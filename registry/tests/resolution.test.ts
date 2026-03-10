/**
 * Resolution agent tests
 */

import { MarketRegistry } from "../src/registry.js";
import { ResolutionAgent } from "../src/resolution.js";
import type { CreateMarketInput } from "../src/types.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
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
  const soon = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  
  return {
    id,
    question: `Will @testuser tweet about test today?`,
    description: `Test market for resolution`,
    createdAt: now.toISOString(),
    resolutionDate: soon.toISOString(),
    timeframe: "end_of_today",
    verification: {
      type: "tweet_exists",
      targetHandles: ["testuser"],
      keywords: ["test"],
      resolutionCriteria: "Check if @testuser tweets about test",
    },
    sources: [],
    tags: ["test"],
    initialProbability: 0.5,
    ...overrides,
  };
}

export async function runResolutionTests() {
  console.log("\n⚖️ Resolution Agent Tests\n");
  passed = 0;
  failed = 0;

  await test("resolution agent initializes with registry", () => {
    const registry = MarketRegistry.createTestRegistry();
    const agent = new ResolutionAgent(registry);
    assert(agent !== undefined, "agent should exist");
  });

  await test("gets pending resolutions", () => {
    const registry = MarketRegistry.createTestRegistry();
    const agent = new ResolutionAgent(registry);
    
    const now = new Date();
    registry.createMarket(createTestMarket("soon", {
      resolutionDate: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    }));
    registry.createMarket(createTestMarket("later", {
      resolutionDate: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    }));
    
    const pending = agent.getPendingResolutions(2);
    assertEqual(pending.length, 1, "should have 1 pending");
    assertEqual(pending[0].id, "soon", "should be 'soon' market");
  });

  await test("resolves market with YES outcome", () => {
    const registry = MarketRegistry.createTestRegistry();
    const agent = new ResolutionAgent(registry);
    registry.createMarket(createTestMarket("yes-market"));
    
    const result = agent.resolve("yes-market", {
      outcome: "YES",
      evidence: {
        type: "tweet_exists",
        url: "https://x.com/testuser/status/123",
        explanation: "Found tweet matching criteria",
      },
    });
    
    assertEqual(result.status, "RESOLVED_YES", "status");
    assertEqual(result.prices.yesPrice, 1, "YES price");
    assertEqual(result.resolutionProof?.outcome, "YES", "proof outcome");
  });

  await test("resolves market with NO outcome", () => {
    const registry = MarketRegistry.createTestRegistry();
    const agent = new ResolutionAgent(registry);
    registry.createMarket(createTestMarket("no-market"));
    
    const result = agent.resolve("no-market", {
      outcome: "NO",
      evidence: {
        type: "tweet_exists",
        explanation: "No tweet found",
      },
    });
    
    assertEqual(result.status, "RESOLVED_NO", "status");
    assertEqual(result.prices.yesPrice, 0, "YES price");
  });

  await test("queues market for resolution", () => {
    const registry = MarketRegistry.createTestRegistry();
    const agent = new ResolutionAgent(registry);
    registry.createMarket(createTestMarket("queue-market"));
    
    agent.queueForResolution("queue-market");
    const queue = agent.getResolutionQueue();
    
    assert(queue.has("queue-market"), "should be in queue");
  });

  await test("removes from queue after resolution", () => {
    const registry = MarketRegistry.createTestRegistry();
    const agent = new ResolutionAgent(registry);
    registry.createMarket(createTestMarket("dequeue-market"));
    
    agent.queueForResolution("dequeue-market");
    agent.resolve("dequeue-market", {
      outcome: "YES",
      evidence: { type: "test", explanation: "test" },
    });
    
    const queue = agent.getResolutionQueue();
    assert(!queue.has("dequeue-market"), "should not be in queue");
  });

  await test("validates resolution criteria", () => {
    const registry = MarketRegistry.createTestRegistry();
    const agent = new ResolutionAgent(registry);
    registry.createMarket(createTestMarket("validate-market"));
    
    const market = registry.getMarket("validate-market")!;
    const criteria = agent.getResolutionCriteria(market);
    
    assert(criteria.type === "tweet_exists", "type");
    assert(criteria.targetHandles?.includes("testuser"), "target handle");
    assert(criteria.keywords?.includes("test"), "keyword");
  });

  await test("throws on resolving non-existent market", () => {
    const registry = MarketRegistry.createTestRegistry();
    const agent = new ResolutionAgent(registry);
    
    let threw = false;
    try {
      agent.resolve("nonexistent", {
        outcome: "YES",
        evidence: { type: "test", explanation: "test" },
      });
    } catch {
      threw = true;
    }
    assert(threw, "should throw");
  });

  await test("throws on resolving already resolved market", () => {
    const registry = MarketRegistry.createTestRegistry();
    const agent = new ResolutionAgent(registry);
    registry.createMarket(createTestMarket("double-resolve"));
    
    agent.resolve("double-resolve", {
      outcome: "YES",
      evidence: { type: "test", explanation: "test" },
    });
    
    let threw = false;
    try {
      agent.resolve("double-resolve", {
        outcome: "NO",
        evidence: { type: "test", explanation: "changed my mind" },
      });
    } catch {
      threw = true;
    }
    assert(threw, "should throw on double resolution");
  });

  await test("batch resolves multiple markets", () => {
    const registry = MarketRegistry.createTestRegistry();
    const agent = new ResolutionAgent(registry);
    
    registry.createMarket(createTestMarket("batch1"));
    registry.createMarket(createTestMarket("batch2"));
    registry.createMarket(createTestMarket("batch3"));
    
    const results = agent.batchResolve([
      { marketId: "batch1", outcome: "YES", evidence: { type: "test", explanation: "yes" } },
      { marketId: "batch2", outcome: "NO", evidence: { type: "test", explanation: "no" } },
      { marketId: "batch3", outcome: "YES", evidence: { type: "test", explanation: "yes" } },
    ]);
    
    assertEqual(results.length, 3, "should resolve 3 markets");
    assertEqual(results[0].status, "RESOLVED_YES", "batch1 YES");
    assertEqual(results[1].status, "RESOLVED_NO", "batch2 NO");
    assertEqual(results[2].status, "RESOLVED_YES", "batch3 YES");
  });

  await test("gets resolution stats", () => {
    const registry = MarketRegistry.createTestRegistry();
    const agent = new ResolutionAgent(registry);
    
    registry.createMarket(createTestMarket("stat1"));
    registry.createMarket(createTestMarket("stat2"));
    registry.createMarket(createTestMarket("stat3"));
    
    agent.resolve("stat1", { outcome: "YES", evidence: { type: "test", explanation: "test" } });
    agent.resolve("stat2", { outcome: "NO", evidence: { type: "test", explanation: "test" } });
    
    const stats = agent.getStats();
    assertEqual(stats.resolved, 2, "resolved count");
    assertEqual(stats.pending, 1, "pending count");
    assertEqual(stats.yesOutcomes, 1, "YES outcomes");
    assertEqual(stats.noOutcomes, 1, "NO outcomes");
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runResolutionTests();
}
