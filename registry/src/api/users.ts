/**
 * Users API
 * 
 * User registration, authentication, and management.
 */

import { Hono } from "hono";
import { registry } from "./index.js";
import { authMiddleware, adminMiddleware } from "./middleware.js";
import type { UserRole } from "../types.js";

export const usersApi = new Hono();

// =============================================================================
// PUBLIC ENDPOINTS
// =============================================================================

/**
 * Get trader leaderboard (public)
 * GET /users/leaderboard
 * 
 * Returns traders ranked by P&L with volume and trade count.
 */
usersApi.get("/leaderboard", (c) => {
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  
  const result = registry.getTraderLeaderboard(limit + 10, 0); // Fetch extra to account for filtered system users
  
  // Filter out system users (Admin, SigArenaAgent) and enrich with user info
  const filteredTraders = result.traders.filter((stats) => {
    const user = registry.getUserByTraderId(stats.traderId);
    // Exclude admin and agent roles (system users)
    return user && user.role !== "admin" && user.role !== "agent";
  });
  
  // Apply pagination after filtering
  const paginatedTraders = filteredTraders.slice(offset, offset + limit);
  
  const leaderboard = paginatedTraders.map((stats, index) => {
    const user = registry.getUserByTraderId(stats.traderId);
    return {
      rank: offset + index + 1,
      traderId: stats.traderId,
      name: user?.name || "Anonymous",
      handle: user?.twitterHandle || stats.traderId.slice(0, 8),
      realizedPnl: stats.realizedPnl,
      tradeCount: stats.tradeCount,
      volume: stats.volume,
      balance: stats.balance,
    };
  });
  
  return c.json({
    leaderboard,
    total: filteredTraders.length,
    offset,
    limit,
  });
});

/**
 * Get stats for a specific trader (public)
 * GET /users/traders/:traderId/stats
 */
usersApi.get("/traders/:traderId/stats", (c) => {
  const traderId = c.req.param("traderId");
  const stats = registry.getTraderStats(traderId);
  
  if (!stats) {
    return c.json({ error: "Trader not found" }, 404);
  }
  
  const user = registry.getUserByTraderId(traderId);
  
  return c.json({
    traderId: stats.traderId,
    name: user?.name || "Anonymous",
    handle: user?.twitterHandle || stats.traderId.slice(0, 8),
    realizedPnl: stats.realizedPnl,
    tradeCount: stats.tradeCount,
    volume: stats.volume,
    balance: stats.balance,
  });
});

/**
 * Get agent token for automated services
 * GET /users/agent-token
 * 
 * Used by creation/resolution agents to get their token on startup.
 * Requires BOOTSTRAP_SECRET env var to match.
 */
usersApi.get("/agent-token", (c) => {
  const secret = c.req.header("X-Bootstrap-Secret");
  const expectedSecret = process.env.BOOTSTRAP_SECRET || "sigarena-bootstrap-2024";
  
  if (secret !== expectedSecret) {
    return c.json({ error: "Invalid bootstrap secret" }, 401);
  }
  
  // Find or create agent
  const { users } = registry.listUsers(0, 100);
  let agent = users.find(u => u.role === "agent" && u.name === "SigArenaAgent");
  
  if (!agent) {
    // Bootstrap hasn't run yet, create agent now
    agent = registry.createUser({
      name: "SigArenaAgent",
      role: "agent",
    });
  }
  
  return c.json({ 
    token: agent.token,
    agentId: agent.id,
  });
});

/**
 * Get or create agent by twitter handle
 * POST /users/agent/upsert
 * 
 * If agent exists (by twitter handle), returns existing user info.
 * If not, creates new agent user and returns with token.
 * This allows agents to resume their state after restarts.
 */
usersApi.post("/agent/upsert", async (c) => {
  try {
    const body = await c.req.json() as { 
      handle: string; 
      name?: string;
      initialBalance?: number;
    };
    
    if (!body.handle || body.handle.trim().length === 0) {
      return c.json({ error: "Twitter handle is required" }, 400);
    }
    
    const handle = body.handle.trim().replace(/^@/, ""); // Remove @ if present
    
    // Check if user already exists
    const existingUser = registry.getUserByTwitterHandle(handle);
    
    if (existingUser) {
      // Return existing user - they can continue where they left off
      const trader = registry.getTrader(existingUser.traderId);
      return c.json({
        existing: true,
        user: {
          id: existingUser.id,
          name: existingUser.name,
          role: existingUser.role,
          traderId: existingUser.traderId,
          twitterHandle: existingUser.twitterHandle,
          createdAt: existingUser.createdAt,
        },
        token: existingUser.token, // Return token so agent can auth
        trader: trader ? {
          id: trader.id,
          balance: trader.balance,
        } : null,
      }, 200);
    }
    
    // Create new agent user
    const user = registry.createUser({
      name: body.name || `@${handle}`,
      role: "user",
      twitterHandle: handle,
    });
    
    // Credit initial balance if specified (default handled by createUser)
    if (body.initialBalance && body.initialBalance > 10000) {
      const trader = registry.getTrader(user.traderId);
      if (trader) {
        const additional = body.initialBalance - 10000;
        registry.creditBalance(user.traderId, additional);
      }
    }
    
    const trader = registry.getTrader(user.traderId);
    
    return c.json({
      existing: false,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        traderId: user.traderId,
        twitterHandle: user.twitterHandle,
        createdAt: user.createdAt,
      },
      token: user.token,
      trader: trader ? {
        id: trader.id,
        balance: trader.balance,
      } : null,
    }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

/**
 * Register a new user
 * POST /users/register
 * 
 * Returns user with bearer token. Save the token - it's only shown once!
 * First user created becomes admin.
 */
usersApi.post("/register", async (c) => {
  try {
    const body = await c.req.json() as { 
      name: string; 
      twitterHandle?: string;
    };
    
    if (!body.name || body.name.trim().length === 0) {
      return c.json({ error: "Name is required" }, 400);
    }
    
    // First user becomes admin
    const { total } = registry.listUsers(0, 1);
    const role = total === 0 ? "admin" : "user";
    
    const user = registry.createUser({
      name: body.name.trim(),
      role,
      twitterHandle: body.twitterHandle,
    });
    
    // Get trader info
    const trader = registry.getTrader(user.traderId);
    
    return c.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        traderId: user.traderId,
        twitterHandle: user.twitterHandle,
        createdAt: user.createdAt,
      },
      token: user.token, // Only returned on registration!
      trader: trader ? {
        id: trader.id,
        balance: trader.balance,
      } : null,
    }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

// =============================================================================
// AUTHENTICATED ENDPOINTS
// =============================================================================

/**
 * Get current user (from token)
 * GET /users/me
 */
usersApi.get("/me", authMiddleware, (c) => {
  const user = c.get("user");
  const trader = registry.getTrader(user.traderId);
  
  return c.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      traderId: user.traderId,
      twitterHandle: user.twitterHandle,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
    },
    trader: trader ? {
      id: trader.id,
      balance: trader.balance,
      realizedPnl: trader.realizedPnl,
      tradeCount: trader.tradeCount,
      wins: trader.wins,
      losses: trader.losses,
      positions: Object.fromEntries(trader.positions),
    } : null,
  });
});

/**
 * Update current user
 * PATCH /users/me
 */
usersApi.patch("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json() as { name?: string; twitterHandle?: string };
  
  if (body.name) user.name = body.name;
  if (body.twitterHandle !== undefined) user.twitterHandle = body.twitterHandle || undefined;
  
  registry.updateUser(user);
  
  return c.json({
    id: user.id,
    name: user.name,
    role: user.role,
    twitterHandle: user.twitterHandle,
  });
});

