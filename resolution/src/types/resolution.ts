/**
 * Resolution Types
 *
 * Core types for market resolution.
 */

import { z } from "zod";

// ============================================================================
// CONSTANTS
// ============================================================================

export const RESOLUTION_OUTCOMES = ["YES", "NO", "INVALID"] as const;
export type ResolutionOutcome = (typeof RESOLUTION_OUTCOMES)[number];

export const EVIDENCE_TYPES = [
  "tweet",           // Found tweet matching criteria
  "no_tweet",        // No tweet found (negative verification)
  "engagement",      // Engagement threshold check
  "follower_count",  // Follower milestone check
  "account_action",  // Account action (reply, follow, etc)
  "api_error",       // Could not verify due to API issues
  "invalid_market",  // Market criteria could not be verified
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Evidence found during resolution
 */
export const ResolutionEvidenceSchema = z.object({
  /** Type of evidence */
  type: z.enum(EVIDENCE_TYPES),
  
  /** URL to the evidence (tweet, profile, etc) */
  url: z.string().nullish(),
  
  /** Tweet ID if applicable */
  tweetId: z.string().nullish(),
  
  /** Raw data from X API */
  data: z.record(z.unknown()).nullish(),
  
  /** Human-readable explanation */
  explanation: z.string(),
  
  /** Confidence level 0-1 */
  confidence: z.number().min(0).max(1),
});

export type ResolutionEvidence = z.infer<typeof ResolutionEvidenceSchema>;

/**
 * Result of resolving a single market
 */
export const ResolutionResultSchema = z.object({
  /** Market ID */
  marketId: z.string(),
  
  /** Resolved outcome */
  outcome: z.enum(RESOLUTION_OUTCOMES),
  
  /** Evidence supporting the resolution */
  evidence: ResolutionEvidenceSchema,
  
  /** When resolution was determined */
  resolvedAt: z.string().datetime(),
});

export type ResolutionResult = z.infer<typeof ResolutionResultSchema>;

/**
 * Market pending resolution (from registry)
 */
export const PendingMarketSchema = z.object({
  id: z.string(),
  question: z.string(),
  description: z.string(),
  resolutionDate: z.string(),
  status: z.string(),
  verification: z.object({
    type: z.string(),
    targetHandles: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    threshold: z.number().optional(),
    resolutionCriteria: z.string(),
  }),
});

export type PendingMarket = z.infer<typeof PendingMarketSchema>;

/**
 * Request for early resolution
 */
export const EarlyResolutionRequestSchema = z.object({
  marketId: z.string(),
  reason: z.string(),
  evidence: z.object({
    url: z.string().optional(),
    explanation: z.string(),
  }).optional(),
});

export type EarlyResolutionRequest = z.infer<typeof EarlyResolutionRequestSchema>;
