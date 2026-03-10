/**
 * Type Tests - Compile-time validation
 */

import { describe, it, expect } from "vitest";
import type {
  AgentPersonality,
  Agent,
  AgentState,
  InterestResponse,
  SideChat,
  TentativeAgreement,
  Message,
  TradingSession,
  MainFloorAction,
  SideChatAction,
  RiskProfile,
  TradingStyle,
  CommunicationTone,
} from "../../src/types/index.js";

describe("Type Definitions", () => {
  describe("AgentPersonality", () => {
    it("should accept valid personality with Map relationships", () => {
      const personality: AgentPersonality = {
        riskProfile: "moderate",
        tradingStyle: "value",
        maxPositionPercent: 0.1,
        minConfidenceToTrade: 0.7,
        tone: "casual",
        verbosity: "normal",
        usesEmoji: false,
        catchphrases: ["test"],
        expertise: ["crypto"],
        avoids: [],
        relationships: new Map(),
        bio: "Test bio",
        tradingPhilosophy: "Test philosophy",
      };
      expect(personality.riskProfile).toBe("moderate");
      expect(personality.relationships).toBeInstanceOf(Map);
    });

    it("should accept degen risk profile", () => {
      const profile: RiskProfile = "degen";
      expect(profile).toBe("degen");
    });

    it("should accept yolo trading style", () => {
      const style: TradingStyle = "yolo";
      expect(style).toBe("yolo");
    });

    it("should accept meme tone", () => {
      const tone: CommunicationTone = "meme";
      expect(tone).toBe("meme");
    });
  });

  describe("Agent", () => {
    it("should accept valid agent", () => {
      const agent: Agent = {
        id: "agent_1",
        handle: "test",
        displayName: "Test Agent",
        personality: {
          riskProfile: "moderate",
          tradingStyle: "value",
          maxPositionPercent: 0.1,
          minConfidenceToTrade: 0.7,
          tone: "casual",
          verbosity: "normal",
          usesEmoji: false,
          catchphrases: [],
          expertise: [],
          avoids: [],
          relationships: new Map(),
          bio: "",
          tradingPhilosophy: "",
        },
        traderId: "trader_1",
        userId: "user_1",
      };
      expect(agent.id).toBe("agent_1");
    });
  });

  describe("AgentState", () => {
    it("should accept valid state with Map positions", () => {
      const state: AgentState = {
        agentId: "agent_1",
        balance: 10000,
        availableBalance: 8000,
        lockedBalance: 2000,
        positions: new Map(),
        onFloor: true,
        activeSideChats: [],
        tentativeAgreements: [],
      };
      expect(state.positions).toBeInstanceOf(Map);
      expect(state.onFloor).toBe(true);
    });
  });

  describe("InterestResponse", () => {
    it("should accept INTERESTED response", () => {
      const response: InterestResponse = {
        id: "int_1",
        agentId: "agent_1",
        marketId: "mkt_1",
        type: "INTERESTED",
        side: "BUY",
        token: "YES",
        price: 0.65,
        quantity: 100,
        message: "I'm in!",
        createdAt: new Date().toISOString(),
      };
      expect(response.type).toBe("INTERESTED");
    });

    it("should accept PASS response", () => {
      const response: InterestResponse = {
        id: "int_2",
        agentId: "agent_2",
        marketId: "mkt_1",
        type: "PASS",
        message: "Not my thing",
        createdAt: new Date().toISOString(),
      };
      expect(response.type).toBe("PASS");
    });
  });

  describe("SideChat", () => {
    it("should accept valid side chat", () => {
      const chat: SideChat = {
        id: "chat_1",
        marketId: "mkt_1",
        participants: ["agent_1", "agent_2"],
        messages: [],
        externalUpdates: [],
        status: "NEGOTIATING",
        startedAt: new Date().toISOString(),
        snapshotPrices: { yes: 0.65, no: 0.35 },
      };
      expect(chat.status).toBe("NEGOTIATING");
    });
  });

  describe("TentativeAgreement", () => {
    it("should accept valid agreement", () => {
      const agreement: TentativeAgreement = {
        id: "agr_1",
        chatId: "chat_1",
        marketId: "mkt_1",
        buyerId: "agent_1",
        sellerId: "agent_2",
        token: "YES",
        price: 0.65,
        quantity: 100,
        status: "PENDING",
        agreedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };
      expect(agreement.status).toBe("PENDING");
    });
  });

  describe("Message", () => {
    it("should accept main floor message (null chatId)", () => {
      const msg: Message = {
        id: "msg_1",
        marketId: "mkt_1",
        chatId: null,
        agentId: "agent_1",
        type: "CHAT",
        text: "Hello traders!",
        createdAt: new Date().toISOString(),
      };
      expect(msg.chatId).toBeNull();
    });

    it("should accept side chat message", () => {
      const msg: Message = {
        id: "msg_2",
        marketId: "mkt_1",
        chatId: "chat_1",
        agentId: "agent_1",
        type: "PROPOSE",
        text: "How about this?",
        order: {
          side: "BUY",
          token: "YES",
          price: 0.65,
          quantity: 100,
        },
        createdAt: new Date().toISOString(),
      };
      expect(msg.chatId).toBe("chat_1");
      expect(msg.order?.price).toBe(0.65);
    });
  });

  describe("Actions", () => {
    it("should type main floor actions correctly", () => {
      const chat: MainFloorAction = { action: "CHAT", text: "Hello" };
      const startChat: MainFloorAction = { action: "START_SIDE_CHAT", text: "Let's talk", withAgents: ["agent_elon"] };
      const pass: MainFloorAction = { action: "PASS" };

      expect(chat.action).toBe("CHAT");
      expect(startChat.action).toBe("START_SIDE_CHAT");
      expect(pass.action).toBe("PASS");
    });

    it("should type side chat actions correctly", () => {
      const propose: SideChatAction = {
        action: "PROPOSE",
        text: "I'll buy",
        side: "BUY",
        token: "YES",
        price: 0.65,
        quantity: 100,
      };
      const agree: SideChatAction = { action: "AGREE", text: "Deal!" };
      const reject: SideChatAction = { action: "REJECT", text: "No way" };

      expect(propose.action).toBe("PROPOSE");
      expect(agree.action).toBe("AGREE");
      expect(reject.action).toBe("REJECT");
    });
  });
});
