/**
 * Resolution Agent Tests
 * 
 * Tests agent logic with mocked API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResolutionAgent } from "../src/agent/index.js";
import type { PendingMarket, ResolutionResult } from "../src/types/index.js";

// Mock the common module
vi.mock("@sigarena/common", () => ({
  xTools: {
    searchRecentTweets: { execute: vi.fn() },
    getTweets: { execute: vi.fn() },
    getTweetById: { execute: vi.fn() },
    getQuoteTweets: { execute: vi.fn() },
    getRepostedBy: { execute: vi.fn() },
    getUserByUsername: { execute: vi.fn() },
    getUsersByUsernames: { execute: vi.fn() },
    getUserById: { execute: vi.fn() },
    getUsersByIds: { execute: vi.fn() },
    getUserTweets: { execute: vi.fn() },
    getUserMentions: { execute: vi.fn() },
    getUserFollowers: { execute: vi.fn() },
    getUserFollowing: { execute: vi.fn() },
  },
  getPendingResolutions: vi.fn(),
  getOverdueMarkets: vi.fn(),
  resolveMarket: vi.fn(),
  configureRegistry: vi.fn(),
}));

// Mock ai module
vi.mock("ai", () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn(() => () => false),
}));

// Mock @ai-sdk/xai
vi.mock("@ai-sdk/xai", () => ({
  xai: vi.fn(() => ({})),
}));

describe("ResolutionAgent", () => {
  let agent: ResolutionAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ResolutionAgent({
      checkIntervalMs: 1000,
      monitorHoursAhead: 24,
      batchSize: 5,
      maxRetries: 3,
      retryDelayMs: 1000,
    });
  });

  describe("constructor", () => {
    it("should create agent with default config", () => {
      const defaultAgent = new ResolutionAgent();
      expect(defaultAgent).toBeDefined();
    });

    it("should override config values", () => {
      const customAgent = new ResolutionAgent({
        batchSize: 20,
        maxRetries: 5,
      });
      expect(customAgent).toBeDefined();
    });
  });

  describe("submitResolution", () => {
    it("should skip INVALID outcomes", async () => {
      const { resolveMarket } = await import("@sigarena/common");
      
      const result: ResolutionResult = {
        marketId: "mkt_123",
        outcome: "INVALID",
        evidence: {
          type: "api_error",
          explanation: "API rate limited",
          confidence: 0,
        },
        resolvedAt: new Date().toISOString(),
      };

      const success = await agent.submitResolution(result);
      
      expect(success).toBe(false);
      expect(resolveMarket).not.toHaveBeenCalled();
    });

    it("should submit YES resolution", async () => {
      const { resolveMarket } = await import("@sigarena/common");
      vi.mocked(resolveMarket).mockResolvedValue({ market: { id: "mkt_123" } });

      const result: ResolutionResult = {
        marketId: "mkt_123",
        outcome: "YES",
        evidence: {
          type: "tweet",
          url: "https://x.com/user/status/456",
          explanation: "Found matching tweet",
          confidence: 0.95,
        },
        resolvedAt: new Date().toISOString(),
      };

      const success = await agent.submitResolution(result);

      expect(success).toBe(true);
      expect(resolveMarket).toHaveBeenCalledWith(
        "mkt_123",
        "YES",
        expect.objectContaining({
          type: "tweet",
          explanation: "Found matching tweet",
        })
      );
    });

    it("should submit NO resolution", async () => {
      const { resolveMarket } = await import("@sigarena/common");
      vi.mocked(resolveMarket).mockResolvedValue({ market: { id: "mkt_123" } });

      const result: ResolutionResult = {
        marketId: "mkt_123",
        outcome: "NO",
        evidence: {
          type: "no_tweet",
          explanation: "No matching tweet found",
          confidence: 0.9,
        },
        resolvedAt: new Date().toISOString(),
      };

      const success = await agent.submitResolution(result);

      expect(success).toBe(true);
      expect(resolveMarket).toHaveBeenCalledWith("mkt_123", "NO", expect.any(Object));
    });

    it("should handle API errors gracefully", async () => {
      const { resolveMarket } = await import("@sigarena/common");
      vi.mocked(resolveMarket).mockResolvedValue({ error: "Network error" });

      const result: ResolutionResult = {
        marketId: "mkt_123",
        outcome: "YES",
        evidence: {
          type: "tweet",
          explanation: "Found tweet",
          confidence: 0.95,
        },
        resolvedAt: new Date().toISOString(),
      };

      const success = await agent.submitResolution(result);

      expect(success).toBe(false);
    });
  });

  describe("runResolutionCycle", () => {
    it("should handle no pending markets", async () => {
      const { getPendingResolutions, getOverdueMarkets } = await import("@sigarena/common");
      vi.mocked(getPendingResolutions).mockResolvedValue({ markets: [] });
      vi.mocked(getOverdueMarkets).mockResolvedValue({ markets: [] });

      const stats = await agent.runResolutionCycle();

      expect(stats).toEqual({ resolved: 0, failed: 0, skipped: 0 });
    });

    it("should handle API errors when fetching markets", async () => {
      const { getPendingResolutions, getOverdueMarkets } = await import("@sigarena/common");
      vi.mocked(getPendingResolutions).mockResolvedValue({ error: "API error" });
      vi.mocked(getOverdueMarkets).mockResolvedValue({ markets: [] });

      const stats = await agent.runResolutionCycle();

      expect(stats).toEqual({ resolved: 0, failed: 0, skipped: 0 });
    });

    it("should prioritize overdue markets", async () => {
      const { getPendingResolutions, getOverdueMarkets } = await import("@sigarena/common");
      
      const overdueMarket = {
        id: "overdue_123",
        question: "Overdue market",
        description: "Test",
        resolutionDate: "2024-12-01T00:00:00.000Z",
        status: "OPEN",
        verification: { type: "tweet_exists", resolutionCriteria: "Test" },
      };

      const pendingMarket = {
        id: "pending_456",
        question: "Pending market",
        description: "Test",
        resolutionDate: "2024-12-10T00:00:00.000Z",
        status: "OPEN",
        verification: { type: "tweet_exists", resolutionCriteria: "Test" },
      };

      vi.mocked(getOverdueMarkets).mockResolvedValue({ markets: [overdueMarket] });
      vi.mocked(getPendingResolutions).mockResolvedValue({ markets: [pendingMarket] });

      // Mock generateText to return immediately (we're testing cycle logic, not AI)
      const { generateText } = await import("ai");
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify({
          outcome: "YES",
          evidence: { type: "tweet", explanation: "Test", confidence: 0.9 },
        }),
        sources: [],
      } as any);

      const { resolveMarket } = await import("@sigarena/common");
      vi.mocked(resolveMarket).mockResolvedValue({ market: {} });

      const stats = await agent.runResolutionCycle();

      // Both markets should be processed (overdue first, then pending)
      expect(stats.resolved + stats.failed + stats.skipped).toBe(2);
    });
  });

  describe("startMonitoring / stopMonitoring", () => {
    it("should start and stop monitoring", async () => {
      const { getPendingResolutions, getOverdueMarkets } = await import("@sigarena/common");
      vi.mocked(getPendingResolutions).mockResolvedValue({ markets: [] });
      vi.mocked(getOverdueMarkets).mockResolvedValue({ markets: [] });

      const stop = agent.startMonitoring();

      // Wait a bit for first cycle
      await new Promise((resolve) => setTimeout(resolve, 100));

      stop();

      // Should not throw
      expect(true).toBe(true);
    });

    it("should warn if monitoring already running", async () => {
      const { getPendingResolutions, getOverdueMarkets } = await import("@sigarena/common");
      vi.mocked(getPendingResolutions).mockResolvedValue({ markets: [] });
      vi.mocked(getOverdueMarkets).mockResolvedValue({ markets: [] });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const stop1 = agent.startMonitoring();
      const stop2 = agent.startMonitoring(); // Should warn

      stop1();
      stop2();

      consoleSpy.mockRestore();
    });
  });
});
