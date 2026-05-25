import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const opencode = createOpenAICompatible({
  name: "opencode",
  baseURL: "https://opencode.ai/zen/go/v1",
  apiKey: process.env.OPENCODE_API_KEY,
});

export const models = {
  fast: opencode("minimax-m2.7"),
  smart: opencode("deepseek-v4-pro"), 
} as const;
