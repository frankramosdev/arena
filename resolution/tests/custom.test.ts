/**
 * Custom Resolution Tests
 */

import { describe, it, expect } from "vitest";
import { getCustomResolutionPrompt } from "../src/prompts/index.js";
import { CustomResolutionRequestSchema } from "../src/types/index.js";
import type { CustomResolutionRequest } from "../src/types/index.js";

describe("Custom Resolution", () => {
  describe("CustomResolutionRequestSchema", () => {
    it("should validate minimal request", () => {
      const request = {
        question: "Did @elonmusk tweet about AI today?",
      };

      const result = CustomResolutionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("should validate full request", () => {
      const request = {
        question: "Did @elonmusk tweet about Grok?",
        context: "Elon has been promoting Grok heavily lately",
        verificationType: "tweet_exists",
        targetHandles: ["elonmusk"],
        keywords: ["grok", "Grok", "xAI"],
        threshold: 1,
        timeWindow: "24h",
        resolutionCriteria: "Tweet must contain 'Grok' or 'grok'",
      };

      const result = CustomResolutionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("should reject question that's too short", () => {
      const request = {
        question: "Tweet?", // < 10 chars
      };

      const result = CustomResolutionRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should reject invalid verification type", () => {
      const request = {
        question: "Did something happen?",
        verificationType: "invalid_type",
      };

      const result = CustomResolutionRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it("should default verificationType to general", () => {
      const request = {
        question: "Did @elonmusk tweet about AI today?",
      };

      const result = CustomResolutionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      expect(result.data?.verificationType).toBe("general");
    });
  });

  describe("getCustomResolutionPrompt", () => {
    const createRequest = (
      overrides: Partial<CustomResolutionRequest> = {}
    ): CustomResolutionRequest => ({
      question: "Did @testuser tweet about AI today?",
      verificationType: "general",
      ...overrides,
    });

    it("should include the question", () => {
      const request = createRequest({ question: "Did @elonmusk post about Grok?" });
      const prompt = getCustomResolutionPrompt(request);

      expect(prompt).toContain("Did @elonmusk post about Grok?");
    });

    it("should include context when provided", () => {
      const request = createRequest({
        context: "Elon has been talking about AI a lot recently",
      });
      const prompt = getCustomResolutionPrompt(request);

      expect(prompt).toContain("Elon has been talking about AI a lot recently");
      expect(prompt).toContain("Context");
    });

    it("should include target handles", () => {
      const request = createRequest({
        targetHandles: ["elonmusk", "sama"],
      });
      const prompt = getCustomResolutionPrompt(request);

      expect(prompt).toContain("@elonmusk");
      expect(prompt).toContain("@sama");
    });

    it("should include keywords", () => {
      const request = createRequest({
        keywords: ["AI", "grok", "machine learning"],
      });
      const prompt = getCustomResolutionPrompt(request);

      expect(prompt).toContain("AI, grok, machine learning");
    });

    it("should include threshold", () => {
      const request = createRequest({
        verificationType: "follower_milestone",
        threshold: 5000000,
      });
      const prompt = getCustomResolutionPrompt(request);

      expect(prompt).toContain("5000000");
    });

    it("should generate tweet_exists guidance", () => {
      const request = createRequest({
        verificationType: "tweet_exists",
        targetHandles: ["elonmusk"],
        keywords: ["grok"],
      });
      const prompt = getCustomResolutionPrompt(request);

      expect(prompt).toContain("searchRecentTweets");
      expect(prompt).toContain("from:elonmusk grok");
      expect(prompt).toContain("Resolve YES");
    });

    it("should generate follower_milestone guidance", () => {
      const request = createRequest({
        verificationType: "follower_milestone",
        targetHandles: ["sama"],
        threshold: 5000000,
      });
      const prompt = getCustomResolutionPrompt(request);

      expect(prompt).toContain("getUserByUsername");
      expect(prompt).toContain("followers_count");
      expect(prompt).toContain("5000000");
    });

    it("should generate engagement_threshold guidance", () => {
      const request = createRequest({
        verificationType: "engagement_threshold",
        threshold: 100000,
      });
      const prompt = getCustomResolutionPrompt(request);

      expect(prompt).toContain("public_metrics");
      expect(prompt).toContain("like_count");
    });

    it("should generate account_action guidance for two handles", () => {
      const request = createRequest({
        verificationType: "account_action",
        targetHandles: ["sama", "elonmusk"],
      });
      const prompt = getCustomResolutionPrompt(request);

      expect(prompt).toContain("from:sama to:elonmusk");
    });

    it("should include JSON output schema", () => {
      const request = createRequest();
      const prompt = getCustomResolutionPrompt(request);

      expect(prompt).toContain('"outcome"');
      expect(prompt).toContain('"YES" | "NO" | "INVALID"');
      expect(prompt).toContain('"evidence"');
      expect(prompt).toContain('"confidence"');
    });

    it("should include confidence guidelines", () => {
      const request = createRequest();
      const prompt = getCustomResolutionPrompt(request);

      expect(prompt).toContain("1.0");
      expect(prompt).toContain("Definitive");
      expect(prompt).toContain("0.8-0.99");
    });
  });
});
