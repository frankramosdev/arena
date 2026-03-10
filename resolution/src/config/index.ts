/**
 * Resolution Agent Configuration
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

  resolution: {
    checkIntervalMs: parseInt(process.env.RESOLUTION_CHECK_INTERVAL_MS || "60000", 10),
    monitorHoursAhead: parseInt(process.env.RESOLUTION_MONITOR_HOURS || "24", 10),
    batchSize: parseInt(process.env.RESOLUTION_BATCH_SIZE || "10", 10),
    retryDelayMs: parseInt(process.env.RESOLUTION_RETRY_DELAY_MS || "300000", 10),
    maxRetries: parseInt(process.env.RESOLUTION_MAX_RETRIES || "3", 10),
  },

  api: {
    port: parseInt(process.env.RESOLUTION_API_PORT || "3200", 10),
  },
} as const;

export function validateConfig(): void {
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY environment variable is required");
  }
}
