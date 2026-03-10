/**
 * Market lifecycle tests
 */

import { MarketRegistry } from "../src/registry.js";
import type { CreateMarketInput } from "../src/types.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${expected}, got ${actual}`);
  }
}

function createTestMarket(id: string, overrides: Partial<CreateMarketInput> = {}): CreateMarketInput {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  return {
    id,
    question: `Test market ${id}?`,
    description: `Description for ${id}`,
    createdAt: now.toISOString(),
    resolutionDate: tomorrow.toISOString(),
    timeframe: "tomorrow",
    verification: {
      type: "tweet_exists",
      targetHandles: ["testuser"],
      resolutionCriteria: "Check if tweet exists",
    },
    sources: [{ handle: "testuser", snippet: "test" }],
    tags: ["test"],
    initialProbability: 0.5,
    ...overrides,
  };
}

export function runMarketTests() {
  console.log("\n📦 Market Lifecycle Tests\n");
  passed = 0;
  failed = 0;
  
  test("creates market with correct initial state", () => {
    const registry = MarketRegistry.createTestRegistry();
    const input = createTestMarket("m1");
    const market = registry.createMarket(input);
    
    assertEqual(market.id, "m1", "ID");
    assertEqual(market.status, "OPEN", "status");
    assertEqual(market.prices.yesPrice, 0.5, "yesPrice");
    assertEqual(market.prices.noPrice, 0.5, "noPrice");
    assertEqual(market.supply.yesSupply, 0, "yesSupply");
    assertEqual(market.supply.noSupply, 0, "noSupply");
    assertEqual(market.supply.collateral, 0, "collateral");
    assertEqual(market.volume.totalVolume, 0, "volume");
  });

  test("throws on duplicate market ID", () => {
    const registry = MarketRegistry.createTestRegistry();
    registry.createMarket(createTestMarket("dup"));
    
    let threw = false;
    try {
      registry.createMarket(createTestMarket("dup"));
    } catch {
      threw = true;
    }
    assert(threw, "should throw on duplicate ID");
  });

  test("retrieves market by ID", () => {
    const registry = MarketRegistry.createTestRegistry();
    registry.createMarket(createTestMarket("get1"));
    
    const market = registry.getMarket("get1");
    assert(market !== undefined, "market should exist");
    assertEqual(market!.id, "get1", "ID");
  });

  test("returns undefined for non-existent market", () => {
    const registry = MarketRegistry.createTestRegistry();
    const market = registry.getMarket("nonexistent");
    assertEqual(market, undefined, "should be undefined");
  });

  test("lists markets with status filter", () => {
    const registry = MarketRegistry.createTestRegistry();
    registry.createMarket(createTestMarket("list1"));
    registry.createMarket(createTestMarket("list2"));
    registry.createMarket(createTestMarket("list3"));
    
    const open = registry.listMarkets({ status: ["OPEN"] });
    assertEqual(open.total, 3, "should have 3 open markets");
    
    const resolved = registry.listMarkets({ status: ["RESOLVED_YES", "RESOLVED_NO"] });
    assertEqual(resolved.total, 0, "should have 0 resolved markets");
  });

  test("lists markets with tag filter", () => {
    const registry = MarketRegistry.createTestRegistry();
    registry.createMarket(createTestMarket("tag1", { tags: ["ai", "tech"] }));
    registry.createMarket(createTestMarket("tag2", { tags: ["crypto"] }));
    registry.createMarket(createTestMarket("tag3", { tags: ["ai", "crypto"] }));
    
    const ai = registry.listMarkets({ tags: ["ai"] });
    assertEqual(ai.total, 2, "should have 2 AI markets");
    
    const crypto = registry.listMarkets({ tags: ["crypto"] });
    assertEqual(crypto.total, 2, "should have 2 crypto markets");
  });

  test("lists markets with pagination", () => {
    const registry = MarketRegistry.createTestRegistry();
    for (let i = 0; i < 10; i++) {
      registry.createMarket(createTestMarket(`page${i}`));
    }
    
    const page1 = registry.listMarkets({}, 0, 3);
    assertEqual(page1.markets.length, 3, "page 1 should have 3 markets");
    assertEqual(page1.total, 10, "total should be 10");
    
    const page2 = registry.listMarkets({}, 3, 3);
    assertEqual(page2.markets.length, 3, "page 2 should have 3 markets");
  });

  test("halts and resumes market", () => {
    const registry = MarketRegistry.createTestRegistry();
    registry.createMarket(createTestMarket("halt1"));
    
    const halted = registry.haltMarket("halt1", "suspicious activity");
    assertEqual(halted.status, "HALTED", "should be halted");
    
    const resumed = registry.resumeMarket("halt1");
    assertEqual(resumed.status, "OPEN", "should be open again");
  });

  test("resolves market as YES", () => {
    const registry = MarketRegistry.createTestRegistry();
    registry.createMarket(createTestMarket("resolve1"));
    
    const resolved = registry.resolveMarket("resolve1", "YES", {
      resolvedBy: "agent",
      evidence: { type: "tweet_exists", explanation: "Tweet found" },
    });
    
    assertEqual(resolved.status, "RESOLVED_YES", "status");
    assertEqual(resolved.prices.yesPrice, 1, "yesPrice should be 1");
    assertEqual(resolved.prices.noPrice, 0, "noPrice should be 0");
    assert(resolved.resolvedAt !== null, "resolvedAt should be set");
  });

  test("resolves market as NO", () => {
    const registry = MarketRegistry.createTestRegistry();
    registry.createMarket(createTestMarket("resolve2"));
    
    const resolved = registry.resolveMarket("resolve2", "NO", {
      resolvedBy: "agent",
      evidence: { type: "tweet_exists", explanation: "Tweet not found" },
    });
    
    assertEqual(resolved.status, "RESOLVED_NO", "status");
    assertEqual(resolved.prices.yesPrice, 0, "yesPrice should be 0");
    assertEqual(resolved.prices.noPrice, 1, "noPrice should be 1");
  });

  test("invalidates market", () => {
    const registry = MarketRegistry.createTestRegistry();
    registry.createMarket(createTestMarket("invalid1"));
    
    const invalid = registry.invalidateMarket("invalid1", "ambiguous question");
    assertEqual(invalid.status, "INVALID", "status");
  });

  test("gets markets expiring soon", () => {
    const registry = MarketRegistry.createTestRegistry();
    const now = new Date();
    
    registry.createMarket(createTestMarket("exp1", {
      resolutionDate: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    }));
    
    registry.createMarket(createTestMarket("exp2", {
      resolutionDate: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    }));
    
    const soon = registry.getMarketsExpiringSoon(24);
    assertEqual(soon.length, 1, "should have 1 market expiring soon");
    assertEqual(soon[0].id, "exp1", "should be exp1");
  });

  test("returns correct stats", () => {
    const registry = MarketRegistry.createTestRegistry();
    registry.createMarket(createTestMarket("stat1"));
    registry.createMarket(createTestMarket("stat2"));
    registry.resolveMarket("stat1", "YES", {
      resolvedBy: "agent",
      evidence: { type: "test", explanation: "test" },
    });
    
    const stats = registry.getStats();
    assertEqual(stats.totalMarkets, 2, "totalMarkets");
    assertEqual(stats.openMarkets, 1, "openMarkets");
    assertEqual(stats.resolvedMarkets, 1, "resolvedMarkets");
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMarketTests();
}
