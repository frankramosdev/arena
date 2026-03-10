/**
 * SQLite Schema and Row Types
 */

// =============================================================================
// SCHEMA
// =============================================================================

export const SCHEMA = `
-- Users table (authentication)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  token TEXT NOT NULL UNIQUE,
  trader_id TEXT NOT NULL,
  twitter_handle TEXT,
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  FOREIGN KEY (trader_id) REFERENCES traders(id)
);

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  description TEXT NOT NULL,
  tags TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL,
  resolution_date TEXT NOT NULL,
  resolved_at TEXT,
  
  -- Verification (JSON)
  verification TEXT NOT NULL,
  resolution_proof TEXT,
  
  -- Sources (JSON array)
  sources TEXT NOT NULL,
  
  -- Token Supply
  yes_supply REAL NOT NULL DEFAULT 0,
  no_supply REAL NOT NULL DEFAULT 0,
  collateral REAL NOT NULL DEFAULT 0,
  
  -- Prices
  yes_price REAL NOT NULL DEFAULT 0.5,
  no_price REAL NOT NULL DEFAULT 0.5,
  yes_best_bid REAL,
  yes_best_ask REAL,
  no_best_bid REAL,
  no_best_ask REAL,
  last_trade_at TEXT,
  
  -- Volume
  total_volume REAL NOT NULL DEFAULT 0,
  volume_24h REAL NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  unique_traders TEXT NOT NULL DEFAULT '[]',
  
  -- Price History (JSON array)
  price_history TEXT NOT NULL,
  
  -- Metadata
  initial_probability REAL NOT NULL DEFAULT 0.5,
  timeframe TEXT NOT NULL
);

-- Traders table (trading state - linked to User)
CREATE TABLE IF NOT EXISTS traders (
  id TEXT PRIMARY KEY,
  balance REAL NOT NULL DEFAULT 10000,
  realized_pnl REAL NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  trader_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  yes_tokens REAL NOT NULL DEFAULT 0,
  no_tokens REAL NOT NULL DEFAULT 0,
  yes_cost_basis REAL NOT NULL DEFAULT 0,
  no_cost_basis REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (trader_id) REFERENCES traders(id),
  FOREIGN KEY (market_id) REFERENCES markets(id),
  UNIQUE(trader_id, market_id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  trader_id TEXT NOT NULL,
  token_type TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  filled_quantity REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (market_id) REFERENCES markets(id),
  FOREIGN KEY (trader_id) REFERENCES traders(id)
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  token_type TEXT NOT NULL,
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  value REAL NOT NULL,
  buyer_id TEXT NOT NULL,
  buyer_order_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  seller_order_id TEXT NOT NULL,
  minted INTEGER NOT NULL DEFAULT 0,
  executed_at TEXT NOT NULL,
  FOREIGN KEY (market_id) REFERENCES markets(id),
  FOREIGN KEY (buyer_id) REFERENCES traders(id),
  FOREIGN KEY (seller_id) REFERENCES traders(id)
);

-- Indices for fast queries
CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
CREATE INDEX IF NOT EXISTS idx_users_trader ON users(trader_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_resolution_date ON markets(resolution_date);
CREATE INDEX IF NOT EXISTS idx_orders_market ON orders(market_id);
CREATE INDEX IF NOT EXISTS idx_orders_trader ON orders(trader_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_positions_trader ON positions(trader_id);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);
`;

// =============================================================================
// ROW TYPES (internal)
// =============================================================================

export interface MarketRow {
  id: string;
  question: string;
  description: string;
  tags: string;
  status: string;
  created_at: string;
  resolution_date: string;
  resolved_at: string | null;
  verification: string;
  resolution_proof: string | null;
  sources: string;
  yes_supply: number;
  no_supply: number;
  collateral: number;
  yes_price: number;
  no_price: number;
  yes_best_bid: number | null;
  yes_best_ask: number | null;
  no_best_bid: number | null;
  no_best_ask: number | null;
  last_trade_at: string | null;
  total_volume: number;
  volume_24h: number;
  trade_count: number;
  unique_traders: string;
  price_history: string;
  initial_probability: number;
  timeframe: string;
}

export interface UserRow {
  id: string;
  name: string;
  role: string;
  token: string;
  trader_id: string;
  twitter_handle: string | null;
  created_at: string;
  last_active_at: string;
}

export interface TraderRow {
  id: string;
  balance: number;
  realized_pnl: number;
  trade_count: number;
  wins: number;
  losses: number;
  created_at: string;
}

export interface PositionRow {
  id: string;
  trader_id: string;
  market_id: string;
  yes_tokens: number;
  no_tokens: number;
  yes_cost_basis: number;
  no_cost_basis: number;
}

export interface OrderRow {
  id: string;
  market_id: string;
  trader_id: string;
  token_type: string;
  side: string;
  order_type: string;
  price: number;
  quantity: number;
  filled_quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TradeRow {
  id: string;
  market_id: string;
  token_type: string;
  price: number;
  quantity: number;
  value: number;
  buyer_id: string;
  buyer_order_id: string;
  seller_id: string;
  seller_order_id: string;
  minted: number;
  executed_at: string;
}
