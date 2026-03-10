/**
 * X API Users Tools
 * Tools for looking up and analyzing user profiles
 */

import { tool } from "ai";
import { z } from "zod";
import { getXClient, safeApiCall } from "./client.js";
import { TweetFieldsSchema, UserFieldsSchema } from "./schemas.js";

// ============================================================================
// Get Users by IDs
// ============================================================================

export const getUsersByIds = tool({
  description: "Lookup multiple users by their IDs.",
  inputSchema: z.object({
    ids: z
      .array(z.string())
      .min(1)
      .max(100)
      .describe("Array of User IDs to lookup (max 100)"),
    userFields: UserFieldsSchema,
    tweetFields: TweetFieldsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.users.getByIds(input.ids, {
        userFields: input.userFields,
        tweetFields: input.tweetFields,
      });
    }, "getUsersByIds");
  },
});

// ============================================================================
// Get Users by Usernames
// ============================================================================

export const getUsersByUsernames = tool({
  description: "Lookup multiple users by their usernames (handles).",
  inputSchema: z.object({
    usernames: z
      .array(z.string())
      .min(1)
      .max(100)
      .describe("Array of usernames to lookup without @ symbol (max 100)"),
    userFields: UserFieldsSchema,
    tweetFields: TweetFieldsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.users.getByUsernames(input.usernames, {
        userFields: input.userFields,
        tweetFields: input.tweetFields,
      });
    }, "getUsersByUsernames");
  },
});

// ============================================================================
// Get User by ID
// ============================================================================

export const getUserById = tool({
  description: "Get a single user by their ID.",
  inputSchema: z.object({
    id: z.string().describe("User ID"),
    userFields: UserFieldsSchema,
    tweetFields: TweetFieldsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.users.getById(input.id, {
        userFields: input.userFields,
        tweetFields: input.tweetFields,
      });
    }, "getUserById");
  },
});

// ============================================================================
// Get User by Username
// ============================================================================

export const getUserByUsername = tool({
  description: "Get a single user by their username (handle).",
  inputSchema: z.object({
    username: z.string().describe("Username without @ symbol"),
    userFields: UserFieldsSchema,
    tweetFields: TweetFieldsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.users.getByUsername(input.username, {
        userFields: input.userFields,
        tweetFields: input.tweetFields,
      });
    }, "getUserByUsername");
  },
});

// ============================================================================
// Get User Followers
// ============================================================================

export const getUserFollowers = tool({
  description: "Get followers of a user.",
  inputSchema: z.object({
    userId: z.string().describe("User ID"),
    maxResults: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .describe("Maximum results (1-1000)"),
    userFields: UserFieldsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.users.getFollowers(input.userId, {
        maxResults: input.maxResults,
        userFields: input.userFields,
      });
    }, "getUserFollowers");
  },
});

// ============================================================================
// Get User Following
// ============================================================================

export const getUserFollowing = tool({
  description: "Get users that a specific user is following.",
  inputSchema: z.object({
    userId: z.string().describe("User ID"),
    maxResults: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .describe("Maximum results (1-1000)"),
    userFields: UserFieldsSchema,
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.users.getFollowing(input.userId, {
        maxResults: input.maxResults,
        userFields: input.userFields,
      });
    }, "getUserFollowing");
  },
});

// ============================================================================
// Export All User Tools
// ============================================================================

export const userTools = {
  getUsersByIds,
  getUsersByUsernames,
  getUserById,
  getUserByUsername,
  getUserFollowers,
  getUserFollowing,
};
