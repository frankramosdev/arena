/**
 * Markets API
 * 
 * Market CRUD and queries.
 */

import { Hono } from "hono";
import { registry } from "./index.js";
import { authMiddleware, agentMiddleware } from "./middleware.js";
import type { CreateMarketInput } from "../types.js";

export const marketsApi = new Hono();

// =============================================================================
// PUBLIC ENDPOINTS (read-only)
// =============================================================================

/**
 * List markets
 * GET /markets?status=OPEN&tags=ai,tech&limit=50&offset=0
 */
marketsApi.get("/", (c) => {
  const status = c.req.query("status")?.split(",") as any;
  const tags = c.req.query("tags")?.split(",");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  const minVolume = c.req.query("minVolume") ? parseFloat(c.req.query("minVolume")!) : undefined;
  
  const result = registry.listMarkets({ status, tags, minVolume }, offset, limit);
  return c.json(result);
});

/**
 * Get a single market
 * GET /markets/:id
 */
marketsApi.get("/:id", (c) => {
  const id = c.req.param("id");
  const market = registry.getMarket(id);
  
  if (!market) {
    return c.json({ error: "Market not found" }, 404);
  }
  
  return c.json(market);
});

/**
 * Get order book for a market
 * GET /markets/:id/orderbook
 */
marketsApi.get("/:id/orderbook", (c) => {
  const id = c.req.param("id");
  
  try {
    const book = registry.getOrderBook(id);
    return c.json(book);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 404);
  }
});

/**
 * Get trades for a market
 * GET /markets/:id/trades?limit=50
 */
marketsApi.get("/:id/trades", (c) => {
  const id = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "50");
  
  const trades = registry.getTradesForMarket(id, limit);
  return c.json({ trades });
});

// =============================================================================
// AGENT ENDPOINTS (requires agent or admin role)
// =============================================================================

/**
 * Create a new market
 * POST /markets
 * 
 * Requires agent or admin role.
 */
marketsApi.post("/", authMiddleware, agentMiddleware, async (c) => {
  try {
    const body = await c.req.json() as CreateMarketInput;
    
    // Force 50/50 initial probability - Polymarket style
    const input: CreateMarketInput = {
      ...body,
      initialProbability: 0.5,
      createdAt: body.createdAt || new Date().toISOString(),
    };
    
    const market = registry.createMarket(input);
    return c.json(market, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

/**
 * Halt a market
 * POST /markets/:id/halt
 */
marketsApi.post("/:id/halt", authMiddleware, agentMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json() as { reason: string };
  
  try {
    const market = registry.haltMarket(id, body.reason);
    return c.json(market);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

/**
 * Resume a halted market
 * POST /markets/:id/resume
 */
marketsApi.post("/:id/resume", authMiddleware, agentMiddleware, (c) => {
  const id = c.req.param("id");
  
  try {
    const market = registry.resumeMarket(id);
    return c.json(market);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

/**
 * Invalidate a market
 * POST /markets/:id/invalidate
 */
marketsApi.post("/:id/invalidate", authMiddleware, agentMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json() as { reason: string };
  
  try {
    const market = registry.invalidateMarket(id, body.reason);
    return c.json(market);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});
