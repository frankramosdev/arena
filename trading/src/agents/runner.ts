/**
 * Agent Runner
 * 
 * Executes agent decisions by calling the LLM with X API tools.
 */

import { generateText, stepCountIs } from "ai";
import { xai } from "@ai-sdk/xai";
import { z } from "zod";
import { xTools } from "@sigarena/common/tools";

import type {
  Agent,
  AgentState,
  MarketInfo,
  InterestResponse,
  SideChat,
  Message,
  MainFloorAction,
  SideChatAction,
} from "../types/index.js";
import {
  buildSystemPrompt,
  buildInterestPrompt,
  buildMainFloorPrompt,
  buildSideChatPrompt,
} from "./prompts.js";

// =============================================================================
// CONFIG
// =============================================================================

const MODEL = process.env.XAI_MODEL || "grok-4-1-fast-reasoning";
const LLM_TIMEOUT_MS = 180_000; // 3 minute timeout - includes tool calls for research
const MAX_RESEARCH_STEPS = 50; // Max steps for research phase

// =============================================================================
// SCHEMAS FOR PARSING
// =============================================================================

const InterestResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("INTERESTED"),
    side: z.enum(["BUY", "SELL"]),
    token: z.enum(["YES", "NO"]),
    price: z.number().min(0.01).max(0.99),
    quantity: z.number().positive(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("PASS"),
    message: z.string(),
  }),
]);

const MainFloorActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CHAT"), text: z.string() }),
  z.object({ action: z.literal("START_SIDE_CHAT"), text: z.string(), withAgents: z.array(z.string()) }),
  z.object({ action: z.literal("FINALIZE_AGREEMENT"), text: z.string(), agreementId: z.string() }),
  z.object({ action: z.literal("CANCEL_AGREEMENT"), text: z.string(), agreementId: z.string() }),
  z.object({ action: z.literal("LEAVE_FLOOR"), text: z.string() }),
  z.object({ action: z.literal("PASS") }),
]);

const SideChatActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CHAT"), text: z.string() }),
  z.object({ 
    action: z.literal("PROPOSE"), 
    text: z.string(), 
    side: z.enum(["BUY", "SELL"]),
    token: z.enum(["YES", "NO"]),
    price: z.number().min(0.01).max(0.99),
    quantity: z.number().positive(),
  }),
  z.object({ 
    action: z.literal("COUNTER"), 
    text: z.string(), 
    side: z.enum(["BUY", "SELL"]),
    token: z.enum(["YES", "NO"]),
    price: z.number().min(0.01).max(0.99),
    quantity: z.number().positive(),
  }),
  z.object({ action: z.literal("AGREE"), text: z.string() }),
  z.object({ action: z.literal("REJECT"), text: z.string() }),
  z.object({ action: z.literal("LEAVE_CHAT"), text: z.string() }),
]);

// =============================================================================
// AGENT RUNNER
// =============================================================================

