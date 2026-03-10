/**
 * Tests for Agent Factory
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AgentFactory, getRelationshipDescription, wouldAgentBeInterested } from "../../src/agents/factory.js";
import type { Agent } from "../../src/types/index.js";

describe("AgentFactory", () => {
  let factory: AgentFactory;

  beforeEach(() => {
    factory = new AgentFactory();
  });

  describe("createPresetAgent", () => {
    it("should create naval agent", () => {
      const agent = factory.createPresetAgent("naval");
      expect(agent.id).toBe("agent_naval");
      expect(agent.handle).toBe("naval");
      expect(agent.displayName).toBe("Naval Ravikant");
    });

    it("should create elon agent", () => {
      const agent = factory.createPresetAgent("elon");
      expect(agent.id).toBe("agent_elon");
      expect(agent.displayName).toBe("Elon Musk");
    });

    it("should store agent in factory", () => {
      factory.createPresetAgent("naval");
      expect(factory.getAgent("agent_naval")).toBeDefined();
    });

    it("should have personality from preset", () => {
      const agent = factory.createPresetAgent("karpathy");
      expect(agent.personality.riskProfile).toBe("moderate");
      expect(agent.personality.tradingStyle).toBe("value");
    });

    it("should have relationships map", () => {
      const agent = factory.createPresetAgent("naval");
      expect(agent.personality.relationships).toBeInstanceOf(Map);
    });
  });

  describe("createAllPresetAgents", () => {
    it("should create all 5 preset agents", () => {
      const agents = factory.createAllPresetAgents();
      expect(agents).toHaveLength(5);
    });

    it("should create agents with correct handles", () => {
      const agents = factory.createAllPresetAgents();
      const handles = agents.map((a) => a.handle);
      expect(handles).toContain("naval");
      expect(handles).toContain("elon");
      expect(handles).toContain("karpathy");
      expect(handles).toContain("degen");
      expect(handles).toContain("pmarca");
    });

    it("should not duplicate agents when called twice", () => {
      factory.createAllPresetAgents();
      factory.createAllPresetAgents();
      expect(factory.getAllAgents()).toHaveLength(5);
    });
  });

  describe("createCustomAgent", () => {
    it("should create a custom agent from twitter handle", async () => {
      const agent = await factory.createCustomAgent("testuser");
      expect(agent.id).toBe("agent_testuser");
      expect(agent.handle).toBe("testuser");
      expect(agent.displayName).toBe("@testuser");
    });

    it("should have default moderate personality", async () => {
      const agent = await factory.createCustomAgent("testuser");
      expect(agent.personality.riskProfile).toBe("moderate");
      expect(agent.personality.tradingStyle).toBe("value");
    });

    it("should add custom agent to the factory", async () => {
      await factory.createCustomAgent("testuser");
      expect(factory.getAllAgents()).toHaveLength(1);
      expect(factory.getAgent("agent_testuser")).toBeDefined();
    });
  });

  describe("getAgent", () => {
    beforeEach(() => {
      factory.createAllPresetAgents();
    });

    it("should return agent by ID", () => {
      const agent = factory.getAgent("agent_naval");
      expect(agent).toBeDefined();
      expect(agent?.handle).toBe("naval");
    });

    it("should return undefined for non-existent ID", () => {
      const agent = factory.getAgent("nonexistent");
      expect(agent).toBeUndefined();
    });
  });

  describe("getAllAgents", () => {
    it("should return empty array initially", () => {
      expect(factory.getAllAgents()).toHaveLength(0);
    });

    it("should return all created agents", () => {
      factory.createAllPresetAgents();
      expect(factory.getAllAgents()).toHaveLength(5);
    });
  });

  describe("initializeAgentState", () => {
    it("should create state with default balance", () => {
      const agent = factory.createPresetAgent("naval");
      const state = factory.initializeAgentState(agent);
      expect(state.balance).toBe(10000);
      expect(state.availableBalance).toBe(10000);
      expect(state.lockedBalance).toBe(0);
    });

    it("should create state with custom balance", () => {
      const agent = factory.createPresetAgent("naval");
      const state = factory.initializeAgentState(agent, 50000);
      expect(state.balance).toBe(50000);
      expect(state.availableBalance).toBe(50000);
    });

    it("should have agent on floor initially", () => {
      const agent = factory.createPresetAgent("naval");
      const state = factory.initializeAgentState(agent);
      expect(state.onFloor).toBe(true);
      expect(state.activeSideChats).toEqual([]);
    });
  });
});

describe("Helper Functions", () => {
  let factory: AgentFactory;
  let naval: Agent;

  beforeEach(() => {
    factory = new AgentFactory();
    naval = factory.createPresetAgent("naval");
  });

  describe("getRelationshipDescription", () => {
    it("should return description for known relationship", () => {
      const desc = getRelationshipDescription(naval, "agent_karpathy");
      expect(desc).toContain("respect");
      expect(desc).toContain("@karpathy");
    });

    it("should return default for unknown relationship", () => {
      const desc = getRelationshipDescription(naval, "agent_unknown");
      expect(desc).toContain("don't know");
    });
  });

  describe("wouldAgentBeInterested", () => {
    it("should return true for expertise tags", () => {
      expect(wouldAgentBeInterested(naval, ["tech", "AI"])).toBe(true);
    });

    it("should return false for avoided tags", () => {
      expect(wouldAgentBeInterested(naval, ["politics"])).toBe(false);
    });

    it("should return true for neutral tags", () => {
      expect(wouldAgentBeInterested(naval, ["weather"])).toBe(true);
    });

    it("should return false if any tag is avoided", () => {
      expect(wouldAgentBeInterested(naval, ["AI", "politics"])).toBe(false);
    });
  });
});
