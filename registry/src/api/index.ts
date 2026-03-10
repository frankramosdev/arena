/**
 * Basemarket Registry API
 *
 * Hono-based REST API for the market registry.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { MarketRegistry } from "../registry.js";
import { ResolutionAgent } from "../resolution.js";
import { marketsApi } from "./markets.js";
import { tradingApi } from "./trading.js";
import { usersApi } from "./users.js";
import { resolutionApi } from "./resolution.js";
import { authMiddleware } from "./middleware.js";

// =============================================================================
// SETUP
// =============================================================================

// Database path - use /app/data in production (Docker volume), local file otherwise
const DB_PATH =
  process.env.DATABASE_PATH ||
  (process.env.NODE_ENV === "production"
    ? "/app/data/markets.db"
    : "markets.db");

// Shared instances
export const registry = new MarketRegistry(DB_PATH);
export const resolutionAgent = new ResolutionAgent(registry);

console.log(`[Registry] Database: ${DB_PATH}`);

// Main API app
export const api = new Hono();

// Global middleware
api.use("*", cors());
api.use("*", logger());

// =============================================================================
// ROUTES
// =============================================================================

// Health & stats (no auth required)
api.get("/", (c) =>
  c.json({
    name: "Basemarket Registry",
    version: "1.0.0",
    docs: "https://github.com/sigarena/registry",
  }),
);

api.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  }),
);

api.get("/stats", (c) => {
  const stats = registry.getStats();
  return c.json(stats);
});

// Mount sub-routers
api.route("/users", usersApi);
api.route("/markets", marketsApi);
api.route("/trade", tradingApi);
api.route("/resolution", resolutionApi);
