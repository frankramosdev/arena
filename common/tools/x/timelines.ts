/**
 * X API Timeline Tools
 * Tools for retrieving user tweet timelines and mentions
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
// Get User Tweets (Timeline)
// ============================================================================

export const getUserTweets = tool({
  description:
    "Get tweets authored by a specific user. Returns their tweet timeline.",
  inputSchema: z.object({
    userId: z.string().describe("User ID"),
    maxResults: z
      .number()
      .min(5)
      .max(100)
      .optional()
      .default(10)
      .describe("Maximum results (5-100)"),
    startTime: z
      .string()
      .optional()
      .describe("Start time (ISO 8601 format)"),
    endTime: z
      .string()
      .optional()
      .describe("End time (ISO 8601 format)"),
    tweetFields: TweetFieldsSchema,
    userFields: UserFieldsSchema,
    expansions: ExpansionsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.users.getPosts(input.userId, {
        maxResults: input.maxResults,
        startTime: input.startTime,
        endTime: input.endTime,
        tweetFields: input.tweetFields,
        userFields: input.userFields,
        expansions: input.expansions,
      });
    }, "getUserTweets");
  },
});

// ============================================================================
// Get User Mentions
// ============================================================================

export const getUserMentions = tool({
  description: "Get tweets that mention a specific user.",
  inputSchema: z.object({
    userId: z.string().describe("User ID"),
    maxResults: z
      .number()
      .min(5)
      .max(100)
      .optional()
      .default(10)
      .describe("Maximum results (5-100)"),
    startTime: z
      .string()
      .optional()
      .describe("Start time (ISO 8601 format)"),
    endTime: z
      .string()
      .optional()
      .describe("End time (ISO 8601 format)"),
    tweetFields: TweetFieldsSchema,
    userFields: UserFieldsSchema,
    expansions: ExpansionsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.users.getMentions(input.userId, {
        maxResults: input.maxResults,
        startTime: input.startTime,
        endTime: input.endTime,
        tweetFields: input.tweetFields,
        userFields: input.userFields,
        expansions: input.expansions,
      });
    }, "getUserMentions");
  },
});

// ============================================================================
// Export All Timeline Tools
// ============================================================================

export const timelineTools = {
  getUserTweets,
  getUserMentions,
};
