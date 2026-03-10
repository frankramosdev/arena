/**
 * Registry AI SDK Tools
 * 
 * AI-callable tools for searching and querying existing markets.
 * The agent uses these to check for duplicates before generating new markets.
 */

import { tool } from "ai";
import { z } from "zod";
import { listMarkets, getMarket, getRegistryStats, type MarketSummary } from "./client.js";

// =============================================================================
// Search Existing Markets Tool
// =============================================================================

export const searchExistingMarkets = tool({
  description: `Search for existing prediction markets in the registry. 
Use this BEFORE generating new markets to avoid creating duplicates.
Search by keywords in the question text, filter by status and tags.
Returns matching markets with their current prices and volume.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe("Search term to match against market questions. Leave empty to list all."),
    status: z
      .array(z.enum(["OPEN", "HALTED", "RESOLVED", "INVALIDATED"]))
      .optional()
      .describe("Filter by market status. Default: all statuses."),
    tags: z
      .array(z.string())
      .optional()
      .describe("Filter by tags (e.g., 'crypto', 'politics', 'sports')"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Max results to return. Default: 20"),
  }),
  execute: async (input: {
    query?: string;
    status?: ("OPEN" | "HALTED" | "RESOLVED" | "INVALIDATED")[];
    tags?: string[];
    limit?: number;
  }) => {
    const result = await listMarkets({
      status: input.status,
      tags: input.tags,
      limit: input.limit || 20,
    });

    if (result.error) {
      return { error: result.error, markets: [] as MarketSummary[], total: 0 };
    }

    let markets = result.markets || [];

    // Client-side filter by query if provided
    if (input.query) {
      const queryLower = input.query.toLowerCase();
      markets = markets.filter((m) =>
        m.question.toLowerCase().includes(queryLower)
      );
    }

    return {
      total: markets.length,
      markets: markets.map((m) => ({
        id: m.id,
        question: m.question,
        status: m.status,
        yesPrice: m.yesPrice,
        noPrice: m.noPrice,
        volume: m.volume,
        resolutionDate: m.resolutionDate,
      })),
    };
  },
});

// =============================================================================
// Get Market Details Tool
// =============================================================================

export const getMarketDetails = tool({
  description: `Get detailed information about a specific market by its ID.
Use this to check if a market with a specific ID already exists.`,
  inputSchema: z.object({
    marketId: z.string().describe("The market ID to lookup"),
  }),
  execute: async (input: { marketId: string }) => {
    const result = await getMarket(input.marketId);

    if (result.error) {
      return { exists: false, error: result.error, market: null };
    }

    return {
      exists: true,
      market: result.market,
      error: null,
    };
  },
});

// =============================================================================
// Get Registry Stats Tool
// =============================================================================

export const getRegistryStatsTool = tool({
  description: `Get current statistics from the prediction market registry.
Returns total markets, open markets, volume, and trader counts.`,
  inputSchema: z.object({}),
  execute: async () => {
    const result = await getRegistryStats();

    if (result.error) {
      return { 
        error: result.error, 
        totalMarkets: 0,
        openMarkets: 0,
        resolvedMarkets: 0,
        totalVolume: 0,
        totalTrades: 0,
        totalTraders: 0,
      };
    }

    return {
      error: null,
      ...result.stats,
    };
  },
});

// =============================================================================
// Combined Tool Set
// =============================================================================

/**
 * All registry tools for market search/lookup
 * 
 * @example
 * ```typescript
 * import { registryTools } from "@sigarena/common";
 * 
 * const { text } = await generateText({
 *   model: someModel,
 *   tools: { ...registryTools },
 *   prompt: "Search for existing crypto markets"
 * });
 * ```
 */
export const registryTools = {
  searchExistingMarkets,
  getMarketDetails,
  getRegistryStatsTool,
};
