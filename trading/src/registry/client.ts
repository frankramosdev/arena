/**
 * Registry Client for Trading Service
 * 
 * Connects to the Market Registry for real markets and order execution.
 */

import {
  configureRegistry,
  getMarket,
  listMarkets,
  type MarketSummary,
} from "@sigarena/common";

// =============================================================================
// CONFIG
// =============================================================================

const REGISTRY_URL = process.env.REGISTRY_URL || "http://localhost:3100";
const AGENT_TOKEN = process.env.AGENT_TOKEN || "";

// Configure on import
configureRegistry({ url: REGISTRY_URL, token: AGENT_TOKEN });

// =============================================================================
// MARKET OPERATIONS
// =============================================================================

export interface TradingMarket {
  id: string;
  question: string;
  description: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  resolutionDate: string;
  status: string;
}

/**
 * Get open markets for trading
 */
export async function getOpenMarkets(limit: number = 10): Promise<TradingMarket[]> {
  const result = await listMarkets({ status: ["OPEN"], limit });
  
  if (result.error) {
    console.error("[Registry] Failed to fetch markets:", result.error);
    return [];
  }
  
  return (result.markets || []).map((m: MarketSummary) => ({
    id: m.id,
    question: m.question,
    description: "", // Need to fetch full market for description
    yesPrice: m.yesPrice,
    noPrice: m.noPrice,
    volume: m.volume,
    resolutionDate: m.resolutionDate,
    status: m.status,
  }));
}

/**
 * Get a specific market by ID
 */
export async function getTradingMarket(marketId: string): Promise<TradingMarket | null> {
  const result = await getMarket(marketId);
  
  if (result.error || !result.market) {
    console.error("[Registry] Failed to fetch market:", result.error);
    return null;
  }
  
  const m = result.market;
  return {
    id: m.id,
    question: m.question,
    description: "", // Need full API response for this
    yesPrice: m.yesPrice,
    noPrice: m.noPrice,
    volume: m.volume,
    resolutionDate: m.resolutionDate,
    status: m.status,
  };
}

// =============================================================================
// TRADING OPERATIONS
// =============================================================================

export interface PlaceOrderParams {
  marketId: string;
  traderId: string;
  tokenType: "YES" | "NO";
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  price: number;
  quantity: number;
  token?: string; // Auth token for this trader
}

export interface OrderResult {
  orderId?: string;
  trades?: Array<{
    id: string;
    price: number;
    quantity: number;
    value: number;
  }>;
  error?: string;
}

/**
 * Place an order on the registry
 */
export async function placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
  try {
    const authToken = params.token || AGENT_TOKEN;
    const { token: _, ...orderParams } = params; // Remove token from body
    
    const response = await fetch(`${REGISTRY_URL}/trade/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify(orderParams),
    });
    
    const data = await response.json() as { order?: { id: string }; trades?: unknown[]; error?: string };
    
    if (!response.ok) {
      return { error: data.error || `HTTP ${response.status}` };
    }
    
    return {
      orderId: data.order?.id,
      trades: (data.trades || []) as OrderResult["trades"],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

// =============================================================================
// ATOMIC SETTLEMENT
// =============================================================================

export interface SettleTradeParams {
  marketId: string;
  buyerId: string;
  sellerId: string;
  tokenType: "YES" | "NO";
  quantity: number;
  price: number;
  token: string; // Auth token (any valid token works)
}

export interface SettleResult {
  success: boolean;
  trade?: {
    id: string;
    marketId: string;
    buyerId: string;
    sellerId: string;
    tokenType: string;
    price: number;
    quantity: number;
    value: number;
  };
  message?: string;
  error?: string;
}

/**
 * Settle a trade atomically (bypasses order book)
 * Used when both agents have already agreed on the trade.
 */
export async function settleTrade(params: SettleTradeParams): Promise<SettleResult> {
  try {
    const { token, ...settleParams } = params;
    
    const response = await fetch(`${REGISTRY_URL}/trade/settle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(settleParams),
    });
    
    const data = await response.json() as SettleResult;
    
    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }
    
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Mint tokens for an agent (deposit collateral)
 */
export async function mintTokens(
  marketId: string,
  traderId: string,
  amount: number,
  authToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = authToken || AGENT_TOKEN;
    const response = await fetch(`${REGISTRY_URL}/trade/mint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ marketId, traderId, amount }),
    });
    
    const data = await response.json() as { error?: string };
    
    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }
    
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// =============================================================================
// AGENT REGISTRATION
// =============================================================================

export interface AgentTrader {
  traderId: string;
  userId: string;
  balance: number;
}

/**
 * Register or resume an agent as a trader in the registry
 * Uses upsert endpoint - if agent exists by twitter handle, resumes their state
 */
export async function registerAgentTrader(
  agentId: string,
  displayName: string,
  initialBalance: number = 10000
): Promise<AgentTrader & { token: string; existing: boolean } | null> {
  try {
    const handle = agentId.replace("agent_", "");
    
    // Use upsert endpoint - creates new or returns existing
    const userResponse = await fetch(`${REGISTRY_URL}/users/agent/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle,
        name: displayName,
        initialBalance,
      }),
    });
    
    const userData = await userResponse.json() as { 
      user?: { id: string; traderId: string }; 
      trader?: { id: string; balance: number };
      token?: string;
      existing?: boolean;
      error?: string;
    };
    
    if (!userResponse.ok || !userData.user || !userData.token) {
      console.error("[Registry] Failed to register/resume agent:", userData.error || "Unknown error");
      return null;
    }
    
    const traderId = userData.user.traderId;
    const token = userData.token;
    const existing = userData.existing || false;
    const balance = userData.trader?.balance || initialBalance;
    
    return {
      traderId,
      userId: userData.user.id,
      balance,
      token,
      existing,
    };
  } catch (err) {
    console.error("[Registry] Failed to register agent:", err);
    return null;
  }
}

/**
 * Get trader balance and positions
 */
export async function getTraderState(traderId: string): Promise<{
  balance: number;
  positions: Map<string, { yesTokens: number; noTokens: number }>;
} | null> {
  try {
    const response = await fetch(`${REGISTRY_URL}/traders/${traderId}`, {
      headers: {
        "Authorization": `Bearer ${AGENT_TOKEN}`,
      },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json() as {
      balance: number;
      positions: Array<{ marketId: string; yesTokens: number; noTokens: number }>;
    };
    
    const positions = new Map<string, { yesTokens: number; noTokens: number }>();
    for (const pos of data.positions || []) {
      positions.set(pos.marketId, {
        yesTokens: pos.yesTokens,
        noTokens: pos.noTokens,
      });
    }
    
    return {
      balance: data.balance,
      positions,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// ORDER BOOK
// =============================================================================

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBook {
  marketId: string;
  yes: { bids: OrderBookLevel[]; asks: OrderBookLevel[]; bestBid: number | null; bestAsk: number | null };
  no: { bids: OrderBookLevel[]; asks: OrderBookLevel[]; bestBid: number | null; bestAsk: number | null };
}

/**
 * Get order book for a market
 */
export async function getOrderBook(marketId: string): Promise<OrderBook | null> {
  try {
    const response = await fetch(`${REGISTRY_URL}/markets/${marketId}/orderbook`);
    
    if (!response.ok) return null;
    
    return await response.json() as OrderBook;
  } catch {
    return null;
  }
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Check if registry is available
 */
export async function isRegistryAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${REGISTRY_URL}/health`);
    const data = await response.json() as { status: string };
    return data.status === "ok";
  } catch {
    return false;
  }
}
