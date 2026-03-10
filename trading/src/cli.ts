#!/usr/bin/env node
/**
 * Trading CLI
 *
 * Run trading sessions from command line.
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from multiple possible locations
config({ path: resolve(__dirname, "../../.env") }); // trading/.env
config({ path: resolve(__dirname, "../../../.env") }); // root/.env
config({ path: resolve(process.cwd(), ".env") }); // cwd/.env

import { getTradingCoordinator } from "./coordinator/index.js";
import {
  getOpenMarkets,
  getTradingMarket,
  isRegistryAvailable,
  type TradingMarket,
} from "./registry/index.js";
import type { MarketInfo, Message, SideChat } from "./types/index.js";

// =============================================================================
// MOCK MARKET (for demo)
// =============================================================================

const DEMO_MARKET: MarketInfo = {
  id: "mkt_1765077935082_fgsa67",
  question: "Will @sama tweet containing 'AI' by few days?",
  description:
    "@sama (ID:1605, Sam Altman) last tweeted Dec 1 about David Sacks and AI innovation. Recent activity focuses on AI progress (GPT-5.1, Codex). Consistent pattern but 6-day gap; trending AI topics and competitor Grok buzz may prompt. Verified via getUserTweets (19 recent tweets, many AI-related). Resolves YES if any tweet from @sama after 2025-12-07T03:24:48Z contains 'AI' or 'ai' (case-insensitive).",
  yesPrice: 0.85,
  noPrice: 0.15,
  volume: 5200,
  resolutionDate: "2025-12-10T07:59:59.999Z",
  status: "OPEN",
};

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "demo") {
    await runDemo();
  } else if (command === "live") {
    await runLiveTrading();
  } else if (command === "trade") {
    const once = args.includes("--once");
    await runTrading(once);
  } else {
    console.log(`
Basemarket Trading CLI

Commands:
  demo              Run a demo trading session with mock market
  live              Run live trading with real registry markets
  trade             Run trading on real markets from registry
  trade --once      Run a single trading round
`);
  }
}

// =============================================================================
// DEMO MODE
// =============================================================================

async function runDemo() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                           Basemarket - TRADING DEMO                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Market: "${DEMO_MARKET.question.slice(0, 60)}..."
║  YES: $${DEMO_MARKET.yesPrice.toFixed(2)} | NO: $${DEMO_MARKET.noPrice.toFixed(2)}
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  const coordinator = getTradingCoordinator(":memory:");

  // Set up message handler
  coordinator.setHandlers({
    onMessage: (msg) => {
      // Already logged by coordinator
    },
    onTrade: (trade) => {
      console.log(
        `\n🎉 TRADE EXECUTED: ${trade.buyerId} bought ${trade.quantity} ${trade.token} from ${trade.sellerId} @ $${trade.price}\n`,
      );
    },
  });

  // Initialize agents
  console.log("\n📋 INITIALIZING AGENTS...\n");
  const agents = await coordinator.initializeAgents(10000);

  for (const agent of agents) {
    console.log(
      `  ✓ @${agent.handle} (${agent.personality.riskProfile}, ${agent.personality.tradingStyle})`,
    );
  }

  // Run interest phase
  console.log("\n\n📢 PHASE 1: INTEREST BROADCAST\n");
  console.log("─".repeat(80));

  const interests = await coordinator.runInterestPhase(DEMO_MARKET);

  console.log("\n" + "─".repeat(80));
  console.log("\n📊 INTEREST SUMMARY:\n");

  const interested = interests.filter((i) => i.type === "INTERESTED");
  const passed = interests.filter((i) => i.type === "PASS");

  console.log("  INTERESTED:");
  for (const i of interested) {
    console.log(
      `    @${i.agentId.replace("agent_", "")}: ${i.side} ${i.quantity} ${i.token} @ $${i.price?.toFixed(2)}`,
    );
    console.log(`      "${i.message}"`);
  }

  console.log("\n  PASSED:");
  for (const i of passed) {
    console.log(`    @${i.agentId.replace("agent_", "")}: "${i.message}"`);
  }

  // Run trading phase
  console.log("\n\n🏛️  PHASE 2: MAIN FLOOR TRADING\n");
  console.log("─".repeat(80));

  const floorMessages: Message[] = [];
  const sideChats = new Map<string, SideChat>();

  // Run 10 rounds
  for (let round = 1; round <= 10; round++) {
    console.log(`\n--- Round ${round} ---\n`);

    // Expire old agreements
    const expired = coordinator.expireAgreements();
    if (expired > 0) {
      console.log(`  ⏰ ${expired} agreement(s) expired\n`);
    }

    // Run floor round (all agents in parallel, max 10 rounds)
    const newMessages = await coordinator.runFloorRound(
      DEMO_MARKET,
      interests,
      floorMessages,
      sideChats,
      round,
      10, // maxRounds
    );

    // Run any active side chats
    const activeChats = Array.from(sideChats.values()).filter(
      (c) => c.status === "NEGOTIATING",
    );
    if (activeChats.length > 0) {
      console.log(`\n  [Running ${activeChats.length} active side chat(s)]`);
      for (const chat of activeChats) {
        console.log(
          `  [Side Chat: ${chat.participants.map((p) => "@" + p.replace("agent_", "")).join(" ↔ ")}]`,
        );
        const result = await coordinator.runSideChatRound(DEMO_MARKET, chat);
        if (result.closed) {
          console.log(`  [Chat closed: ${chat.status}]`);
        }
      }
    }

    // Check if everyone left (count AGENT_LEFT messages)
    const agentsWhoLeft = floorMessages
      .filter((m) => m.type === "AGENT_LEFT")
      .map((m) => m.agentId);
    const uniqueLeft = new Set(agentsWhoLeft);
    if (uniqueLeft.size >= 5) {
      console.log("\n  All agents have left the floor.\n");
      break;
    }

    // Small delay between rounds
    if (round < 10) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log("\n" + "═".repeat(80));
  console.log("\n✅ DEMO COMPLETE\n");
}

// =============================================================================
// LIVE TRADING (with Registry)
// =============================================================================

// Track processed markets to avoid re-processing
const processedMarkets = new Set<string>();

async function runLiveTrading() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                       Basemarket - LIVE TRADING                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  // Check registry connection
  console.log("[Trading] Checking registry connection...");
  const registryOk = await isRegistryAvailable();

  if (!registryOk) {
    console.error(
      "[Trading] ❌ Registry not available. Start it with: pnpm registry",
    );
    console.log("[Trading] Falling back to demo mode...\n");
    await runDemo();
    return;
  }

  console.log("[Trading] ✓ Registry connected");

  // Initialize coordinator ONCE with registry enabled
  const coordinator = getTradingCoordinator(":memory:", true);

  coordinator.setHandlers({
    onTrade: (trade) => {
      console.log(
        `\n🎉 TRADE: ${trade.buyerId} bought ${trade.quantity} ${trade.token} from ${trade.sellerId} @ $${trade.price}\n`,
      );
    },
  });

  // Initialize agents ONCE with $10k each
  console.log("📋 INITIALIZING AGENTS WITH $10,000 EACH...\n");
  const agents = await coordinator.initializeAgents(10000);

  for (const agent of agents) {
    console.log(
      `  ✓ @${agent.handle} ($10,000) - ${agent.personality.riskProfile}`,
    );
  }

  // Run continuous trading loop
  console.log("\n🔄 STARTING CONTINUOUS TRADING LOOP...\n");
  console.log("[Trading] Will poll for new markets every 30 seconds\n");

  let iteration = 0;

  while (true) {
    iteration++;

    // Fetch open markets
    const markets = await getOpenMarkets(10);

    // Find new markets we haven't processed
    const newMarkets = markets.filter((m) => !processedMarkets.has(m.id));

    if (newMarkets.length > 0) {
      console.log(`\n📢 NEW MARKETS DETECTED: ${newMarkets.length}\n`);

      // Process each new market sequentially
      for (const market of newMarkets) {
        processedMarkets.add(market.id);
        await processMarket(coordinator, market);
      }
    } else if (iteration === 1) {
      // First run, no markets
      console.log(
        "[Trading] No open markets found. Waiting for new markets...",
      );
    }

    // Wait 30 seconds before checking for new markets
    console.log("\n⏳ Waiting 30s for new markets...");
    await new Promise((r) => setTimeout(r, 30000));
  }
}

/**
 * Process a single market - broadcast to agents and run trading
 */
