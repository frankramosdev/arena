import { z } from "zod";

// =============================================================================
// POLYMARKET-STYLE TOKEN MODEL
// =============================================================================
//
// Core Invariant: 1 YES + 1 NO = $1 (always)
//
// Operations:
//   MINT:    $1 → 1 YES + 1 NO
//   REDEEM:  1 YES + 1 NO → $1
//   TRADE:   Buy/sell YES or NO tokens on order book
//   SETTLE:  Winning token = $1, losing token = $0
//
// =============================================================================

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Market status lifecycle
 */
export type MarketStatus = "OPEN" | "HALTED" | "RESOLVED_YES" | "RESOLVED_NO" | "INVALID";

/**
 * Token type in a binary market
 */
export type TokenType = "YES" | "NO";

/**
 * Order type
 */
export type OrderType = "LIMIT" | "MARKET";

/**
 * Order status
 */
export type OrderStatus = "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";

// =============================================================================
// VERIFICATION (from creation agent)
// =============================================================================

export const VerificationMethodSchema = z.object({
  type: z.enum([
    "tweet_exists",
    "tweet_count",
    "engagement_threshold",
    "follower_milestone",
    "hashtag_trending",
    "account_action",
  ]),
  targetHandles: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  hashtags: z.array(z.string()).optional(),
  threshold: z.number().optional(),
  resolutionCriteria: z.string(),
});

export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

// =============================================================================
// MARKET
// =============================================================================

/**
 * Token supply state for a market
 * 
 * Invariant: yesSupply === noSupply === collateral
 * (Every $1 deposited creates 1 YES + 1 NO)
 */
export interface TokenSupply {
  /** Total YES tokens in existence */
  yesSupply: number;
  /** Total NO tokens in existence (always equals yesSupply) */
  noSupply: number;
  /** Total collateral locked (always equals yesSupply) */
  collateral: number;
}

/**
 * Current prices derived from order book
 */
export interface MarketPrices {
  /** Last trade price for YES token */
  yesPrice: number;
  /** Last trade price for NO token (= 1 - yesPrice) */
  noPrice: number;
  /** Best bid for YES */
  yesBestBid: number | null;
  /** Best ask for YES */
  yesBestAsk: number | null;
  /** Best bid for NO */
  noBestBid: number | null;
  /** Best ask for NO */
  noBestAsk: number | null;
  /** Last trade timestamp */
  lastTradeAt: string | null;
}

/**
 * Volume statistics
 */
export interface VolumeStats {
  /** Total volume traded (in $) */
  totalVolume: number;
  /** Volume in last 24h */
  volume24h: number;
  /** Number of trades */
  tradeCount: number;
  /** Number of unique traders */
  uniqueTraders: Set<string>;
}

/**
 * Price history entry
 */
export interface PricePoint {
  timestamp: string;
  yesPrice: number;
  volume: number;
}

/**
 * Source reference for market creation
 */
export interface MarketSource {
  url?: string;
  handle?: string;
  snippet?: string;
}

/**
 * Proof of resolution
 */
export interface ResolutionProof {
  resolvedBy: "agent" | "manual";
  outcome: "YES" | "NO";
  timestamp: string;
  evidence: {
    type: string;
    url?: string;
    data?: Record<string, unknown>;
    explanation: string;
  };
}

/**
 * Full market record in the registry
 */
export interface RegistryMarket {
  // === Identity ===
  id: string;
  
  // === Content ===
  question: string;
  description: string;
  tags: string[];
  
  // === Lifecycle ===
  status: MarketStatus;
  createdAt: string;
  resolutionDate: string;
  resolvedAt: string | null;
  
  // === Verification ===
  verification: VerificationMethod;
  resolutionProof: ResolutionProof | null;
  
  // === Sources ===
  sources: MarketSource[];
  
  // === Token State ===
  supply: TokenSupply;
  prices: MarketPrices;
  volume: VolumeStats;
  priceHistory: PricePoint[];
  
  // === Metadata ===
  initialProbability: number;
  timeframe: "end_of_today" | "tomorrow" | "few_days" | "end_of_week";
}

// =============================================================================
// ORDERS
// =============================================================================

/**
 * An order to buy or sell tokens
 */
export interface Order {
  id: string;
  marketId: string;
  traderId: string;
  
  /** Which token to trade */
  tokenType: TokenType;
  
  /** BUY or SELL this token */
  side: "BUY" | "SELL";
  
  /** Order type */
  type: OrderType;
  