/**
 * Get user's balance
 * GET /users/me/balance
 */
usersApi.get("/me/balance", authMiddleware, (c) => {
  const user = c.get("user");
  const trader = registry.getTrader(user.traderId);
  
  if (!trader) {
    return c.json({ error: "Trader not found" }, 404);
  }
  
  return c.json({
    balance: trader.balance,
    realizedPnl: trader.realizedPnl,
  });
});

/**
 * Get user's positions
 * GET /users/me/positions
 */
usersApi.get("/me/positions", authMiddleware, (c) => {
  const user = c.get("user");
  const trader = registry.getTrader(user.traderId);
  
  if (!trader) {
    return c.json({ error: "Trader not found" }, 404);
  }
  
  const positions = [];
  for (const [marketId, pos] of trader.positions) {
    const market = registry.getMarket(marketId);
    positions.push({
      marketId,
      market: market ? {
        question: market.question,
        status: market.status,
        yesPrice: market.prices.yesPrice,
        noPrice: market.prices.noPrice,
      } : null,
      yesTokens: pos.yesTokens,
      noTokens: pos.noTokens,
      yesCostBasis: pos.yesCostBasis,
      noCostBasis: pos.noCostBasis,
    });
  }
  
  return c.json({ positions });
});

/**
 * Get user's orders
 * GET /users/me/orders?status=OPEN,PARTIALLY_FILLED
 */
usersApi.get("/me/orders", authMiddleware, (c) => {
  const user = c.get("user");
  const status = c.req.query("status")?.split(",") as any;
  
  const orders = registry.getOrdersForTrader(user.traderId, status);
  return c.json({ orders });
});

/**
 * Get user's trades
 * GET /users/me/trades?limit=50
 */
usersApi.get("/me/trades", authMiddleware, (c) => {
  const user = c.get("user");
  const limit = parseInt(c.req.query("limit") || "50");
  
  const trades = registry.getTradesForTrader(user.traderId, limit);
  return c.json({ trades });
});

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * List all users (admin only)
 * GET /users?limit=50&offset=0
 */
usersApi.get("/", authMiddleware, adminMiddleware, (c) => {
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  
  const result = registry.listUsers(offset, limit);
  return c.json({
    users: result.users.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      traderId: u.traderId,
      twitterHandle: u.twitterHandle,
      createdAt: u.createdAt,
      lastActiveAt: u.lastActiveAt,
    })),
    total: result.total,
    offset,
    limit,
  });
});

/**
 * Get user by ID (admin only)
 * GET /users/:id
 */
usersApi.get("/:id", authMiddleware, adminMiddleware, (c) => {
  const id = c.req.param("id");
  const user = registry.getUser(id);
  
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  
  const trader = registry.getTrader(user.traderId);
  
  return c.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      traderId: user.traderId,
      twitterHandle: user.twitterHandle,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
    },
    trader: trader ? {
      id: trader.id,
      balance: trader.balance,
      realizedPnl: trader.realizedPnl,
      tradeCount: trader.tradeCount,
    } : null,
  });
});

/**
 * Create user with specific role (admin only)
 * POST /users
 */
usersApi.post("/", authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json() as { 
      name: string; 
      role?: UserRole;
      twitterHandle?: string;
    };
    
    const user = registry.createUser({
      name: body.name,
      role: body.role || "user",
      twitterHandle: body.twitterHandle,
    });
    
    return c.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        traderId: user.traderId,
      },
      token: user.token,
    }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

/**
 * Credit balance to user (admin only)
 * POST /users/:id/credit
 */
usersApi.post("/:id/credit", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json() as { amount: number };
  
  const user = registry.getUser(id);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }
  
  try {
    const trader = registry.creditBalance(user.traderId, body.amount);
    return c.json({
      traderId: trader.id,
      balance: trader.balance,
      credited: body.amount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});
