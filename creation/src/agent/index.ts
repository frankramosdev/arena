/**
 * Creation Agent - Single agentic call: x_search + X API tools -> JSON output
 */

import { xai } from "@ai-sdk/xai";
import { generateText, stepCountIs } from "ai";
import { z } from "zod";
import { xTools, searchExistingMarkets } from "@sigarena/common";

import { CONFIG } from "../config/index.js";
import { getSystemPrompt, getMarketPrompt } from "../prompts/index.js";
import {
  DEFAULT_GENERATION_CONFIG,
  GeneratedMarketSchema,
  type GenerationConfig,
  type Market,
} from "../types/index.js";
import { generateMarketId, log } from "../utils/index.js";

export class CreationAgent {
  private config: GenerationConfig;

  constructor(config: Partial<GenerationConfig> = {}) {
    this.config = { ...DEFAULT_GENERATION_CONFIG, ...config };
  }

  async runGenerationCycle(): Promise<Market[]> {
    log.info("Starting generation cycle...");

    const systemPrompt = getSystemPrompt(this.config);
    const marketPrompt = getMarketPrompt(this.config);

    const schema = z.object({
      markets: z.array(GeneratedMarketSchema),
    });

    let stepCount = 0;

    // Build tools object
    const tools = {
      // REGISTRY TOOL - Check for existing markets before generating
      searchExistingMarkets,
      
      // X API tools for specific lookups
      // NOTE: Searching is handled by Live Search (providerOptions.xai.searchParameters)
      getTweets: xTools.getTweets,
      getTweetById: xTools.getTweetById,
      getQuoteTweets: xTools.getQuoteTweets,
      getRepostedBy: xTools.getRepostedBy,
      getUsersByUsernames: xTools.getUsersByUsernames,
      getUserByUsername: xTools.getUserByUsername,
      getUsersByIds: xTools.getUsersByIds,
      getUserById: xTools.getUserById,
      getUserTweets: xTools.getUserTweets,
      getUserMentions: xTools.getUserMentions,
      getUserFollowers: xTools.getUserFollowers,
      getUserFollowing: xTools.getUserFollowing,
      getTrendsByWoeid: xTools.getTrendsByWoeid,
    };
    log.info(`Registered ${Object.keys(tools).length} tools (1 registry + ${Object.keys(tools).length - 1} X API) + Live Search`);

    let text: string;
    try {
      // Use xai() with custom tools + Live Search (not xai.responses())
      // xai.responses() only supports server-side tools, can't mix with custom tools
      const result = await generateText({
        model: xai(CONFIG.xai.model),
      system: systemPrompt,
      prompt: marketPrompt,
        tools,
        // Enable multi-step tool calling - model can call tools multiple times
        stopWhen: stepCountIs(200), // Max 200 steps for deep research
      providerOptions: {
        xai: {
            // Enable Live Search for X and web
            searchParameters: {
              mode: "auto", // Model decides when to search
              returnCitations: true,
              maxSearchResults: 25, // API max is 30
              sources: [
                {
                  type: "x",
                  // Search high-engagement posts
                  postFavoriteCount: 10,
                  postViewCount: 1000,
                },
                {
                  type: "news",
                  safeSearch: true,
                },
              ],
            },
        },
      },
        onStepFinish: ({ toolCalls, toolResults, text: stepText }) => {
        stepCount++;
        if (toolCalls && toolCalls.length > 0) {
          for (const call of toolCalls) {
              log.info(`[Step ${stepCount}] ${call.toolName}`);
          }
        }
        if (toolResults && toolResults.length > 0) {
            for (let i = 0; i < toolResults.length; i++) {
              const tr = toolResults[i];
              const toolName = toolCalls?.[i]?.toolName ?? "unknown";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const r = (tr as any).output as Record<string, unknown> | undefined;
              if (r) {
                if ("error" in r) {
                  log.warn(`  [${toolName}] Error: ${r.error}`);
                } else if ("data" in r && Array.isArray(r.data)) {
                  log.info(`  [${toolName}] ${r.data.length} results`);
                } else if ("posts" in r && Array.isArray(r.posts)) {
                  log.info(`  [${toolName}] ${r.posts.length} posts`);
            }
          }
            }
          }
          // Log text output if present (final step will have JSON)
          if (stepText && stepText.length > 0) {
            log.info(`[Step ${stepCount}] Text output: ${stepText.slice(0, 100)}...`);
        }
      },
    });
      text = result.text;
      log.info(`Completed ${stepCount} steps`);
      
      // Log sources if available
      if (result.sources && result.sources.length > 0) {
        log.info(`Sources: ${result.sources.length} citations`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`generateText failed: ${msg}`);
      // Log full error for debugging
      if (err instanceof Error && 'cause' in err) {
        log.error(`Cause: ${JSON.stringify(err.cause, null, 2)}`);
      }
      if (err && typeof err === 'object' && 'responseBody' in err) {
        log.error(`Response: ${JSON.stringify((err as any).responseBody, null, 2)}`);
      }
      console.error(err);
      throw err;
    }

    // Debug: log raw output
    if (!text || text.length === 0) {
      log.error("Model returned empty text");
      throw new Error("Model returned empty text - no JSON output");
    }
    log.info(`Raw output length: ${text.length} chars`);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      log.error(`JSON parse failed. Raw text: ${text.slice(0, 500)}...`);
      throw new Error(`Failed to parse model output as JSON: ${err}`);
    }

    const parseResult = schema.safeParse(parsed);
    if (!parseResult.success) {
      throw new Error(`Schema validation failed: ${parseResult.error.message}`);
    }

    const now = new Date().toISOString();
    const markets = parseResult.data.markets.map((m) => ({
      ...m,
      id: generateMarketId(),
      createdAt: now,
    }));

    log.info(`Generated ${markets.length} markets`);
    return markets;
  }

  startPeriodicGeneration(
    intervalMs: number = CONFIG.generation.intervalMs,
    onGenerated?: (markets: Market[]) => void
  ): () => void {
    log.info(`Starting periodic generation (${intervalMs / 1000}s interval)`);

    this.runGenerationCycle()
      .then((markets) => onGenerated?.(markets))
      .catch((err) => log.error(err.message));

    const interval = setInterval(async () => {
      try {
        const markets = await this.runGenerationCycle();
        onGenerated?.(markets);
      } catch (err) {
        log.error(`Generation failed: ${err}`);
      }
    }, intervalMs);

    return () => {
      log.info("Stopping periodic generation");
      clearInterval(interval);
    };
  }
}
