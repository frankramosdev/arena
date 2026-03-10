/**
 * Tests for types and schemas
 */

import { describe, it, expect } from "vitest";
import {
  generateMarketId,
  MarketSchema,
  GeneratedMarketSchema,
  VerificationMethodSchema,
  MarketSourceSchema,
  TIMEFRAMES,
  VERIFICATION_TYPES,
} from "../src/index.js";

// ============================================================================
// generateMarketId
// ============================================================================

describe("generateMarketId", () => {
  it("generates unique IDs", () => {
    const id1 = generateMarketId();
    const id2 = generateMarketId();
    expect(id1).not.toBe(id2);
  });

  it("follows the expected format", () => {
    const id = generateMarketId();
    expect(id).toMatch(/^mkt_\d+_[a-z0-9]{6}$/);
  });

  it("includes timestamp component", () => {
    const before = Date.now();
    const id = generateMarketId();
    const after = Date.now();

    const timestampStr = id.split("_")[1];
    const timestamp = parseInt(timestampStr, 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// Constants
// ============================================================================

describe("TIMEFRAMES", () => {
  it("contains expected values", () => {
    expect(TIMEFRAMES).toContain("end_of_today");
    expect(TIMEFRAMES).toContain("tomorrow");
    expect(TIMEFRAMES).toContain("few_days");
    expect(TIMEFRAMES).toContain("end_of_week");
    expect(TIMEFRAMES).toHaveLength(4);
  });
});

describe("VERIFICATION_TYPES", () => {
  it("contains expected values", () => {
    expect(VERIFICATION_TYPES).toContain("tweet_exists");
    expect(VERIFICATION_TYPES).toContain("tweet_count");
    expect(VERIFICATION_TYPES).toContain("engagement_threshold");
    expect(VERIFICATION_TYPES).toContain("follower_milestone");
    expect(VERIFICATION_TYPES).toContain("account_action");
    expect(VERIFICATION_TYPES).toHaveLength(5);
  });
});

// ============================================================================
// VerificationMethodSchema
// ============================================================================

describe("VerificationMethodSchema", () => {
  it("validates a minimal verification method", () => {
    const result = VerificationMethodSchema.safeParse({
      type: "tweet_exists",
      resolutionCriteria: "Check if @elonmusk tweets about Grok",
    });
    expect(result.success).toBe(true);
  });

  it("validates with all optional fields", () => {
    const result = VerificationMethodSchema.safeParse({
      type: "engagement_threshold",
      targetHandles: ["elonmusk", "xai"],
      keywords: ["grok", "ai"],
      threshold: 10000,
      resolutionCriteria: "Tweet must reach 10K likes",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid verification type", () => {
    const result = VerificationMethodSchema.safeParse({
      type: "invalid_type",
      resolutionCriteria: "Some criteria",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing resolutionCriteria", () => {
    const result = VerificationMethodSchema.safeParse({
      type: "tweet_exists",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// MarketSourceSchema
// ============================================================================

describe("MarketSourceSchema", () => {
  it("validates empty source", () => {
    const result = MarketSourceSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("validates source with all fields", () => {
    const result = MarketSourceSchema.safeParse({
      url: "https://x.com/elonmusk/status/123",
      handle: "elonmusk",
      snippet: "Just announced Grok 3...",
    });
    expect(result.success).toBe(true);
  });

  it("validates source with partial fields", () => {
    const result = MarketSourceSchema.safeParse({
      handle: "xai",
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// GeneratedMarketSchema
// ============================================================================

describe("GeneratedMarketSchema", () => {
  const validMarket = {
    question: "Will @elonmusk tweet about Grok 3 today?",
    description: "Elon has been hinting at Grok 3 announcements.",
    resolutionDate: "2024-12-08T23:59:59.999Z",
    timeframe: "end_of_today",
    verification: {
      type: "tweet_exists",
      targetHandles: ["elonmusk"],
      keywords: ["grok", "grok 3"],
      resolutionCriteria: "Check @elonmusk timeline for tweets containing 'grok'",
    },
    sources: [
      {
        handle: "elonmusk",
        snippet: "Something big coming...",
      },
    ],
    tags: ["ai", "xai", "grok"],
  };

  it("validates a complete market", () => {
    const result = GeneratedMarketSchema.safeParse(validMarket);
    expect(result.success).toBe(true);
  });

  it("rejects invalid timeframe", () => {
    const result = GeneratedMarketSchema.safeParse({
      ...validMarket,
      timeframe: "invalid_timeframe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid resolution date format", () => {
    const result = GeneratedMarketSchema.safeParse({
      ...validMarket,
      resolutionDate: "tomorrow",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = GeneratedMarketSchema.safeParse({
      question: "Will something happen?",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty sources array", () => {
    const result = GeneratedMarketSchema.safeParse({
      ...validMarket,
      sources: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty tags array", () => {
    const result = GeneratedMarketSchema.safeParse({
      ...validMarket,
      tags: [],
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// MarketSchema (full market with auto-generated fields)
// ============================================================================

describe("MarketSchema", () => {
  const validFullMarket = {
    id: "mkt_1733612345678_abc123",
    createdAt: "2024-12-07T12:00:00.000Z",
    question: "Will @elonmusk tweet about Grok 3 today?",
    description: "Elon has been hinting at Grok 3 announcements.",
    resolutionDate: "2024-12-08T23:59:59.999Z",
    timeframe: "end_of_today",
    verification: {
      type: "tweet_exists",
      targetHandles: ["elonmusk"],
      resolutionCriteria: "Check @elonmusk timeline",
    },
    sources: [],
    tags: ["ai"],
  };

  it("validates a full market with id and createdAt", () => {
    const result = MarketSchema.safeParse(validFullMarket);
    expect(result.success).toBe(true);
  });

  it("rejects market without id", () => {
    const { id, ...marketWithoutId } = validFullMarket;
    const result = MarketSchema.safeParse(marketWithoutId);
    expect(result.success).toBe(false);
  });

  it("rejects market without createdAt", () => {
    const { createdAt, ...marketWithoutCreatedAt } = validFullMarket;
    const result = MarketSchema.safeParse(marketWithoutCreatedAt);
    expect(result.success).toBe(false);
  });

  it("rejects invalid createdAt format", () => {
    const result = MarketSchema.safeParse({
      ...validFullMarket,
      createdAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});
