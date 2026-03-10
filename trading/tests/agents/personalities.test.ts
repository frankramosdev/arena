/**
 * Tests for Agent Personalities
 */

import { describe, it, expect } from "vitest";
import {
  NAVAL_PERSONALITY,
  ELON_PERSONALITY,
  KARPATHY_PERSONALITY,
  DEGEN_PERSONALITY,
  PMARCA_PERSONALITY,
  PRESET_PERSONALITIES,
  initializeRelationships,
} from "../../src/agents/personalities.js";
import type { AgentPersonality } from "../../src/types/index.js";

// Ensure relationships are initialized
initializeRelationships();

describe("Agent Personalities", () => {
  const allPersonalities: [string, AgentPersonality][] = [
    ["Naval", NAVAL_PERSONALITY],
    ["Elon", ELON_PERSONALITY],
    ["Karpathy", KARPATHY_PERSONALITY],
    ["Degen", DEGEN_PERSONALITY],
    ["pmarca", PMARCA_PERSONALITY],
  ];

  describe("PRESET_PERSONALITIES", () => {
    it("should have exactly 5 preset personalities", () => {
      expect(Object.keys(PRESET_PERSONALITIES)).toHaveLength(5);
    });

    it("should include all expected personalities", () => {
      expect(PRESET_PERSONALITIES).toHaveProperty("naval");
      expect(PRESET_PERSONALITIES).toHaveProperty("elon");
      expect(PRESET_PERSONALITIES).toHaveProperty("karpathy");
      expect(PRESET_PERSONALITIES).toHaveProperty("degen");
      expect(PRESET_PERSONALITIES).toHaveProperty("pmarca");
    });
  });

  describe.each(allPersonalities)("%s personality", (name, personality) => {
    it("should have a riskProfile", () => {
      expect(personality.riskProfile).toBeDefined();
      expect(typeof personality.riskProfile).toBe("string");
    });

    it("should have a tradingStyle", () => {
      expect(personality.tradingStyle).toBeDefined();
      expect(typeof personality.tradingStyle).toBe("string");
    });

    it("should have maxPositionPercent between 0 and 1", () => {
      expect(personality.maxPositionPercent).toBeGreaterThan(0);
      expect(personality.maxPositionPercent).toBeLessThanOrEqual(1);
    });

    it("should have minConfidenceToTrade between 0 and 1", () => {
      expect(personality.minConfidenceToTrade).toBeGreaterThan(0);
      expect(personality.minConfidenceToTrade).toBeLessThanOrEqual(1);
    });

    it("should have maxPositionPercent <= 0.25 (conservative sizing)", () => {
      expect(personality.maxPositionPercent).toBeLessThanOrEqual(0.25);
    });

    it("should have minConfidenceToTrade >= 0.50 (reasonable conviction)", () => {
      expect(personality.minConfidenceToTrade).toBeGreaterThanOrEqual(0.50);
    });

    it("should have a tone", () => {
      expect(personality.tone).toBeDefined();
      expect(typeof personality.tone).toBe("string");
    });

    it("should have a verbosity setting", () => {
      expect(["terse", "normal", "verbose"]).toContain(personality.verbosity);
    });

    it("should have at least one catchphrase", () => {
      expect(personality.catchphrases.length).toBeGreaterThan(0);
    });

    it("should have at least one area of expertise", () => {
      expect(personality.expertise.length).toBeGreaterThan(0);
    });

    it("should have a bio", () => {
      expect(personality.bio.length).toBeGreaterThan(0);
    });

    it("should have a tradingPhilosophy", () => {
      expect(personality.tradingPhilosophy.length).toBeGreaterThan(0);
    });

    it("should have relationships map", () => {
      expect(personality.relationships).toBeInstanceOf(Map);
    });

    it("should have relationships with other agents (after init)", () => {
      expect(personality.relationships.size).toBeGreaterThan(0);
    });
  });

  describe("Risk/Confidence Alignment", () => {
    it("aggressive traders should have reasonable limits", () => {
      expect(ELON_PERSONALITY.maxPositionPercent).toBeLessThanOrEqual(0.20);
      expect(DEGEN_PERSONALITY.maxPositionPercent).toBeLessThanOrEqual(0.25);
    });

    it("conservative traders should have higher confidence thresholds", () => {
      expect(NAVAL_PERSONALITY.minConfidenceToTrade).toBeGreaterThanOrEqual(0.70);
      expect(KARPATHY_PERSONALITY.minConfidenceToTrade).toBeGreaterThanOrEqual(0.70);
    });

    it("degen should have lowest confidence threshold", () => {
      const confidences = allPersonalities.map(([, p]) => p.minConfidenceToTrade);
      expect(DEGEN_PERSONALITY.minConfidenceToTrade).toBe(Math.min(...confidences));
    });
  });

  describe("Personality Diversity", () => {
    it("should have diverse trading styles", () => {
      const styles = allPersonalities.map(([, p]) => p.tradingStyle);
      const uniqueStyles = new Set(styles);
      expect(uniqueStyles.size).toBeGreaterThanOrEqual(3);
    });

    it("should have diverse risk profiles", () => {
      const profiles = allPersonalities.map(([, p]) => p.riskProfile);
      const uniqueProfiles = new Set(profiles);
      expect(uniqueProfiles.size).toBeGreaterThanOrEqual(2);
    });

    it("should have diverse tones", () => {
      const tones = allPersonalities.map(([, p]) => p.tone);
      const uniqueTones = new Set(tones);
      expect(uniqueTones.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Relationships", () => {
    it("naval should respect karpathy", () => {
      const rel = NAVAL_PERSONALITY.relationships.get("karpathy");
      expect(rel?.sentiment).toBe("respect");
    });

    it("degen should have rivalry with naval", () => {
      const rel = DEGEN_PERSONALITY.relationships.get("naval");
      expect(rel?.sentiment).toBe("rivalry");
    });

    it("elon should respect karpathy (former colleague)", () => {
      const rel = ELON_PERSONALITY.relationships.get("karpathy");
      expect(rel?.sentiment).toBe("respect");
    });
  });
});
