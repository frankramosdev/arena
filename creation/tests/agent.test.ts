/**
 * Tests for CreationAgent
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreationAgent, DEFAULT_GENERATION_CONFIG, type GenerationConfig } from "../src/index.js";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
  generateText: vi.fn(),
  };
});

vi.mock("@ai-sdk/xai", () => ({
  xai: Object.assign(
    vi.fn(() => "mocked-model"),
    {
      responses: vi.fn(() => "mocked-agentic-model"),
      tools: {
        xSearch: vi.fn(() => ({ type: "x_search" })),
        webSearch: vi.fn(() => ({ type: "web_search" })),
      },
    }
  ),
}));

// Mock the X SDK client to avoid needing real bearer token
vi.mock("@xdevplatform/xdk", () => ({
  Client: vi.fn(() => ({
    posts: {},
    users: {},
    trends: {},
    news: {},
  })),
}));

import { generateText } from "ai";

const mockGenerateText = vi.mocked(generateText);

// ============================================================================
// Test Data
// ============================================================================

const mockGeneratedMarkets = {
  markets: [
    {
      question: "Will @elonmusk tweet about Grok 3 today?",
      description: "Elon has been hinting at Grok improvements.",
      resolutionDate: "2024-12-08T23:59:59.999Z",
      timeframe: "end_of_today" as const,
      verification: {
        type: "tweet_exists" as const,
        targetHandles: ["elonmusk"],
        keywords: ["grok", "grok 3"],
        resolutionCriteria: "Check @elonmusk timeline for Grok mentions",
      },
      sources: [{ handle: "elonmusk" }],
      tags: ["ai", "grok"],
    },
  ],
};

// ============================================================================
// CreationAgent Constructor
// ============================================================================

describe("CreationAgent", () => {
  describe("constructor", () => {
    it("uses default config when none provided", () => {
      const agent = new CreationAgent();
      expect(agent).toBeInstanceOf(CreationAgent);
    });

    it("merges custom config with defaults", () => {
      const customConfig: Partial<GenerationConfig> = {
        marketsPerRun: 10,
        priorityHandles: ["custom1", "custom2"],
      };
      const agent = new CreationAgent(customConfig);
      expect(agent).toBeInstanceOf(CreationAgent);
    });
  });
});

// ============================================================================
// runGenerationCycle (single agentic call)
// ============================================================================

describe("runGenerationCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(mockGeneratedMarkets) } as any);
  });

  it("returns generated markets with ids and timestamps", async () => {
    const agent = new CreationAgent();
    const markets = await agent.runGenerationCycle();

    expect(markets).toHaveLength(1);
    expect(markets[0].id).toMatch(/^mkt_/);
    expect(markets[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("uses agentic model with tools and schema", async () => {
    const agent = new CreationAgent();
    await agent.runGenerationCycle();

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.model).toBe("mocked-agentic-model");
    expect(callArgs.tools).toBeDefined();
  });
});

// ============================================================================
// startPeriodicGeneration
// ============================================================================

describe("startPeriodicGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(mockGeneratedMarkets) } as any);
  });

  it("returns a stop function", () => {
    const agent = new CreationAgent();
    const stop = agent.startPeriodicGeneration(60000);
    expect(typeof stop).toBe("function");
    stop();
  });

  it("calls callback with markets", async () => {
    const agent = new CreationAgent();
    const callback = vi.fn();

    const stop = agent.startPeriodicGeneration(60000, callback);

    await new Promise((r) => setTimeout(r, 50));

    expect(callback).toHaveBeenCalled();
    expect(callback.mock.calls[0][0]).toHaveLength(1);

    stop();
  });
});

// ============================================================================
// Error Handling
// ============================================================================

describe("Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propagates generation errors", async () => {
    mockGenerateText.mockRejectedValue(new Error("Generation failed"));

    const agent = new CreationAgent();
    await expect(agent.runGenerationCycle()).rejects.toThrow("Generation failed");
  });
});
