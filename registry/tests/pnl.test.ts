/**
 * P&L, Volume, and Leaderboard Tests
 */

import { MarketRegistry } from "../src/registry.js";

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

function assertClose(actual: number, expected: number, tolerance: number, msg: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg}: expected ~${expected}, got ${actual}`);
  }
}

function createTestMarket(registry: MarketRegistry, id: string): void {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  registry.createMarket({
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
    sources: [],
    tags: ["test"],
    initialProbability: 0.5,
  });
}

function createTestTrader(registry: MarketRegistry, name: string): string {
  const user = registry.createUser({ name });
  return user.traderId;
}

export function runPnLTests() {
  console.log("\n💰 P&L, Volume & Leaderboard Tests\n");
  passed = 0;
  failed = 0;

  // =========================================================================
  // P&L TRACKING
  // =========================================================================

  test("P&L starts at zero", () => {
    const registry = MarketRegistry.createTestRegistry();
    const alice = createTestTrader(registry, "alice");
    
    const trader = registry.getTrader(alice)!;
    assertEqual(trader.realizedPnl, 0, "initial P&L");
    assertEqual(trader.tradeCount, 0, "initial trade count");
  });

  test("P&L increases on profitable sell", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    const bob = createTestTrader(registry, "bob");
    
    // Alice mints 100 tokens for $100
    registry.mint({ traderId: alice, marketId: "m1", amount: 100 });
    
    // Alice sells 50 YES tokens at $0.70 (cost basis $0.50)
    registry.placeOrder({
      traderId: alice,
      marketId: "m1",
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.70,
      quantity: 50,
    });
    
    // Bob buys at $0.70
    registry.placeOrder({
      traderId: bob,
      marketId: "m1",
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.70,
      quantity: 50,
    });
    
    const aliceTrader = registry.getTrader(alice)!;
    // Profit = (0.70 - 0.50) * 50 = $10
    assertClose(aliceTrader.realizedPnl, 10, 0.01, "alice P&L from profitable sale");
  });

  test("P&L decreases on loss-making sell", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    const bob = createTestTrader(registry, "bob");
    
    // Alice mints at 0.50 cost basis
    registry.mint({ traderId: alice, marketId: "m1", amount: 100 });
    
    // Alice sells 50 YES at $0.30 (loss)
    registry.placeOrder({
      traderId: alice,
      marketId: "m1",
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.30,
      quantity: 50,
    });
    
    // Bob buys at $0.30
    registry.placeOrder({
      traderId: bob,
      marketId: "m1",
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.30,
      quantity: 50,
    });
    
    const aliceTrader = registry.getTrader(alice)!;
    // Loss = (0.30 - 0.50) * 50 = -$10
    assertClose(aliceTrader.realizedPnl, -10, 0.01, "alice P&L from loss sale");
  });

  test("trade count increments on trades", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    const bob = createTestTrader(registry, "bob");
    
    registry.mint({ traderId: alice, marketId: "m1", amount: 100 });
    
    // First trade
    registry.placeOrder({
      traderId: alice,
      marketId: "m1",
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.60,
      quantity: 20,
    });
    registry.placeOrder({
      traderId: bob,
      marketId: "m1",
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.60,
      quantity: 20,
    });
    
    // Second trade
    registry.placeOrder({
      traderId: alice,
      marketId: "m1",
      tokenType: "NO",
      side: "SELL",
      type: "LIMIT",
      price: 0.40,
      quantity: 30,
    });
    registry.placeOrder({
      traderId: bob,
      marketId: "m1",
      tokenType: "NO",
      side: "BUY",
      type: "LIMIT",
      price: 0.40,
      quantity: 30,
    });
    
    const aliceTrader = registry.getTrader(alice)!;
    const bobTrader = registry.getTrader(bob)!;
    
    assertEqual(aliceTrader.tradeCount, 2, "alice trade count");
    assertEqual(bobTrader.tradeCount, 2, "bob trade count");
  });

  // =========================================================================
  // VOLUME TRACKING
  // =========================================================================

  test("volume calculated from trades", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    const bob = createTestTrader(registry, "bob");
    
    registry.mint({ traderId: alice, marketId: "m1", amount: 100 });
    
    // Trade 1: 50 YES at $0.60 = $30
    registry.placeOrder({
      traderId: alice,
      marketId: "m1",
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.60,
      quantity: 50,
    });
    registry.placeOrder({
      traderId: bob,
      marketId: "m1",
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.60,
      quantity: 50,
    });
    
    // Trade 2: 30 NO at $0.40 = $12
    registry.placeOrder({
      traderId: alice,
      marketId: "m1",
      tokenType: "NO",
      side: "SELL",
      type: "LIMIT",
      price: 0.40,
      quantity: 30,
    });
    registry.placeOrder({
      traderId: bob,
      marketId: "m1",
      tokenType: "NO",
      side: "BUY",
      type: "LIMIT",
      price: 0.40,
      quantity: 30,
    });
    
    const aliceStats = registry.getTraderStats(alice)!;
    const bobStats = registry.getTraderStats(bob)!;
    
    // Alice was seller in both, Bob was buyer in both
    // Total volume for each = 30 + 12 = 42
    assertClose(aliceStats.volume, 42, 0.01, "alice volume");
    assertClose(bobStats.volume, 42, 0.01, "bob volume");
  });

  // =========================================================================
  // LEADERBOARD
  // =========================================================================

  test("leaderboard sorts by P&L", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    // Create 3 traders
    const alice = createTestTrader(registry, "alice");
    const bob = createTestTrader(registry, "bob");
    const carol = createTestTrader(registry, "carol");
    
    // Alice mints and sells at profit
    registry.mint({ traderId: alice, marketId: "m1", amount: 100 });
    registry.placeOrder({
      traderId: alice,
      marketId: "m1",
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.80, // 30c profit each
      quantity: 50,
    });
    
    // Bob buys from alice
    registry.placeOrder({
      traderId: bob,
      marketId: "m1",
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.80,
      quantity: 50,
    });
    
    // Carol doesn't trade
    
    // Get leaderboard
    const { traders } = registry.getTraderLeaderboard(10, 0);
    
    assert(traders.length >= 3, "should have at least 3 traders");
    
    // Alice should be first (highest P&L: +$15)
    const aliceEntry = traders.find(t => t.traderId === alice);
    assert(aliceEntry !== undefined, "alice should be in leaderboard");
    assertClose(aliceEntry!.realizedPnl, 15, 0.01, "alice P&L");
    
    // Bob has 0 P&L (bought but hasn't sold)
    const bobEntry = traders.find(t => t.traderId === bob);
    assertEqual(bobEntry?.realizedPnl, 0, "bob P&L");
    
    // Carol has 0 P&L (no trades)
    const carolEntry = traders.find(t => t.traderId === carol);
    assertEqual(carolEntry?.realizedPnl, 0, "carol P&L");
  });

  test("leaderboard pagination works", () => {
    const registry = MarketRegistry.createTestRegistry();
    
    // Create 5 traders
    for (let i = 0; i < 5; i++) {
      createTestTrader(registry, `trader${i}`);
    }
    
    // Get first 2
    const page1 = registry.getTraderLeaderboard(2, 0);
    assertEqual(page1.traders.length, 2, "page 1 size");
    assertEqual(page1.total, 5, "total traders");
    
    // Get next 2
    const page2 = registry.getTraderLeaderboard(2, 2);
    assertEqual(page2.traders.length, 2, "page 2 size");
    
    // Get last 1
    const page3 = registry.getTraderLeaderboard(2, 4);
    assertEqual(page3.traders.length, 1, "page 3 size");
  });

  test("getTraderStats returns correct data", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    const bob = createTestTrader(registry, "bob");
    
    registry.mint({ traderId: alice, marketId: "m1", amount: 100 });
    
    // Trade at $0.70
    registry.placeOrder({
      traderId: alice,
      marketId: "m1",
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.70,
      quantity: 40,
    });
    registry.placeOrder({
      traderId: bob,
      marketId: "m1",
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.70,
      quantity: 40,
    });
    
    const stats = registry.getTraderStats(alice);
    assert(stats !== undefined, "stats should exist");
    assertEqual(stats!.traderId, alice, "traderId");
    assertEqual(stats!.tradeCount, 1, "tradeCount");
    assertClose(stats!.volume, 28, 0.01, "volume (40 * 0.70)");
    assertClose(stats!.realizedPnl, 8, 0.01, "P&L (40 * 0.20 profit)");
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run if called directly
runPnLTests();
