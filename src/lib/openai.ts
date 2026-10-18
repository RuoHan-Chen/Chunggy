import OpenAI from "openai";

import { ConfigurationError, getOpenAIEnvironment } from "@/lib/env";

let client: OpenAI | undefined;

const CHUNGGY_INSTRUCTIONS =
  "You are Assurance, a concise and helpful hackathon assistant. Do not claim to have queried the database unless database results are explicitly included in the prompt.";

export function getOpenAIClient() {
  if (!client) {
    const env = getOpenAIEnvironment();
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return client;
}

export async function createOpenAIResponse(message: string) {
  const env = getOpenAIEnvironment();

  if (!env.model) {
    throw new ConfigurationError(["OPENAI_MODEL"]);
  }

  const completion = await getOpenAIClient().chat.completions.create({
    model: env.model,
    messages: [
      { role: "system", content: CHUNGGY_INSTRUCTIONS },
      { role: "user", content: message },
    ],
    max_completion_tokens: 500,
  });
  const text = completion.choices[0]?.message?.content?.trim() ?? "";

  if (!text) {
    throw new Error("OpenAI returned an empty chat response.");
  }

  return {
    id: completion.id,
    model: completion.model,
    text,
  };
}
