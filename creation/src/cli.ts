/**
 * SIG Arena - Creation Agent CLI
 * 
 * Generates markets and submits them to the Registry API.
 * The agent itself checks for duplicates via the searchExistingMarkets tool.
 */

import { CONFIG, validateConfig } from "./config/index.js";
import { CreationAgent } from "./agent/index.js";
import type { Market } from "./types/index.js";
import { 
  configureRegistry, 
  getRegistryStats as fetchRegistryStats,
  isRegistryHealthy,
} from "@sigarena/common";

const DIVIDER = "─".repeat(70);
const DOUBLE_DIVIDER = "═".repeat(70);

// Registry API configuration
const REGISTRY_URL = process.env.REGISTRY_URL || "http://localhost:3100";
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET || "sigarena-bootstrap-2024";
let AGENT_TOKEN = process.env.AGENT_TOKEN;

/**
 * Fetch agent token from registry if not set
 */
async function ensureAgentToken(): Promise<void> {
  if (AGENT_TOKEN) return;
  
  console.log("[SIG Arena] AGENT_TOKEN not set, fetching from registry...");
  
  try {
    const response = await fetch(`${REGISTRY_URL}/users/agent-token`, {
      headers: { "X-Bootstrap-Secret": BOOTSTRAP_SECRET },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json() as { token: string; agentId: string };
    AGENT_TOKEN = data.token;
    configureRegistry({ url: REGISTRY_URL, token: AGENT_TOKEN });
    console.log(`[SIG Arena] Got agent token for ${data.agentId}`);
  } catch (err) {
    console.error("[ERROR] Failed to fetch agent token:", err);
    console.error("[ERROR] Set AGENT_TOKEN env var or ensure registry is running");
    process.exit(1);
  }
}

// Configure the registry client (used by agent's searchExistingMarkets tool)
configureRegistry({ url: REGISTRY_URL, token: AGENT_TOKEN });

function formatMarket(market: Market, index: number): string {
  const lines: string[] = [
    "",
    DIVIDER,
    `MARKET #${index + 1}  |  ${market.id}`,
    DIVIDER,
    "",
    `  Question:     ${market.question}`,
    `  Description:  ${market.description}`,
    "",
    `  Timeframe:    ${market.timeframe}`,
    `  Resolves:     ${market.resolutionDate}`,
    "",
    `  Verification:`,
    `    Type:       ${market.verification.type}`,
    `    Criteria:   ${market.verification.resolutionCriteria}`,
  ];

  if (market.verification.targetHandles?.length) {
    lines.push(`    Handles:    ${market.verification.targetHandles.map((h) => `@${h}`).join(", ")}`);
  }
  if (market.verification.keywords?.length) {
    lines.push(`    Keywords:   ${market.verification.keywords.join(", ")}`);
  }
  if (market.verification.threshold) {
    lines.push(`    Threshold:  ${market.verification.threshold}`);
  }

  lines.push("", `  Tags:         ${market.tags.join(", ")}`);

  if (market.sources.length > 0) {
    lines.push("", "  Sources:");
    market.sources.forEach((s, i) => {
      if (s.handle) lines.push(`    ${i + 1}. @${s.handle}`);
      if (s.url) lines.push(`       ${s.url}`);
      if (s.snippet) lines.push(`       "${s.snippet.slice(0, 80)}..."`);
    });
  }

  return lines.join("\n");
}

/**
 * Submit market to Registry API
 */
async function submitMarketToRegistry(market: Market): Promise<{ success: boolean; error?: string }> {
  if (!AGENT_TOKEN) {
    return { success: false, error: "AGENT_TOKEN not set. Get one from registry admin." };
  }

  try {
    const response = await fetch(`${REGISTRY_URL}/markets`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AGENT_TOKEN}`,
      },
      body: JSON.stringify({
        id: market.id,
        question: market.question,
        description: market.description,
        createdAt: market.createdAt,
        resolutionDate: market.resolutionDate,
        timeframe: market.timeframe,
        verification: market.verification,
        sources: market.sources,
        tags: market.tags,
        // Note: initialProbability is not sent - API always uses 0.5
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Submit markets to Registry API
 * Note: The agent already checks for duplicates via searchExistingMarkets tool
 */
async function submitMarketsToRegistry(markets: Market[]): Promise<{ saved: number; failed: number }> {
  console.log(`[Registry] Submitting ${markets.length} market(s)...`);
  
  let saved = 0;
  let failed = 0;

  for (const market of markets) {
    const result = await submitMarketToRegistry(market);
    if (result.success) {
      saved++;
      console.log(`  ✓ Created: ${market.id.slice(0, 8)}... "${market.question.slice(0, 50)}..."`);
    } else {
      failed++;
      // Registry returns "already exists" if duplicate - that's fine, agent should have avoided it
      console.log(`  ✗ Failed: ${market.id.slice(0, 8)}... - ${result.error}`);
    }
  }

  return { saved, failed };
}

/**
 * Get registry stats (uses common tool)
 */
async function getRegistryStats(): Promise<{ totalMarkets: number; openMarkets: number } | null> {
  const result = await fetchRegistryStats();
  if (result.error || !result.stats) return null;
  return {
    totalMarkets: result.stats.totalMarkets,
    openMarkets: result.stats.openMarkets,
  };
}

async function onMarketsGenerated(markets: Market[]): Promise<void> {
  console.log("\n" + DOUBLE_DIVIDER);
  console.log(`  GENERATED ${markets.length} MARKETS`);
  console.log(DOUBLE_DIVIDER);

  markets.forEach((market, index) => {
    console.log(formatMarket(market, index));
  });

  // Submit to registry (agent already checked for duplicates)
  console.log("\n" + DIVIDER);
  console.log("  SUBMITTING TO REGISTRY");
  console.log(DIVIDER);
  
  const { saved, failed } = await submitMarketsToRegistry(markets);
  
  console.log(`\n  Summary:`);
  console.log(`    ✓ Created:  ${saved} markets`);
  if (failed > 0) {
    console.log(`    ✗ Failed:   ${failed} markets`);
  }

  // Show registry stats
  const stats = await getRegistryStats();
  if (stats) {
    console.log("\n  Registry Stats:");
    console.log(`    Total Markets:  ${stats.totalMarkets}`);
    console.log(`    Open Markets:   ${stats.openMarkets}`);
  }

  console.log("\n" + DOUBLE_DIVIDER);
}

const USAGE = `
SIG Arena - Creation Agent

USAGE
  pnpm generate           Start continuous market generation
  pnpm generate:once      Generate markets once and exit

ENVIRONMENT
  XAI_API_KEY             Required. Your xAI API key.
  REGISTRY_URL            Registry API URL (default: http://localhost:3100)
  AGENT_TOKEN             Optional. Auto-fetched from registry if not set.
  BOOTSTRAP_SECRET        Secret for auto-fetching token (default: sigarena-bootstrap-2024)
  GENERATION_INTERVAL_MS  Interval between generations (default: 3600000ms)
  MAX_MARKETS_PER_RUN     Markets per generation cycle (default: 5)

EXAMPLE
  XAI_API_KEY=xxx pnpm generate:once
`;

async function runGenerate(once: boolean): Promise<void> {
  // Check registry is reachable
  console.log(`[SIG Arena] Registry URL: ${REGISTRY_URL}`);
  
  const healthy = await isRegistryHealthy();
  if (!healthy) {
    console.error(`[ERROR] Cannot reach registry at ${REGISTRY_URL}`);
    console.error("[ERROR] Start the registry first: cd registry && pnpm start");
    process.exit(1);
  }
  
  // Ensure we have an agent token
  await ensureAgentToken();
  
  const stats = await getRegistryStats();
  console.log(`[SIG Arena] Registry connected. ${stats?.totalMarkets ?? 0} markets, ${stats?.openMarkets ?? 0} open.\n`);

  const agent = new CreationAgent();

  if (once) {
    console.log("[SIG Arena] Running single generation cycle\n");
    const markets = await agent.runGenerationCycle();
    await onMarketsGenerated(markets);
  } else {
    console.log("[SIG Arena] Starting continuous generation");
    console.log(`[SIG Arena] Interval: ${CONFIG.generation.intervalMs / 1000}s`);
    console.log("[SIG Arena] Press Ctrl+C to stop\n");

    const stop = agent.startPeriodicGeneration(
      CONFIG.generation.intervalMs,
      async (markets) => {
        await onMarketsGenerated(markets);
      }
    );

    process.on("SIGINT", () => { stop(); process.exit(0); });
    process.on("SIGTERM", () => { stop(); process.exit(0); });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command && command !== "help" && command !== "--help") {
    try {
      validateConfig();
    } catch (error) {
      console.error("[ERROR]", error);
      process.exit(1);
    }
  }

  switch (command) {
    case "generate":
      await runGenerate(args.includes("--once"));
      break;
    default:
      console.log(USAGE);
      break;
  }
}

main().catch((error) => {
  console.error("[FATAL]", error.message || error);
  process.exit(1);
});
