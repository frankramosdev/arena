/**
 * Basemarket Trading Service
 *
 * Agent-to-agent trading with personalities.
 */

// Types
export * from "./types/index.js";

// Agents
export {
  PRESET_PERSONALITIES,
  AgentFactory,
  getAgentFactory,
  AgentRunner,
  getAgentRunner,
} from "./agents/index.js";

// Storage
export { TradingStorage, getTradingStorage } from "./storage/index.js";

// Coordinator
export {
  TradingCoordinator,
  getTradingCoordinator,
} from "./coordinator/index.js";

// Registry Integration
export * from "./registry/index.js";

// API
export { api } from "./api/index.js";
