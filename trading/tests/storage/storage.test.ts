/**
 * Tests for Trading Storage
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TradingStorage } from "../../src/storage/index.js";
import { unlinkSync, existsSync } from "fs";

const TEST_DB_PATH = "./test-trading.db";

function cleanupDb(path: string) {
  const files = [path, `${path}-shm`, `${path}-wal`];
  for (const f of files) {
    if (existsSync(f)) {
      try { unlinkSync(f); } catch {}
    }
  }
}

describe("TradingStorage", () => {
  let storage: TradingStorage;

  beforeEach(() => {
    cleanupDb(TEST_DB_PATH);
    storage = new TradingStorage(TEST_DB_PATH);
  });

  afterEach(() => {
    storage.close();
    cleanupDb(TEST_DB_PATH);
  });

  describe("Interest Responses", () => {
    it("should save interest response", () => {
      storage.saveInterest({
        id: "int_001",
        marketId: "mkt_001",
        agentId: "agent_naval",
        type: "INTERESTED",
        side: "BUY",
        token: "YES",
        price: 0.65,
        quantity: 100,
        message: "I'm bullish on this",
        createdAt: new Date().toISOString(),
      });

      const responses = storage.getInterestsForMarket("mkt_001");
      expect(responses).toHaveLength(1);
      expect(responses[0].agentId).toBe("agent_naval");
    });

    it("should get all interests for a market", () => {
      storage.saveInterest({
        id: "int_001",
        marketId: "mkt_001",
        agentId: "agent_naval",
        type: "INTERESTED",
        side: "BUY",
        token: "YES",
        price: 0.65,
        quantity: 100,
        message: "I'm in",
        createdAt: new Date().toISOString(),
      });

      storage.saveInterest({
        id: "int_002",
        marketId: "mkt_001",
        agentId: "agent_elon",
        type: "NOT_INTERESTED",
        message: "Not my thing",
        createdAt: new Date().toISOString(),
      });

      const interests = storage.getInterestsForMarket("mkt_001");
      expect(interests).toHaveLength(2);
    });
  });

  describe("Side Chats", () => {
    it("should create a side chat", () => {
      const chat = storage.createSideChat(
        "mkt_001",
        ["agent_naval", "agent_elon"],
        { yes: 0.65, no: 0.35 }
      );
      expect(chat.id).toMatch(/^chat_/);
      expect(chat.participants).toContain("agent_naval");
      expect(chat.participants).toContain("agent_elon");
      expect(chat.status).toBe("NEGOTIATING");
    });

    it("should get side chat by ID", () => {
      const created = storage.createSideChat(
        "mkt_001",
        ["agent_naval", "agent_elon"],
        { yes: 0.65, no: 0.35 }
      );
      const retrieved = storage.getSideChat(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.participants).toHaveLength(2);
    });

    it("should return null for non-existent chat", () => {
      const chat = storage.getSideChat("nonexistent");
      expect(chat).toBeNull();
    });

    it("should get active chats for a market", () => {
      storage.createSideChat("mkt_001", ["agent_naval", "agent_elon"], { yes: 0.65, no: 0.35 });
      const closed = storage.createSideChat("mkt_001", ["agent_karpathy", "agent_degen"], { yes: 0.65, no: 0.35 });
      storage.updateSideChatStatus(closed.id, "CLOSED", "cancelled");

      const active = storage.getActiveSideChatsForMarket("mkt_001");
      expect(active).toHaveLength(1);
    });

    it("should update side chat status", () => {
      const chat = storage.createSideChat(
        "mkt_001",
        ["agent_naval", "agent_elon"],
        { yes: 0.65, no: 0.35 }
      );
      storage.updateSideChatStatus(chat.id, "CLOSED", "deal_made");

      const closed = storage.getSideChat(chat.id);
      expect(closed?.status).toBe("CLOSED");
      expect(closed?.closedAt).toBeDefined();
    });

    it("should store snapshot prices", () => {
      const chat = storage.createSideChat(
        "mkt_001",
        ["agent_naval", "agent_elon"],
        { yes: 0.65, no: 0.35 }
      );
      const retrieved = storage.getSideChat(chat.id);
      expect(retrieved?.snapshotPrices.yes).toBe(0.65);
      expect(retrieved?.snapshotPrices.no).toBe(0.35);
    });
  });

  describe("Messages", () => {
    let chatId: string;

    beforeEach(() => {
      chatId = storage.createSideChat(
        "mkt_001",
        ["agent_naval", "agent_elon"],
        { yes: 0.65, no: 0.35 }
      ).id;
    });

    it("should save a side chat message", () => {
      storage.saveMessage({
        id: "msg_001",
        marketId: "mkt_001",
        chatId,
        agentId: "agent_naval",
        type: "CHAT",
        text: "What price are you thinking?",
        createdAt: new Date().toISOString(),
      });

      const messages = storage.getMessagesForChat(chatId);
      expect(messages).toHaveLength(1);
    });

    it("should save a floor message (no chatId)", () => {
      storage.saveMessage({
        id: "msg_001",
        marketId: "mkt_001",
        chatId: null,
        agentId: "agent_naval",
        type: "CHAT",
        text: "I'm looking to buy YES",
        createdAt: new Date().toISOString(),
      });

      const floorMessages = storage.getFloorMessages("mkt_001");
      expect(floorMessages).toHaveLength(1);
    });

    it("should get floor messages (no chatId)", () => {
      // Floor message
      storage.saveMessage({
        id: "msg_001",
        marketId: "mkt_001",
        chatId: null,
        agentId: "agent_naval",
        type: "CHAT",
        text: "I'm looking to buy YES",
        createdAt: new Date().toISOString(),
      });

      // Side chat message
      storage.saveMessage({
        id: "msg_002",
        marketId: "mkt_001",
        chatId,
        agentId: "agent_elon",
        type: "CHAT",
        text: "Private message",
        createdAt: new Date().toISOString(),
      });

      const floorMessages = storage.getFloorMessages("mkt_001");
      expect(floorMessages).toHaveLength(1);
      expect(floorMessages[0].chatId).toBeNull();
    });

    it("should include messages in side chat retrieval", () => {
      storage.saveMessage({
        id: "msg_001",
        marketId: "mkt_001",
        chatId,
        agentId: "agent_naval",
        type: "CHAT",
        text: "Hello",
        createdAt: new Date().toISOString(),
      });

      storage.saveMessage({
        id: "msg_002",
        marketId: "mkt_001",
        chatId,
        agentId: "agent_elon",
        type: "CHAT",
        text: "Hi",
        createdAt: new Date().toISOString(),
      });

      const chat = storage.getSideChat(chatId);
      expect(chat?.messages).toHaveLength(2);
    });
  });

  describe("Tentative Agreements", () => {
    let chatId: string;

    beforeEach(() => {
      chatId = storage.createSideChat(
        "mkt_001",
        ["agent_naval", "agent_elon"],
        { yes: 0.65, no: 0.35 }
      ).id;
    });

    it("should save a tentative agreement", () => {
      storage.saveTentativeAgreement({
        id: "agr_001",
        chatId,
        marketId: "mkt_001",
        buyerId: "agent_naval",
        sellerId: "agent_elon",
        token: "YES",
        price: 0.65,
        quantity: 100,
        status: "PENDING",
        agreedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      const agreement = storage.getTentativeAgreement("agr_001");
      expect(agreement).toBeDefined();
      expect(agreement?.buyerId).toBe("agent_naval");
    });

    it("should get pending agreements for an agent", () => {
      storage.saveTentativeAgreement({
        id: "agr_001",
        chatId,
        marketId: "mkt_001",
        buyerId: "agent_naval",
        sellerId: "agent_elon",
        token: "YES",
        price: 0.65,
        quantity: 100,
        status: "PENDING",
        agreedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      const navalAgreements = storage.getPendingAgreementsForAgent("agent_naval");
      expect(navalAgreements).toHaveLength(1);

      const elonAgreements = storage.getPendingAgreementsForAgent("agent_elon");
      expect(elonAgreements).toHaveLength(1);
    });

    it("should update agreement status", () => {
      storage.saveTentativeAgreement({
        id: "agr_001",
        chatId,
        marketId: "mkt_001",
        buyerId: "agent_naval",
        sellerId: "agent_elon",
        token: "YES",
        price: 0.65,
        quantity: 100,
        status: "PENDING",
        agreedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      storage.updateAgreementStatus("agr_001", "FINALIZED", "trade_123");

      const agreement = storage.getTentativeAgreement("agr_001");
      expect(agreement?.status).toBe("FINALIZED");
      expect(agreement?.tradeId).toBe("trade_123");
    });

    it("should expire old agreements", () => {
      // Create an expired agreement
      storage.saveTentativeAgreement({
        id: "agr_001",
        chatId,
        marketId: "mkt_001",
        buyerId: "agent_naval",
        sellerId: "agent_elon",
        token: "YES",
        price: 0.65,
        quantity: 100,
        status: "PENDING",
        agreedAt: new Date(Date.now() - 120000).toISOString(),
        expiresAt: new Date(Date.now() - 60000).toISOString(),
      });

      // Create a non-expired agreement
      storage.saveTentativeAgreement({
        id: "agr_002",
        chatId,
        marketId: "mkt_001",
        buyerId: "agent_karpathy",
        sellerId: "agent_degen",
        token: "NO",
        price: 0.35,
        quantity: 50,
        status: "PENDING",
        agreedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });

      const expiredCount = storage.expireOldAgreements();
      expect(expiredCount).toBe(1);

      const agreement = storage.getTentativeAgreement("agr_001");
      expect(agreement?.status).toBe("EXPIRED");
    });
  });
});
