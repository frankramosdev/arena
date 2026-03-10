/**
 * Personality Creator Agent
 * 
 * Uses X API tools + Live Search to research a Twitter user
 * and generate a trading agent personality.
 */

import { xai } from "@ai-sdk/xai";
import { generateText, stepCountIs } from "ai";
import { z } from "zod";
import { xTools } from "@sigarena/common/tools";

import { getSystemPrompt, getCreationPrompt } from "../prompts/index.js";
import {
  AgentPersonalitySchema,
  GeneratedAgentSchema,
  type GeneratedAgent,
  type CreatorConfig,
  DEFAULT_CONFIG,
} from "../types/index.js";
import { log } from "../utils/index.js";

// Output schema for the agent
const CreatorOutputSchema = z.object({
  handle: z.string(),
  displayName: z.string(),
  avatar: z.string().optional(),
  twitterId: z.string().optional(),
  personality: AgentPersonalitySchema,
});

export class PersonalityCreatorAgent {
  private config: CreatorConfig;

  constructor(config: Partial<CreatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a personality for a Twitter user
   */
  async createPersonality(username: string): Promise<GeneratedAgent> {
    const cleanUsername = username.replace("@", "").toLowerCase();
    log.info(`Creating personality for @${cleanUsername}`);

    const systemPrompt = getSystemPrompt();
    const creationPrompt = getCreationPrompt(cleanUsername);

    let stepCount = 0;

    // Full X API tools for deep research
    const tools = {
      // User profile & identity
      getUserByUsername: xTools.getUserByUsername,
      getUserById: xTools.getUserById,
      
      // User content - their voice
      getUserTweets: xTools.getUserTweets,
      getUserMentions: xTools.getUserMentions,
      
      // Network & relationships
      getUserFollowing: xTools.getUserFollowing,
      
      // Search & discovery
      searchRecentTweets: xTools.searchRecentTweets,
      
      // Deep dive on specific tweets
      getTweetById: xTools.getTweetById,
      getQuoteTweets: xTools.getQuoteTweets,
    };

    log.info(`Registered ${Object.keys(tools).length} X API tools + Live Search`);

    try {
      const result = await generateText({
        model: xai(this.config.model),
        system: systemPrompt,
        prompt: creationPrompt,
        tools,
        stopWhen: stepCountIs(this.config.maxResearchSteps),
        providerOptions: {
          xai: {
            // Enable Live Search for additional context
            searchParameters: {
              mode: "auto",
              returnCitations: true,
              maxSearchResults: 25,
              sources: [
                {
                  type: "x",
                  postFavoriteCount: 5,
                  postViewCount: 500,
                },
                {
                  type: "news",
                  safeSearch: true,
                },
                {
                  type: "web",
                },
              ],
            },
          },
        },
        onStepFinish: ({ toolCalls, toolResults }) => {
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
              const r = (tr as any).result as Record<string, unknown> | undefined;
              if (r) {
                if ("error" in r) {
                  log.warn(`  [${toolName}] Error: ${r.error}`);
                } else if ("data" in r && Array.isArray(r.data)) {
                  log.info(`  [${toolName}] ${r.data.length} results`);
                } else if ("data" in r && r.data) {
                  log.info(`  [${toolName}] Found user`);
                }
              }
            }
          }
        },
      });

      log.info(`Completed ${stepCount} research steps`);

      // Log sources if available
      if (result.sources && result.sources.length > 0) {
        log.info(`Live Search: ${result.sources.length} sources found`);
      }

      const text = result.text;
      if (!text || text.length === 0) {
        throw new Error("Model returned empty response");
      }

      log.info(`Raw output: ${text.length} chars`);

      // Parse JSON from response
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Try to extract JSON from text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Failed to parse model output as JSON: ${text.slice(0, 500)}`);
        }
      }

      // Validate schema
      const parseResult = CreatorOutputSchema.safeParse(parsed);
      if (!parseResult.success) {
        log.error(`Schema validation failed: ${parseResult.error.message}`);
        throw new Error(`Schema validation failed: ${parseResult.error.message}`);
      }

      const output = parseResult.data;

      // Construct final agent
      const agent: GeneratedAgent = {
        id: `agent_${cleanUsername}`,
        handle: output.handle || cleanUsername,
        displayName: output.displayName || `@${cleanUsername}`,
        avatar: output.avatar,
        twitterId: output.twitterId,
        generatedAt: new Date().toISOString(),
        personality: output.personality,
      };

      log.success(`Generated personality for @${cleanUsername}`);
      return agent;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Personality creation failed: ${msg}`);
      
      // Log full error for debugging
      if (err instanceof Error && err.stack) {
        log.debug(`Stack: ${err.stack}`);
      }
      if (err && typeof err === 'object' && 'cause' in err) {
        log.error(`Cause: ${JSON.stringify((err as Record<string, unknown>).cause, null, 2)}`);
      }

      throw err;
    }
  }
}
