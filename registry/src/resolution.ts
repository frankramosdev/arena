/**
 * Resolution Agent - Resolves markets based on verification criteria
 */

import type { MarketRegistry } from "./registry.js";
import type { RegistryMarket, ResolutionProof, VerificationMethod } from "./types.js";

/**
 * Resolution input
 */
export interface ResolutionInput {
  outcome: "YES" | "NO";
  evidence: {
    type: string;
    url?: string;
    data?: Record<string, unknown>;
    explanation: string;
  };
}

/**
 * Resolution Agent
 */
export class ResolutionAgent {
  private registry: MarketRegistry;
  private resolutionQueue: Set<string> = new Set();
  
  constructor(registry: MarketRegistry) {
    this.registry = registry;
  }

  getPendingResolutions(withinHours = 24): RegistryMarket[] {
    return this.registry.getMarketsExpiringSoon(withinHours);
  }

  queueForResolution(marketId: string): void {
    const market = this.registry.getMarket(marketId);
    if (!market) throw new Error(`Market ${marketId} not found`);
    if (market.status !== "OPEN") {
      throw new Error(`Market ${marketId} is not open (status: ${market.status})`);
    }
    this.resolutionQueue.add(marketId);
  }

  getResolutionQueue(): Set<string> {
    return new Set(this.resolutionQueue);
  }

  getResolutionCriteria(market: RegistryMarket): VerificationMethod {
    return market.verification;
  }

  resolve(marketId: string, input: ResolutionInput): RegistryMarket {
    const proof: Omit<ResolutionProof, "outcome" | "timestamp"> = {
      resolvedBy: "agent",
      evidence: input.evidence,
    };

    const resolved = this.registry.resolveMarket(marketId, input.outcome, proof);
    this.resolutionQueue.delete(marketId);
    
    console.log(`[Resolution] Market ${marketId} resolved as ${input.outcome}`);
    console.log(`  Evidence: ${input.evidence.explanation}`);
    
    return resolved;
  }

  batchResolve(resolutions: Array<{ marketId: string } & ResolutionInput>): RegistryMarket[] {
    const results: RegistryMarket[] = [];
    
    for (const { marketId, outcome, evidence } of resolutions) {
      try {
        const resolved = this.resolve(marketId, { outcome, evidence });
        results.push(resolved);
      } catch (err) {
        console.error(`[Resolution] Failed to resolve ${marketId}:`, err);
      }
    }
    
    return results;
  }

  getStats(): {
    resolved: number;
    pending: number;
    queued: number;
    yesOutcomes: number;
    noOutcomes: number;
  } {
    const { markets } = this.registry.listMarkets({}, 0, 10000);
    
    let yesOutcomes = 0;
    let noOutcomes = 0;
    let pending = 0;
    
    for (const market of markets) {
      if (market.status === "RESOLVED_YES") yesOutcomes++;
      else if (market.status === "RESOLVED_NO") noOutcomes++;
      else if (market.status === "OPEN") pending++;
    }
    
    return {
      resolved: yesOutcomes + noOutcomes,
      pending,
      queued: this.resolutionQueue.size,
      yesOutcomes,
      noOutcomes,
    };
  }

  isPastResolutionDate(market: RegistryMarket): boolean {
    return new Date(market.resolutionDate) <= new Date();
  }

  getOverdueMarkets(): RegistryMarket[] {
    const { markets } = this.registry.listMarkets({ status: ["OPEN"] }, 0, 10000);
    return markets.filter(m => this.isPastResolutionDate(m));
  }

  queueOverdueMarkets(): string[] {
    const overdue = this.getOverdueMarkets();
    const queued: string[] = [];
    
    for (const market of overdue) {
      if (!this.resolutionQueue.has(market.id)) {
        this.resolutionQueue.add(market.id);
        queued.push(market.id);
      }
    }
    
    if (queued.length > 0) {
      console.log(`[Resolution] Queued ${queued.length} overdue markets`);
    }
    
    return queued;
  }
}
