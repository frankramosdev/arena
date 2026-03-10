/**
 * X API Posts/Tweets Tools
 * Tools for searching, retrieving, and analyzing tweets
 */

import { tool } from "ai";
import { z } from "zod";
import { getXClient, safeApiCall } from "./client.js";
import {
  TweetFieldsSchema,
  UserFieldsSchema,
  ExpansionsSchema,
} from "./schemas.js";

// ============================================================================
// Get Tweets by IDs
// ============================================================================

export const getTweets = tool({
  description:
    "Lookup one or more Tweets by their IDs. Returns detailed tweet data including text, author, metrics, etc.",
  inputSchema: z.object({
    ids: z
      .array(z.string())
      .min(1)
      .max(100)
      .describe("Array of Tweet IDs to lookup (max 100)"),
    tweetFields: TweetFieldsSchema,
    userFields: UserFieldsSchema,
    expansions: ExpansionsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.posts.getByIds(input.ids, {
        tweetFields: input.tweetFields,
        userFields: input.userFields,
        expansions: input.expansions,
      });
    }, "getTweets");
  },
});

// ============================================================================
// Get Tweet by ID
// ============================================================================

export const getTweetById = tool({
  description: "Get a single tweet by its ID with detailed information.",
  inputSchema: z.object({
    id: z.string().describe("Tweet ID"),
    tweetFields: TweetFieldsSchema,
    userFields: UserFieldsSchema,
    expansions: ExpansionsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.posts.getById(input.id, {
        tweetFields: input.tweetFields,
        userFields: input.userFields,
        expansions: input.expansions,
      });
    }, "getTweetById");
  },
});

// ============================================================================
// Search Recent Tweets
// ============================================================================

export const searchRecentTweets = tool({
  description:
    "Search for tweets from the last 7 days matching a query. Supports complex search operators like 'from:', 'to:', '#hashtag', '@mention', 'has:media', etc.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .max(512)
      .describe("Search query with optional operators"),
    maxResults: z
      .number()
      .min(10)
      .max(100)
      .optional()
      .default(10)
      .describe("Maximum results to return (10-100)"),
    startTime: z
      .string()
      .optional()
      .describe("Start time for search (ISO 8601 format)"),
    endTime: z
      .string()
      .optional()
      .describe("End time for search (ISO 8601 format)"),
    tweetFields: TweetFieldsSchema,
    userFields: UserFieldsSchema,
    expansions: ExpansionsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.posts.searchRecent(input.query, {
        maxResults: input.maxResults,
        startTime: input.startTime,
        endTime: input.endTime,
        tweetFields: input.tweetFields,
        userFields: input.userFields,
        expansions: input.expansions,
      });
    }, "searchRecentTweets");
  },
});

// ============================================================================
// Get Quote Tweets
// ============================================================================

export const getQuoteTweets = tool({
  description: "Get tweets that quote a specific tweet.",
  inputSchema: z.object({
    id: z.string().describe("Tweet ID to get quotes for"),
    maxResults: z.number().min(10).max(100).optional().default(10),
    tweetFields: TweetFieldsSchema,
    userFields: UserFieldsSchema,
    expansions: ExpansionsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.posts.getQuoted(input.id, {
        maxResults: input.maxResults,
        tweetFields: input.tweetFields,
        userFields: input.userFields,
        expansions: input.expansions,
      });
    }, "getQuoteTweets");
  },
});

// ============================================================================
// Get Reposted By (Who Retweeted)
// ============================================================================

export const getRepostedBy = tool({
  description: "Get users who reposted (retweeted) a specific tweet.",
  inputSchema: z.object({
    id: z.string().describe("Tweet ID"),
    maxResults: z.number().min(1).max(100).optional().default(100),
    userFields: UserFieldsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.posts.getRepostedBy(input.id, {
        maxResults: input.maxResults,
        userFields: input.userFields,
      });
    }, "getRepostedBy");
  },
});

// ============================================================================
// Export All Posts Tools
// ============================================================================

export const postTools = {
  getTweets,
  getTweetById,
  searchRecentTweets,
  getQuoteTweets,
  getRepostedBy,
};
