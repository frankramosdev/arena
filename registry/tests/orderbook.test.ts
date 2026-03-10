/**
 * Order book and trading tests - Polymarket token model
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

export function runOrderBookTests() {
  console.log("\n📈 Token Model & Order Book Tests\n");
  passed = 0;
  failed = 0;

  // =========================================================================
  // MINT & REDEEM
  // =========================================================================

  test("mints YES+NO tokens for collateral", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    const initialTrader = registry.getTrader(alice)!;
    assertEqual(initialTrader.balance, 10000, "initial balance");
    
    const result = registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    
    assertEqual(result.yesTokens, 100, "should get 100 YES");
    assertEqual(result.noTokens, 100, "should get 100 NO");
    
    const updatedTrader = registry.getTrader(alice)!;
    assertEqual(updatedTrader.balance, 9900, "balance should be 9900");
    
    const position = registry.getPosition(alice, "m1")!;
    assertEqual(position.yesTokens, 100, "position YES");
    assertEqual(position.noTokens, 100, "position NO");
    
    const market = registry.getMarket("m1")!;
    assertEqual(market.supply.yesSupply, 100, "market YES supply");
    assertEqual(market.supply.noSupply, 100, "market NO supply");
    assertEqual(market.supply.collateral, 100, "market collateral");
  });

  test("redeems YES+NO tokens for collateral", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    
    const result = registry.redeem({ marketId: "m1", traderId: alice, amount: 50 });
    
    assertEqual(result.cashReturned, 50, "should get $50 back");
    
    const trader = registry.getTrader(alice)!;
    assertEqual(trader.balance, 9950, "balance should be 9950");
    
    const position = registry.getPosition(alice, "m1")!;
    assertEqual(position.yesTokens, 50, "position YES");
    assertEqual(position.noTokens, 50, "position NO");
    
    const market = registry.getMarket("m1")!;
    assertEqual(market.supply.yesSupply, 50, "market YES supply");
  });

  test("fails to mint without sufficient balance", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    
    let threw = false;
    try {
      registry.mint({ marketId: "m1", traderId: alice, amount: 20000 });
    } catch {
      threw = true;
    }
    assert(threw, "should throw on insufficient balance");
  });

  test("fails to redeem without sufficient tokens", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 50 });
    
    let threw = false;
    try {
      registry.redeem({ marketId: "m1", traderId: alice, amount: 100 });
    } catch {
      threw = true;
    }
    assert(threw, "should throw on insufficient tokens");
  });

  // =========================================================================
  // ORDERS & MATCHING
  // =========================================================================

  test("places limit order to sell YES tokens", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    
    const { order, trades } = registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.60,
      quantity: 50,
    });
    
    assertEqual(order.status, "OPEN", "order should be open");
    assertEqual(trades.length, 0, "no trades yet");
    
    const book = registry.getOrderBook("m1");
    assertEqual(book.yes.asks.length, 1, "should have 1 ask");
    assertEqual(book.yes.asks[0].price, 0.60, "ask price");
    assertEqual(book.yes.asks[0].quantity, 50, "ask quantity");
  });

  test("places limit order to buy YES tokens", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    
    const { order, trades } = registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.55,
      quantity: 100,
    });
    
    assertEqual(order.status, "OPEN", "order should be open");
    assertEqual(trades.length, 0, "no trades");
    
    const book = registry.getOrderBook("m1");
    assertEqual(book.yes.bids.length, 1, "should have 1 bid");
    assertEqual(book.yes.bids[0].price, 0.55, "bid price");
  });

  test("matches crossing orders", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    // Alice mints and sells YES
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.60,
      quantity: 50,
    });
    
    // Bob buys YES at 0.65 (crosses with Alice's ask at 0.60)
    const bob = createTestTrader(registry, "bob");
    const { order, trades } = registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.65,
      quantity: 50,
    });
    
    assertEqual(trades.length, 1, "should have 1 trade");
    assertEqual(trades[0].quantity, 50, "trade quantity");
    assertEqual(trades[0].price, 0.60, "trade at maker price");
    assertEqual(order.status, "FILLED", "order filled");
    
    // Check positions
    const alicePos = registry.getPosition(alice, "m1")!;
    assertEqual(alicePos.yesTokens, 50, "Alice has 50 YES left");
    assertEqual(alicePos.noTokens, 100, "Alice has 100 NO");
    
    const bobPos = registry.getPosition(bob, "m1")!;
    assertEqual(bobPos.yesTokens, 50, "Bob has 50 YES");
    
    // Check balances
    const aliceTrader = registry.getTrader(alice)!;
    assertEqual(aliceTrader.balance, 9930, "Alice: 10000 - 100 (mint) + 30 (sell 50@0.60)");
    
    const bobTrader = registry.getTrader(bob)!;
    assertEqual(bobTrader.balance, 9970, "Bob: 10000 - 30 (buy 50@0.60)");
  });

  test("partial fill leaves remainder in book", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    // Alice sells 30 YES
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.60,
      quantity: 30,
    });
    
    // Bob wants to buy 50 YES
    const bob = createTestTrader(registry, "bob");
    const { order, trades } = registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.65,
      quantity: 50,
    });
    
    assertEqual(trades.length, 1, "should have 1 trade");
    assertEqual(trades[0].quantity, 30, "traded 30");
    assertEqual(order.filledQuantity, 30, "30 filled");
    assertEqual(order.status, "PARTIALLY_FILLED", "partially filled");
    
    // Remainder should be in the bid book
    const book = registry.getOrderBook("m1");
    assertEqual(book.yes.bids.length, 1, "1 bid in book");
    assertEqual(book.yes.bids[0].quantity, 20, "20 remaining");
  });

  test("updates market prices after trade", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.70,
      quantity: 50,
    });
    
    const bob = createTestTrader(registry, "bob");
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.70,
      quantity: 50,
    });
    
    const market = registry.getMarket("m1")!;
    assertClose(market.prices.yesPrice, 0.70, 0.001, "YES price updated");
    assertClose(market.prices.noPrice, 0.30, 0.001, "NO price updated");
  });

  test("tracks volume correctly", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.60,
      quantity: 100,
    });
    
    const bob = createTestTrader(registry, "bob");
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.60,
      quantity: 100,
    });
    
    const market = registry.getMarket("m1")!;
    assertClose(market.volume.totalVolume, 60, 0.01, "volume should be $60");
    assertEqual(market.volume.tradeCount, 1, "1 trade");
  });

  test("fails to sell tokens you don't have", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    // Alice has no tokens
    
    let threw = false;
    try {
      registry.placeOrder({
        marketId: "m1",
        traderId: alice,
        tokenType: "YES",
        side: "SELL",
        type: "LIMIT",
        price: 0.60,
        quantity: 50,
      });
    } catch {
      threw = true;
    }
    assert(threw, "should throw when selling tokens you don't have");
  });

  test("fails to buy without sufficient balance", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    // Alice has $10000
    
    let threw = false;
    try {
      registry.placeOrder({
        marketId: "m1",
        traderId: alice,
        tokenType: "YES",
        side: "BUY",
        type: "LIMIT",
        price: 0.60,
        quantity: 20000, // Would cost $12000
      });
    } catch {
      threw = true;
    }
    assert(threw, "should throw when buying exceeds balance");
  });

  test("cancels order", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    
    const { order } = registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.60,
      quantity: 50,
    });
    
    const cancelled = registry.cancelOrder(order.id);
    assertEqual(cancelled.status, "CANCELLED", "should be cancelled");
    
    const book = registry.getOrderBook("m1");
    assertEqual(book.yes.asks.length, 0, "order removed from book");
  });

  test("rejects order on halted market", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    const alice = createTestTrader(registry, "alice");
    registry.haltMarket("m1", "test");
    
    let threw = false;
    try {
      registry.placeOrder({
        marketId: "m1",
        traderId: alice,
        tokenType: "YES",
        side: "BUY",
        type: "LIMIT",
        price: 0.60,
        quantity: 100,
      });
    } catch {
      threw = true;
    }
    assert(threw, "should throw on halted market");
  });

  test("cancels all orders on resolution", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.70,
      quantity: 50,
    });
    
    const bob = createTestTrader(registry, "bob");
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.50,
      quantity: 50,
    });
    
    registry.resolveMarket("m1", "YES", {
      resolvedBy: "agent",
      evidence: { type: "test", explanation: "test" },
    });
    
    const book = registry.getOrderBook("m1");
    assertEqual(book.yes.bids.length, 0, "bids cleared");
    assertEqual(book.yes.asks.length, 0, "asks cleared");
  });

  // =========================================================================
  // FULL TRADING CYCLES
  // =========================================================================

  test("buy then sell: trader can resell purchased tokens", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    // Alice mints and sells only 50 YES @ 0.60
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 50 });
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.60,
      quantity: 50,
    });
    
    // Bob buys all 50 YES from Alice @ 0.60
    const bob = createTestTrader(registry, "bob");
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.60,
      quantity: 50,
    });
    
    // Verify Alice's order is fully consumed
    const book1 = registry.getOrderBook("m1");
    assertEqual(book1.yes.asks.length, 0, "Alice's ask fully consumed");
    
    // Verify Bob has 50 YES
    const bobPos1 = registry.getPosition(bob, "m1")!;
    assertEqual(bobPos1.yesTokens, 50, "Bob has 50 YES after buying");
    
    // Bob resells his 50 YES @ 0.70 (higher price)
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.70,
      quantity: 50,
    });
    
    // Charlie buys Bob's tokens @ 0.70
    const charlie = createTestTrader(registry, "charlie");
    const { trades } = registry.placeOrder({
      marketId: "m1",
      traderId: charlie,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.70,
      quantity: 50,
    });
    
    assertEqual(trades.length, 1, "trade executed");
    assertEqual(trades[0].price, 0.70, "trade at Bob's ask price");
    
    // Final positions
    const bobPos2 = registry.getPosition(bob, "m1")!;
    assertEqual(bobPos2.yesTokens, 0, "Bob sold all YES");
    
    const charliePos = registry.getPosition(charlie, "m1")!;
    assertEqual(charliePos.yesTokens, 50, "Charlie has 50 YES");
    
    // Bob's profit: bought 50 @ 0.60 ($30), sold 50 @ 0.70 ($35) = $5 profit
    const bobTrader = registry.getTrader(bob)!;
    assertEqual(bobTrader.balance, 10005, "Bob: 10000 - 30 (buy) + 35 (sell) = 10005");
  });

  test("mint, partial sell, buy more, sell all", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    // Alice mints 50 tokens and sells all @ 0.50
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 50 });
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.50,
      quantity: 50,
    });
    
    // Bob buys 30 YES @ 0.50
    const bob = createTestTrader(registry, "bob");
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.50,
      quantity: 30,
    });
    
    const bobPos1 = registry.getPosition(bob, "m1")!;
    assertEqual(bobPos1.yesTokens, 30, "Bob has 30 YES");
    
    // Bob buys 20 more YES (from remaining Alice ask)
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.50,
      quantity: 20,
    });
    
    const bobPos2 = registry.getPosition(bob, "m1")!;
    assertEqual(bobPos2.yesTokens, 50, "Bob has 50 YES total");
    
    // Alice's order should be fully consumed now
    const book = registry.getOrderBook("m1");
    assertEqual(book.yes.asks.length, 0, "All of Alice's asks consumed");
    
    // Bob sells all 50 YES @ 0.60
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "YES",
      side: "SELL",
      type: "LIMIT",
      price: 0.60,
      quantity: 50,
    });
    
    // Charlie buys all 50 from Bob
    const charlie = createTestTrader(registry, "charlie");
    const { trades } = registry.placeOrder({
      marketId: "m1",
      traderId: charlie,
      tokenType: "YES",
      side: "BUY",
      type: "LIMIT",
      price: 0.60,
      quantity: 50,
    });
    
    assertEqual(trades.length, 1, "One trade");
    assertEqual(trades[0].price, 0.60, "Trade at Bob's price");
    
    const bobPos3 = registry.getPosition(bob, "m1")!;
    assertEqual(bobPos3.yesTokens, 0, "Bob sold all");
    
    const charliePos = registry.getPosition(charlie, "m1")!;
    assertEqual(charliePos.yesTokens, 50, "Charlie has all 50");
    
    // Bob's balance: 10000 - 15 (30@0.50) - 10 (20@0.50) + 30 (50@0.60) = 10005
    const bobTrader = registry.getTrader(bob)!;
    assertEqual(bobTrader.balance, 10005, "Bob profit from trading");
  });

  test("NO token trading: mint, sell NO, resell NO", () => {
    const registry = MarketRegistry.createTestRegistry();
    createTestMarket(registry, "m1");
    
    // Alice mints and sells NO @ 0.40
    const alice = createTestTrader(registry, "alice");
    registry.mint({ marketId: "m1", traderId: alice, amount: 100 });
    registry.placeOrder({
      marketId: "m1",
      traderId: alice,
      tokenType: "NO",
      side: "SELL",
      type: "LIMIT",
      price: 0.40,
      quantity: 50,
    });
    
    // Bob buys 50 NO @ 0.40
    const bob = createTestTrader(registry, "bob");
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "NO",
      side: "BUY",
      type: "LIMIT",
      price: 0.40,
      quantity: 50,
    });
    
    const bobPos1 = registry.getPosition(bob, "m1")!;
    assertEqual(bobPos1.noTokens, 50, "Bob has 50 NO");
    assertEqual(bobPos1.yesTokens, 0, "Bob has 0 YES");
    
    // Bob resells NO @ 0.45
    registry.placeOrder({
      marketId: "m1",
      traderId: bob,
      tokenType: "NO",
      side: "SELL",
      type: "LIMIT",
      price: 0.45,
      quantity: 50,
    });
    
    // Charlie buys Bob's NO
    const charlie = createTestTrader(registry, "charlie");
    registry.placeOrder({
      marketId: "m1",
      traderId: charlie,
      tokenType: "NO",
      side: "BUY",
      type: "LIMIT",
      price: 0.45,
      quantity: 50,
    });
    
    const bobPos2 = registry.getPosition(bob, "m1")!;
    assertEqual(bobPos2.noTokens, 0, "Bob sold all NO");
    
    const charliePos = registry.getPosition(charlie, "m1")!;
    assertEqual(charliePos.noTokens, 50, "Charlie has 50 NO");
    
    // Bob's profit: bought 50 @ 0.40 ($20), sold 50 @ 0.45 ($22.50) = $2.50 profit
    const bobTrader = registry.getTrader(bob)!;
    assertClose(bobTrader.balance, 10002.5, 0.01, "Bob profit from NO trading");
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runOrderBookTests();
}
