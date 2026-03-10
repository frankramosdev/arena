/**
 * Configuration Types
 *
 * Types for agent configuration.
 */

import type { ResolutionTimeframe } from "./market.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for market generation
 */
export interface GenerationConfig {
  /** Number of markets to generate per run */
  marketsPerRun: number;

  /** How many markets of each timeframe to generate */
  timeframeDistribution: Record<ResolutionTimeframe, number>;

  /** X handles to prioritize (high signal accounts) */
  priorityHandles: string[];

  /** Topics to focus on */
  priorityTopics: string[];

  /** Minimum engagement for source tweets */
  minEngagement: {
    likes: number;
    retweets: number;
    views: number;
  };
}

// ============================================================================
// DEFAULTS
// ============================================================================

/**
 * Default configuration for the creation agent
 */
export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  marketsPerRun: 5,

  timeframeDistribution: {
    end_of_today: 1,
    tomorrow: 1,
    few_days: 2,
    end_of_week: 1,
  },

  priorityHandles: [
    "elonmusk",
    "xai",
    "sama",
    "ylecun",
    "karpathy",
    "naval",
    "gajesh",
    "tbpn",
  ],

  priorityTopics: [
    "AI announcements",
    "product launches",
    "funding rounds",
    "tech drama",
    "viral tweets",
    "crypto/web3",
    "spacex",
    "tesla",
  ],

  minEngagement: {
    likes: 10,
    retweets: 1,
    views: 10000,
  },
};
