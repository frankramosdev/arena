/**
 * Registry Integration
 */

export {
  // Market operations
  getOpenMarkets,
  getTradingMarket,
  type TradingMarket,
  
  // Trading operations
  placeOrder,
  mintTokens,
  settleTrade,
  type PlaceOrderParams,
  type OrderResult,
  type SettleTradeParams,
  type SettleResult,
  
  // Agent registration
  registerAgentTrader,
  getTraderState,
  type AgentTrader,
  
  // Order book
  getOrderBook,
  type OrderBook,
  type OrderBookLevel,
  
  // Health
  isRegistryAvailable,
} from "./client.js";
