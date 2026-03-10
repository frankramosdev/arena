/**
 * Tests for prompt generation
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_GENERATION_CONFIG } from "../src/index.js";
import { getSystemPrompt, getMarketPrompt } from "../src/prompts/index.js";

const mockConfig = {
  ...DEFAULT_GENERATION_CONFIG,
  priorityHandles: ["testuser1", "testuser2"],
  priorityTopics: ["AI", "crypto"],
  marketsPerRun: 5,
};

describe("getSystemPrompt", () => {
  it("includes priority handles", () => {
    const prompt = getSystemPrompt(mockConfig);
    expect(prompt).toContain("@testuser1");
    expect(prompt).toContain("@testuser2");
  });

  it("includes priority topics", () => {
    const prompt = getSystemPrompt(mockConfig);
    expect(prompt).toContain("AI");
    expect(prompt).toContain("crypto");
  });

  it("includes current date", () => {
    const prompt = getSystemPrompt(mockConfig);
    expect(prompt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("includes timeframe definitions", () => {
    const prompt = getSystemPrompt(mockConfig);
    expect(prompt).toContain("end_of_today");
    expect(prompt).toContain("tomorrow");
    expect(prompt).toContain("few_days");
    expect(prompt).toContain("end_of_week");
  });

  it("includes forbidden market types", () => {
    const prompt = getSystemPrompt(mockConfig);
    expect(prompt).toContain("FORBIDDEN");
    expect(prompt).toContain("Subjective");
    expect(prompt).toContain("Price/financial");
  });

  it("mentions Twitter API verification requirement", () => {
    const prompt = getSystemPrompt(mockConfig);
    expect(prompt).toContain("Twitter API");
    expect(prompt).toContain("verifiable");
  });

  it("explicitly states no price setting", () => {
    const prompt = getSystemPrompt(mockConfig);
    expect(prompt).toContain("do NOT set prices");
  });

  it("includes day of week", () => {
    const prompt = getSystemPrompt(mockConfig);
    expect(prompt).toMatch(/Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday/);
  });

  it("includes time of day", () => {
    const prompt = getSystemPrompt(mockConfig);
    expect(prompt).toMatch(/early morning|morning|afternoon|evening|night/);
  });

  it("includes hours left today", () => {
    const prompt = getSystemPrompt(mockConfig);
    expect(prompt).toMatch(/Hours left today: \d+/);
  });

  it("includes days left in week", () => {
    const prompt = getSystemPrompt(mockConfig);
    expect(prompt).toMatch(/Days left in week: \d/);
  });
});

describe("getMarketPrompt", () => {
  it("includes number of markets to generate", () => {
    const prompt = getMarketPrompt(mockConfig);
    expect(prompt).toContain("5");
  });

  it("includes priority handles", () => {
    const prompt = getMarketPrompt(mockConfig);
    expect(prompt).toContain("@testuser1");
    expect(prompt).toContain("@testuser2");
  });

  it("includes priority topics", () => {
    const prompt = getMarketPrompt(mockConfig);
    expect(prompt).toContain("AI");
    expect(prompt).toContain("crypto");
  });

  it("includes JSON schema structure", () => {
    const prompt = getMarketPrompt(mockConfig);
    expect(prompt).toContain('"markets"');
    expect(prompt).toContain('"question"');
    expect(prompt).toContain('"verification"');
    expect(prompt).toContain('"resolutionCriteria"');
  });

  it("includes verification types", () => {
    const prompt = getMarketPrompt(mockConfig);
    expect(prompt).toContain("tweet_exists");
    expect(prompt).toContain("engagement_threshold");
    expect(prompt).toContain("follower_milestone");
  });

  it("includes market type guidance", () => {
    const prompt = getMarketPrompt(mockConfig);
    expect(prompt).toContain("Best Market Types");
    expect(prompt).toContain("Risky Market Types");
  });

  it("forbids price markets", () => {
    const prompt = getMarketPrompt(mockConfig);
    expect(prompt).toContain("NO price/financial");
  });

  it("includes time context", () => {
    const prompt = getMarketPrompt(mockConfig);
    expect(prompt).toMatch(/Now: \d{4}-\d{2}-\d{2}T/);
    expect(prompt).toMatch(/Hours left today: \d+/);
  });

  it("includes search strategy", () => {
    const prompt = getMarketPrompt(mockConfig);
    expect(prompt).toContain("Search Strategy");
    expect(prompt).toContain("x_search");
  });
});
