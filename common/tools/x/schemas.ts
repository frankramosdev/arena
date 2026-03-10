/**
 * X API Shared Schemas
 * Common Zod schemas for tweet fields, user fields, and expansions
 */

import { z } from "zod";

// ============================================================================
// Tweet Fields
// ============================================================================

export const TweetFieldsSchema = z
  .array(
    z.enum([
      "attachments",
      "author_id",
      "context_annotations",
      "conversation_id",
      "created_at",
      "entities",
      "geo",
      "id",
      "in_reply_to_user_id",
      "lang",
      "public_metrics",
      "possibly_sensitive",
      "referenced_tweets",
      "reply_settings",
      "source",
      "text",
      "withheld",
    ])
  )
  .optional()
  .describe("Tweet fields to include in the response");

export type TweetFields = z.infer<typeof TweetFieldsSchema>;

// ============================================================================
// User Fields
// ============================================================================

export const UserFieldsSchema = z
  .array(
    z.enum([
      "created_at",
      "description",
      "entities",
      "id",
      "location",
      "name",
      "pinned_tweet_id",
      "profile_image_url",
      "protected",
      "public_metrics",
      "url",
      "username",
      "verified",
      "withheld",
    ])
  )
  .optional()
  .describe("User fields to include in the response");

export type UserFields = z.infer<typeof UserFieldsSchema>;

// ============================================================================
// Expansions
// ============================================================================

export const ExpansionsSchema = z
  .array(
    z.enum([
      "author_id",
      "referenced_tweets.id",
      "referenced_tweets.id.author_id",
      "entities.mentions.username",
      "attachments.poll_ids",
      "attachments.media_keys",
      "in_reply_to_user_id",
      "geo.place_id",
    ])
  )
  .optional()
  .describe("Expansions to include in the response");

export type Expansions = z.infer<typeof ExpansionsSchema>;

// ============================================================================
// Granularity
// ============================================================================

export const GranularitySchema = z
  .enum(["minute", "hour", "day"])
  .describe("Time granularity for counts");

export type Granularity = z.infer<typeof GranularitySchema>;
