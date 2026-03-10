/**
 * X API Tools
 * Complete set of AI SDK tools for X API v2 endpoints
 */

// ============================================================================
// Re-export All Modules
// ============================================================================

export * from "./schemas.js";
export * from "./client.js";
export * from "./posts.js";
export * from "./users.js";
export * from "./timelines.js";
export * from "./trends.js";
export * from "./news.js";

// ============================================================================
// Import Tool Groups
// ============================================================================

import { postTools } from "./posts.js";
import { userTools } from "./users.js";
import { timelineTools } from "./timelines.js";
import { trendTools } from "./trends.js";
import { newsTools } from "./news.js";

// ============================================================================
// Combined Tool Set
// ============================================================================

/**
 * All X API tools bundled for easy consumption by agents
 * 
 * @example
 * ```typescript
 * import { xTools } from "@sigarena/common/tools";
 * 
 * const { text } = await generateText({
 *   model: someModel,
 *   tools: { ...xTools },
 *   prompt: "Search for tweets about AI"
 * });
 * ```
 */
export const xTools = {
  // Posts/Tweets (8 tools)
  ...postTools,

  // Users (6 tools)
  ...userTools,

  // Timelines (2 tools)
  ...timelineTools,

  // Trends (2 tools)
  ...trendTools,

  // News (2 tools)
  ...newsTools,
};

export type XTools = typeof xTools;

// ============================================================================
// Grouped Tool Sets (for selective imports)
// ============================================================================

export { postTools } from "./posts.js";
export { userTools } from "./users.js";
export { timelineTools } from "./timelines.js";
export { trendTools } from "./trends.js";
export { newsTools } from "./news.js";
