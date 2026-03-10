/**
 * Basemarket - Resolution Agent CLI
 *
 * Monitors markets for resolution and provides API for early resolution requests.
 */

import { CONFIG, validateConfig } from "./config/index.js";
import { ResolutionAgent } from "./agent/index.js";
import { startApiServer } from "./api/index.js";
import {
  configureRegistry,
  isRegistryHealthy,
  getResolutionStats,
  getPendingResolutions,
  getOverdueMarkets,
} from "@sigarena/common";

const DIVIDER = "─".repeat(70);
const DOUBLE_DIVIDER = "═".repeat(70);

// Registry API configuration
const REGISTRY_URL = process.env.REGISTRY_URL || "http://localhost:3100";
const BOOTSTRAP_SECRET =
  process.env.BOOTSTRAP_SECRET || "sigarena-bootstrap-2024";
let AGENT_TOKEN = process.env.AGENT_TOKEN;

/**
 * Fetch agent token from registry if not set
 */
async function ensureAgentToken(): Promise<void> {
  if (AGENT_TOKEN) return;

  console.log("[Resolution] AGENT_TOKEN not set, fetching from registry...");

  try {
    const response = await fetch(`${REGISTRY_URL}/users/agent-token`, {
      headers: { "X-Bootstrap-Secret": BOOTSTRAP_SECRET },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as { token: string; agentId: string };
    AGENT_TOKEN = data.token;
    configureRegistry({ url: REGISTRY_URL, token: AGENT_TOKEN });
    console.log(`[Resolution] Got agent token for ${data.agentId}`);
  } catch (err) {
    console.error("[ERROR] Failed to fetch agent token:", err);
    console.error(
      "[ERROR] Set AGENT_TOKEN env var or ensure registry is running",
    );
    process.exit(1);
  }
}

// Configure the registry client
configureRegistry({ url: REGISTRY_URL, token: AGENT_TOKEN });

const USAGE = `
Basemarket - Resolution Agent

USAGE
  pnpm resolve             Start monitoring daemon + API server
  pnpm resolve:once        Run single resolution cycle and exit
  pnpm resolve:status      Show pending/overdue markets
  pnpm resolve:custom      Run custom resolution (ad-hoc testing)

ENVIRONMENT
  XAI_API_KEY               Required. Your xAI API key.
  REGISTRY_URL              Registry API URL (default: http://localhost:3100)
  AGENT_TOKEN               Optional. Auto-fetched from registry if not set.
  BOOTSTRAP_SECRET          Secret for auto-fetching token (default: sigarena-bootstrap-2024)
  RESOLUTION_API_PORT       API server port (default: 3200)
  RESOLUTION_CHECK_INTERVAL Resolution check interval in ms (default: 60000)
  RESOLUTION_MONITOR_HOURS  Hours ahead to monitor (default: 24)
  RESOLUTION_BATCH_SIZE     Markets per cycle (default: 10)

API ENDPOINTS (when running daemon)
  GET  /health             Health check
  GET  /stats              Get agent stats
  POST /resolve            Request early resolution
  POST /cycle              Trigger manual resolution cycle
  POST /custom             Custom resolution (ad-hoc testing)

CUSTOM RESOLUTION (via API)
  curl -X POST localhost:3200/custom -H "Content-Type: application/json" -d '{
    "question": "Did @elonmusk tweet about Grok in the last 24 hours?",
    "verificationType": "tweet_exists",
    "targetHandles": ["elonmusk"],
    "keywords": ["grok", "Grok"]
  }'

EXAMPLE
  XAI_API_KEY=xxx AGENT_TOKEN=sig_xxx pnpm resolve
`;

async function showStatus(): Promise<void> {
  console.log(DOUBLE_DIVIDER);
  console.log("  RESOLUTION STATUS");
  console.log(DOUBLE_DIVIDER);

  // Get stats
  const stats = await getResolutionStats();
  if (stats.stats) {
    console.log("\n  Stats:");
    console.log(`    Pending:         ${stats.stats.pendingCount}`);
    console.log(`    Overdue:         ${stats.stats.overdueCount}`);
    console.log(`    Resolved Today:  ${stats.stats.resolvedToday}`);
  }

  // Get pending
  const pending = await getPendingResolutions(24);
  if (pending.markets && pending.markets.length > 0) {
    console.log("\n  Pending Resolution (next 24h):");
    for (const m of pending.markets.slice(0, 10)) {
      console.log(
        `    ${m.id.slice(0, 8)}... | ${m.resolutionDate} | ${m.question.slice(0, 40)}...`,
      );
    }
    if (pending.markets.length > 10) {
      console.log(`    ... and ${pending.markets.length - 10} more`);
    }
  }

  // Get overdue
  const overdue = await getOverdueMarkets();
  if (overdue.markets && overdue.markets.length > 0) {
    console.log("\n  ⚠️  OVERDUE (need resolution):");
    for (const m of overdue.markets) {
      console.log(
        `    ${m.id.slice(0, 8)}... | ${m.resolutionDate} | ${m.question.slice(0, 40)}...`,
      );
    }
  }

  console.log("\n" + DOUBLE_DIVIDER);
}

async function runDaemon(): Promise<void> {
  console.log(DOUBLE_DIVIDER);
  console.log("  Basemarket - RESOLUTION AGENT");
  console.log(DOUBLE_DIVIDER);
  console.log(`\n  Registry:    ${REGISTRY_URL}`);
  console.log(`  Check Int:   ${CONFIG.resolution.checkIntervalMs / 1000}s`);
  console.log(`  Monitor:     ${CONFIG.resolution.monitorHoursAhead}h ahead`);
  console.log(`  Batch Size:  ${CONFIG.resolution.batchSize}`);
  console.log(`  API Port:    ${CONFIG.api.port}`);

  const agent = new ResolutionAgent({
    checkIntervalMs: CONFIG.resolution.checkIntervalMs,
    monitorHoursAhead: CONFIG.resolution.monitorHoursAhead,
    batchSize: CONFIG.resolution.batchSize,
    maxRetries: CONFIG.resolution.maxRetries,
    retryDelayMs: CONFIG.resolution.retryDelayMs,
  });

  // Start API server
  startApiServer(agent, CONFIG.api.port);

  // Start monitoring
  console.log("\n" + DIVIDER);
  console.log("  STARTING MONITORING");
  console.log(DIVIDER);

  const stop = agent.startMonitoring((stats) => {
    if (stats.resolved > 0 || stats.failed > 0) {
      console.log(
        `\n  Cycle: ${stats.resolved} resolved, ${stats.failed} failed, ${stats.skipped} skipped`,
      );
    }
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n  Shutting down...");
    stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    stop();
    process.exit(0);
  });

  console.log("\n  Press Ctrl+C to stop\n");
}

async function runOnce(): Promise<void> {
  console.log("[Resolution] Running single cycle...\n");

  const agent = new ResolutionAgent({
    batchSize: CONFIG.resolution.batchSize,
    monitorHoursAhead: CONFIG.resolution.monitorHoursAhead,
  });

  const stats = await agent.runResolutionCycle();

  console.log("\n" + DIVIDER);
  console.log("  CYCLE COMPLETE");
  console.log(DIVIDER);
  console.log(`  Resolved:  ${stats.resolved}`);
  console.log(`  Failed:    ${stats.failed}`);
  console.log(`  Skipped:   ${stats.skipped}`);
  console.log(DIVIDER);
}

async function runCustom(args: string[]): Promise<void> {
  // Parse args: question, handles, keywords
  const question = args[0];
  if (!question) {
    console.log(`
Custom Resolution - Ad-hoc Testing

USAGE
  pnpm resolve:custom "Did @elonmusk tweet about Grok today?"
  pnpm resolve:custom "Does @sama have more than 5M followers?" --type=follower_milestone --handles=sama --threshold=5000000

OPTIONS
  --type=TYPE           Verification type: tweet_exists, follower_milestone, engagement_threshold, account_action, tweet_count, general
  --handles=h1,h2       Target X handles (comma-separated)
  --keywords=k1,k2      Keywords to search (comma-separated)
  --threshold=N         Numeric threshold for milestone/engagement checks
  --context="..."       Additional context for the question

EXAMPLES
  pnpm resolve:custom "Did @elonmusk mention Grok?" --handles=elonmusk --keywords=grok,Grok
  pnpm resolve:custom "Does @openai have 5M followers?" --type=follower_milestone --handles=openai --threshold=5000000
  pnpm resolve:custom "Did @sama reply to @elonmusk?" --type=account_action --handles=sama,elonmusk
`);
    return;
  }

  // Parse options
  const options: Record<string, string> = {};
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      options[key] = value || "true";
    }
  }

  const request = {
    question,
    verificationType: (options.type as any) || "general",
    targetHandles: options.handles?.split(",").map((h) => h.trim()),
    keywords: options.keywords?.split(",").map((k) => k.trim()),
    threshold: options.threshold ? parseInt(options.threshold, 10) : undefined,
    context: options.context,
  };

  console.log(DOUBLE_DIVIDER);
  console.log("  CUSTOM RESOLUTION");
  console.log(DOUBLE_DIVIDER);
  console.log(`\n  Question: ${question}`);
  console.log(`  Type:     ${request.verificationType}`);
  if (request.targetHandles)
    console.log(
      `  Handles:  ${request.targetHandles.map((h) => `@${h}`).join(", ")}`,
    );
  if (request.keywords)
    console.log(`  Keywords: ${request.keywords.join(", ")}`);
  if (request.threshold) console.log(`  Threshold: ${request.threshold}`);
  console.log("\n" + DIVIDER);
  console.log("  RESOLVING...");
  console.log(DIVIDER + "\n");

  const agent = new ResolutionAgent();
  const result = await agent.resolveCustom(request);

  console.log("\n" + DOUBLE_DIVIDER);
  console.log("  RESULT");
  console.log(DOUBLE_DIVIDER);
  console.log(`\n  Outcome:     ${result.outcome}`);
  console.log(
    `  Confidence:  ${(result.evidence.confidence * 100).toFixed(1)}%`,
  );
  console.log(`  Tool Calls:  ${result.toolCalls}`);
  console.log(`  Model:       ${result.model}`);

  console.log("\n  Evidence:");
  console.log(`    Type:        ${result.evidence.type}`);
  if (result.evidence.url)
    console.log(`    URL:         ${result.evidence.url}`);
  if (result.evidence.tweetId)
    console.log(`    Tweet ID:    ${result.evidence.tweetId}`);
  console.log(`    Explanation: ${result.evidence.explanation}`);

  console.log("\n" + DOUBLE_DIVIDER);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Custom command doesn't need registry
  if (command === "custom") {
    try {
      validateConfig();
    } catch (error) {
      console.error("[ERROR]", error);
      process.exit(1);
    }
    await runCustom(args.slice(1));
    return;
  }

  // Check registry connection for commands that need it
  if (command && !["help", "--help"].includes(command)) {
    try {
      validateConfig();
    } catch (error) {
      console.error("[ERROR]", error);
      process.exit(1);
    }

    console.log(`[Resolution] Registry: ${REGISTRY_URL}`);
    const healthy = await isRegistryHealthy();
    if (!healthy) {
      console.error(`[ERROR] Cannot reach registry at ${REGISTRY_URL}`);
      console.error(
        "[ERROR] Start the registry first: cd registry && pnpm start",
      );
      process.exit(1);
    }

    // Ensure we have an agent token
    await ensureAgentToken();

    console.log("[Resolution] Registry connected\n");
  }

  switch (command) {
    case "start":
    case "daemon":
      await runDaemon();
      break;

    case "once":
    case "cycle":
      await runOnce();
      break;

    case "status":
      await showStatus();
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
