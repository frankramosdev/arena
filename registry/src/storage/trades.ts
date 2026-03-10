/**
 * Trade Storage Operations
 */

import type Database from "better-sqlite3";
import type { Trade, TokenType } from "../types.js";
import type { TradeRow } from "./schema.js";

export function createTrade(db: Database.Database, trade: Trade): void {
  db.prepare(`
    INSERT INTO trades (
      id, market_id, token_type, price, quantity, value,
      buyer_id, buyer_order_id, seller_id, seller_order_id,
      minted, executed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    trade.id,
    trade.marketId,
    trade.tokenType,
    trade.price,
    trade.quantity,
    trade.value,
    trade.buyerId,
    trade.buyerOrderId,
    trade.sellerId,
    trade.sellerOrderId,
    trade.minted ? 1 : 0,
    trade.executedAt
  );
}

export function getTradesForMarket(
  db: Database.Database,
  marketId: string,
  limit = 50
): Trade[] {
  const rows = db.prepare(`
    SELECT * FROM trades WHERE market_id = ? ORDER BY executed_at DESC LIMIT ?
  `).all(marketId, limit) as TradeRow[];
  return rows.map(r => rowToTrade(r));
}

export function getTradesForTrader(
  db: Database.Database,
  traderId: string,
  limit = 50
): Trade[] {
  const rows = db.prepare(`
    SELECT * FROM trades 
    WHERE buyer_id = ? OR seller_id = ? 
    ORDER BY executed_at DESC LIMIT ?
  `).all(traderId, traderId, limit) as TradeRow[];
  return rows.map(r => rowToTrade(r));
}

function rowToTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    marketId: row.market_id,
    tokenType: row.token_type as TokenType,
    price: row.price,
    quantity: row.quantity,
    value: row.value,
    buyerId: row.buyer_id,
    buyerOrderId: row.buyer_order_id,
    sellerId: row.seller_id,
    sellerOrderId: row.seller_order_id,
    minted: row.minted === 1,
    executedAt: row.executed_at,
  };
}
