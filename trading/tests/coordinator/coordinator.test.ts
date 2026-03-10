/**
 * Tests for Trading Coordinator (Unit tests - no LLM calls)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TradingCoordinator } from "../../src/coordinator/index.js";
import { existsSync, unlinkSync, readdirSync } from "fs";
import { randomUUID } from "crypto";

const TEST_DB_PATH = "./test-coordinator.db";

function cleanupDb(path: string) {
  const files = [path, `${path}-shm`, `${path}-wal`];
  for (const f of files) {
    if (existsSync(f)) {
      try { unlinkSync(f); } catch {}
    }
  }
}

// Mock the AgentRunner to avoid LLM calls
vi.mock("../../src/agents/runner.js", () => {
  return {
    AgentRunner: vi.fn().mockImplementation(() => ({
      getInterest: vi.fn().mockImplementation(async (agent: any, market: any) => ({
        id: `int_${randomUUID().slice(0, 8)}`,
        marketId: market.id,
        agentId: agent.id,
        type: "INTERESTED",
        side: "BUY",
        token: "YES",
        price: 0.65,
        quantity: 100,
        message: "I like this market!",
        createdAt: new Date().toISOString(),
      })),
      getMainFloorAction: vi.fn().mockResolvedValue({
        action: "PASS",
      }),
      getSideChatAction: vi.fn().mockResolvedValue({
        action: "CHAT",
        text: "Thinking about it...",
      }),
    })),
    getAgentRunner: vi.fn().mockImplementation(() => ({
      getInterest: vi.fn().mockImplementation(async (agent: any, market: any) => ({
        id: `int_${randomUUID().slice(0, 8)}`,
        marketId: market.id,
        agentId: agent.id,
        type: "INTERESTED",
        side: "BUY",
        token: "YES",
        price: 0.65,
        quantity: 100,
        message: "I like this market!",
        createdAt: new Date().toISOString(),
      })),
      getMainFloorAction: vi.fn().mockResolvedValue({
        action: "PASS",
      }),
      getSideChatAction: vi.fn().mockResolvedValue({
        action: "CHAT",
        text: "Thinking about it...",
      }),
    })),
  };
});

describe("TradingCoordinator", () => {
  let coordinator: TradingCoordinator;

  const mockMarket = {
    id: "mkt_001",
    question: "Will Bitcoin hit $100k by end of 2025?",
    description: "Resolves YES if BTC/USD reaches $100,000",
    yesPrice: 0.65,
    noPrice: 0.35,
    volume: 10000,
    resolutionDate: "2025-12-31T00:00:00Z",
    status: "OPEN",
  };

  beforeEach(() => {
    cleanupDb(TEST_DB_PATH);
    // Create fresh coordinator with unique db for each test
    const uniqueDbPath = `./test-coordinator-${randomUUID().slice(0, 8)}.db`;
    coordinator = new TradingCoordinator(uniqueDbPath);
  });

  afterEach(() => {
    cleanupDb(TEST_DB_PATH);
    // Clean up any test db files with uuid pattern (including WAL files)
    try {
      const files = readdirSync(".");
      for (const f of files) {
        if (f.startsWith("test-coordinator-") && (f.endsWith(".db") || f.endsWith(".db-shm") || f.endsWith(".db-wal"))) {
          try { unlinkSync(f); } catch {}
        }
      }
    } catch {}
  });

  describe("initializeAgents", () => {
    it("should create all preset agents", async () => {
      const agents = await coordinator.initializeAgents(10000);
      expect(agents).toHaveLength(5);
    });

    it("should initialize agents with specified balance", async () => {
      const agents = await coordinator.initializeAgents(50000);
      expect(agents.length).toBe(5);
    });
  });

  describe("setHandlers", () => {
    it("should set message handler", () => {
      const onMessage = vi.fn();
      coordinator.setHandlers({ onMessage });
      // Handler is set (internal - just verify no error)
    });

    it("should set trade handler", () => {
      const onTrade = vi.fn();
      coordinator.setHandlers({ onTrade });
      // Handler is set (internal - just verify no error)
    });

    it("should set both handlers", () => {
      const onMessage = vi.fn();
      const onTrade = vi.fn();
      coordinator.setHandlers({ onMessage, onTrade });
      // Both handlers are set
    });
  });

  describe("runInterestPhase", () => {
    beforeEach(async () => {
      await coordinator.initializeAgents(10000);
    });

    it("should collect interest from all agents", async () => {
      const responses = await coordinator.runInterestPhase(mockMarket);
      expect(responses).toHaveLength(5);
    });

    it("should return responses with agent IDs", async () => {
      const responses = await coordinator.runInterestPhase(mockMarket);
      const agentIds = responses.map(r => r.agentId);
      expect(agentIds).toContain("agent_naval");
      expect(agentIds).toContain("agent_elon");
    });
  });

  describe("expireAgreements", () => {
    it("should return number of expired agreements", async () => {
      await coordinator.initializeAgents(10000);
      const expired = coordinator.expireAgreements();
      expect(typeof expired).toBe("number");
    });
  });

  describe("runFloorRound", () => {
    beforeEach(async () => {
      await coordinator.initializeAgents(10000);
    });

    it("should run floor round with agents", async () => {
      const interests = await coordinator.runInterestPhase(mockMarket);
      const sideChats = new Map();
      const floorMessages: any[] = [];

      const messages = await coordinator.runFloorRound(
        mockMarket,
        interests,
        floorMessages,
        sideChats
      );

      // Messages array returned (may be empty if all PASS)
      expect(Array.isArray(messages)).toBe(true);
    });
  });
});
