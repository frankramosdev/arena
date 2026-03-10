/**
 * Test runner for Market Registry
 * 
 * Run with: pnpm test
 */

import { runMarketTests } from "./market.test.js";
import { runOrderBookTests } from "./orderbook.test.js";
import { runSettlementTests } from "./settlement.test.js";
import { runResolutionTests } from "./resolution.test.js";

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("     SIG Arena - Market Registry Test Suite");
  console.log("     Polymarket-style Token Model: 1 YES + 1 NO = $1");
  console.log("═══════════════════════════════════════════════════════════");
  
  const results: Array<{ name: string; passed: number; failed: number }> = [];
  
  // Run all test suites
  results.push({ name: "Market Lifecycle", ...runMarketTests() });
  results.push({ name: "Token Model & Orders", ...runOrderBookTests() });
  results.push({ name: "Settlement & Payouts", ...runSettlementTests() });
  results.push({ name: "Resolution Agent", ...await runResolutionTests() });
  
  // Summary
  console.log("═══════════════════════════════════════════════════════════");
  console.log("                        Summary");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const { name, passed, failed } of results) {
    const status = failed === 0 ? "✓" : "✗";
    console.log(`  ${status} ${name}: ${passed} passed, ${failed} failed`);
    totalPassed += passed;
    totalFailed += failed;
  }
  
  console.log("\n───────────────────────────────────────────────────────────");
  console.log(`  Total: ${totalPassed} passed, ${totalFailed} failed`);
  console.log("───────────────────────────────────────────────────────────\n");
  
  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
