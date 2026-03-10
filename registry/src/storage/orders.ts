/**
 * Order Storage Operations
 */

import type Database from "better-sqlite3";
import type { Order, OrderStatus, TokenType, OrderType } from "../types.js";
import type { OrderRow } from "./schema.js";

export function createOrder(db: Database.Database, order: Order): void {
  db.prepare(`
    INSERT INTO orders (
      id, market_id, trader_id, token_type, side, order_type,
      price, quantity, filled_quantity, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.id,
    order.marketId,
    order.traderId,
    order.tokenType,
    order.side,
    order.type,
    order.price,
    order.quantity,
    order.filledQuantity,
    order.status,
    order.createdAt,
    order.updatedAt
  );
}

export function getOrder(db: Database.Database, id: string): Order | undefined {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  return row ? rowToOrder(row) : undefined;
}

export function updateOrder(db: Database.Database, order: Order): void {
  db.prepare(`
    UPDATE orders SET
      filled_quantity = ?,
      status = ?,
      updated_at = ?
    WHERE id = ?
  `).run(order.filledQuantity, order.status, order.updatedAt, order.id);
}

export function getOrdersForMarket(
  db: Database.Database,
  marketId: string,
  status?: OrderStatus[]
): Order[] {
  let query = "SELECT * FROM orders WHERE market_id = ?";
  const params: string[] = [marketId];

  if (status && status.length > 0) {
    const placeholders = status.map(() => "?").join(", ");
    query += ` AND status IN (${placeholders})`;
    params.push(...status);
  }

  query += " ORDER BY created_at DESC";
  const rows = db.prepare(query).all(...params) as OrderRow[];
  return rows.map(r => rowToOrder(r));
}

export function getOrdersForTrader(
  db: Database.Database,
  traderId: string,
  status?: OrderStatus[]
): Order[] {
  let query = "SELECT * FROM orders WHERE trader_id = ?";
  const params: string[] = [traderId];

  if (status && status.length > 0) {
    const placeholders = status.map(() => "?").join(", ");
    query += ` AND status IN (${placeholders})`;
    params.push(...status);
  }

  query += " ORDER BY created_at DESC";
  const rows = db.prepare(query).all(...params) as OrderRow[];
  return rows.map(r => rowToOrder(r));
}

export function getActiveOrdersForMarketAndToken(
  db: Database.Database,
  marketId: string,
  tokenType: TokenType
): { bids: Order[]; asks: Order[] } {
  const rows = db.prepare(`
    SELECT * FROM orders 
    WHERE market_id = ? AND token_type = ? AND status IN ('OPEN', 'PARTIALLY_FILLED')
  `).all(marketId, tokenType) as OrderRow[];

  const orders = rows.map(r => rowToOrder(r));
  const bids = orders.filter(o => o.side === "BUY").sort((a, b) => b.price - a.price);
  const asks = orders.filter(o => o.side === "SELL").sort((a, b) => a.price - b.price);

  return { bids, asks };
}

export function cancelOrdersForMarket(db: Database.Database, marketId: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE orders SET status = 'CANCELLED', updated_at = ?
    WHERE market_id = ? AND status IN ('OPEN', 'PARTIALLY_FILLED')
  `).run(now, marketId);
}

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    marketId: row.market_id,
    traderId: row.trader_id,
    tokenType: row.token_type as TokenType,
    side: row.side as "BUY" | "SELL",
    type: row.order_type as OrderType,
    price: row.price,
    quantity: row.quantity,
    filledQuantity: row.filled_quantity,
    status: row.status as OrderStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
