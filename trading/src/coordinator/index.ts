/**
 * Trading Coordinator
 * 
 * Orchestrates the trading session:
 * 1. Interest phase - broadcast market, collect responses
 * 2. Trading phase - main floor + side chats
 * 3. Finalization - execute trades
 */

import { randomUUID } from "crypto";
import {
  getAgentFactory,
  getAgentRunner,
  type Agent,
} from "../agents/index.js";
import { getTradingStorage, TradingStorage } from "../storage/index.js";
import {
  placeOrder,
  isRegistryAvailable,
  type PlaceOrderParams,
} from "../registry/index.js";
import type {
  AgentState,
  MarketInfo,
  InterestResponse,
  SideChat,
  Message,
  TentativeAgreement,
  TradingSession,
  MainFloorAction,
  SideChatAction,
} from "../types/index.js";

// =============================================================================
// CONFIG
// =============================================================================

const TENTATIVE_EXPIRY_MS = 30_000;  // 30 seconds
const SIDE_CHAT_TIMEOUT_MS = 120_000; // 2 minutes
const FLOOR_ROUND_SPEAKERS = 3;       // Agents per floor round
const INTER_MESSAGE_DELAY_MS = 1500;  // Delay between messages

// =============================================================================
// COORDINATOR
// =============================================================================

export class TradingCoordinator {
  private storage: TradingStorage;
  private factory = getAgentFactory();
  private runner = getAgentRunner();
  
  private agents: Map<string, Agent> = new Map();
  private agentStates: Map<string, AgentState> = new Map();
  
  // Registry integration
  private useRegistry: boolean = false;
  private agentTraderIds: Map<string, string> = new Map(); // agentId -> traderId in registry
  private agentTokens: Map<string, string> = new Map(); // agentId -> auth token for registry
  
  // Event handlers for real-time streaming
  private onMessage?: (msg: Message) => void;
  private onTrade?: (trade: { marketId: string; buyerId: string; sellerId: string; token: string; price: number; quantity: number }) => void;

  constructor(dbPath?: string, useRegistry: boolean = false) {
    this.storage = getTradingStorage(dbPath);
    this.useRegistry = useRegistry;
  }
  
  /**
   * Map an agent to a registry trader ID
   */
  setAgentTraderId(agentId: string, traderId: string): void {
    this.agentTraderIds.set(agentId, traderId);
  }

  /**
   * Set event handlers for real-time updates
   */
  setHandlers(handlers: {
    onMessage?: (msg: Message) => void;
    onTrade?: (trade: any) => void;
  }): void {
    this.onMessage = handlers.onMessage;
    this.onTrade = handlers.onTrade;
  }

  /**
   * Initialize agents for trading
   */
  async initializeAgents(startingBalance: number = 10000): Promise<Agent[]> {
    const agents = this.factory.createAllPresetAgents();
    
    for (const agent of agents) {
      this.agents.set(agent.id, agent);
      this.agentStates.set(agent.id, this.factory.initializeAgentState(agent, startingBalance));
      
      // Register or resume agent with real registry if enabled
      if (this.useRegistry) {
        const { registerAgentTrader } = await import("../registry/index.js");
        const result = await registerAgentTrader(agent.id, agent.handle, startingBalance);
        if (result) {
          this.agentTraderIds.set(agent.id, result.traderId);
          this.agentTokens.set(agent.id, result.token);
          
          // Update agent state with actual balance from registry
          const state = this.agentStates.get(agent.id);
          if (state && result.balance !== startingBalance) {
            state.balance = result.balance;
            state.availableBalance = result.balance;
          }
          
          if (result.existing) {
            console.log(`[Registry] Resumed @${agent.handle} (trader ${result.traderId}, $${result.balance.toLocaleString()})`);
          } else {
            console.log(`[Registry] Registered @${agent.handle} as trader ${result.traderId}`);
          }
        } else {
          console.error(`[Registry] Failed to register @${agent.handle}`);
        }
      }
    }
    
    console.log(`[Coordinator] Initialized ${agents.length} agents${this.useRegistry ? ' (registered with registry)' : ''}`);
    return agents;
  }
  
