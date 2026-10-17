import * as common from "oci-common";
import * as generativeaiinference from "oci-generativeaiinference";

import { getOciGenerativeAiEnvironment } from "@/lib/env";

let clientPromise:
  | Promise<generativeaiinference.GenerativeAiInferenceClient>
  | undefined;

export function getOciGenerativeAiClient() {
  if (!clientPromise) {
    clientPromise = createClient();
  }

  return clientPromise;
}

export async function createOracleAiResponse(message: string) {
  const env = getOciGenerativeAiEnvironment();
  const client = await getOciGenerativeAiClient();
  const chatDetails: generativeaiinference.models.ChatDetails = {
    compartmentId: env.OCI_GENAI_COMPARTMENT_ID,
    servingMode: {
      servingType: "ON_DEMAND",
      modelId: env.OCI_GENAI_MODEL_ID,
    },
    chatRequest: {
      apiFormat: "GENERIC",
      messages: [
        {
          role: "SYSTEM",
          content: [
            {
              type: "TEXT",
              text: "You are Chunggy, a concise and helpful hackathon assistant. Do not claim to have queried the database unless database results are explicitly included in the prompt.",
            } as generativeaiinference.models.TextContent,
          ],
        },
        {
          role: "USER",
          content: [
            {
              type: "TEXT",
              text: message,
            } as generativeaiinference.models.TextContent,
          ],
        },
      ],
      maxTokens: 500,
      temperature: 0.2,
    },
  };
  const response = await client.chat({
    chatDetails,
  });

  if (!response || !("chatResult" in response)) {
    throw new Error("OCI returned an unsupported streaming response.");
  }

  const chatResponse = response.chatResult.chatResponse;

  if (!("choices" in chatResponse)) {
    throw new Error("OCI returned an unsupported chat response format.");
  }

  const text =
    chatResponse.choices[0]?.message.content
      ?.map((content) => ("text" in content ? content.text : undefined))
      .filter((content): content is string => Boolean(content))
      .join("\n") ?? "";

  if (!text) {
    throw new Error("OCI returned an empty chat response.");
  }

  return {
    id: response.opcRequestId,
    model: response.chatResult.modelId,
    text,
  };
}

async function createClient() {
  const env = getOciGenerativeAiEnvironment();
  const authenticationDetailsProvider =
    env.authMode === "instance_principal"
      ? await new common.InstancePrincipalsAuthenticationDetailsProviderBuilder().build()
      : new common.ConfigFileAuthenticationDetailsProvider(
          env.configFile,
          env.profile,
        );
  const client = new generativeaiinference.GenerativeAiInferenceClient({
    authenticationDetailsProvider,
  });

  client.regionId = env.OCI_GENAI_REGION;
  return client;
}
