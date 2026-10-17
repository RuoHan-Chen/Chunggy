import { auth } from "@/auth";
import { ConfigurationError } from "@/lib/env";
import { createOracleAiResponse } from "@/lib/oci-generative-ai";
import { createOpenAIResponse } from "@/lib/openai";

const MAX_MESSAGE_LENGTH = 4_000;

export type ChatProvider = "oci" | "openai";

const providers = {
  oci: {
    id: "oci-generative-ai",
    label: "OCI Generative AI",
    create: createOracleAiResponse,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    create: createOpenAIResponse,
  },
} as const;

export async function postChat(request: Request, provider: ChatProvider) {
  const selected = providers[provider];
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = getMessage(body);

  if (!message) {
    return Response.json(
      { error: "invalid_message", message: "Provide a non-empty message." },
      { status: 400 },
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      {
        error: "message_too_long",
        message: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`,
      },
      { status: 413 },
    );
  }

  try {
    const result = await selected.create(message);

    return Response.json({
      provider: selected.id,
      ...result,
    });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return Response.json(
        {
          error: "not_configured",
          missing: error.missingVariables,
          message: `${selected.label} is not configured.`,
        },
        { status: 503 },
      );
    }

    console.error(`${selected.label} request failed`);
    return Response.json(
      {
        error: "upstream_error",
        message: `${selected.label} rejected the request.`,
      },
      { status: 502 },
    );
  }
}

function getMessage(body: unknown) {
  if (!body || typeof body !== "object" || !("message" in body)) {
    return undefined;
  }

  const { message } = body as { message?: unknown };
  return typeof message === "string" ? message.trim() : undefined;
}
