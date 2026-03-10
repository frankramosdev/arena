/**
 * X API Client Factory
 * Creates and manages singleton X API client instance
 * Supports Bearer Token (app-only) and OAuth (user context) authentication
 */

import { Client, type ClientConfig } from "@xdevplatform/xdk";

// ============================================================================
// Auth Configuration
// ============================================================================

export interface XAuthConfig {
  // Bearer Token (app-only auth) - for public data
  bearerToken?: string;
  // OAuth 1.0a (user context auth) - for user-specific endpoints
  oauth?: {
    consumerKey: string;
    consumerSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  };
}

// ============================================================================
// Client Singleton
// ============================================================================

let clientInstance: Client | null = null;
let currentAuthMode: "bearer" | "oauth" | null = null;

/**
 * Get or create X API client instance
 * Prioritizes OAuth if available, falls back to Bearer Token
 */
export function getXClient(config?: XAuthConfig): Client {
  // Get config from params or environment
  const bearerToken = config?.bearerToken ?? process.env.X_BEARER_TOKEN;
  const oauth = config?.oauth ?? getOAuthFromEnv();

  // Prefer OAuth if available (more endpoints)
  if (oauth) {
    if (!clientInstance || currentAuthMode !== "oauth") {
      // Cast to any to handle SDK type mismatch
      const clientConfig = {
        auth: {
          consumerKey: oauth.consumerKey,
          consumerSecret: oauth.consumerSecret,
          accessToken: oauth.accessToken,
          accessTokenSecret: oauth.accessTokenSecret,
        },
      } as ClientConfig;
      clientInstance = new Client(clientConfig);
      currentAuthMode = "oauth";
    }
    return clientInstance;
  }

  // Fall back to Bearer Token
  if (bearerToken) {
    if (!clientInstance || currentAuthMode !== "bearer") {
      const clientConfig: ClientConfig = { bearerToken };
      clientInstance = new Client(clientConfig);
      currentAuthMode = "bearer";
    }
    return clientInstance;
  }

  throw new Error("X_BEARER_TOKEN or OAuth credentials required");
}

/**
 * Check if OAuth is configured
 */
export function hasOAuthConfig(): boolean {
  return !!(getOAuthFromEnv() || process.env.X_CONSUMER_KEY);
}

/**
 * Get OAuth config from environment
 */
function getOAuthFromEnv(): XAuthConfig["oauth"] | undefined {
  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (consumerKey && consumerSecret && accessToken && accessTokenSecret) {
    return { consumerKey, consumerSecret, accessToken, accessTokenSecret };
  }
  return undefined;
}

/**
 * Reset client instance (useful for testing or token refresh)
 */
export function resetXClient(): void {
  clientInstance = null;
  currentAuthMode = null;
}

/**
 * Check if client is initialized
 */
export function isXClientInitialized(): boolean {
  return clientInstance !== null;
}

/**
 * Get current auth mode
 */
export function getAuthMode(): "bearer" | "oauth" | null {
  return currentAuthMode;
}

// ============================================================================
// Safe API Call Wrapper
// ============================================================================

/**
 * Wraps X API calls with error handling
 * Returns error message instead of throwing to allow agent to continue
 */
export async function safeApiCall<T>(
  fn: () => Promise<T>,
  toolName: string
): Promise<T | { error: string; tool: string }> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, tool: toolName };
  }
}
