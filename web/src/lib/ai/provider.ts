import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// The Zen gateway rejects requests without this header ("MissingSessionID") —
// it uses the value to route a conversation to a warm backend. One id per
// server process is enough; it only has to be stable, not per-user.
const SESSION_ID = randomUUID();

const opencode = createOpenAICompatible({
  name: "opencode",
  baseURL: "https://opencode.ai/zen/go/v1",
  apiKey: process.env.OPENCODE_API_KEY,
  headers: { "x-opencode-session": SESSION_ID },
});

// One model for everything. deepseek-v4-pro was measured against
// glm-5.3-flash on skill extraction and produced equivalent output (17 vs 18
// skills) while taking two to five times as long, so there is nothing here for
// a second, slower tier to do.
export const models = {
  fast: opencode("glm-5.3-flash"),
} as const;

// Every model on this gateway reasons by default and none allow disabling it
// outright, which pushes time-to-first-token past 10s. "low" keeps the latency
// budget in range for the interactive, streamed analyses.
export const FAST_OPTIONS = {
  opencode: { reasoningEffort: "low" },
} as const;
