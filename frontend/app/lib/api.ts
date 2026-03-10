/**
 * Registry & Trading API Client
 * 
 * Fetches real market data from the registry and trading floor.
 */

// Detect if running on server (SSR) inside Docker
const isServer = typeof window === "undefined";

// Use internal Docker URLs for server-side, public URLs for client-side
const REGISTRY_URL = isServer
  ? (process.env.INTERNAL_REGISTRY_URL || process.env.NEXT_PUBLIC_REGISTRY_URL || "http://registry:3100")
  : (process.env.NEXT_PUBLIC_REGISTRY_URL || "http://localhost:3100");

const TRADING_URL = isServer
  ? (process.env.INTERNAL_TRADING_URL || process.env.NEXT_PUBLIC_TRADING_URL || "http://trading:3300")
  : (process.env.NEXT_PUBLIC_TRADING_URL || "http://localhost:3300");

const RESOLUTION_URL = isServer
  ? (process.env.INTERNAL_RESOLUTION_URL || process.env.NEXT_PUBLIC_RESOLUTION_URL || "http://resolution:3200")
  : (process.env.NEXT_PUBLIC_RESOLUTION_URL || "http://localhost:3200");

// =============================================================================
// TYPES
// =============================================================================

export interface RegistryMarket {
  id: string;
  question: string;
  description: string;
  tags: string[];
  status: "OPEN" | "HALTED" | "RESOLVED_YES" | "RESOLVED_NO" | "INVALID";
  createdAt: string;
  resolutionDate: string;
  resolvedAt: string | null;
  verification: {
    type: string;
    targetHandles?: string[];
    keywords?: string[];
    hashtags?: string[];
    threshold?: number;
    resolutionCriteria: string;
  };
  resolutionProof: {
    resolvedBy: string;
    outcome: string;
    timestamp: string;
    evidence: {
      type: string;
      url?: string;
      explanation: string;
    };
  } | null;
  sources: Array<{
    url?: string;
    handle?: string;
    snippet?: string;
  }>;
  supply: {
    yesSupply: number;
    noSupply: number;
    collateral: number;
  };
  prices: {
    yesPrice: number;
    noPrice: number;
    yesBestBid: number | null;
    yesBestAsk: number | null;
    noBestBid: number | null;
    noBestAsk: number | null;
    lastTradeAt: string | null;
  };
  volume: {
    totalVolume: number;
    volume24h: number;
    tradeCount: number;
  };
  priceHistory: Array<{
    timestamp: string;
    yesPrice: number;
    volume: number;
  }>;
  initialProbability: number;
  timeframe: string;
}

