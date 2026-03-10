/**
 * Resolution Types Tests
 */

import { describe, it, expect } from "vitest";
import {
  ResolutionEvidenceSchema,
  ResolutionResultSchema,
  PendingMarketSchema,
  EarlyResolutionRequestSchema,
  RESOLUTION_OUTCOMES,
  EVIDENCE_TYPES,
} from "../src/types/index.js";

describe("Resolution Types", () => {
  describe("RESOLUTION_OUTCOMES", () => {
    it("should have correct values", () => {
      expect(RESOLUTION_OUTCOMES).toEqual(["YES", "NO", "INVALID"]);
    });
  });

  describe("EVIDENCE_TYPES", () => {
    it("should have all evidence types", () => {
      expect(EVIDENCE_TYPES).toContain("tweet");
      expect(EVIDENCE_TYPES).toContain("no_tweet");
      expect(EVIDENCE_TYPES).toContain("engagement");
      expect(EVIDENCE_TYPES).toContain("follower_count");
      expect(EVIDENCE_TYPES).toContain("account_action");
      expect(EVIDENCE_TYPES).toContain("api_error");
      expect(EVIDENCE_TYPES).toContain("invalid_market");
    });
  });

  describe("ResolutionEvidenceSchema", () => {
    it("should validate valid evidence", () => {
      const evidence = {
        type: "tweet",
        url: "https://x.com/elonmusk/status/123",
        tweetId: "123",
        explanation: "Found matching tweet",
        confidence: 0.95,
      };

      const result = ResolutionEvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it("should validate evidence without optional fields", () => {
      const evidence = {
        type: "no_tweet",
        explanation: "No matching tweet found after exhaustive search",
        confidence: 0.8,
      };

      const result = ResolutionEvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it("should reject invalid evidence type", () => {
      const evidence = {
        type: "invalid_type",
        explanation: "Test",
        confidence: 0.5,
      };

      const result = ResolutionEvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(false);
    });

    it("should reject confidence out of range", () => {
      const evidence = {
        type: "tweet",
        explanation: "Test",
        confidence: 1.5, // > 1
      };

      const result = ResolutionEvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(false);
    });

    it("should reject negative confidence", () => {
      const evidence = {
        type: "tweet",
        explanation: "Test",
        confidence: -0.1,
      };

      const result = ResolutionEvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(false);
    });
  });

  describe("ResolutionResultSchema", () => {
    it("should validate complete resolution result", () => {
      const result = {
        marketId: "mkt_123",
        outcome: "YES",
        evidence: {
          type: "tweet",
          url: "https://x.com/user/status/456",
          tweetId: "456",
          explanation: "Found tweet matching criteria",
          confidence: 0.99,
        },
        resolvedAt: "2024-12-07T12:00:00.000Z",
      };

      const parsed = ResolutionResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it("should reject invalid outcome", () => {
      const result = {
        marketId: "mkt_123",
        outcome: "MAYBE",
        evidence: {
          type: "tweet",
          explanation: "Test",
          confidence: 0.5,
        },
        resolvedAt: "2024-12-07T12:00:00.000Z",
      };

      const parsed = ResolutionResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe("PendingMarketSchema", () => {
    it("should validate pending market with all verification fields", () => {
      const market = {
        id: "mkt_abc123",
        question: "Will @elonmusk tweet about Grok today?",
        description: "Elon has been active on X recently...",
        resolutionDate: "2024-12-08T23:59:59.000Z",
        status: "OPEN",
        verification: {
          type: "tweet_exists",
          targetHandles: ["elonmusk"],
          keywords: ["grok", "Grok"],
          resolutionCriteria: "Resolves YES if Elon tweets about Grok",
        },
      };

      const result = PendingMarketSchema.safeParse(market);
      expect(result.success).toBe(true);
    });

    it("should validate market with threshold verification", () => {
      const market = {
        id: "mkt_def456",
        question: "Will @sama reach 5M followers?",
        description: "Sam Altman currently at 4.8M",
        resolutionDate: "2024-12-10T00:00:00.000Z",
        status: "OPEN",
        verification: {
          type: "follower_milestone",
          targetHandles: ["sama"],
          threshold: 5000000,
          resolutionCriteria: "Resolves YES if follower count >= 5M",
        },
      };

      const result = PendingMarketSchema.safeParse(market);
      expect(result.success).toBe(true);
    });

    it("should validate market without optional verification fields", () => {
      const market = {
        id: "mkt_ghi789",
        question: "Will there be a viral AI meme?",
        description: "Looking for viral AI content",
        resolutionDate: "2024-12-09T00:00:00.000Z",
        status: "OPEN",
        verification: {
          type: "tweet_exists",
          resolutionCriteria: "Manual verification required",
        },
      };

      const result = PendingMarketSchema.safeParse(market);
      expect(result.success).toBe(true);
    });
  });

  describe("EarlyResolutionRequestSchema", () => {
    it("should validate request with evidence", () => {
      const request = {
        marketId: "mkt_123",
        reason: "Event already occurred",
        evidence: {
          url: "https://x.com/user/status/789",
          explanation: "Tweet was posted confirming the event",
        },
      };

      const result = EarlyResolutionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("should validate request without evidence", () => {
      const request = {
        marketId: "mkt_123",
        reason: "Market needs immediate resolution",
      };

      const result = EarlyResolutionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("should reject request without marketId", () => {
      const request = {
        reason: "No market ID provided",
      };

      const result = EarlyResolutionRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });
});