  /**
   * Reset agents for a new market (bring them back to the floor)
   * Preserves their balance from previous trades
   */
  resetAgentsForNewMarket(): void {
    for (const [agentId, state] of this.agentStates.entries()) {
      state.onFloor = true;
      state.activeSideChats = [];
      state.tentativeAgreements = [];
      state.researchContext = '';
      // Balance and positions are preserved across markets!
    }
    console.log(`[Coordinator] Reset ${this.agentStates.size} agents for new market`);
  }
  
  /**
   * Get total number of agents
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Run interest phase - broadcast market to all agents
   */
  async runInterestPhase(market: MarketInfo): Promise<InterestResponse[]> {
    console.log(`[Coordinator] Starting interest phase for market ${market.id}`);
    
    const interests: InterestResponse[] = [];
    
    // Call all agents in parallel
    const promises = Array.from(this.agents.values()).map(async (agent) => {
      const state = this.agentStates.get(agent.id)!;
      try {
        const interest = await this.runner.getInterest(agent, market, state.balance);
        this.storage.saveInterest(interest);
        interests.push(interest);
        
        // Cache research context in agent state (avoid duplicate API calls later)
        if (interest.researchContext) {
          state.researchContext = interest.researchContext;
        }
        // Also store their reasoning
        state.researchContext = `YOUR PRIOR RESEARCH: ${interest.message}`;
        
        console.log(`[${agent.handle}] ${interest.type}: ${interest.message.slice(0, 50)}...`);
        return interest;
      } catch (err) {
        console.error(`[${agent.handle}] Interest failed:`, err);
        // Return a PASS on error
        const passInterest: InterestResponse = {
          id: `interest_${agent.id}_${market.id}`,
          marketId: market.id,
          agentId: agent.id,
          type: "PASS",
          message: "(Error generating interest)",
          createdAt: new Date().toISOString(),
        };
        this.storage.saveInterest(passInterest);
        interests.push(passInterest);
        return passInterest;
      }
    });
    
    await Promise.all(promises);
    
    const interested = interests.filter(i => i.type === "INTERESTED").length;
    console.log(`[Coordinator] Interest phase complete: ${interested}/${interests.length} interested`);
    
    return interests;
  }

  /**
   * Run a single round of the main floor
   */
  async runFloorRound(
    market: MarketInfo,
    interests: InterestResponse[],
    floorMessages: Message[],
    sideChats: Map<string, SideChat>,
    roundNumber: number = 1,
    maxRounds: number = 10
  ): Promise<Message[]> {
    const newMessages: Message[] = [];
    
    // FORCE LEAVE at max rounds
    if (roundNumber >= maxRounds) {
      console.log(`[Coordinator] Round ${maxRounds} - FORCING all agents to leave`);
      for (const agent of this.agents.values()) {
        const state = this.agentStates.get(agent.id)!;
        if (state.onFloor) {
          state.onFloor = false;
          const msg = this.createMessage(market.id, null, agent.id, "AGENT_LEFT", `Market closed. Final position: ${this.formatPosition(state, market.id)}`);
          this.storage.saveMessage(msg);
          newMessages.push(msg);
          this.onMessage?.(msg);
        }
      }
      return newMessages;
    }
    
    // Get agents on floor (not those who left)
    const agentsOnFloor = Array.from(this.agents.values()).filter(a => {
      const state = this.agentStates.get(a.id)!;
      return state.onFloor;
    });
    
    // Get agents who left
    const agentsWhoLeft = Array.from(this.agents.values())
      .filter(a => !this.agentStates.get(a.id)!.onFloor)
      .map(a => a.id);
    
    if (agentsOnFloor.length === 0) {
      console.log("[Coordinator] No agents on floor");
      return newMessages;
    }
    
    // Build active side chats summary
    const activeSideChats = Array.from(sideChats.values())
      .filter(c => c.status === "NEGOTIATING")
      .map(c => ({ participants: c.participants, startedAt: c.startedAt }));
    
    // RUN ALL AGENTS IN PARALLEL
    const agentPromises = agentsOnFloor.map(async (agent) => {
      const state = this.agentStates.get(agent.id)!;
      state.tentativeAgreements = this.storage.getPendingAgreementsForAgent(agent.id);
      
      try {
        const action = await this.runner.getMainFloorAction(
          agent,
          state,
          market,
          floorMessages,
          interests,
          activeSideChats,
          agentsOnFloor.filter(a => a.id !== agent.id),
          roundNumber,
          agentsWhoLeft,
          maxRounds
        );
        return { agent, state, action };
      } catch (err) {
        console.error(`[${agent.handle}] Floor action failed:`, err);
        return null;
      }
    });
    
    // Wait for all agents to decide in parallel
    const results = await Promise.all(agentPromises);
    
    // Process actions sequentially (to avoid race conditions on side chats)
    for (const result of results) {
      if (!result) continue;
      const { agent, state, action } = result;
      
      const messages = await this.processFloorAction(agent, state, market, action, sideChats);
      newMessages.push(...messages);
      floorMessages.push(...messages);
      
      for (const msg of messages) {
        this.onMessage?.(msg);
      }
    }
    
    return newMessages;
  }
  