export interface RegistryStats {
  totalMarkets: number;
  openMarkets: number;
  resolvedMarkets: number;
  totalVolume: number;
  totalTrades: number;
  totalTraders: number;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBook {
  marketId: string;
  yes: {
    bids: OrderBookEntry[];
    asks: OrderBookEntry[];
    spread: number | null;
  };
  no: {
    bids: OrderBookEntry[];
    asks: OrderBookEntry[];
    spread: number | null;
  };
}

export interface Trade {
  id: string;
  marketId: string;
  tokenType: "YES" | "NO";
  price: number;
  quantity: number;
  value: number;
  buyerId: string;
  sellerId: string;
  timestamp: string;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch registry stats
 */
export async function fetchStats(): Promise<RegistryStats> {
  const res = await fetch(`${REGISTRY_URL}/stats`, {
    next: { revalidate: 10 }, // Revalidate every 10 seconds
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Fetch markets list
 */
export async function fetchMarkets(options?: {
  status?: string[];
  tags?: string[];
  limit?: number;
  offset?: number;
}): Promise<{ markets: RegistryMarket[]; total: number }> {
  const params = new URLSearchParams();
  
  if (options?.status?.length) {
    params.set("status", options.status.join(","));
  }
  if (options?.tags?.length) {
    params.set("tags", options.tags.join(","));
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }
  if (options?.offset) {
    params.set("offset", String(options.offset));
  }
  
  const url = `${REGISTRY_URL}/markets${params.toString() ? `?${params}` : ""}`;
  
  const res = await fetch(url, {
    next: { revalidate: 5 }, // Revalidate every 5 seconds
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch markets: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Fetch a single market
 */
export async function fetchMarket(id: string): Promise<RegistryMarket | null> {
  const res = await fetch(`${REGISTRY_URL}/markets/${id}`, {
    next: { revalidate: 5 },
  });
  
  if (res.status === 404) {
    return null;
  }
  
  if (!res.ok) {
    throw new Error(`Failed to fetch market: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Fetch order book for a market
 */
export async function fetchOrderBook(marketId: string): Promise<OrderBook> {
  const res = await fetch(`${REGISTRY_URL}/markets/${marketId}/orderbook`, {
    next: { revalidate: 2 }, // More frequent for order book
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch order book: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Fetch trades for a market
 */
export async function fetchTrades(marketId: string, limit = 50): Promise<{ trades: Trade[] }> {
  const res = await fetch(`${REGISTRY_URL}/markets/${marketId}/trades?limit=${limit}`, {
    next: { revalidate: 5 },
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch trades: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Check if registry is healthy
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${REGISTRY_URL}/health`, {
      next: { revalidate: 30 },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// DATA TRANSFORMERS
// =============================================================================

/**
 * Convert registry market to frontend Market format
 */
export function toFrontendMarket(m: RegistryMarket) {
  // Extract primary handle from sources or verification
  const twitterHandle = m.verification.targetHandles?.[0] 
    || m.sources.find(s => s.handle)?.handle;
  
  // Determine category from tags
  const categoryMap: Record<string, string> = {
    "ai": "AI",
    "tech": "Tech", 
    "crypto": "Crypto",
    "bitcoin": "Crypto",
    "ethereum": "Crypto",
    "politics": "Politics",
    "sports": "Sports",
    "space": "Space",
    "finance": "Finance",
    "memes": "Memes",
    "entertainment": "Entertainment",
  };
  
  const category = m.tags.find(t => categoryMap[t.toLowerCase()])
    ? categoryMap[m.tags.find(t => categoryMap[t.toLowerCase()])!.toLowerCase()]
    : m.tags[0] || "General";
  
  return {
    id: m.id,
    question: m.question,
    description: m.description,
    category,
    yesPrice: Math.round(m.prices.yesPrice * 100),
    noPrice: Math.round(m.prices.noPrice * 100),
    volume: m.volume.totalVolume,
    volume24h: m.volume.volume24h,
    expiresAt: m.resolutionDate,
    createdAt: m.createdAt,
    status: m.status,
    twitterHandle,
    verificationMethod: m.verification.type,
    resolutionCriteria: m.verification.resolutionCriteria,
    tags: m.tags,
    // Additional fields from registry
    tradeCount: m.volume.tradeCount,
    yesBestBid: m.prices.yesBestBid,
    yesBestAsk: m.prices.yesBestAsk,
    noBestBid: m.prices.noBestBid,
    noBestAsk: m.prices.noBestAsk,
    priceHistory: m.priceHistory,
    resolutionProof: m.resolutionProof,
  };
}

/**
 * Format volume for display
 */
export function formatVolume(volume: number): string {
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
  return `$${volume.toFixed(0)}`;
}

/**
 * Format time remaining
 */
export function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) return "Expired";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h left`;

  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}m left`;
}

// =============================================================================
// TRADING FLOOR API
// =============================================================================

export interface TradingAgent {
  id: string;
  handle: string;
  displayName: string;
  avatar: string;
  emoji: string;
  personality: {
    riskProfile: string;
    tradingStyle: string;
    tone: string;
    expertise: string[];
  };
}

/**
 * Fetch all trading agents
 */
export async function fetchAgents(): Promise<{ agents: TradingAgent[] }> {
  try {
    const res = await fetch(`${TRADING_URL}/agents`, {
      next: { revalidate: 60 },
    });
    
    if (!res.ok) {
      return { agents: [] };
    }
    
    return res.json();
  } catch {
    return { agents: [] };
  }
}

/**
 * Fetch single agent details
 */
export async function fetchAgent(id: string): Promise<TradingAgent | null> {
  try {
    const res = await fetch(`${TRADING_URL}/agents/${id}`, {
      next: { revalidate: 60 },
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    return data.agent;
  } catch {
    return null;
  }
}

/**
 * Get avatar for an agent handle
 */
export async function fetchAgentAvatar(handle: string): Promise<string> {
  try {
    const res = await fetch(`${TRADING_URL}/avatars/${handle}`, {
      next: { revalidate: 300 }, // Cache for 5 min
    });
    
    if (!res.ok) {
      return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(handle)}`;
    }
    
    const data = await res.json();
    return data.avatar;
  } catch {
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(handle)}`;
  }
}

/**
 * Fetch all avatars
 */
export async function fetchAllAvatars(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${TRADING_URL}/avatars`, {
      next: { revalidate: 300 },
    });
    
    if (!res.ok) return {};
    
    const data = await res.json();
    return data.avatars;
  } catch {
    return {};
  }
}

/**
 * Check if trading floor is healthy
 */
export async function checkTradingHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${TRADING_URL}/health`, {
      next: { revalidate: 30 },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// LEADERBOARD API
// =============================================================================

export interface LeaderboardEntry {
  rank: number;
  traderId: string;
  name: string;
  handle: string;
  realizedPnl: number;
  tradeCount: number;
  volume: number;
  balance: number;
}

/**
 * Fetch trader leaderboard
 */
export async function fetchLeaderboard(limit = 50, offset = 0): Promise<{
  leaderboard: LeaderboardEntry[];
  total: number;
}> {
  try {
    const res = await fetch(
      `${REGISTRY_URL}/users/leaderboard?limit=${limit}&offset=${offset}`,
      { next: { revalidate: 30 } }
    );
    
    if (!res.ok) {
      return { leaderboard: [], total: 0 };
    }
    
    return res.json();
  } catch {
    return { leaderboard: [], total: 0 };
  }
}

/**
 * Fetch stats for a specific trader
 */
export async function fetchTraderStats(traderId: string): Promise<LeaderboardEntry | null> {
  try {
    const res = await fetch(`${REGISTRY_URL}/users/traders/${traderId}/stats`, {
      next: { revalidate: 30 },
    });
    
    if (!res.ok) return null;
    
    return res.json();
  } catch {
    return null;
  }
}

// =============================================================================
// TRADING SESSIONS API
// =============================================================================

export interface TradingSession {
  id: string;
  marketId: string;
  marketQuestion?: string;
  status: 'INITIALIZING' | 'INTEREST' | 'TRADING' | 'CLOSED';
  startedAt: string;
  stats: {
    interests: number;
    interested: number;
    floorMessages: number;
    sideChats: number;
    trades: number;
    currentRound?: number;
    maxRounds?: number;
  };
}

export interface TradingMessage {
  id: string;
  type: 'CHAT' | 'RFQ' | 'RESPONSE' | 'AGREEMENT' | 'TRADE' | 'AGENT_LEFT' | 'SYSTEM' | 'SIDE_CHAT_STARTED';
  agentId: string;
  agentHandle?: string;
  marketId: string;
  chatId?: string | null; // null = main floor, string = side chat ID
  text: string;          // actual field name from Message type
  content?: string;      // alias for frontend
  createdAt: string;     // actual field name from Message type
  timestamp?: string;    // alias for frontend
  sessionId?: string;
  marketQuestion?: string;
}

export interface TradingTrade {
  id: string;
  timestamp: string;
  buyer: string;
  seller: string;
  token: string;
  quantity: number;
  price: number;
  marketId: string;
  sessionId?: string;
  marketQuestion?: string;
}

export interface TradingFeed {
  messages: TradingMessage[];
  trades: TradingTrade[];
  activeSessions: number;
  totalAgents: number;
}

/**
 * Fetch all trading sessions
 */
export async function fetchTradingSessions(): Promise<{ sessions: TradingSession[] }> {
  try {
    const res = await fetch(`${TRADING_URL}/sessions`, {
      cache: 'no-store',
    });
    
    if (!res.ok) return { sessions: [] };
    return res.json();
  } catch {
    return { sessions: [] };
  }
}

/**
 * Fetch aggregate feed from trading floor
 */
export async function fetchTradingFeed(limit = 50): Promise<TradingFeed> {
  try {
    const res = await fetch(`${TRADING_URL}/feed?limit=${limit}`, {
      cache: 'no-store',
    });
    
    if (!res.ok) {
      return { messages: [], trades: [], activeSessions: 0, totalAgents: 0 };
    }
    
    return res.json();
  } catch {
    return { messages: [], trades: [], activeSessions: 0, totalAgents: 0 };
  }
}

/**
 * Start a new trading session for a market
 */
export async function startTradingSession(market: {
  id: string;
  question: string;
  description: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  resolutionDate: string;
  status: string;
}): Promise<{ session?: TradingSession; error?: string }> {
  try {
    const res = await fetch(`${TRADING_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market }),
    });
    
    if (!res.ok) {
      const data = await res.json();
      return { error: data.error || 'Failed to start session' };
    }
    
    return res.json();
  } catch (e) {
    return { error: String(e) };
  }
}

/**
 * Get session floor messages
 */
export async function fetchSessionMessages(sessionId: string, limit = 50): Promise<{ messages: TradingMessage[] }> {
  try {
    const res = await fetch(`${TRADING_URL}/sessions/${sessionId}/floor?limit=${limit}`, {
      cache: 'no-store',
    });
    
    if (!res.ok) return { messages: [] };
    return res.json();
  } catch {
    return { messages: [] };
  }
}

/**
 * Subscribe to session messages via SSE
 */
export function subscribeToSession(
  sessionId: string,
  onMessage: (msg: TradingMessage) => void,
  onClose?: () => void
): () => void {
  const eventSource = new EventSource(`${TRADING_URL}/sessions/${sessionId}/stream`);
  
  eventSource.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      onMessage(msg);
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  });
  
  eventSource.addEventListener('close', () => {
    onClose?.();
    eventSource.close();
  });
  
  eventSource.onerror = () => {
    onClose?.();
    eventSource.close();
  };
  
  return () => eventSource.close();
}

// =============================================================================
// RESOLUTION API
// =============================================================================

export interface EarlyResolutionResult {
  success: boolean;
  marketId?: string;
  outcome?: "YES" | "NO" | "INVALID";
  evidence?: {
    type: string;
    url?: string;
    explanation: string;
    confidence: number;
  };
  resolvedAt?: string;
  error?: string;
}

/**
 * Request early resolution for a market
 */
export async function requestEarlyResolution(
  marketId: string,
  reason: string = "User requested early resolution"
): Promise<EarlyResolutionResult> {
  try {
    const res = await fetch(`${RESOLUTION_URL}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketId, reason }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || "Failed to resolve market" };
    }

    return data;
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Check resolution agent health
 */
export async function checkResolutionHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${RESOLUTION_URL}/health`, {
      next: { revalidate: 30 },
    });
    return res.ok;
  } catch {
    return false;
  }
}
