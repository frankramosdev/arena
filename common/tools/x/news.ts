/**
 * X API News Tools
 * Tools for searching and retrieving news stories
 */

import { tool } from "ai";
import { z } from "zod";
import { getXClient, safeApiCall } from "./client.js";

// ============================================================================
// Get News Story by ID
// ============================================================================

export const getNewsStoryById = tool({
  description: "Get a news story by its ID.",
  inputSchema: z.object({
    id: z.string().describe("News story ID"),
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.news.get(input.id);
    }, "getNewsStoryById");
  },
});

// ============================================================================
// Search News
// ============================================================================

export const searchNews = tool({
  description:
    "Search for news stories matching a query. Returns relevant news articles.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe("Search query for news stories"),
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.news.search(input.query);
    }, "searchNews");
  },
});

// ============================================================================
// Export All News Tools
// ============================================================================

export const newsTools = {
  getNewsStoryById,
  searchNews,
};
