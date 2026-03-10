/**
 * Trading Floor SQLite Schema
 */

export const TRADING_SCHEMA = `
-- Interest responses per market
CREATE TABLE IF NOT EXISTS interest_responses (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  side TEXT,
  token TEXT,
  price REAL,
  quantity REAL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Side chats
CREATE TABLE IF NOT EXISTS side_chats (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  participants TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  snapshot_yes_price REAL NOT NULL,
  snapshot_no_price REAL NOT NULL,
  closed_at TEXT,
  close_reason TEXT
);

-- All messages (floor + side chats)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  chat_id TEXT,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  order_data TEXT,
  referenced_agent_id TEXT,
  referenced_order_id TEXT,
  created_at TEXT NOT NULL
);

-- Tentative agreements
CREATE TABLE IF NOT EXISTS tentative_agreements (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  token TEXT NOT NULL,
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  status TEXT NOT NULL,
  agreed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  resolved_at TEXT,
  trade_id TEXT
);

-- Trading sessions
CREATE TABLE IF NOT EXISTS trading_sessions (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  closed_at TEXT
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_interest_market ON interest_responses(market_id);
CREATE INDEX IF NOT EXISTS idx_messages_market ON messages(market_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_market ON side_chats(market_id);
CREATE INDEX IF NOT EXISTS idx_chats_status ON side_chats(status);
CREATE INDEX IF NOT EXISTS idx_tentatives_status ON tentative_agreements(status);
CREATE INDEX IF NOT EXISTS idx_sessions_market ON trading_sessions(market_id);
`;
