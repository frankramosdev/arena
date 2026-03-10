/**
 * Resolution Prompts Tests
 */

import { describe, it, expect } from "vitest";
import { getSystemPrompt, getResolutionPrompt } from "../src/prompts/index.js";
import type { PendingMarket } from "../src/types/index.js";

describe("Resolution Prompts", () => {
  describe("getSystemPrompt", () => {
    it("should return system prompt with key sections", () => {
      const prompt = getSystemPrompt();

      // Check mission statement
      expect(prompt).toContain("RESOLUTION AGENT");
      expect(prompt).toContain("YES, NO, or INVALID");

      // Check tools are documented
      expect(prompt).toContain("searchRecentTweets");
      expect(prompt).toContain("getUserByUsername");
      expect(prompt).toContain("getTweetById");

      // Check verification types
      expect(prompt).toContain("tweet_exists");
      expect(prompt).toContain("follower_milestone");
      expect(prompt).toContain("engagement_threshold");

      // Check output format
      expect(prompt).toContain("outcome");
      expect(prompt).toContain("evidence");
      expect(prompt).toContain("confidence");
    });

    it("should include INVALID guidance", () => {
      const prompt = getSystemPrompt();
      expect(prompt).toContain("INVALID");
      expect(prompt).toContain("api_error");
    });
  });

  describe("getResolutionPrompt", () => {
    const createMockMarket = (
      overrides: Partial<PendingMarket> = {}
    ): PendingMarket => ({
      id: "mkt_test123",
      question: "Will @testuser tweet about AI today?",
      description: "Test market description",
      resolutionDate: "2024-12-08T23:59:59.000Z",
      status: "OPEN",
      verification: {
        type: "tweet_exists",
        targetHandles: ["testuser"],
        keywords: ["AI", "artificial intelligence"],
        resolutionCriteria: "Resolves YES if tweet found",
      },
      ...overrides,
    });

    it("should include market details", () => {
      const market = createMockMarket();
      const prompt = getResolutionPrompt(market);

      expect(prompt).toContain(market.id);
      expect(prompt).toContain(market.question);
      expect(prompt).toContain(market.description);
      expect(prompt).toContain(market.resolutionDate);
    });

    it("should include verification details", () => {
      const market = createMockMarket();
      const prompt = getResolutionPrompt(market);

      expect(prompt).toContain("tweet_exists");
      expect(prompt).toContain("@testuser");
      expect(prompt).toContain("AI, artificial intelligence");
      expect(prompt).toContain("Resolves YES if tweet found");
    });

    it("should generate tweet_exists instructions", () => {
      const market = createMockMarket({
        verification: {
          type: "tweet_exists",
          targetHandles: ["elonmusk"],
          keywords: ["grok"],
          resolutionCriteria: "Tweet about Grok",
        },
      });

      const prompt = getResolutionPrompt(market);

      expect(prompt).toContain("searchRecentTweets");
      expect(prompt).toContain("from:elonmusk");
      expect(prompt).toContain("YES = matching tweet found");
    });

    it("should generate follower_milestone instructions", () => {
      const market = createMockMarket({
        verification: {
          type: "follower_milestone",
          targetHandles: ["sama"],
          threshold: 5000000,
          resolutionCriteria: "5M followers",
        },
      });

      const prompt = getResolutionPrompt(market);

      expect(prompt).toContain("getUserByUsername");
      expect(prompt).toContain("followers_count");
      expect(prompt).toContain("5000000");
    });

    it("should generate engagement_threshold instructions", () => {
      const market = createMockMarket({
        verification: {
          type: "engagement_threshold",
          threshold: 100000,
          resolutionCriteria: "100K likes",
        },
      });

      const prompt = getResolutionPrompt(market);

      expect(prompt).toContain("engagement metrics");
      expect(prompt).toContain("likes, retweets, views");
      expect(prompt).toContain("100000");
    });

    it("should generate account_action instructions", () => {
      const market = createMockMarket({
        verification: {
          type: "account_action",
          targetHandles: ["user1", "user2"],
          resolutionCriteria: "user1 replies to user2",
        },
      });

      const prompt = getResolutionPrompt(market);

      expect(prompt).toContain("from:user1 to:user2");
      expect(prompt).toContain("replies");
    });

    it("should include JSON output schema", () => {
      const market = createMockMarket();
      const prompt = getResolutionPrompt(market);

      expect(prompt).toContain('"outcome"');
      expect(prompt).toContain('"YES" | "NO" | "INVALID"');
      expect(prompt).toContain('"evidence"');
    });

    it("should handle market without optional fields", () => {
      const market = createMockMarket({
        verification: {
          type: "tweet_exists",
          resolutionCriteria: "Custom criteria only",
        },
      });

      const prompt = getResolutionPrompt(market);

      expect(prompt).toContain("N/A"); // For missing handles/keywords
      expect(prompt).toContain("Custom criteria only");
    });
  });
});
