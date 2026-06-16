import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import OpenAI from "openai";

/**
 * Single source of truth for the OpenAI model used across the app.
 * Change this one value to switch models everywhere (chat, coach, AI-title).
 */
export const DEFAULT_MODEL = "gpt-5.4-mini";

let aiSdkClient: ReturnType<typeof createOpenAI> | null = null;
let openaiClient: OpenAI | null = null;

/** Vercel AI SDK client — for streamText / generateObject. */
export function getAiSdkClient() {
  if (!aiSdkClient) {
    aiSdkClient = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return aiSdkClient;
}

/** Raw OpenAI SDK client — for chat.completions.create. */
export function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}
