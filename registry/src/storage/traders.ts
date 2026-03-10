/**
 * Trader Storage Operations
 */

import type Database from "better-sqlite3";
import type { Trader, Position } from "../types.js";
import type { TraderRow, PositionRow } from "./schema.js";

export function createTrader(db: Database.Database, id: string): Trader {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO traders (id, balance, created_at)
    VALUES (?, 10000, ?)
  `).run(id, now);

  return getTrader(db, id)!;
}

export function getTrader(db: Database.Database, id: string): Trader | undefined {
  const row = db.prepare("SELECT * FROM traders WHERE id = ?").get(id) as TraderRow | undefined;
  if (!row) return undefined;

  // Load positions
  const positionRows = db.prepare("SELECT * FROM positions WHERE trader_id = ?").all(id) as PositionRow[];
  const positions = new Map<string, Position>();
  for (const p of positionRows) {
    positions.set(p.market_id, {
      marketId: p.market_id,
      yesTokens: p.yes_tokens,
      noTokens: p.no_tokens,
      yesCostBasis: p.yes_cost_basis,
      noCostBasis: p.no_cost_basis,
    });
  }

  return {
    id: row.id,
    balance: row.balance,
    positions,
    realizedPnl: row.realized_pnl,
    tradeCount: row.trade_count,
    wins: row.wins,
    losses: row.losses,
    createdAt: row.created_at,
  };
}

export function updateTrader(db: Database.Database, trader: Trader): void {
  db.prepare(`
    UPDATE traders SET
      balance = ?,
      realized_pnl = ?,
      trade_count = ?,
      wins = ?,
      losses = ?
    WHERE id = ?
  `).run(
    trader.balance,
    trader.realizedPnl,
    trader.tradeCount,
    trader.wins,
    trader.losses,
    trader.id
  );

  // Update positions
  for (const [marketId, pos] of trader.positions) {
    db.prepare(`
      INSERT INTO positions (id, trader_id, market_id, yes_tokens, no_tokens, yes_cost_basis, no_cost_basis)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(trader_id, market_id) DO UPDATE SET
        yes_tokens = excluded.yes_tokens,
        no_tokens = excluded.no_tokens,
        yes_cost_basis = excluded.yes_cost_basis,
        no_cost_basis = excluded.no_cost_basis
    `).run(
      `${trader.id}_${marketId}`,
      trader.id,
      marketId,
      pos.yesTokens,
      pos.noTokens,
      pos.yesCostBasis,
      pos.noCostBasis
    );
  }
}

export function traderExists(db: Database.Database, id: string): boolean {
  const row = db.prepare("SELECT 1 FROM traders WHERE id = ?").get(id);
  return !!row;
}

export function getTradersWithPositionsInMarket(db: Database.Database, marketId: string): Trader[] {
  const positionRows = db.prepare(`
    SELECT trader_id FROM positions 
    WHERE market_id = ? AND (yes_tokens > 0 OR no_tokens > 0)
  `).all(marketId) as { trader_id: string }[];

  const traders: Trader[] = [];
  for (const { trader_id } of positionRows) {
    const trader = getTrader(db, trader_id);
    if (trader) {
      traders.push(trader);
    }
  }
  return traders;
}

// =============================================================================
// TRADER STATS (for leaderboard)
// =============================================================================

export interface TraderStats {
  traderId: string;
  realizedPnl: number;
  tradeCount: number;
  volume: number;
  balance: number;
}

/**
 * Get volume for a trader (sum of all trade values where they were buyer or seller)
 */
export function getTraderVolume(db: Database.Database, traderId: string): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(value), 0) as volume
    FROM trades
    WHERE buyer_id = ? OR seller_id = ?
  `).get(traderId, traderId) as { volume: number };
  
  return result.volume;
}

/**
 * Get stats for a single trader
 */
export function getTraderStats(db: Database.Database, traderId: string): TraderStats | undefined {
  const trader = getTrader(db, traderId);
  if (!trader) return undefined;
  
  const volume = getTraderVolume(db, traderId);
  
  return {
    traderId: trader.id,
    realizedPnl: trader.realizedPnl,
    tradeCount: trader.tradeCount,
    volume,
    balance: trader.balance,
  };
}

/**
 * Get all traders ranked by P&L (for leaderboard)
 */
export function getTraderLeaderboard(
  db: Database.Database, 
  limit = 50, 
  offset = 0
): { traders: TraderStats[]; total: number } {
  // Get total count
  const countResult = db.prepare("SELECT COUNT(*) as total FROM traders").get() as { total: number };
  
  // Get traders ordered by P&L
  const rows = db.prepare(`
    SELECT id, balance, realized_pnl, trade_count
    FROM traders
    ORDER BY realized_pnl DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Array<{
    id: string;
    balance: number;
    realized_pnl: number;
    trade_count: number;
  }>;
  
  // Add volume for each trader
  const traders: TraderStats[] = rows.map(row => ({
    traderId: row.id,
    realizedPnl: row.realized_pnl,
    tradeCount: row.trade_count,
    volume: getTraderVolume(db, row.id),
    balance: row.balance,
  }));
  
  return { traders, total: countResult.total };
}
