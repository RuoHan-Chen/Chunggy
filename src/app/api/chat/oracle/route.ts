import { auth } from "@/auth";
import { ConfigurationError } from "@/lib/env";
import { createOracleAiResponse } from "@/lib/oci-generative-ai";

const MAX_MESSAGE_LENGTH = 4_000;

export async function POST(request: Request) {
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
    const result = await createOracleAiResponse(message);

    return Response.json({
      provider: "oci-generative-ai",
      ...result,
    });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return Response.json(
        {
          error: "not_configured",
          missing: error.missingVariables,
        },
        { status: 503 },
      );
    }

    console.error("OCI Generative AI request failed");
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }
}

function getMessage(body: unknown) {
  if (!body || typeof body !== "object" || !("message" in body)) {
    return undefined;
  }

  const { message } = body as { message?: unknown };
  return typeof message === "string" ? message.trim() : undefined;
}
