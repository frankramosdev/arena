/**
 * Trading Service Types
 */

// =============================================================================
// AGENT PERSONALITY
// =============================================================================

export type RiskProfile = 'conservative' | 'moderate' | 'aggressive' | 'degen';
export type TradingStyle = 'value' | 'momentum' | 'contrarian' | 'arbitrage' | 'yolo';
export type CommunicationTone = 'formal' | 'casual' | 'aggressive' | 'philosophical' | 'meme';
export type Verbosity = 'terse' | 'normal' | 'verbose';

export interface AgentPersonality {
  // Trading behavior
  riskProfile: RiskProfile;
  tradingStyle: TradingStyle;
  maxPositionPercent: number;      // Max % of balance in one position
  minConfidenceToTrade: number;    // 0-1, won't trade below this
  
  // Communication
  tone: CommunicationTone;
  verbosity: Verbosity;
  usesEmoji: boolean;
  catchphrases: string[];          // Signature phrases
  
  // Topic preferences
  expertise: string[];             // Topics they know well
  avoids: string[];                // Topics they skip
  
  // Bio for prompt
  bio: string;
  tradingPhilosophy: string;
}

// =============================================================================
// AGENT
// =============================================================================

export interface Agent {
  id: string;
  handle: string;
  displayName: string;
  avatar?: string;
  
  personality: AgentPersonality;
  
  // Links to registry
  traderId: string;
  userId: string;
}

export interface AgentState {
  agentId: string;
  balance: number;
  availableBalance: number;        // balance - locked
  lockedBalance: number;
  positions: Map<string, Position>;
  
  // Current activity
  onFloor: boolean;
  activeSideChats: string[];
  tentativeAgreements: TentativeAgreement[];
  
  // Cached research from interest phase (avoid duplicate API calls)
  researchContext: string;
}

export interface Position {
  marketId: string;
  yesTokens: number;
  noTokens: number;
  yesCostBasis: number;
  noCostBasis: number;
}

// =============================================================================
// INTEREST RESPONSE
// =============================================================================

export type InterestType = 'INTERESTED' | 'PASS';

export interface InterestResponse {
  id: string;
  marketId: string;
  agentId: string;
  type: InterestType;
  
  // If INTERESTED
  side?: 'BUY' | 'SELL';
  token?: 'YES' | 'NO';
  price?: number;
  quantity?: number;
  
  // Always present
  message: string;
  createdAt: string;
  
  // Cached research context (avoid re-querying)
  researchContext?: string;
}

// =============================================================================
// SIDE CHAT
// =============================================================================

export type SideChatStatus = 
  | 'NEGOTIATING'
  | 'TENTATIVE'
  | 'EXECUTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface SideChat {
  id: string;
  marketId: string;
  participants: string[];          // Agent IDs
  status: SideChatStatus;
  
  messages: Message[];
  externalUpdates: ExternalUpdate[];
  
  // Snapshot when chat started
  startedAt: string;
  snapshotPrices: { yes: number; no: number };
  
  // If tentative or later
  tentativeTerms?: TentativeTerms;
  
  // When closed
  closedAt?: string;
  closeReason?: string;
}

export interface TentativeTerms {
  buyerId: string;
  sellerId: string;
  token: 'YES' | 'NO';
  price: number;
  quantity: number;
}

export interface ExternalUpdate {
  type: 'TRADE_ON_FLOOR' | 'PRICE_CHANGE' | 'OTHER_TENTATIVE' | 'BALANCE_CHANGE';
  description: string;
  timestamp: string;
}

// =============================================================================
// TENTATIVE AGREEMENT
// =============================================================================

export type TentativeStatus = 'PENDING' | 'FINALIZED' | 'CANCELLED' | 'EXPIRED';

export interface TentativeAgreement {
  id: string;
  chatId: string;
  marketId: string;
  
  buyerId: string;
  sellerId: string;
  token: 'YES' | 'NO';
  price: number;
  quantity: number;
  
  status: TentativeStatus;
  agreedAt: string;
  expiresAt: string;
  resolvedAt?: string;
  tradeId?: string;                // If finalized
}

// =============================================================================
// MESSAGES
// =============================================================================

export type MessageType = 
  | 'CHAT'
  | 'PROPOSE'
  | 'COUNTER'
  | 'AGREE'
  | 'REJECT'
  | 'SYSTEM'
  | 'TRADE'
  | 'SIDE_CHAT_STARTED'
  | 'SIDE_CHAT_CLOSED'
  | 'AGENT_LEFT'
  | 'FINALIZED'
  | 'CANCELLED';

export interface Message {
  id: string;
  marketId: string;
  chatId: string | null;           // null = main floor
  agentId: string;                 // 'SYSTEM' for system messages
  type: MessageType;
  text: string;
  
  // If trading message
  order?: {
    side: 'BUY' | 'SELL';
    token: 'YES' | 'NO';
    price: number;
    quantity: number;
  };
  
  // If referencing another agent/order
  referencedAgentId?: string;
  referencedOrderId?: string;
  
  createdAt: string;
}

// =============================================================================
// AGENT ACTIONS (Output from LLM)
// =============================================================================

// Main floor actions
export type MainFloorAction =
  | { action: 'CHAT'; text: string }
  | { action: 'START_SIDE_CHAT'; text: string; withAgents: string[] }
  | { action: 'FINALIZE_AGREEMENT'; text: string; agreementId: string }
  | { action: 'CANCEL_AGREEMENT'; text: string; agreementId: string }
  | { action: 'LEAVE_FLOOR'; text: string }
  | { action: 'PASS' };

// Side chat actions
export type SideChatAction =
  | { action: 'CHAT'; text: string }
  | { action: 'PROPOSE'; text: string; side: 'BUY' | 'SELL'; token: 'YES' | 'NO'; price: number; quantity: number }
  | { action: 'COUNTER'; text: string; side: 'BUY' | 'SELL'; token: 'YES' | 'NO'; price: number; quantity: number }
  | { action: 'AGREE'; text: string }
  | { action: 'REJECT'; text: string }
  | { action: 'LEAVE_CHAT'; text: string };

export type AgentAction = MainFloorAction | SideChatAction;

// =============================================================================
// MARKET STATE (from Registry)
// =============================================================================

export interface MarketInfo {
  id: string;
  question: string;
  description: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  resolutionDate: string;
  status: string;
}

// =============================================================================
// TRADING SESSION
// =============================================================================

export type SessionStatus = 'INITIALIZING' | 'INTEREST' | 'TRADING' | 'CLOSING' | 'CLOSED';

export interface TradingSession {
  id: string;
  marketId: string;
  market: MarketInfo;
  status: SessionStatus;
  
  // Participating agents
  agents: Map<string, AgentState>;
  
  // Interest pool
  interests: InterestResponse[];
  
  // Main floor
  floorMessages: Message[];
  agentsOnFloor: Set<string>;
  
  // Side chats
  sideChats: Map<string, SideChat>;
  
  // Agreements
  tentativeAgreements: Map<string, TentativeAgreement>;
  
  // Executed trades
  trades: string[];                // Trade IDs
  
  // Timing
  startedAt: string;
  closedAt?: string;
}
