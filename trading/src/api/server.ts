/**
 * Trading Floor API Server
 * 
 * Starts the API and optionally runs auto-trading in the background.
 */

import { serve } from "@hono/node-server";
import { api, startAutoTrading } from "./index.js";

const PORT = parseInt(process.env.TRADING_API_PORT || "3300");
const AUTO_TRADE = process.env.AUTO_TRADE !== "false"; // Enable by default

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                        SIG ARENA - TRADING FLOOR API                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Starting server on port ${PORT}...                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

serve({
  fetch: api.fetch,
  port: PORT,
});

console.log(`[Trading API] Server running at http://localhost:${PORT}`);
console.log(`[Trading API] Endpoints:`);
console.log(`  GET  /health              - Health check`);
console.log(`  GET  /agents              - List agents`);
console.log(`  POST /sessions            - Start trading session`);
console.log(`  GET  /sessions/:id        - Get session state`);
console.log(`  GET  /sessions/:id/stream - SSE message stream`);
console.log(`  GET  /sessions/:id/floor  - Get floor messages`);
console.log(`  GET  /sessions/:id/chats  - Get side chats`);

// Start auto-trading in background
if (AUTO_TRADE) {
  console.log(`\n[Trading API] Auto-trading ENABLED - will poll for markets`);
  startAutoTrading().catch(err => {
    console.error("[Trading API] Auto-trading error:", err);
  });
} else {
  console.log(`\n[Trading API] Auto-trading DISABLED - set AUTO_TRADE=true to enable`);
}
