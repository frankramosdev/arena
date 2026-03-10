/**
 * Verification Types
 *
 * Defines how markets can be verified via Twitter/X API.
 * All markets must have an objective verification method.
 */

import { z } from "zod";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Supported verification types
 *
 * - tweet_exists: Check if account posted about something
 * - tweet_count: Count tweets matching criteria
 * - engagement_threshold: Check likes/retweets/views
 * - follower_milestone: Check follower count
 * - account_action: Check for specific action (reply, quote, etc)
 */
export const VERIFICATION_TYPES = [
  "tweet_exists",
  "tweet_count",
  "engagement_threshold",
  "follower_milestone",
  "account_action",
] as const;

export type VerificationType = (typeof VERIFICATION_TYPES)[number];

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Schema for market verification method
 *
 * Defines HOW a market will be verified when it resolves.
 * Resolution agent uses this to determine YES/NO outcome.
 */
export const VerificationMethodSchema = z.object({
  /** Type of verification to perform */
  type: z.enum(VERIFICATION_TYPES),

  /** X handles to monitor (without @) */
  targetHandles: z.array(z.string()).nullish(),

  /** Keywords to search for in tweets */
  keywords: z.array(z.string()).nullish(),

  /** Numeric threshold (for count/engagement types) */
  threshold: z.number().nullish(),

  /** Human-readable description of resolution criteria */
  resolutionCriteria: z.string(),
});

export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

