/**
 * Trading Floor Storage
 */

import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { TRADING_SCHEMA } from "./schema.js";
import type {
  InterestResponse,
  SideChat,
  Message,
  TentativeAgreement,
  SideChatStatus,
  TentativeStatus,
} from "../types/index.js";

// =============================================================================
// STORAGE CLASS
// =============================================================================

export class TradingStorage {
  private db: Database.Database;

  constructor(dbPath: string = "trading.db") {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(TRADING_SCHEMA);
  }

  // ===========================================================================
  // INTEREST RESPONSES
  // ===========================================================================

  saveInterest(interest: InterestResponse): void {
    const stmt = this.db.prepare(`
      INSERT INTO interest_responses (id, market_id, agent_id, type, side, token, price, quantity, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      interest.id,
      interest.marketId,
      interest.agentId,
      interest.type,
      interest.side || null,
      interest.token || null,
      interest.price || null,
      interest.quantity || null,
      interest.message,
      interest.createdAt
    );
  }

  getInterestsForMarket(marketId: string): InterestResponse[] {
    const stmt = this.db.prepare(`
      SELECT * FROM interest_responses WHERE market_id = ? ORDER BY created_at ASC
    `);
    const rows = stmt.all(marketId) as any[];
    return rows.map(this.rowToInterest);
  }

  private rowToInterest(row: any): InterestResponse {
    return {
      id: row.id,
      marketId: row.market_id,
      agentId: row.agent_id,
      type: row.type,
      side: row.side || undefined,
      token: row.token || undefined,
      price: row.price || undefined,
      quantity: row.quantity || undefined,
      message: row.message,
      createdAt: row.created_at,
    };
  }

  // ===========================================================================
  // SIDE CHATS
  // ===========================================================================

  createSideChat(
    marketId: string,
    participants: string[],
    snapshotPrices: { yes: number; no: number }
  ): SideChat {
    const chat: SideChat = {
      id: `chat_${randomUUID().slice(0, 8)}`,
      marketId,
      participants,
      status: "NEGOTIATING",
      messages: [],
      externalUpdates: [],
      startedAt: new Date().toISOString(),
      snapshotPrices,
    };

    const stmt = this.db.prepare(`
      INSERT INTO side_chats (id, market_id, participants, status, started_at, snapshot_yes_price, snapshot_no_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      chat.id,
      chat.marketId,
      JSON.stringify(chat.participants),
      chat.status,
      chat.startedAt,
      snapshotPrices.yes,
      snapshotPrices.no
    );

    return chat;
  }

  getSideChat(chatId: string): SideChat | null {
    const stmt = this.db.prepare(`SELECT * FROM side_chats WHERE id = ?`);
    const row = stmt.get(chatId) as any;
    if (!row) return null;

    const chat = this.rowToSideChat(row);
    chat.messages = this.getMessagesForChat(chatId);
    return chat;
  }

  getActiveSideChatsForMarket(marketId: string): SideChat[] {
    const stmt = this.db.prepare(`
      SELECT * FROM side_chats WHERE market_id = ? AND status = 'NEGOTIATING' ORDER BY started_at ASC
    `);
    const rows = stmt.all(marketId) as any[];
    return rows.map(row => {
      const chat = this.rowToSideChat(row);
      chat.messages = this.getMessagesForChat(chat.id);
      return chat;
    });
  }

  updateSideChatStatus(chatId: string, status: SideChatStatus, closeReason?: string): void {
    const stmt = this.db.prepare(`
      UPDATE side_chats SET status = ?, closed_at = ?, close_reason = ? WHERE id = ?
    `);
    stmt.run(status, status !== "NEGOTIATING" ? new Date().toISOString() : null, closeReason || null, chatId);
  }

  private rowToSideChat(row: any): SideChat {
    return {
      id: row.id,
      marketId: row.market_id,
      participants: JSON.parse(row.participants),
      status: row.status,
      messages: [],
      externalUpdates: [],
      startedAt: row.started_at,
      snapshotPrices: { yes: row.snapshot_yes_price, no: row.snapshot_no_price },
      closedAt: row.closed_at || undefined,
      closeReason: row.close_reason || undefined,
    };
  }

  // ===========================================================================
  // MESSAGES
  // ===========================================================================

  saveMessage(message: Message): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, market_id, chat_id, agent_id, type, text, order_data, referenced_agent_id, referenced_order_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      message.id,
      message.marketId,
      message.chatId,
      message.agentId,
      message.type,
      message.text,
      message.order ? JSON.stringify(message.order) : null,
      message.referencedAgentId || null,
      message.referencedOrderId || null,
      message.createdAt
    );
  }

  getFloorMessages(marketId: string, limit: number = 100): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages WHERE market_id = ? AND chat_id IS NULL ORDER BY created_at DESC LIMIT ?
    `);
    const rows = stmt.all(marketId, limit) as any[];
    return rows.map(this.rowToMessage).reverse();
  }

  getMessagesForChat(chatId: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC
    `);
    const rows = stmt.all(chatId) as any[];
    return rows.map(this.rowToMessage);
  }

  private rowToMessage(row: any): Message {
    return {
      id: row.id,
      marketId: row.market_id,
      chatId: row.chat_id,
      agentId: row.agent_id,
      type: row.type,
      text: row.text,
      order: row.order_data ? JSON.parse(row.order_data) : undefined,
      referencedAgentId: row.referenced_agent_id || undefined,
      referencedOrderId: row.referenced_order_id || undefined,
      createdAt: row.created_at,
    };
  }

  // ===========================================================================
  // TENTATIVE AGREEMENTS
  // ===========================================================================

  saveTentativeAgreement(agreement: TentativeAgreement): void {
    const stmt = this.db.prepare(`
      INSERT INTO tentative_agreements (id, chat_id, market_id, buyer_id, seller_id, token, price, quantity, status, agreed_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      agreement.id,
      agreement.chatId,
      agreement.marketId,
      agreement.buyerId,
      agreement.sellerId,
      agreement.token,
      agreement.price,
      agreement.quantity,
      agreement.status,
      agreement.agreedAt,
      agreement.expiresAt
    );
  }

  getTentativeAgreement(id: string): TentativeAgreement | null {
    const stmt = this.db.prepare(`SELECT * FROM tentative_agreements WHERE id = ?`);
    const row = stmt.get(id) as any;
    return row ? this.rowToAgreement(row) : null;
  }

  getPendingAgreementsForAgent(agentId: string): TentativeAgreement[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tentative_agreements 
      WHERE (buyer_id = ? OR seller_id = ?) AND status = 'PENDING'
      ORDER BY expires_at ASC
    `);
    const rows = stmt.all(agentId, agentId) as any[];
    return rows.map(this.rowToAgreement);
  }

  updateAgreementStatus(id: string, status: TentativeStatus, tradeId?: string): void {
    const stmt = this.db.prepare(`
      UPDATE tentative_agreements SET status = ?, resolved_at = ?, trade_id = ? WHERE id = ?
    `);
    stmt.run(status, new Date().toISOString(), tradeId || null, id);
  }

  expireOldAgreements(): number {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tentative_agreements SET status = 'EXPIRED', resolved_at = ? 
      WHERE status = 'PENDING' AND expires_at < ?
    `);
    const result = stmt.run(now, now);
    return result.changes;
  }

  private rowToAgreement(row: any): TentativeAgreement {
    return {
      id: row.id,
      chatId: row.chat_id,
      marketId: row.market_id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
      token: row.token,
      price: row.price,
      quantity: row.quantity,
      status: row.status,
      agreedAt: row.agreed_at,
      expiresAt: row.expires_at,
      resolvedAt: row.resolved_at || undefined,
      tradeId: row.trade_id || undefined,
    };
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  close(): void {
    this.db.close();
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let storageInstance: TradingStorage | null = null;

export function getTradingStorage(dbPath?: string): TradingStorage {
  if (!storageInstance) {
    storageInstance = new TradingStorage(dbPath);
  }
  return storageInstance;
}
