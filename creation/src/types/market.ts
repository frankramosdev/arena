/**
 * Market Types
 *
 * Core market schemas for prediction markets.
 */

import { z } from "zod";
import { VerificationMethodSchema } from "./verification.js";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Market resolution timeframes
 */
export const TIMEFRAMES = [
  "end_of_today",
  "tomorrow",
  "few_days",
  "end_of_week",
] as const;

export type ResolutionTimeframe = (typeof TIMEFRAMES)[number];

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Source of market inspiration (tweet, article, etc)
 */
export const MarketSourceSchema = z.object({
  url: z.string().optional(),
  handle: z.string().optional(),
  snippet: z.string().optional(),
});

export type MarketSource = z.infer<typeof MarketSourceSchema>;

/**
 * Schema for LLM-generated market (without auto-generated fields)
 *
 * This is what the AI model outputs. The agent adds id/createdAt.
 */
export const GeneratedMarketSchema = z.object({
  /** The market question (e.g., "Will @elonmusk tweet about Grok today?") */
  question: z.string(),

  /** Detailed description with context */
  description: z.string(),

  /** When this market resolves (ISO datetime) */
  resolutionDate: z.string().datetime(),

  /** Timeframe category */
  timeframe: z.enum(TIMEFRAMES),

  /** How to verify the outcome */
  verification: VerificationMethodSchema,

  /** Source tweets/URLs that inspired this market */
  sources: z.array(MarketSourceSchema),

  /** Tags for categorization */
  tags: z.array(z.string()),
});

export type GeneratedMarket = z.infer<typeof GeneratedMarketSchema>;

/**
 * Full market with auto-generated fields
 *
 * This is the final market object stored in the registry.
 */
export const MarketSchema = GeneratedMarketSchema.extend({
  /** Unique identifier (auto-generated) */
  id: z.string(),

  /** When this market was created (auto-generated) */
  createdAt: z.string().datetime(),
});

export type Market = z.infer<typeof MarketSchema>;

/**
 * Batch of markets from a single generation run
 */
export const MarketBatchSchema = z.object({
  generatedAt: z.string().datetime(),
  markets: z.array(MarketSchema),
  searchContext: z.string(),
});

export type MarketBatch = z.infer<typeof MarketBatchSchema>;

