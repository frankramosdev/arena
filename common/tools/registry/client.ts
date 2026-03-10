/**
 * Registry API Client
 * 
 * HTTP client for interacting with the SIG Arena Registry API.
 */

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_REGISTRY_URL = "http://localhost:3100";

let registryUrl = process.env.REGISTRY_URL || DEFAULT_REGISTRY_URL;
let agentToken = process.env.AGENT_TOKEN;

/**
 * Configure the registry client
 */
export function configureRegistry(config: { url?: string; token?: string }) {
  if (config.url) registryUrl = config.url;
  if (config.token) agentToken = config.token;
}

/**
 * Get current registry URL
 */
export function getRegistryUrl(): string {
  return registryUrl;
}

/**
 * Check if agent token is configured
 */
export function hasAgentToken(): boolean {
  return !!agentToken;
}

// =============================================================================
// HTTP Helpers
// =============================================================================

interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  requiresAuth?: boolean;
}

async function registryFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<{ data?: T; error?: string }> {
  const { method = "GET", body, requiresAuth = false } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (requiresAuth) {
    if (!agentToken) {
      return { error: "AGENT_TOKEN not configured" };
    }
    headers["Authorization"] = `Bearer ${agentToken}`;
  }

  try {
    const response = await fetch(`${registryUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      return { error: data.error || `HTTP ${response.status}` };
    }

    return { data: data as T };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

// =============================================================================
// Market Queries (Public)
// =============================================================================

export interface MarketSummary {
  id: string;
  question: string;
  status: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  resolutionDate: string;
}

/**
 * Check if a market exists by ID
 */
export async function marketExists(marketId: string): Promise<boolean> {
  const result = await registryFetch<{ id: string }>(`/markets/${marketId}`);
  return !result.error && !!result.data?.id;
}

/**
 * Check multiple markets for existence
 * Returns map of marketId -> exists
 */
export async function checkMarketsExist(
  marketIds: string[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  // Check in parallel
  await Promise.all(
    marketIds.map(async (id) => {
      const exists = await marketExists(id);
      results.set(id, exists);
    })
  );
  
  return results;
}

/**
 * Get market details
 */
export async function getMarket(marketId: string): Promise<{
  market?: MarketSummary;
  error?: string;
}> {
  const result = await registryFetch<any>(`/markets/${marketId}`);
  
  if (result.error) {
    return { error: result.error };
  }
  
  const m = result.data;
  return {
    market: {
      id: m.id,
      question: m.question,
      status: m.status,
      yesPrice: m.prices?.yesPrice ?? 0.5,
      noPrice: m.prices?.noPrice ?? 0.5,
      volume: m.volume?.totalVolume ?? 0,
      resolutionDate: m.resolutionDate,
    },
  };
}

/**
 * List markets with optional filters
 */
export async function listMarkets(options: {
  status?: string[];
  tags?: string[];
  limit?: number;
  offset?: number;
} = {}): Promise<{
  markets?: MarketSummary[];
  total?: number;
  error?: string;
}> {
  const params = new URLSearchParams();
  if (options.status?.length) params.set("status", options.status.join(","));
  if (options.tags?.length) params.set("tags", options.tags.join(","));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));
  
  const query = params.toString();
  const endpoint = `/markets${query ? `?${query}` : ""}`;
  
  const result = await registryFetch<{ markets: any[]; total: number }>(endpoint);
  
  if (result.error) {
    return { error: result.error };
  }
  
  return {
    markets: result.data!.markets.map((m) => ({
      id: m.id,
      question: m.question,
      status: m.status,
      yesPrice: m.prices?.yesPrice ?? 0.5,
      noPrice: m.prices?.noPrice ?? 0.5,
      volume: m.volume?.totalVolume ?? 0,
      resolutionDate: m.resolutionDate,
    })),
    total: result.data!.total,
  };
}

/**
 * Search for markets by question text
 * Returns markets whose questions contain the search term
 */
export async function searchMarkets(
  searchTerm: string,
  options: { status?: string[]; limit?: number } = {}
): Promise<{
  markets?: MarketSummary[];
  error?: string;
}> {
  // Fetch markets and filter client-side (registry doesn't have search endpoint yet)
  const result = await listMarkets({
    status: options.status,
    limit: options.limit || 100,
  });
  
  if (result.error) {
    return { error: result.error };
  }
  
  const searchLower = searchTerm.toLowerCase();
  const filtered = result.markets!.filter((m) =>
    m.question.toLowerCase().includes(searchLower)
  );
  
  return { markets: filtered };
}

// =============================================================================
// Registry Stats (Public)
// =============================================================================

export interface RegistryStats {
  totalMarkets: number;
  openMarkets: number;
  resolvedMarkets: number;
  totalVolume: number;
  totalTrades: number;
  totalTraders: number;
}

/**
 * Get registry statistics
 */
export async function getRegistryStats(): Promise<{
  stats?: RegistryStats;
  error?: string;
}> {
  const result = await registryFetch<RegistryStats>("/stats");
  
  if (result.error) {
    return { error: result.error };
  }
  
  return { stats: result.data };
}

/**
 * Check if registry is healthy
 */
export async function isRegistryHealthy(): Promise<boolean> {
  const result = await registryFetch<{ status: string }>("/health");
  return result.data?.status === "ok";
}

// =============================================================================
// Resolution Operations (Agent)
// =============================================================================

export interface PendingMarketSummary {
  id: string;
  question: string;
  description: string;
  resolutionDate: string;
  status: string;
  verification: {
    type: string;
    targetHandles?: string[];
    keywords?: string[];
    threshold?: number;
    resolutionCriteria: string;
  };
}

/**
 * Get markets pending resolution (expiring within N hours)
 */
export async function getPendingResolutions(hours: number = 24): Promise<{
  markets?: PendingMarketSummary[];
  error?: string;
}> {
  const result = await registryFetch<{ markets: any[]; count: number }>(
    `/resolution/pending?hours=${hours}`
  );

  if (result.error) {
    return { error: result.error };
  }

  return {
    markets: result.data!.markets.map((m) => ({
      id: m.id,
      question: m.question,
      description: m.description,
      resolutionDate: m.resolutionDate,
      status: m.status,
      verification: m.verification,
    })),
  };
}

/**
 * Get overdue markets (past resolution date but still open)
 */
export async function getOverdueMarkets(): Promise<{
  markets?: PendingMarketSummary[];
  error?: string;
}> {
  const result = await registryFetch<{ markets: any[]; count: number }>(
    "/resolution/overdue"
  );

  if (result.error) {
    return { error: result.error };
  }

  return {
    markets: result.data!.markets.map((m) => ({
      id: m.id,
      question: m.question,
      description: m.description,
      resolutionDate: m.resolutionDate,
      status: m.status,
      verification: m.verification,
    })),
  };
}

export interface ResolutionEvidence {
  type: string;
  url?: string;
  data?: Record<string, unknown>;
  explanation: string;
}

/**
 * Resolve a market with outcome and evidence
 */
export async function resolveMarket(
  marketId: string,
  outcome: "YES" | "NO",
  evidence: ResolutionEvidence
): Promise<{
  market?: any;
  error?: string;
}> {
  const result = await registryFetch<any>(`/resolution/${marketId}`, {
    method: "POST",
    body: { outcome, evidence },
    requiresAuth: true,
  });

  if (result.error) {
    return { error: result.error };
  }

  return { market: result.data };
}

/**
 * Batch resolve multiple markets
 */
export async function batchResolveMarkets(
  resolutions: Array<{
    marketId: string;
    outcome: "YES" | "NO";
    evidence: ResolutionEvidence;
  }>
): Promise<{
  resolved?: number;
  markets?: Array<{ id: string; status: string; resolvedAt: string }>;
  error?: string;
}> {
  const result = await registryFetch<{
    resolved: number;
    markets: Array<{ id: string; status: string; resolvedAt: string }>;
  }>("/resolution/batch", {
    method: "POST",
    body: resolutions,
    requiresAuth: true,
  });

  if (result.error) {
    return { error: result.error };
  }

  return {
    resolved: result.data!.resolved,
    markets: result.data!.markets,
  };
}

/**
 * Get resolution stats
 */
export async function getResolutionStats(): Promise<{
  stats?: {
    pendingCount: number;
    overdueCount: number;
    resolvedToday: number;
    avgResolutionTime: number;
  };
  error?: string;
}> {
  const result = await registryFetch<any>("/resolution/stats");

  if (result.error) {
    return { error: result.error };
  }

  return { stats: result.data };
}
