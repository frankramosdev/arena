/**
 * Custom Resolution Types
 *
 * Types for ad-hoc resolution requests (testing/debugging).
 */

import { z } from "zod";
import { ResolutionEvidenceSchema, RESOLUTION_OUTCOMES } from "./resolution.js";

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Custom resolution request - for ad-hoc testing
 * 
 * Allows resolving arbitrary conditions without a market in the registry.
 */
export const CustomResolutionRequestSchema = z.object({
  /** The question to resolve */
  question: z.string().min(10).describe("The yes/no question to resolve"),
  
  /** Additional context for the resolution */
  context: z.string().optional().describe("Background context for the question"),
  
  /** Verification type hint */
  verificationType: z.enum([
    "tweet_exists",
    "tweet_count",
    "engagement_threshold",
    "follower_milestone",
    "account_action",
    "general",
  ]).optional().default("general"),
  
  /** Target X handles to focus on */
  targetHandles: z.array(z.string()).optional(),
  
  /** Keywords to search for */
  keywords: z.array(z.string()).optional(),
  
  /** Numeric threshold if applicable */
  threshold: z.number().optional(),
  
  /** Time window for search (ISO date or relative like "24h", "7d") */
  timeWindow: z.string().optional(),
  
  /** Specific resolution criteria */
  resolutionCriteria: z.string().optional(),
});

export type CustomResolutionRequest = z.infer<typeof CustomResolutionRequestSchema>;

/**
 * Custom resolution result
 */
export const CustomResolutionResultSchema = z.object({
  /** The original question */
  question: z.string(),
  
  /** Resolved outcome */
  outcome: z.enum(RESOLUTION_OUTCOMES),
  
  /** Evidence supporting the resolution */
  evidence: ResolutionEvidenceSchema,
  
  /** When resolution was determined */
  resolvedAt: z.string().datetime(),
  
  /** Number of tool calls made */
  toolCalls: z.number(),
  
  /** Model used for resolution */
  model: z.string(),
});

export type CustomResolutionResult = z.infer<typeof CustomResolutionResultSchema>;
