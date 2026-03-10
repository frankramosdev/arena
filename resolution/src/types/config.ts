/**
 * Resolution Configuration Types
 */

export interface ResolutionConfig {
  /** How often to check for markets needing resolution (ms) */
  checkIntervalMs: number;
  
  /** How many hours before resolution date to start monitoring */
  monitorHoursAhead: number;
  
  /** Max markets to resolve in a single batch */
  batchSize: number;
  
  /** Retry failed resolutions after this many ms */
  retryDelayMs: number;
  
  /** Max retries for a single market */
  maxRetries: number;
}

export const DEFAULT_RESOLUTION_CONFIG: ResolutionConfig = {
  checkIntervalMs: 60_000,      // Check every minute
  monitorHoursAhead: 24,        // Monitor markets resolving in next 24h
  batchSize: 10,                // Resolve up to 10 at a time
  retryDelayMs: 300_000,        // Retry after 5 minutes
  maxRetries: 3,                // Max 3 retries
};
