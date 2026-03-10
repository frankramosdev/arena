/**
 * Tests for configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("CONFIG", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("has correct model configured", async () => {
    const { CONFIG } = await import("../src/config/index.js");
    expect(CONFIG.xai.model).toBe("grok-4-1-fast-reasoning");
  });

  it("uses default interval when not specified", async () => {
    delete process.env.GENERATION_INTERVAL_MS;
    const { CONFIG } = await import("../src/config/index.js");
    expect(CONFIG.generation.intervalMs).toBe(3600000);
  });

  it("uses default markets per run when not specified", async () => {
    delete process.env.MAX_MARKETS_PER_RUN;
    const { CONFIG } = await import("../src/config/index.js");
    expect(CONFIG.generation.maxMarketsPerRun).toBe(5);
  });
});

describe("validateConfig", () => {
  it("does not throw when XAI_API_KEY is set", async () => {
    process.env.XAI_API_KEY = "test-api-key";
    const { validateConfig } = await import("../src/config/index.js");
    expect(() => validateConfig()).not.toThrow();
  });
});