async function processMarket(
  coordinator: ReturnType<typeof getTradingCoordinator>,
  market: TradingMarket,
) {
  const marketInfo: MarketInfo = {
    id: market.id,
    question: market.question,
    description: market.description,
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    volume: market.volume,
    resolutionDate: market.resolutionDate,
    status: market.status,
  };

  console.log(`
════════════════════════════════════════════════════════════════════════════════
📊 NEW MARKET: "${market.question.slice(0, 60)}..."
   YES: $${market.yesPrice.toFixed(2)} | NO: $${market.noPrice.toFixed(2)}
════════════════════════════════════════════════════════════════════════════════
`);

  // Reset agent floor status for new market
  coordinator.resetAgentsForNewMarket();

  // Run interest phase - broadcast to all agents
  console.log("📢 BROADCASTING TO AGENTS...\n");
  const interests = await coordinator.runInterestPhase(marketInfo);

  // Show interests
  const interested = interests.filter((i) => i.type === "INTERESTED");
  console.log(
    `\n📊 ${interested.length}/${interests.length} AGENTS INTERESTED:\n`,
  );
  for (const i of interested) {
    console.log(
      `  @${i.agentId.replace("agent_", "")}: ${i.side} ${i.quantity} ${i.token} @ $${i.price?.toFixed(2)}`,
    );
  }

  // Skip trading if no one interested
  if (interested.length < 2) {
    console.log("\n⏭️ Skipping trading (need at least 2 interested agents)\n");
    return;
  }

  // Run trading rounds
  const floorMessages: Message[] = [];
  const sideChats = new Map<string, SideChat>();

  console.log("\n🏛️ TRADING FLOOR\n");

  for (let round = 1; round <= 10; round++) {
    // Check if market was resolved during trading
    const currentMarket = await getTradingMarket(market.id);
    if (currentMarket && currentMarket.status !== "OPEN") {
      console.log(
        `\n⚠️ Market resolved during trading: ${currentMarket.status}\n`,
      );
      break;
    }

    console.log(`--- Round ${round}/10 ---\n`);

    coordinator.expireAgreements();

    await coordinator.runFloorRound(
      marketInfo,
      interests,
      floorMessages,
      sideChats,
      round,
      10,
    );

    // Run side chats
    const activeChats = Array.from(sideChats.values()).filter(
      (c) => c.status === "NEGOTIATING",
    );
    if (activeChats.length > 0) {
      for (const chat of activeChats) {
        await coordinator.runSideChatRound(marketInfo, chat);
      }
    }

    // Check if all agents left
    const agentsLeft = floorMessages.filter(
      (m) => m.type === "AGENT_LEFT",
    ).length;
    if (agentsLeft >= 5) {
      console.log("\n  All agents have left the floor.\n");
      break;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n✅ MARKET COMPLETE: ${market.question.slice(0, 40)}...\n`);
}

// =============================================================================
// REAL TRADING
// =============================================================================

async function runTrading(once: boolean) {
  console.log("[Trading] Starting trading service...");
  await runLiveTrading();
}

// =============================================================================
// RUN
// =============================================================================

main().catch(console.error);
