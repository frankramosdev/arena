/**
 * ID Generation Utilities
 */

/**
 * Generate a unique market ID
 * Format: mkt_{timestamp}_{random6}
 *
 * @example
 * generateMarketId() // "mkt_1733612345678_a1b2c3"
 */
export function generateMarketId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `mkt_${timestamp}_${random}`;
}

/**
 * Generate a unique agent ID
 * Format: agent_{timestamp}_{random6}
 */
export function generateAgentId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `agent_${timestamp}_${random}`;
}

/**
 * Generate a unique order ID
 * Format: order_{timestamp}_{random6}
 */
export function generateOrderId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `order_${timestamp}_${random}`;
}