  private formatPosition(state: AgentState, marketId: string): string {
    const pos = state.positions.get(marketId);
    if (!pos || (pos.yesTokens === 0 && pos.noTokens === 0)) {
      return `$${state.balance.toLocaleString()} cash, no tokens`;
    }
    const parts = [];
    if (pos.yesTokens !== 0) parts.push(`${pos.yesTokens} YES`);
    if (pos.noTokens !== 0) parts.push(`${pos.noTokens} NO`);
    return `$${state.balance.toLocaleString()} cash, ${parts.join(', ')}`;
  }

  /**
   * Process a main floor action
   */
  private async processFloorAction(
    agent: Agent,
    state: AgentState,
    market: MarketInfo,
    action: MainFloorAction,
    sideChats: Map<string, SideChat>
  ): Promise<Message[]> {
    const messages: Message[] = [];
    const now = new Date().toISOString();
    
    if (action.action === "PASS") {
      return messages;
    }
    
    if (action.action === "CHAT") {
      const msg = this.createMessage(market.id, null, agent.id, "CHAT", action.text);
      this.storage.saveMessage(msg);
      messages.push(msg);
      console.log(`[${agent.handle}] ${action.text}`);
    }
    
    else if (action.action === "START_SIDE_CHAT") {
      // Validate participants - accept both "agent_elon" and "elon" formats
      const validParticipants = action.withAgents
        .map(id => {
          // Normalize: ensure "agent_" prefix
          const normalized = id.startsWith('agent_') ? id : `agent_${id}`;
          return this.agents.has(normalized) && normalized !== agent.id ? normalized : null;
        })
        .filter((id): id is string => id !== null);
      
      if (validParticipants.length === 0) {
        console.log(`[${agent.handle}] No valid side chat participants from: ${action.withAgents.join(', ')}`);
        return messages;
      }
      
      // Create side chat
      const chat = this.storage.createSideChat(
        market.id,
        [agent.id, ...validParticipants],
        { yes: market.yesPrice, no: market.noPrice }
      );
      sideChats.set(chat.id, chat);
      state.activeSideChats.push(chat.id);
      
      // Announce on floor
      const participantHandles = validParticipants.map(id => `@${id.replace('agent_', '')}`).join(', ');
      const announcement = this.createMessage(
        market.id, null, "SYSTEM", "SIDE_CHAT_STARTED",
        `@${agent.handle} started a private negotiation with ${participantHandles}`
      );
      this.storage.saveMessage(announcement);
      messages.push(announcement);
      
      // Add agent's message
      const msg = this.createMessage(market.id, null, agent.id, "CHAT", action.text);
      this.storage.saveMessage(msg);
      messages.push(msg);
      
      console.log(`[${agent.handle}] Started side chat with ${participantHandles}`);
    }
    
    else if (action.action === "FINALIZE_AGREEMENT") {
      const agreement = this.storage.getTentativeAgreement(action.agreementId);
      
      if (!agreement || agreement.status !== "PENDING") {
        console.log(`[${agent.handle}] Agreement not found or not pending`);
        return messages;
      }
      
      // Check balance for buyer
      const isBuyer = agreement.buyerId === agent.id;
      if (isBuyer) {
        const cost = agreement.price * agreement.quantity;
        if (state.availableBalance < cost) {
          console.log(`[${agent.handle}] Insufficient balance to finalize`);
          // Auto-cancel
          this.storage.updateAgreementStatus(agreement.id, "CANCELLED");
          const cancelMsg = this.createMessage(
            market.id, null, "SYSTEM", "CANCELLED",
            `@${agent.handle}'s agreement cancelled: insufficient balance`
          );
          this.storage.saveMessage(cancelMsg);
          messages.push(cancelMsg);
          return messages;
        }
      }
      
      // Execute trade
      const tradeId = `trade_${randomUUID().slice(0, 8)}`;
      const marketId = agreement.marketId;
      const cost = agreement.price * agreement.quantity;
      
      // If using real registry, settle the trade atomically
      if (this.useRegistry) {
        const buyerTraderId = this.agentTraderIds.get(agreement.buyerId);
        const sellerTraderId = this.agentTraderIds.get(agreement.sellerId);
        const anyToken = this.agentTokens.get(agreement.buyerId) || this.agentTokens.get(agreement.sellerId);
        
        if (buyerTraderId && sellerTraderId && anyToken) {
          console.log(`[Registry] Settling trade atomically: ${agreement.quantity} ${agreement.token} @ $${agreement.price}`);
          
          // Use atomic settlement - this handles minting, token transfer, and cash transfer
          const { settleTrade } = await import("../registry/index.js");
          const result = await settleTrade({
            marketId,
            buyerId: buyerTraderId,
            sellerId: sellerTraderId,
            tokenType: agreement.token as "YES" | "NO",
            quantity: agreement.quantity,
            price: agreement.price,
            token: anyToken,
          });
          
          if (result.success) {
            console.log(`[Registry] ✅ Trade settled: ${result.message}`);
            if (result.trade) {
              console.log(`[Registry] Trade ID: ${result.trade.id}`);
            }
          } else {
            console.error(`[Registry] ❌ Settlement failed: ${result.error}`);
          }
        } else {
          console.warn(`[Registry] Missing trader IDs or tokens - skipping registry settlement`);
        }
      }
      
      this.storage.updateAgreementStatus(agreement.id, "FINALIZED", tradeId);
      
      // Update local balances and positions
      const buyerState = this.agentStates.get(agreement.buyerId)!;
      const sellerState = this.agentStates.get(agreement.sellerId)!;
      
      buyerState.balance -= cost;
      buyerState.availableBalance = buyerState.balance - buyerState.lockedBalance;
      sellerState.balance += cost;
      
      // Update positions
      if (!buyerState.positions.has(marketId)) {
        buyerState.positions.set(marketId, { 
          marketId, yesTokens: 0, noTokens: 0, yesCostBasis: 0, noCostBasis: 0 
        });
      }
      if (!sellerState.positions.has(marketId)) {
        sellerState.positions.set(marketId, { 
          marketId, yesTokens: 0, noTokens: 0, yesCostBasis: 0, noCostBasis: 0 
        });
      }
      const buyerPos = buyerState.positions.get(marketId)!;
      const sellerPos = sellerState.positions.get(marketId)!;
      
      if (agreement.token === 'YES') {
        buyerPos.yesTokens += agreement.quantity;
        buyerPos.yesCostBasis += cost;
        sellerPos.yesTokens -= agreement.quantity;
      } else {
        buyerPos.noTokens += agreement.quantity;
        buyerPos.noCostBasis += cost;
        sellerPos.noTokens -= agreement.quantity;
      }
      
      // Announce
      const tradeMsg = this.createMessage(
        market.id, null, "SYSTEM", "TRADE",
        `⚡ TRADE: @${agreement.buyerId.replace('agent_', '')} bought ${agreement.quantity} ${agreement.token} from @${agreement.sellerId.replace('agent_', '')} @ $${agreement.price.toFixed(2)}`
      );
      this.storage.saveMessage(tradeMsg);
      messages.push(tradeMsg);
      
      // Agent's comment
      const commentMsg = this.createMessage(market.id, null, agent.id, "FINALIZED", action.text);
      this.storage.saveMessage(commentMsg);
      messages.push(commentMsg);
      
      console.log(`[${agent.handle}] Finalized trade: ${agreement.quantity} ${agreement.token} @ $${agreement.price}`);
      
      this.onTrade?.({
        marketId: market.id,
        buyerId: agreement.buyerId,
        sellerId: agreement.sellerId,
        token: agreement.token,
        price: agreement.price,
        quantity: agreement.quantity,
      });
    }
    
    else if (action.action === "CANCEL_AGREEMENT") {
      const agreement = this.storage.getTentativeAgreement(action.agreementId);
      
      if (!agreement || agreement.status !== "PENDING") {
        console.log(`[${agent.handle}] Agreement not found or not pending`);
        return messages;
      }
      
      this.storage.updateAgreementStatus(agreement.id, "CANCELLED");
      
      const counterparty = agreement.buyerId === agent.id ? agreement.sellerId : agreement.buyerId;
      const cancelMsg = this.createMessage(
        market.id, null, "SYSTEM", "CANCELLED",
        `Agreement between @${agent.handle} and @${counterparty.replace('agent_', '')} was cancelled`
      );
      this.storage.saveMessage(cancelMsg);
      messages.push(cancelMsg);
      
      const commentMsg = this.createMessage(market.id, null, agent.id, "CANCELLED", action.text);
      this.storage.saveMessage(commentMsg);
      messages.push(commentMsg);
      
      console.log(`[${agent.handle}] Cancelled agreement`);
    }
    
    else if (action.action === "LEAVE_FLOOR") {
      state.onFloor = false;
      
      const leaveMsg = this.createMessage(market.id, null, "SYSTEM", "AGENT_LEFT", `@${agent.handle} has left the floor`);
      this.storage.saveMessage(leaveMsg);
      messages.push(leaveMsg);
      
      const commentMsg = this.createMessage(market.id, null, agent.id, "CHAT", action.text);
      this.storage.saveMessage(commentMsg);
      messages.push(commentMsg);
      
      console.log(`[${agent.handle}] Left the floor`);
    }
    
    return messages;
  }

