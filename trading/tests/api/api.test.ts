/**
 * Tests for Trading Floor API
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { api } from "../../src/api/index.js";

// Mock the coordinator and factory
vi.mock("../../src/coordinator/index.js", () => ({
  getTradingCoordinator: vi.fn().mockReturnValue({
    initializeAgents: vi.fn().mockResolvedValue(undefined),
    runInterestPhase: vi.fn().mockResolvedValue([
      {
        id: "int_001",
        agentId: "agent_naval",
        type: "INTERESTED",
        direction: "BUY",
        token: "YES",
        quote: 0.65,
        message: "I like this!",
      },
    ]),
    runFloorRound: vi.fn().mockResolvedValue([]),
    runSideChatRound: vi
      .fn()
      .mockResolvedValue({ messages: [], closed: false }),
    runAllSideChatsParallel: vi.fn().mockResolvedValue([]),
    expireAgreements: vi.fn(),
    setHandlers: vi.fn(),
  }),
  TradingCoordinator: vi.fn(),
}));

vi.mock("../../src/agents/index.js", () => ({
  getAgentFactory: vi.fn().mockReturnValue({
    getAllAgents: vi.fn().mockReturnValue([
      {
        id: "agent_naval",
        handle: "@naval",
        displayName: "Naval Ravikant",
        personality: {
          riskProfile: "conservative",
          tradingStyle: "value",
          tone: "philosophical",
          expertise: ["startups", "crypto"],
        },
      },
      {
        id: "agent_elon",
        handle: "@elon",
        displayName: "Elon Musk",
        personality: {
          riskProfile: "aggressive",
          tradingStyle: "momentum",
          tone: "casual",
          expertise: ["tech", "space"],
        },
      },
    ]),
    getAgent: vi.fn().mockImplementation((id: string) => {
      if (id === "agent_naval") {
        return {
          id: "agent_naval",
          handle: "@naval",
          displayName: "Naval Ravikant",
          personality: {
            riskProfile: "conservative",
            tradingStyle: "value",
            tone: "philosophical",
            expertise: ["startups", "crypto"],
          },
        };
      }
      return undefined;
    }),
  }),
  AgentFactory: vi.fn(),
}));

describe("Trading Floor API", () => {
  describe("GET /", () => {
    it("should return API info", async () => {
      const res = await api.request("/");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe("Basemarket Trading Floor");
      expect(body.endpoints).toBeDefined();
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const res = await api.request("/health");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeDefined();
    });
  });

  describe("GET /agents", () => {
    it("should return list of agents", async () => {
      const res = await api.request("/agents");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.agents).toBeDefined();
      expect(Array.isArray(body.agents)).toBe(true);
    });

    it("should include agent personality info", async () => {
      const res = await api.request("/agents");
      const body = await res.json();

      expect(body.agents[0].personality).toBeDefined();
      expect(body.agents[0].personality.riskProfile).toBeDefined();
    });
  });

  describe("GET /agents/:id", () => {
    it("should return agent by ID", async () => {
      const res = await api.request("/agents/naval");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.agent.handle).toBe("@naval");
    });

    it("should return 404 for non-existent agent", async () => {
      const res = await api.request("/agents/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /sessions", () => {
    it("should require market data", async () => {
      const res = await api.request("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("should create a new session", async () => {
      const res = await api.request("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: {
            id: "mkt_001",
            question: "Will BTC hit $100k?",
          },
        }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.session.id).toMatch(/^session_/);
      expect(body.session.marketId).toBe("mkt_001");
    });
  });

  describe("GET /sessions/:id", () => {
    it("should return 404 for non-existent session", async () => {
      const res = await api.request("/sessions/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /sessions/:id/interests", () => {
    it("should return 404 for non-existent session", async () => {
      const res = await api.request("/sessions/nonexistent/interests");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /sessions/:id/floor", () => {
    it("should return 404 for non-existent session", async () => {
      const res = await api.request("/sessions/nonexistent/floor");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /sessions/:id/chats", () => {
    it("should return 404 for non-existent session", async () => {
      const res = await api.request("/sessions/nonexistent/chats");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /sessions/:id/close", () => {
    it("should return 404 for non-existent session", async () => {
      const res = await api.request("/sessions/nonexistent/close", {
        method: "POST",
      });
      expect(res.status).toBe(404);
    });
  });
});
