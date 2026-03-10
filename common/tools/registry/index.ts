/**
 * Registry Tools
 *
 * Tools for interacting with the Basemarket Registry API.
 */

// Client functions (for direct use)
export {
  // Configuration
  configureRegistry,
  getRegistryUrl,
  hasAgentToken,

  // Market Queries
  marketExists,
  checkMarketsExist,
  getMarket,
  listMarkets,
  searchMarkets,

  // Stats
  getRegistryStats,
  isRegistryHealthy,

  // Resolution Operations
  getPendingResolutions,
  getOverdueMarkets,
  resolveMarket,
  batchResolveMarkets,
  getResolutionStats,

  // Types
  type MarketSummary,
  type RegistryStats,
  type PendingMarketSummary,
  type ResolutionEvidence,
} from "./client.js";

// AI SDK Tools (for agent use)
export {
  searchExistingMarkets,
  getMarketDetails,
  getRegistryStatsTool,
  registryTools,
} from "./tools.js";
