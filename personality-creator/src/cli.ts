#!/usr/bin/env node
/**
 * Personality Creator CLI
 *
 * Ship Your Agent - Generate trading personalities from Twitter profiles.
 *
 * Usage: pnpm ship <username>
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from multiple possible locations
config({ path: resolve(__dirname, "../../.env") });
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(process.cwd(), ".env") });

import { PersonalityCreatorAgent } from "./agent/index.js";
import { log } from "./utils/index.js";
import type { GeneratedAgent } from "./types/index.js";

// =============================================================================
// CLI
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  const username = args[0].replace("@", "");
  const outputIdx = args.indexOf("--output");
  const outputDir =
    outputIdx !== -1 && args[outputIdx + 1]
      ? args[outputIdx + 1]
      : resolve(__dirname, "../agents");

  printBanner();

  console.log(`\n📍 Target: @${username}\n`);

  // Create the agent
  const agent = new PersonalityCreatorAgent({
    model: "grok-4-1-fast-reasoning",
    maxResearchSteps: 50,
    timeoutMs: 300_000,
    outputDir,
  });

  try {
    // Generate personality
    console.log("🔍 Starting research...\n");
    const generatedAgent = await agent.createPersonality(username);

    // Display results
    printResults(generatedAgent);

    // Save to file
    saveAgent(generatedAgent, outputDir);

    console.log("\n" + "═".repeat(80));
    console.log("\n✅ Agent ready to deploy!\n");
  } catch (err) {
    console.error("\n❌ Failed to create personality:", err);
    process.exit(1);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function printBanner() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                        Basemarket - SHIP YOUR AGENT                           ║
║                                                                              ║
║  Analyze Twitter profiles and generate trading personalities with Grok AI   ║
╚══════════════════════════════════════════════════════════════════════════════╝`);
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                        Basemarket - SHIP YOUR AGENT                           ║
╚══════════════════════════════════════════════════════════════════════════════╝

Usage: pnpm ship <username>

Arguments:
  username     Twitter username (without @)

Options:
  --output     Output directory (default: ./agents)
  --help       Show this help message

Examples:
  pnpm ship naval
  pnpm ship elonmusk
  pnpm ship balajis --output ./custom-agents

Environment Variables:
  XAI_MODEL           Grok model to use (default: grok-3-fast)
  X_BEARER_TOKEN      X API Bearer Token (required)
  XAI_API_KEY         xAI API Key (required)

The agent will:
  1. Fetch the user's profile and tweets using X API
  2. Analyze their communication style, interests, and personality
  3. Generate a trading personality based on their Twitter presence
  4. Save the personality as a JSON file
`);
}

function printResults(agent: GeneratedAgent) {
  const p = agent.personality;

  console.log("\n" + "═".repeat(80));
  console.log("\n🎉 PERSONALITY GENERATED\n");

  console.log(`  Handle:         @${agent.handle}`);
  console.log(`  Display Name:   ${agent.displayName}`);
  if (agent.twitterId) {
    console.log(`  Twitter ID:     ${agent.twitterId}`);
  }

  console.log("\n  --- Trading Profile ---");
  console.log(`  Risk Profile:       ${formatRisk(p.riskProfile)}`);
  console.log(`  Trading Style:      ${p.tradingStyle}`);
  console.log(
    `  Max Position:       ${(p.maxPositionPercent * 100).toFixed(0)}%`,
  );
  console.log(
    `  Min Confidence:     ${(p.minConfidenceToTrade * 100).toFixed(0)}%`,
  );

  console.log("\n  --- Communication ---");
  console.log(`  Tone:               ${p.tone}`);
  console.log(`  Verbosity:          ${p.verbosity}`);

  console.log("\n  --- Topics ---");
  console.log(`  Expertise:          ${p.expertise.join(", ")}`);
  console.log(
    `  Avoids:             ${p.avoids.length > 0 ? p.avoids.join(", ") : "(nothing)"}`,
  );

  if (p.catchphrases.length > 0) {
    console.log("\n  --- Catchphrases ---");
    for (const phrase of p.catchphrases) {
      console.log(`    • "${phrase}"`);
    }
  }

  console.log("\n  --- Bio ---");
  console.log(`  ${p.bio}`);

  console.log("\n  --- Trading Philosophy ---");
  console.log(`  ${p.tradingPhilosophy}`);
}

function formatRisk(risk: string): string {
  const riskEmojis: Record<string, string> = {
    conservative: "🛡️ conservative",
    moderate: "⚖️ moderate",
    aggressive: "⚡ aggressive",
    degen: "🎰 DEGEN",
  };
  return riskEmojis[risk] || risk;
}

function saveAgent(agent: GeneratedAgent, outputDir: string) {
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = resolve(outputDir, `${agent.handle.toLowerCase()}.json`);

  const serialized = {
    ...agent,
    personality: agent.personality,
  };

  writeFileSync(outputPath, JSON.stringify(serialized, null, 2));
  console.log(`\n📁 Saved to: ${outputPath}`);
}

// =============================================================================
// RUN
// =============================================================================

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
