/**
 * Basemarket - Creation Agent
 *
 * Generates X/Twitter-specific prediction markets using xAI's agentic tools.
 *
 * @example
 * ```typescript
 * import { CreationAgent } from "@sigarena/creation";
 * const agent = new CreationAgent();
 * const markets = await agent.runGenerationCycle();
 * ```
 */

export { CreationAgent } from "./agent/index.js";

export type {
  Market,
  GeneratedMarket,
  MarketBatch,
  MarketSource,
  ResolutionTimeframe,
  VerificationMethod,
  VerificationType,
  GenerationConfig,
} from "./types/index.js";

export {
  MarketSchema,
  GeneratedMarketSchema,
  MarketBatchSchema,
  MarketSourceSchema,
  VerificationMethodSchema,
  TIMEFRAMES,
  VERIFICATION_TYPES,
  DEFAULT_GENERATION_CONFIG,
} from "./types/index.js";

export {
  generateMarketId,
  generateAgentId,
  generateOrderId,
  getDateContext,
  createLogger,
} from "./utils/index.js";

export { CONFIG, validateConfig } from "./config/index.js";
