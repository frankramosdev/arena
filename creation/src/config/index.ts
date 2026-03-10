/**
 * Configuration
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load from root .env first, then local .env
config({ path: resolve(process.cwd(), "../.env") });
config({ path: resolve(process.cwd(), ".env") });

export const CONFIG = {
  xai: {
    apiKey: process.env.XAI_API_KEY || "",
    model: "grok-4-1-fast-reasoning" as const,
  },

  generation: {
    intervalMs: parseInt(process.env.GENERATION_INTERVAL_MS || "3600000", 10),
    maxMarketsPerRun: parseInt(process.env.MAX_MARKETS_PER_RUN || "5", 10),
  },
} as const;

export function validateConfig(): void {
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY environment variable is required");
  }
}
