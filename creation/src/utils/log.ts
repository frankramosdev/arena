/**
 * Logging Utilities
 *
 * Simple, consistent logging across the creation agent.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

/**
 * Create a namespaced logger
 *
 * @example
 * const log = createLogger("agent");
 * log.info("Starting generation cycle");
 * // Output: [agent] Starting generation cycle
 */
export function createLogger(namespace: string) {
  const prefix = `[${namespace}]`;

  return {
    info: (msg: string, ...args: unknown[]) => {
      console.log(prefix, msg, ...args);
    },
    warn: (msg: string, ...args: unknown[]) => {
      console.warn(prefix, "WARN:", msg, ...args);
    },
    error: (msg: string, ...args: unknown[]) => {
      console.error(prefix, "ERROR:", msg, ...args);
    },
    debug: (msg: string, ...args: unknown[]) => {
      if (process.env.DEBUG) {
        console.debug(prefix, "DEBUG:", msg, ...args);
      }
    },
  };
}

/**
 * Default logger for the creation agent
 */
export const log = createLogger("creation");

