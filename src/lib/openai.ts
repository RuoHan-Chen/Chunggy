import OpenAI from "openai";

import { getOpenAIEnvironment } from "@/lib/env";

let client: OpenAI | undefined;

export function getOpenAIClient() {
  if (!client) {
    const env = getOpenAIEnvironment();
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return client;
}