  /**
   * Run a round of side chat negotiations
   */
  async runSideChatRound(
    market: MarketInfo,
    chat: SideChat
  ): Promise<{ messages: Message[]; closed: boolean }> {
    const messages: Message[] = [];
    
    if (chat.status !== "NEGOTIATING") {
      return { messages, closed: true };
    }
    
    // Check timeout
    const elapsed = Date.now() - new Date(chat.startedAt).getTime();
    if (elapsed > SIDE_CHAT_TIMEOUT_MS) {
      this.storage.updateSideChatStatus(chat.id, "EXPIRED", "Negotiation timed out");
      chat.status = "EXPIRED";
      return { messages, closed: true };
    }
    
    // Each participant takes a turn
    for (const agentId of chat.participants) {
      if (chat.status !== "NEGOTIATING") break;
      
      const agent = this.agents.get(agentId)!;
      const state = this.agentStates.get(agentId)!;
      const otherParticipants = chat.participants
        .filter(id => id !== agentId)
        .map(id => this.agents.get(id)!)
        .filter(Boolean);
      
      try {
        const action = await this.runner.getSideChatAction(
          agent,
          state,
          market,
          chat,
          otherParticipants
        );
        
        const newMsgs = await this.processSideChatAction(agent, state, market, chat, action);
        messages.push(...newMsgs);
        chat.messages.push(...newMsgs);
        
        for (const msg of newMsgs) {
          this.onMessage?.(msg);
        }
        
        await sleep(INTER_MESSAGE_DELAY_MS);
      } catch (err) {
        console.error(`[${agent.handle}] Side chat action failed:`, err);
      }
    }
    
    return { messages, closed: chat.status !== "NEGOTIATING" };
  }

