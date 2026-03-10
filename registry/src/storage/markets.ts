/**
 * Market Storage Operations
 */

import type Database from "better-sqlite3";
import type {
  RegistryMarket,
  CreateMarketInput,
  MarketStatus,
  PricePoint,
  VerificationMethod,
  ResolutionProof,
  MarketSource,
} from "../types.js";
import type { MarketRow } from "./schema.js";

export function createMarket(db: Database.Database, input: CreateMarketInput): RegistryMarket {
  const now = input.createdAt;
  const priceHistory: PricePoint[] = [{
    timestamp: now,
    yesPrice: input.initialProbability,
    volume: 0,
  }];

  const stmt = db.prepare(`
    INSERT INTO markets (
      id, question, description, tags, status, created_at, resolution_date,
      verification, sources, yes_price, no_price, price_history,
      initial_probability, timeframe, unique_traders
    ) VALUES (
      ?, ?, ?, ?, 'OPEN', ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, '[]'
    )
  `);

  stmt.run(
    input.id,
    input.question,
    input.description,
    JSON.stringify(input.tags),
    now,
    input.resolutionDate,
    JSON.stringify(input.verification),
    JSON.stringify(input.sources),
    input.initialProbability,
    1 - input.initialProbability,
    JSON.stringify(priceHistory),
    input.initialProbability,
    input.timeframe
  );

  return getMarket(db, input.id)!;
}

export function getMarket(db: Database.Database, id: string): RegistryMarket | undefined {
  const row = db.prepare("SELECT * FROM markets WHERE id = ?").get(id) as MarketRow | undefined;
  return row ? rowToMarket(row) : undefined;
}

export function updateMarket(db: Database.Database, market: RegistryMarket): void {
  const stmt = db.prepare(`
    UPDATE markets SET
      status = ?,
      resolved_at = ?,
      resolution_proof = ?,
      yes_supply = ?,
      no_supply = ?,
      collateral = ?,
      yes_price = ?,
      no_price = ?,
      yes_best_bid = ?,
      yes_best_ask = ?,
      no_best_bid = ?,
      no_best_ask = ?,
      last_trade_at = ?,
      total_volume = ?,
      volume_24h = ?,
      trade_count = ?,
      unique_traders = ?,
      price_history = ?
    WHERE id = ?
  `);

  stmt.run(
    market.status,
    market.resolvedAt,
    market.resolutionProof ? JSON.stringify(market.resolutionProof) : null,
    market.supply.yesSupply,
    market.supply.noSupply,
    market.supply.collateral,
    market.prices.yesPrice,
    market.prices.noPrice,
    market.prices.yesBestBid,
    market.prices.yesBestAsk,
    market.prices.noBestBid,
    market.prices.noBestAsk,
    market.prices.lastTradeAt,
    market.volume.totalVolume,
    market.volume.volume24h,
    market.volume.tradeCount,
    JSON.stringify([...market.volume.uniqueTraders]),
    JSON.stringify(market.priceHistory),
    market.id
  );
}

export function listMarkets(
  db: Database.Database,
  status?: MarketStatus[],
  offset = 0,
  limit = 50
): { markets: RegistryMarket[]; total: number } {
  let query = "SELECT * FROM markets";
  let countQuery = "SELECT COUNT(*) as count FROM markets";
  const params: (string | number)[] = [];

  if (status && status.length > 0) {
    const placeholders = status.map(() => "?").join(", ");
    query += ` WHERE status IN (${placeholders})`;
    countQuery += ` WHERE status IN (${placeholders})`;
    params.push(...status);
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";

  const rows = db.prepare(query).all(...params, limit, offset) as MarketRow[];
  const { count } = db.prepare(countQuery).get(...params.slice(0, status?.length || 0)) as { count: number };

  return {
    markets: rows.map(r => rowToMarket(r)),
    total: count,
  };
}

export function getMarketsExpiringSoon(db: Database.Database, withinHours: number): RegistryMarket[] {
  const cutoff = new Date(Date.now() + withinHours * 60 * 60 * 1000).toISOString();
  const rows = db.prepare(`
    SELECT * FROM markets 
    WHERE status = 'OPEN' AND resolution_date <= ?
    ORDER BY resolution_date ASC
  `).all(cutoff) as MarketRow[];
  return rows.map(r => rowToMarket(r));
}

export function marketExists(db: Database.Database, id: string): boolean {
  const row = db.prepare("SELECT 1 FROM markets WHERE id = ?").get(id);
  return !!row;
}

function rowToMarket(row: MarketRow): RegistryMarket {
  return {
    id: row.id,
    question: row.question,
    description: row.description,
    tags: JSON.parse(row.tags),
    status: row.status as MarketStatus,
    createdAt: row.created_at,
    resolutionDate: row.resolution_date,
    resolvedAt: row.resolved_at,
    verification: JSON.parse(row.verification) as VerificationMethod,
    resolutionProof: row.resolution_proof ? JSON.parse(row.resolution_proof) as ResolutionProof : null,
    sources: JSON.parse(row.sources) as MarketSource[],
    supply: {
      yesSupply: row.yes_supply,
      noSupply: row.no_supply,
      collateral: row.collateral,
    },
    prices: {
      yesPrice: row.yes_price,
      noPrice: row.no_price,
      yesBestBid: row.yes_best_bid,
      yesBestAsk: row.yes_best_ask,
      noBestBid: row.no_best_bid,
      noBestAsk: row.no_best_ask,
      lastTradeAt: row.last_trade_at,
    },
    volume: {
      totalVolume: row.total_volume,
      volume24h: row.volume_24h,
      tradeCount: row.trade_count,
      uniqueTraders: new Set(JSON.parse(row.unique_traders)),
    },
    priceHistory: JSON.parse(row.price_history) as PricePoint[],
    initialProbability: row.initial_probability,
    timeframe: row.timeframe as RegistryMarket["timeframe"],
  };
}
