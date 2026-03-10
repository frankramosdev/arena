/**
 * Resolution Agent - AI-driven market verification
 * 
 * Uses X API tools to gather evidence and resolve markets.
 */

import { xai } from "@ai-sdk/xai";
import { generateText } from "ai";
import { z } from "zod";
import {
  getPendingResolutions,
  getOverdueMarkets,
  resolveMarket,
  type PendingMarketSummary,
} from "@sigarena/common";

import { CONFIG } from "../config/index.js";
import { getSystemPrompt, getResolutionPrompt, getCustomResolutionPrompt } from "../prompts/index.js";
import {
  DEFAULT_RESOLUTION_CONFIG,
  ResolutionEvidenceSchema,
  type ResolutionConfig,
  type ResolutionResult,
  type ResolutionEvidence,
  type PendingMarket,
  type CustomResolutionRequest,
  type CustomResolutionResult,
} from "../types/index.js";
import { log } from "../utils/index.js";

// Schema for AI output
const ResolutionOutputSchema = z.object({
  outcome: z.enum(["YES", "NO", "INVALID"]),
  evidence: ResolutionEvidenceSchema,
});

export class ResolutionAgent {
  private config: ResolutionConfig;
  private retryCount: Map<string, number> = new Map();
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ResolutionConfig> = {}) {
    this.config = { ...DEFAULT_RESOLUTION_CONFIG, ...config };
  }

  /**
   * Resolve a single market using AI
   */
  async resolveMarket(market: PendingMarket): Promise<ResolutionResult> {
    log.info(`Resolving market: ${market.id.slice(0, 8)}... "${market.question.slice(0, 50)}..."`);

    const systemPrompt = getSystemPrompt();
    const resolutionPrompt = getResolutionPrompt(market);

    let stepCount = 0;

    // Build tools for resolution using xAI native x_search (replaces deprecated searchParameters)
    const tools = {
      x_search: xai.tools.xSearch(),
    };

    try {
      const result = await generateText({
        model: xai.responses(CONFIG.xai.model),
        system: systemPrompt,
        prompt: resolutionPrompt,
        tools,
        onStepFinish: ({ toolCalls }) => {
          stepCount++;
          if (toolCalls && toolCalls.length > 0) {
            for (const call of toolCalls) {
              log.debug(`[Step ${stepCount}] ${call.toolName}`);
            }
          }
        },
      });

      log.info(`Completed ${stepCount} steps`);

      // Parse the result
      const text = result.text;
      if (!text || text.length === 0) {
        throw new Error("Model returned empty response");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Try to extract JSON from text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Failed to parse model output as JSON: ${text.slice(0, 200)}`);
        }
      }

      const parseResult = ResolutionOutputSchema.safeParse(parsed);
      if (!parseResult.success) {
        throw new Error(`Schema validation failed: ${parseResult.error.message}`);
      }

      const { outcome, evidence } = parseResult.data;

      return {
        marketId: market.id,
        outcome,
        evidence,
        resolvedAt: new Date().toISOString(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Resolution failed for ${market.id}: ${msg}`);

      // Return INVALID with error evidence
      return {
        marketId: market.id,
        outcome: "INVALID",
        evidence: {
          type: "api_error",
          explanation: `Resolution failed: ${msg}`,
          confidence: 0,
        },
        resolvedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Submit resolution to registry
   */
  async submitResolution(result: ResolutionResult): Promise<boolean> {
    if (result.outcome === "INVALID") {
      log.warn(`Skipping INVALID market ${result.marketId}: ${result.evidence.explanation}`);
      return false;
    }

    const response = await resolveMarket(result.marketId, result.outcome, {
      type: result.evidence.type,
      url: result.evidence.url ?? undefined,
      data: result.evidence.data ?? undefined,
      explanation: result.evidence.explanation,
    });

    if (response.error) {
      log.error(`Failed to submit resolution for ${result.marketId}: ${response.error}`);
      return false;
    }

    log.success(`Resolved ${result.marketId} → ${result.outcome}`);
    return true;
  }

  /**
   * Run a single resolution cycle
   */
  async runResolutionCycle(): Promise<{ resolved: number; failed: number; skipped: number }> {
    log.info("Starting resolution cycle...");

    // Get markets needing resolution
    const [pending, overdue] = await Promise.all([
      getPendingResolutions(this.config.monitorHoursAhead),
      getOverdueMarkets(),
    ]);

    if (pending.error) {
      log.error(`Failed to get pending markets: ${pending.error}`);
      return { resolved: 0, failed: 0, skipped: 0 };
    }

    if (overdue.error) {
      log.error(`Failed to get overdue markets: ${overdue.error}`);
      return { resolved: 0, failed: 0, skipped: 0 };
    }

    // ONLY resolve overdue markets (past their resolution date)
    // Pending markets are just for monitoring - don't resolve them early!
    const overdueMarkets = (overdue.markets || []).slice(0, this.config.batchSize);
    
    // Log pending markets for awareness
    const pendingCount = (pending.markets || []).length;
    if (pendingCount > 0) {
      log.info(`${pendingCount} market(s) pending resolution in next 24h`);
    }

    if (overdueMarkets.length === 0) {
      log.info("No overdue markets need resolution");
      return { resolved: 0, failed: 0, skipped: 0 };
    }

    log.info(`Found ${overdueMarkets.length} overdue markets to resolve`);
    
    const markets = overdueMarkets;

    let resolved = 0;
    let failed = 0;
    let skipped = 0;

    for (const market of markets) {
      // Check retry count
      const retries = this.retryCount.get(market.id) || 0;
      if (retries >= this.config.maxRetries) {
        log.warn(`Skipping ${market.id}: max retries exceeded`);
        skipped++;
        continue;
      }

      // Resolve the market
      const result = await this.resolveMarket(market as PendingMarket);

      // Submit to registry
      const success = await this.submitResolution(result);

      if (success) {
        resolved++;
        this.retryCount.delete(market.id);
      } else if (result.outcome === "INVALID") {
        skipped++;
        // Track retry for API errors
        if (result.evidence.type === "api_error") {
          this.retryCount.set(market.id, retries + 1);
        }
      } else {
        failed++;
        this.retryCount.set(market.id, retries + 1);
      }
    }

    log.info(`Cycle complete: ${resolved} resolved, ${failed} failed, ${skipped} skipped`);
    return { resolved, failed, skipped };
  }

  /**
   * Start continuous monitoring and resolution
   */
  startMonitoring(
    onCycleComplete?: (stats: { resolved: number; failed: number; skipped: number }) => void
  ): () => void {
    if (this.isRunning) {
      log.warn("Monitoring already running");
      return () => {};
    }

    this.isRunning = true;
    log.info(`Starting monitoring (${this.config.checkIntervalMs / 1000}s interval)`);

    // Run immediately
    this.runResolutionCycle()
      .then((stats) => onCycleComplete?.(stats))
      .catch((err) => log.error(err.message));

    // Set up interval
    this.checkInterval = setInterval(async () => {
      try {
        const stats = await this.runResolutionCycle();
        onCycleComplete?.(stats);
      } catch (err) {
        log.error(`Resolution cycle failed: ${err}`);
      }
    }, this.config.checkIntervalMs);

    return () => {
      this.stopMonitoring();
    };
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    log.info("Monitoring stopped");
  }

  /**
   * Request early resolution for a specific market
   */
  async requestEarlyResolution(
    marketId: string,
    _reason: string
  ): Promise<ResolutionResult | null> {
    log.info(`Early resolution requested for ${marketId}`);

    // Fetch market from registry
    const pending = await getPendingResolutions(24 * 7); // Check next 7 days
    if (pending.error) {
      log.error(`Failed to fetch market: ${pending.error}`);
      return null;
    }

    const market = pending.markets?.find((m) => m.id === marketId);
    if (!market) {
      log.error(`Market ${marketId} not found or not eligible for resolution`);
      return null;
    }

    // Resolve immediately
    const result = await this.resolveMarket(market as PendingMarket);
    await this.submitResolution(result);

    return result;
  }

  /**
   * Resolve a custom question (ad-hoc testing)
   * 
   * This doesn't interact with the registry - it's for testing the
   * resolution logic with arbitrary questions.
   */
  async resolveCustom(request: CustomResolutionRequest): Promise<CustomResolutionResult> {
    log.info(`Custom resolution: "${request.question.slice(0, 50)}..."`);

    const systemPrompt = getSystemPrompt();
    const customPrompt = getCustomResolutionPrompt(request);

    let stepCount = 0;

    // Build tools for resolution using xAI native x_search (replaces deprecated searchParameters)
    const tools = {
      x_search: xai.tools.xSearch(),
    };

    try {
      const result = await generateText({
        model: xai.responses(CONFIG.xai.model),
        system: systemPrompt,
        prompt: customPrompt,
        tools,
        onStepFinish: ({ toolCalls }) => {
          stepCount++;
          if (toolCalls && toolCalls.length > 0) {
            for (const call of toolCalls) {
              log.info(`[Step ${stepCount}] ${call.toolName}`);
            }
          }
        },
      });

      log.info(`Completed ${stepCount} steps`);

      const text = result.text;
      if (!text || text.length === 0) {
        throw new Error("Model returned empty response");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Failed to parse model output as JSON: ${text.slice(0, 200)}`);
        }
      }

      const parseResult = ResolutionOutputSchema.safeParse(parsed);
      if (!parseResult.success) {
        throw new Error(`Schema validation failed: ${parseResult.error.message}`);
      }

      const { outcome, evidence } = parseResult.data;

      return {
        question: request.question,
        outcome,
        evidence,
        resolvedAt: new Date().toISOString(),
        toolCalls: stepCount,
        model: CONFIG.xai.model,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Custom resolution failed: ${msg}`);
      
      // Log full error for debugging
      if (err instanceof Error && err.stack) {
        log.debug(`Stack: ${err.stack}`);
      }
      if (err && typeof err === 'object' && 'cause' in err) {
        log.error(`Cause: ${JSON.stringify((err as any).cause, null, 2)}`);
      }

      return {
        question: request.question,
        outcome: "INVALID",
        evidence: {
          type: "api_error",
          explanation: `Resolution failed: ${msg}`,
          confidence: 0,
        },
        resolvedAt: new Date().toISOString(),
        toolCalls: stepCount,
        model: CONFIG.xai.model,
      };
    }
  }
}