export class AgentRunner {
  /**
   * Get agent's interest in a market
   * Agent can use X API tools to research before deciding
   */
  async getInterest(
    agent: Agent,
    market: MarketInfo,
    balance: number
  ): Promise<InterestResponse> {
    const systemPrompt = buildSystemPrompt(agent);
    const prompt = buildInterestPrompt(agent, market, balance);

    // X API tools for specific lookups
    const researchTools = {
      getUserByUsername: xTools.getUserByUsername,
      getUserTweets: xTools.getUserTweets,
      searchRecentTweets: xTools.searchRecentTweets,
      getTrendsByWoeid: xTools.getTrendsByWoeid,
    };

    const result = await withTimeout(
      generateText({
        model: xai(MODEL),
        system: systemPrompt,
        prompt,
        tools: researchTools,
        stopWhen: stepCountIs(MAX_RESEARCH_STEPS),
        // Enable Live Search for X and web (native xAI feature)
        providerOptions: {
          xai: {
            searchParameters: {
              mode: "auto", // Model decides when to search
              returnCitations: true,
              maxSearchResults: 20,
              sources: [
                { type: "x", postFavoriteCount: 5, postViewCount: 500 },
                { type: "news", safeSearch: true },
              ],
            },
          },
        },
      }),
      LLM_TIMEOUT_MS,
      `Interest generation for ${agent.handle}`
    );

    // Capture research context from tool calls
    let researchContext = '';
    if (result.steps && result.steps.length > 1) {
      const toolCalls = result.steps.flatMap(s => s.toolCalls || []);
      const toolResults = result.steps.flatMap(s => s.toolResults || []);
      if (toolCalls.length > 0) {
        console.log(`  [${agent.handle}] Used ${toolCalls.length} tool(s): ${toolCalls.map(t => t.toolName).join(', ')}`);
        // Summarize key findings from tool results
        const findings: string[] = [];
        for (let i = 0; i < toolResults.length; i++) {
          const tr = toolResults[i] as { result?: unknown };
          const toolName = toolCalls[i]?.toolName || 'unknown';
          if (tr?.result && typeof tr.result === 'object') {
            const r = tr.result as Record<string, unknown>;
            if (r.data && Array.isArray(r.data) && r.data.length > 0) {
              findings.push(`${toolName}: ${r.data.length} results`);
            }
          }
        }
        if (findings.length > 0) {
          researchContext = `Research: ${findings.join(', ')}`;
        }
      }
    }
    if (result.sources && result.sources.length > 0) {
      console.log(`  [${agent.handle}] Live Search: ${result.sources.length} sources`);
      researchContext += researchContext ? ` + ${result.sources.length} web sources` : `${result.sources.length} web sources`;
    }

    const parsed = parseJSON(result.text);
    const validated = InterestResponseSchema.parse(parsed);

    return {
      id: `interest_${agent.id}_${market.id}`,
      marketId: market.id,
      agentId: agent.id,
      type: validated.type,
      side: validated.type === "INTERESTED" ? validated.side : undefined,
      token: validated.type === "INTERESTED" ? validated.token : undefined,
      price: validated.type === "INTERESTED" ? validated.price : undefined,
      quantity: validated.type === "INTERESTED" ? validated.quantity : undefined,
      message: validated.message,
      createdAt: new Date().toISOString(),
      researchContext, // Include research summary
    };
  }

  /**
   * Get agent's action on the main floor
   */
  async getMainFloorAction(
    agent: Agent,
    state: AgentState,
    market: MarketInfo,
    floorMessages: Message[],
    interests: InterestResponse[],
    activeSideChats: { participants: string[]; startedAt: string }[],
    otherAgents: Agent[],
    roundNumber: number = 1,
    agentsWhoLeft: string[] = [],
    maxRounds: number = 10
  ): Promise<MainFloorAction> {
    const systemPrompt = buildSystemPrompt(agent);
    const prompt = buildMainFloorPrompt(
      agent,
      state,
      market,
      floorMessages,
      interests,
      activeSideChats,
      otherAgents,
      roundNumber,
      agentsWhoLeft,
      maxRounds
    );

    const result = await withTimeout(
      generateText({
        model: xai(MODEL),
        system: systemPrompt,
        prompt,
      }),
      LLM_TIMEOUT_MS,
      `Floor action for ${agent.handle}`
    );

    const parsed = parseJSON(result.text);
    return MainFloorActionSchema.parse(parsed);
  }

  /**
   * Get agent's action in a side chat
   */
  async getSideChatAction(
    agent: Agent,
    state: AgentState,
    market: MarketInfo,
    chat: SideChat,
    otherParticipants: Agent[]
  ): Promise<SideChatAction> {
    const systemPrompt = buildSystemPrompt(agent);
    const prompt = buildSideChatPrompt(agent, state, market, chat, otherParticipants);

    const result = await withTimeout(
      generateText({
        model: xai(MODEL),
        system: systemPrompt,
        prompt,
      }),
      LLM_TIMEOUT_MS,
      `Side chat action for ${agent.handle}`
    );

    const parsed = parseJSON(result.text);
    return SideChatActionSchema.parse(parsed);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Wrap a promise with a timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout: ${operation} took longer than ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]);
}

function parseJSON(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`Failed to parse JSON from: ${text.slice(0, 200)}`);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let runnerInstance: AgentRunner | null = null;

export function getAgentRunner(): AgentRunner {
  if (!runnerInstance) {
    runnerInstance = new AgentRunner();
  }
  return runnerInstance;
}