  /** Price per token (0-1) */
  price: number;
  
  /** Number of tokens */
  quantity: number;
  
  /** Amount filled so far */
  filledQuantity: number;
  
  /** Order status */
  status: OrderStatus;
  
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

/**
 * A completed trade
 */
export interface Trade {
  id: string;
  marketId: string;
  
  /** Which token was traded */
  tokenType: TokenType;
  
  /** Price per token */
  price: number;
  
  /** Number of tokens */
  quantity: number;
  
  /** Trade value in $ */
  value: number;
  
  /** Buyer info */
  buyerId: string;
  buyerOrderId: string;
  
  /** Seller info */
  sellerId: string;
  sellerOrderId: string;
  
  /** Whether this trade minted new tokens */
  minted: boolean;
  
  /** Timestamp */
  executedAt: string;
}

/**
 * Order book level (aggregated)
 */
export interface BookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

/**
 * Order book snapshot for a token
 */
export interface TokenOrderBook {
  tokenType: TokenType;
  bids: BookLevel[];  // Want to BUY (sorted high to low)
  asks: BookLevel[];  // Want to SELL (sorted low to high)
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
}

/**
 * Full market order book (YES and NO)
 */
export interface MarketOrderBook {
  marketId: string;
  yes: TokenOrderBook;
  no: TokenOrderBook;
  updatedAt: string;
}

// =============================================================================
// USER & AUTH
// =============================================================================

/**
 * User role
 */
export type UserRole = "user" | "admin" | "agent";

/**
 * User account (authentication)
 */
export interface User {
  id: string;
  name: string;
  role: UserRole;
  
  /** Bearer token for API auth */
  token: string;
  
  /** Associated trader ID (1:1 mapping) */
  traderId: string;
  
  /** Twitter handle if linked */
  twitterHandle?: string;
  
  /** Timestamps */
  createdAt: string;
  lastActiveAt: string;
}

// =============================================================================
// TRADER (TRADING STATE)
// =============================================================================

/**
 * Position in a market
 */
export interface Position {
  marketId: string;
  /** YES tokens held */
  yesTokens: number;
  /** NO tokens held */
  noTokens: number;
  /** Total cost basis for YES */
  yesCostBasis: number;
  /** Total cost basis for NO */
  noCostBasis: number;
}

/**
 * Trader account (trading state)
 * 
 * Every User has exactly one Trader.
 * Trader tracks balances and positions.
 */
export interface Trader {
  id: string;
  
  /** USD cash balance */
  balance: number;
  
  /** Positions by market */
  positions: Map<string, Position>;
  
  /** Realized P&L */
  realizedPnl: number;
  
  /** Trade count */
  tradeCount: number;
  
  /** Markets won/lost */
  wins: number;
  losses: number;
  
  /** Timestamps */
  createdAt: string;
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Input for creating a market
 */
export interface CreateMarketInput {
  id: string;
  question: string;
  description: string;
  createdAt: string;
  resolutionDate: string;
  timeframe: "end_of_today" | "tomorrow" | "few_days" | "end_of_week";
  verification: VerificationMethod;
  sources: MarketSource[];
  tags: string[];
  initialProbability: number;
}

/**
 * Input for minting tokens
 */
export interface MintInput {
  marketId: string;
  traderId: string;
  /** Amount of $ to deposit (creates this many YES + NO tokens) */
  amount: number;
}

/**
 * Input for redeeming tokens
 */
export interface RedeemInput {
  marketId: string;
  traderId: string;
  /** Number of YES+NO pairs to redeem for $ */
  amount: number;
}

/**
 * Input for placing an order
 */
export interface PlaceOrderInput {
  marketId: string;
  traderId: string;
  /** Which token to trade */
  tokenType: TokenType;
  /** BUY or SELL */
  side: "BUY" | "SELL";
  /** Order type */
  type: OrderType;
  /** Price (required for LIMIT, ignored for MARKET) */
  price?: number;
  /** Quantity of tokens */
  quantity: number;
}

/**
 * Market query filters
 */
export interface MarketFilters {
  status?: MarketStatus[];
  tags?: string[];
  minVolume?: number;
  resolvingBefore?: string;
  resolvingAfter?: string;
}

/**
 * Market list with pagination
 */
export interface MarketList {
  markets: RegistryMarket[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Settlement result for a trader
 */
export interface SettlementResult {
  traderId: string;
  marketId: string;
  yesTokens: number;
  noTokens: number;
  payout: number;
  profit: number;
}
