/**
 * Agent Runner
 *
 * Executes agent decisions by calling the LLM.
 * Interest phase uses the Responses API with native xSearch for real-time X research.
 * Floor/side-chat phases use the Chat API for fast structured decisions.
 */

import { generateText } from "ai";
import { xai, xSearch } from "@ai-sdk/xai";
import { z } from "zod";

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
// HELPERS
// =============================================================================

/**
 * Extract @handles from a market question/description (max 10 for xSearch)
 */
function extractHandles(text: string): string[] {
  const matches = text.match(/@([A-Za-z0-9_]+)/g) || [];
  return [...new Set(matches.map((h) => h.slice(1)))].slice(0, 10);
}

/**
 * Wrap a promise with a timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`Timeout: ${operation} took longer than ${ms}ms`)),
      ms
    );
  });
  return Promise.race([promise, timeout]);
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`Failed to parse JSON from: ${text.slice(0, 200)}`);
  }
}

// =============================================================================
// AGENT RUNNER
// =============================================================================

export class AgentRunner {
  /**
   * Get agent's interest in a market.
   * Uses Responses API + xSearch for native real-time X research.
   * Passes allowedXHandles extracted from the market question so research
   * is focused on the relevant accounts.
   */
  async getInterest(
    agent: Agent,
    market: MarketInfo,
    balance: number
  ): Promise<InterestResponse> {
    const systemPrompt = buildSystemPrompt(agent);
    const prompt = buildInterestPrompt(agent, market, balance);

    // Focus X search on handles mentioned in the market question
    const handles = extractHandles(`${market.question} ${market.description}`);

    const result = await withTimeout(
      generateText({
        model: xai.responses(MODEL),
        system: systemPrompt,
        prompt,
        tools: {
          x_search: handles.length > 0
            ? xSearch({ allowedXHandles: handles })
            : xSearch(),
        },
        maxSteps: MAX_RESEARCH_STEPS,
      }),
      LLM_TIMEOUT_MS,
      `Interest generation for ${agent.handle}`
    );

    // Log research activity
    if (result.sources && result.sources.length > 0) {
      console.log(
        `  [${agent.handle}] xSearch: ${result.sources.length} source(s)` +
          (handles.length > 0 ? ` (focused on @${handles.join(", @")})` : "")
      );
    }

    const parsed = parseJSON(result.text);
    const validated = InterestResponseSchema.parse(parsed);

    const researchContext =
      result.sources && result.sources.length > 0
        ? `X research: ${result.sources.length} posts found`
        : "";

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
      researchContext,
    };
  }

  /**
   * Get agent's action on the main floor.
   * Uses Chat API (fast, no research needed — agents already have context).
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
   * Get agent's action in a side chat.
   * Uses Chat API (fast structured negotiation).
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
// SINGLETON
// =============================================================================

let runnerInstance: AgentRunner | null = null;

export function getAgentRunner(): AgentRunner {
  if (!runnerInstance) {
    runnerInstance = new AgentRunner();
  }
  return runnerInstance;
}