  /**
   * Process a side chat action
   */
  private async processSideChatAction(
    agent: Agent,
    state: AgentState,
    market: MarketInfo,
    chat: SideChat,
    action: SideChatAction
  ): Promise<Message[]> {
    const messages: Message[] = [];
    
    if (action.action === "CHAT") {
      const msg = this.createMessage(market.id, chat.id, agent.id, "CHAT", action.text);
      this.storage.saveMessage(msg);
      messages.push(msg);
      console.log(`  [${agent.handle} in ${chat.id}] ${action.text}`);
    }
    
    else if (action.action === "PROPOSE" || action.action === "COUNTER") {
      const msg = this.createMessage(
        market.id, chat.id, agent.id, 
        action.action, 
        action.text,
        { side: action.side, token: action.token, price: action.price, quantity: action.quantity }
      );
      this.storage.saveMessage(msg);
      messages.push(msg);
      console.log(`  [${agent.handle} in ${chat.id}] ${action.action}: ${action.side} ${action.quantity} ${action.token} @ $${action.price}`);
    }
    
    else if (action.action === "AGREE") {
      // Find the last proposal
      const lastProposal = this.findLastProposal(chat.messages, agent.id);
      
      if (!lastProposal || !lastProposal.order) {
        console.log(`  [${agent.handle}] No proposal to agree to`);
        return messages;
      }
      
      // Determine buyer/seller
      const proposer = lastProposal.agentId;
      const proposerWantsToBuy = lastProposal.order.side === "BUY";
      const buyerId = proposerWantsToBuy ? proposer : agent.id;
      const sellerId = proposerWantsToBuy ? agent.id : proposer;
      
      // Create tentative agreement
      const agreement: TentativeAgreement = {
        id: `agree_${randomUUID().slice(0, 8)}`,
        chatId: chat.id,
        marketId: market.id,
        buyerId,
        sellerId,
        token: lastProposal.order.token,
        price: lastProposal.order.price,
        quantity: lastProposal.order.quantity,
        status: "PENDING",
        agreedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + TENTATIVE_EXPIRY_MS).toISOString(),
      };
      
      this.storage.saveTentativeAgreement(agreement);
      
      // Update chat status
      chat.status = "TENTATIVE";
      chat.tentativeTerms = {
        buyerId,
        sellerId,
        token: agreement.token,
        price: agreement.price,
        quantity: agreement.quantity,
      };
      this.storage.updateSideChatStatus(chat.id, "TENTATIVE");
      
      // Add messages
      const agreeMsg = this.createMessage(market.id, chat.id, agent.id, "AGREE", action.text);
      this.storage.saveMessage(agreeMsg);
      messages.push(agreeMsg);
      
      const systemMsg = this.createMessage(
        market.id, chat.id, "SYSTEM", "SYSTEM",
        `✅ TENTATIVE AGREEMENT: @${buyerId.replace('agent_', '')} buys ${agreement.quantity} ${agreement.token} from @${sellerId.replace('agent_', '')} @ $${agreement.price.toFixed(2)} — Must finalize on main floor within 30s`
      );
      this.storage.saveMessage(systemMsg);
      messages.push(systemMsg);
      
      console.log(`  [${agent.handle}] AGREED - Tentative: ${agreement.quantity} ${agreement.token} @ $${agreement.price}`);
    }
    
