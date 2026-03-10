// =============================================================================
// Basemarket - Market Registry
// =============================================================================
//
// Polymarket-style prediction market exchange with SQLite persistence.
//
// Token Model:
//   - 1 YES + 1 NO = $1 (always)
//   - MINT:   $X → X YES + X NO
//   - REDEEM: X YES + X NO → $X
//   - SETTLE: Winning token = $1, losing = $0
//
// All markets start at 50/50 odds. Let the market discover the price.
//
// =============================================================================

// Core classes
export { MarketRegistry } from "./registry.js";
export { MarketStorage, createTestStorage } from "./storage/index.js";
export { ResolutionAgent } from "./resolution.js";
export type { ResolutionInput } from "./resolution.js";

// API
export { api, registry, resolutionAgent } from "./api/index.js";

// Types
export type {
  // Core types
  MarketStatus,
  TokenType,
  OrderType,
  OrderStatus,

  // User & Auth
  UserRole,
  User,

  // Verification
  VerificationMethod,

  // Market
  TokenSupply,
  MarketPrices,
  VolumeStats,
  PricePoint,
  MarketSource,
  RegistryMarket,
  ResolutionProof,

  // Orders & Trading
  Order,
  Trade,
  BookLevel,
  TokenOrderBook,
  MarketOrderBook,

  // Trader
  Trader,
  Position,

  // API inputs
  CreateMarketInput,
  MintInput,
  RedeemInput,
  PlaceOrderInput,
  MarketFilters,
  MarketList,
  SettlementResult,
} from "./types.js";
