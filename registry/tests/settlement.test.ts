/**
 * Settlement tests - verify token payouts on resolution
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

/** Create a test trader via user registration. Returns trader ID. */
function createTestTrader(registry: MarketRegistry, name: string): string {
  const user = registry.createUser({ name });
  return user.traderId;
}

export function runSettlementTests() {
  console.log("\n💰 Settlement Tests\n");
  passed = 0;
  failed = 0;

  test("YES holder gets $1 per token on YES resolution", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    // Alice mints and keeps only YES
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    
    // Alice sells all NO tokens to Bob
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "NO",
      side: "SELL",
      type: "LIMIT",
      price: 0.40,
      quantity: 100,
    });
    
    const bob = createTestTrader(registry, "bob");
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "NO",
      side: "BUY",
      type: "LIMIT",
      price: 0.40,
      quantity: 100,
    });
    
    // Before resolution:
    // Alice: $9940 (10000 - 100 mint + 40 sell NO), 100 YES, 0 NO
    // Bob: $9960 (10000 - 40 buy NO), 0 YES, 100 NO
    const aliceBefore = registry.getTrader(alice)!;
    const bobBefore = registry.getTrader(bob)!;
    assertClose(aliceBefore.balance, 9940, 1, "Alice before");
    assertClose(bobBefore.balance, 9960, 1, "Bob before");
    
    // Resolve YES
    registry.resolveMarket("m1", "YES", {
      resolvedBy: "agent",
      evidence: { type: "test", explanation: "test" },
    });
    
    // After resolution:
    // Alice gets 100 * $1 = $100 for her YES tokens
    // Bob gets 0 for his NO tokens
    const aliceAfter = registry.getTrader(alice)!;
    const bobAfter = registry.getTrader(bob)!;
    
    assertClose(aliceAfter.balance, 10040, 1, "Alice after: 9940 + 100 payout");
    assertClose(bobAfter.balance, 9960, 1, "Bob after: no payout");
    
    // Alice profit: paid $60 net for YES (100 mint - 40 sell NO), won $100 = +$40
    assertClose(aliceAfter.realizedPnl, 40, 1, "Alice P&L");
    
    // Bob loss: paid $40 for NO, won $0 = -$40
    assertClose(bobAfter.realizedPnl, -40, 1, "Bob P&L");
  });

  test("NO holder gets $1 per token on NO resolution", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    // Setup same as above
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "NO",
      side: "SELL",
      type: "LIMIT",
      price: 0.40,
      quantity: 100,
    });
    
    const bob = createTestTrader(registry, "bob");
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "NO",
      side: "BUY",
      type: "LIMIT",
      price: 0.40,
      quantity: 100,
    });
    
    // Resolve NO
    registry.resolveMarket("m1", "NO", {
      resolvedBy: "agent",
      evidence: { type: "test", explanation: "test" },
    });
    
    const aliceAfter = registry.getTrader(alice)!;
    const bobAfter = registry.getTrader(bob)!;
    
    // Alice: had YES, gets $0, loses $60 net cost
    assertClose(aliceAfter.balance, 9940, 1, "Alice: 9940 + 0 payout");
    assertClose(aliceAfter.realizedPnl, -60, 1, "Alice lost $60");
    
    // Bob: had NO, gets $100, profit $60
    assertClose(bobAfter.balance, 10060, 1, "Bob: 9960 + 100 payout");
    assertClose(bobAfter.realizedPnl, 60, 1, "Bob won $60");
  });

  test("positions cleared after settlement", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    
    const posBefore = registry.getPosition(alice, "m1")!;
    assertEqual(posBefore.yesTokens, 100, "100 YES before");
    assertEqual(posBefore.noTokens, 100, "100 NO before");
    
    registry.resolveMarket("m1", "YES", {
      resolvedBy: "agent",
      evidence: { type: "test", explanation: "test" },
    });
    
    const posAfter = registry.getPosition(alice, "m1")!;
    assertEqual(posAfter.yesTokens, 0, "0 YES after");
    assertEqual(posAfter.noTokens, 0, "0 NO after");
  });

  test("multiple traders settle correctly", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    // Alice bets YES
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "NO",
      side: "SELL",
      type: "LIMIT",
      price: 0.30,
      quantity: 100,
    });
    
    // Bob bets NO
    const bob = createTestTrader(registry, "bob");
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "NO",
      side: "BUY",
      type: "LIMIT",
      price: 0.30,
      quantity: 100,
    });
    
    // Carol also bets YES
    const carol = createTestTrader(registry, "carol");
    registry.mint({ marketId: "m1", traderId: carol, amount: 50 });
    registry.placeOrder({
      marketId: "m1",
      traderId: carol,
      tokenType: "NO",
      side: "SELL",
      type: "LIMIT",
      price: 0.30,
      quantity: 50,
    });
    
    // Dave buys Carol's NO
    const dave = createTestTrader(registry, "dave");
    registry.placeOrder({
      marketId: "m1",
      traderId: dave,
      tokenType: "NO",
      side: "BUY",
      type: "LIMIT",
      price: 0.30,
      quantity: 50,
    });
    
    // Resolve YES - Alice and Carol win
    registry.resolveMarket("m1", "YES", {
      resolvedBy: "agent",
      evidence: { type: "test", explanation: "test" },
    });
    
    const aliceAfter = registry.getTrader(alice)!;
    const bobAfter = registry.getTrader(bob)!;
    const carolAfter = registry.getTrader(carol)!;
    const daveAfter = registry.getTrader(dave)!;
    
    // Alice: paid $70 net (100-30), won $100 = +$30
    assert(aliceAfter.realizedPnl > 0, "Alice should profit");
    assert(aliceAfter.wins === 1, "Alice wins");
    
    // Bob: paid $30, won $0 = -$30
    assert(bobAfter.realizedPnl < 0, "Bob should lose");
    assert(bobAfter.losses === 1, "Bob loses");
    
    // Carol: paid $35 net (50-15), won $50 = +$15
    assert(carolAfter.realizedPnl > 0, "Carol should profit");
    
    // Dave: paid $15, won $0 = -$15
    assert(daveAfter.realizedPnl < 0, "Dave should lose");
  });

  test("wins/losses counters increment correctly", () => {
    const registry = MarketRegistry.createTestRegistry();
    
    const alice = createTestTrader(registry, "alice");
    const bob = createTestTrader(registry, "bob");
    
    // Market 1: Alice bets YES and wins
    createTestMarket(registry, "m1");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    // Alice sells NO to make a directional bet on YES
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "NO",
      side: "SELL",
      type: "LIMIT",
      price: 0.40,
      quantity: 100,
    });
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "NO",
      side: "BUY",
      type: "LIMIT",
      price: 0.40,
      quantity: 100,
    });
    registry.resolveMarket("m1", "YES", {
      resolvedBy: "agent",
      evidence: { type: "test", explanation: "test" },
    });
    
    let aliceAfter = registry.getTrader(alice)!;
    assertEqual(aliceAfter.wins, 1, "1 win");
    assertEqual(aliceAfter.losses, 0, "0 losses");
    
    // Market 2: Alice bets NO and loses (market resolves YES)
    createTestMarket(registry, "m2");
    registry.mint({ marketId: "m2", traderId: alice, amount: 100 });
    // Alice sells YES to bet on NO
    registry.placeOrder({
      marketId: "m2",
      traderId: alice,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.50,
      quantity: 100,
    });
    registry.placeOrder({
      marketId: "m2",
      traderId: bob,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.50,
      quantity: 100,
    });
    registry.resolveMarket("m2", "YES", {
      resolvedBy: "agent",
      evidence: { type: "test", explanation: "test" },
    });
    
    aliceAfter = registry.getTrader(alice)!;
    assertEqual(aliceAfter.wins, 1, "still 1 win");
    assertEqual(aliceAfter.losses, 1, "1 loss now");
  });

  test("invariant: total payout equals collateral", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    // Multiple traders mint
    const alice = createTestTrader(registry, "alice");
    const bob = createTestTrader(registry, "bob");
    const carol = createTestTrader(registry, "carol");
    
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    registry.mint({ marketId: "m1", traderId: bob, amount: 50 });
    registry.mint({ marketId: "m1", traderId: carol, amount: 75 });
    
    const market = registry.getMarket("m1")!;
    const totalCollateral = market.supply.collateral;
    assertEqual(totalCollateral, 225, "total collateral");
    
    // Trade some tokens around
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.60,
      quantity: 50,
    });
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.60,
      quantity: 50,
    });
    
    // Sum all balances before resolution
    const sumBefore = 
      registry.getTrader(alice)!.balance +
      registry.getTrader(bob)!.balance +
      registry.getTrader(carol)!.balance;
    
    // Resolve
    registry.resolveMarket("m1", "YES", {
      resolvedBy: "agent",
      evidence: { type: "test", explanation: "test" },
    });
    
    // Sum all balances after
    const sumAfter = 
      registry.getTrader(alice)!.balance +
      registry.getTrader(bob)!.balance +
      registry.getTrader(carol)!.balance;
    
    // The increase should equal total YES tokens (225)
    // because YES won and each YES pays $1
    assertClose(sumAfter - sumBefore, 225, 1, "payout equals collateral");
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSettlementTests();
}
