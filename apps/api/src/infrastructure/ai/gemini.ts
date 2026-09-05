import { GoogleGenAI } from "@google/genai";

import { logger } from "@/common/utils/logger";

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn("GEMINI_API_KEY not set - AI features will be unavailable");
      throw new Error("Gemini API key not configured");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export const GEMINI_MODELS = {
  FLASH: "gemini-2.5-flash",
  PRO: "gemini-2.5-pro-preview-05-06",
} as const;
