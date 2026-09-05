import Anthropic from "@anthropic-ai/sdk";

import { logger } from "@/common/utils/logger";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.warn("ANTHROPIC_API_KEY not set - ARIA chat will be unavailable");
      throw new Error("Anthropic API key not configured");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const ANTHROPIC_MODELS = {
  CHAT: "claude-sonnet-4-5-20250929",
  TITLE: "claude-haiku-4-5-20251001",
} as const;
