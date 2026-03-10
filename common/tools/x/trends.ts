/**
 * X API Trends Tools
 * Tools for retrieving trending topics
 */

import { tool } from "ai";
import { z } from "zod";
import { getXClient, safeApiCall } from "./client.js";

// ============================================================================
// Common WOEIDs Reference
// ============================================================================

/**
 * Common Where On Earth IDs (WOEIDs) for trend lookups
 * See: https://developer.x.com/en/docs/twitter-api/trends/api-reference
 */
export const COMMON_WOEIDS = {
  WORLDWIDE: 1,
  UNITED_STATES: 23424977,
  UNITED_KINGDOM: 23424975,
  CANADA: 23424775,
  AUSTRALIA: 23424748,
  INDIA: 23424848,
  JAPAN: 23424856,
  GERMANY: 23424829,
  FRANCE: 23424819,
  BRAZIL: 23424768,
  // Major US Cities
  NEW_YORK: 2459115,
  LOS_ANGELES: 2442047,
  CHICAGO: 2379574,
  SAN_FRANCISCO: 2487956,
  MIAMI: 2450022,
  SEATTLE: 2490383,
  // Tech Hubs
  SILICON_VALLEY: 2487956, // San Francisco
  AUSTIN: 2357536,
} as const;

// ============================================================================
// Get Trends by WOEID
// ============================================================================

export const getTrendsByWoeid = tool({
  description: `Get trending topics for a specific location by WOEID (Where On Earth ID). 
Common WOEIDs: 
- 1 (Worldwide)
- 23424977 (United States)
- 23424975 (United Kingdom)
- 2459115 (New York)
- 2487956 (San Francisco)`,
  inputSchema: z.object({
    woeid: z
      .number()
      .describe("Where On Earth ID for the location"),
  }),
  execute: async (input) => {
    return safeApiCall(async () => {
      const client = getXClient();
      return client.trends.getByWoeid(input.woeid);
    }, "getTrendsByWoeid");
  },
});

// ============================================================================
// Export All Trends Tools
// ============================================================================

export const trendTools = {
  getTrendsByWoeid,
};
