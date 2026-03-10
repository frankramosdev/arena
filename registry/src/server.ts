/**
 * Basemarket Registry Server
 *
 * Starts the Hono API server.
 */

import { serve } from "@hono/node-server";
import { api, registry } from "./api/index.js";

const PORT = parseInt(process.env.REGISTRY_PORT || "3100");

// =============================================================================
// BOOTSTRAP - Auto-create admin and agent users on first startup
// =============================================================================

function bootstrap() {
  const { total } = registry.listUsers(0, 1);

  if (total > 0) {
    console.log(
      `[Bootstrap] Found ${total} existing users, skipping bootstrap`,
    );

    // Log existing agent token if we have one
    const agents = registry.listUsers(0, 100);
    const agent = agents.users.find((u) => u.role === "agent");
    if (agent) {
      console.log(`[Bootstrap] Existing agent token: ${agent.token}`);
    }
    return;
  }

  console.log("[Bootstrap] First startup - creating admin and agent users...");

  // Create admin user
  const admin = registry.createUser({
    name: "Admin",
    role: "admin",
  });
  console.log(`[Bootstrap] Created admin: ${admin.id}`);

  // Create shared agent (used by both creation and resolution)
  const agent = registry.createUser({
    name: "SigArenaAgent",
    role: "agent",
  });
  console.log(`[Bootstrap] Created agent: ${agent.id}`);

  // Output tokens
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                    BOOTSTRAP COMPLETE                              ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ADMIN_TOKEN=${admin.token}
║  AGENT_TOKEN=${agent.token}
║                                                                    ║
║  Set AGENT_TOKEN in your .env for creation/resolution agents.     ║
╚═══════════════════════════════════════════════════════════════════╝
`);

  // Write to file for Docker to pick up
  try {
    const fs = require("fs");
    fs.writeFileSync("/app/data/.agent_token", agent.token);
    console.log("[Bootstrap] Wrote agent token to /app/data/.agent_token");
  } catch {
    // Not in Docker or can't write, skip
  }
}

// Run bootstrap
bootstrap();

console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                     Basemarket Registry                             ║
║                   Polymarket-style Exchange                        ║
╠═══════════════════════════════════════════════════════════════════╣
║  Token Model: 1 YES + 1 NO = $1                                   ║
║  Database: SQLite (markets.db)                                    ║
╚═══════════════════════════════════════════════════════════════════╝
`);

serve(
  {
    fetch: api.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`🚀 Registry API running at http://localhost:${info.port}`);
    console.log(`
API Endpoints:

  Public:
  GET  /                          API info
  GET  /health                    Health check
  GET  /stats                     Registry statistics
  GET  /markets                   List markets
  GET  /markets/:id               Get market
  GET  /markets/:id/orderbook     Order book

  Users:
  POST /users/register            Register (returns token)
  GET  /users/me                  Current user (auth required)
  GET  /users/me/balance          Your USD balance
  GET  /users/me/positions        Your positions
  GET  /users/me/orders           Your orders

  Trading (auth required):
  POST /trade/mint                Mint YES+NO tokens
  POST /trade/redeem              Redeem for USD
  POST /trade/order               Place order
  DELETE /trade/order/:id         Cancel order

  Resolution (agent role):
  GET  /resolution/pending        Markets expiring soon
  POST /resolution/:marketId      Resolve market

  Admin:
  POST /markets                   Create market
  GET  /users                     List all users
  POST /users/:id/credit          Credit balance
`);
  },
);