    else if (action.action === "REJECT") {
      chat.status = "FAILED";
      this.storage.updateSideChatStatus(chat.id, "FAILED", "Rejected by " + agent.handle);
      
      const msg = this.createMessage(market.id, chat.id, agent.id, "REJECT", action.text);
      this.storage.saveMessage(msg);
      messages.push(msg);
      
      console.log(`  [${agent.handle}] REJECTED - Chat closed`);
    }
    
    else if (action.action === "LEAVE_CHAT") {
      chat.status = "CANCELLED";
      this.storage.updateSideChatStatus(chat.id, "CANCELLED", "Left by " + agent.handle);
      
      const msg = this.createMessage(market.id, chat.id, agent.id, "CHAT", action.text);
      this.storage.saveMessage(msg);
      messages.push(msg);
      
      console.log(`  [${agent.handle}] LEFT - Chat closed`);
    }
    
    return messages;
  }

  /**
   * Run all active side chats in parallel
   */
  async runAllSideChatsParallel(
    market: MarketInfo,
    sideChats: Map<string, SideChat>
  ): Promise<Message[]> {
    const allMessages: Message[] = [];
    
    const activeChats = Array.from(sideChats.values())
      .filter(c => c.status === "NEGOTIATING");
    
    if (activeChats.length === 0) return allMessages;
    
    console.log(`[Coordinator] Running ${activeChats.length} side chats in parallel`);
    
    const results = await Promise.all(
      activeChats.map(chat => this.runSideChatRound(market, chat))
    );
    
    for (const result of results) {
      allMessages.push(...result.messages);
    }
    
    return allMessages;
  }

  /**
   * Expire old tentative agreements
   */
  expireAgreements(): number {
    return this.storage.expireOldAgreements();
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private createMessage(
    marketId: string,
    chatId: string | null,
    agentId: string,
    type: Message["type"],
    text: string,
    order?: Message["order"]
  ): Message {
    return {
      id: `msg_${randomUUID().slice(0, 8)}`,
      marketId,
      chatId,
      agentId,
      type,
      text,
      order,
      createdAt: new Date().toISOString(),
    };
  }

  private selectSpeakers(agents: Agent[], count: number, recentMessages: Message[]): Agent[] {
    // Weight by: not recently spoke, was mentioned, has pending agreements
    const weights = new Map<string, number>();
    const recent5 = recentMessages.slice(-5);
    
    for (const agent of agents) {
      let weight = 1.0;
      
      // Lower weight if recently spoke
      const recentCount = recent5.filter(m => m.agentId === agent.id).length;
      weight *= Math.pow(0.3, recentCount);
      
      // Higher weight if mentioned
      const wasMentioned = recent5.some(m => m.text.includes(`@${agent.handle}`));
      if (wasMentioned) weight *= 3.0;
      
      // Higher weight if has pending agreements
      const state = this.agentStates.get(agent.id)!;
      if (state.tentativeAgreements.length > 0) weight *= 2.0;
      
      weights.set(agent.id, weight);
    }
    
    // Weighted random selection
    const selected: Agent[] = [];
    const remaining = [...agents];
    
    for (let i = 0; i < Math.min(count, remaining.length); i++) {
      const totalWeight = remaining.reduce((sum, a) => sum + (weights.get(a.id) || 1), 0);
      let rand = Math.random() * totalWeight;
      
      for (let j = 0; j < remaining.length; j++) {
        rand -= weights.get(remaining[j].id) || 1;
        if (rand <= 0) {
          selected.push(remaining[j]);
          remaining.splice(j, 1);
          break;
        }
      }
    }
    
    return selected;
  }

  private findLastProposal(messages: Message[], excludeAgentId: string): Message | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if ((m.type === "PROPOSE" || m.type === "COUNTER") && m.agentId !== excludeAgentId) {
        return m;
      }
    }
    return null;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// SINGLETON
// =============================================================================

let coordinatorInstance: TradingCoordinator | null = null;

export function getTradingCoordinator(dbPath?: string, useRegistry: boolean = false): TradingCoordinator {
  if (!coordinatorInstance || useRegistry) {
    coordinatorInstance = new TradingCoordinator(dbPath, useRegistry);
  }
  return coordinatorInstance;
}
