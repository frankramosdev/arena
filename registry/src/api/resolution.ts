/**
 * Resolution API
 * 
 * Market resolution - requires agent role.
 */

import { Hono } from "hono";
import { registry, resolutionAgent } from "./index.js";
import { authMiddleware, agentMiddleware } from "./middleware.js";

export const resolutionApi = new Hono();

// =============================================================================
// PUBLIC ENDPOINTS
// =============================================================================

/**
 * Get markets expiring soon
 * GET /resolution/pending?hours=24
 */
resolutionApi.get("/pending", (c) => {
  const hours = parseInt(c.req.query("hours") || "24");
  const markets = resolutionAgent.getPendingResolutions(hours);
  return c.json({ markets, count: markets.length });
});

/**
 * Get overdue markets (past resolution date but still open)
 * GET /resolution/overdue
 */
resolutionApi.get("/overdue", (c) => {
  const markets = resolutionAgent.getOverdueMarkets();
  return c.json({ markets, count: markets.length });
});

/**
 * Get resolution stats
 * GET /resolution/stats
 */
resolutionApi.get("/stats", (c) => {
  const stats = resolutionAgent.getStats();
  return c.json(stats);
});

// =============================================================================
// AGENT ENDPOINTS
// =============================================================================

/**
 * Resolve a market
 * POST /resolution/:marketId
 * 
 * Requires agent or admin role.
 */
resolutionApi.post("/:marketId", authMiddleware, agentMiddleware, async (c) => {
  const marketId = c.req.param("marketId");
  const body = await c.req.json() as {
    outcome: "YES" | "NO";
    evidence: {
      type: string;
      url?: string;
      data?: Record<string, unknown>;
      explanation: string;
    };
  };
  
  try {
    const market = resolutionAgent.resolve(marketId, body);
    return c.json(market);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

/**
 * Batch resolve markets
 * POST /resolution/batch
 * 
 * Requires agent or admin role.
 */
resolutionApi.post("/batch", authMiddleware, agentMiddleware, async (c) => {
  const body = await c.req.json() as Array<{
    marketId: string;
    outcome: "YES" | "NO";
    evidence: {
      type: string;
      url?: string;
      data?: Record<string, unknown>;
      explanation: string;
    };
  }>;
  
  const results = resolutionAgent.batchResolve(body);
  
  return c.json({
    resolved: results.length,
    markets: results.map(m => ({
      id: m.id,
      status: m.status,
      resolvedAt: m.resolvedAt,
    })),
  });
});
