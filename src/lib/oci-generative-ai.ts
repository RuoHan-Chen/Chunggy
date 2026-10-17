import OpenAI from "openai";

import { getOciGenerativeAiEnvironment } from "@/lib/env";

let client: OpenAI | undefined;

export function getOciGenerativeAiClient() {
  if (!client) {
    const env = getOciGenerativeAiEnvironment();

    client = new OpenAI({
      apiKey: env.OCI_GENAI_API_KEY,
      baseURL: `https://inference.generativeai.${env.OCI_GENAI_REGION}.oci.oraclecloud.com/openai/v1`,
      project: env.OCI_GENAI_PROJECT_ID,
      maxRetries: 1,
      timeout: 30_000,
    });
  }

  return client;
}

export async function createOracleAiResponse(message: string) {
  const env = getOciGenerativeAiEnvironment();
  const response = await getOciGenerativeAiClient().responses.create({
    model: env.OCI_GENAI_MODEL,
    instructions:
      "You are Chunggy, a concise and helpful hackathon assistant. Do not claim to have queried the database unless database results are explicitly included in the prompt.",
    input: message,
    max_output_tokens: 500,
  });

  return {
    id: response.id,
    model: env.OCI_GENAI_MODEL,
    text: response.output_text,
  };
}
