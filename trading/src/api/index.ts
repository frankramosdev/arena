/**
 * Trading Floor API
 *
 * REST + WebSocket API for the trading floor.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import { getTradingCoordinator } from "../coordinator/index.js";
import {
  getAgentFactory,
  getAgentAvatar,
  setAgentAvatar,
  getAllAvatars,
  getAgentEmoji,
} from "../agents/index.js";
import {
  getOpenMarkets,
  isRegistryAvailable,
  type TradingMarket,
} from "../registry/index.js";
import type {
  Message,
  InterestResponse,
  SideChat,
  MarketInfo,
} from "../types/index.js";

// =============================================================================
// SETUP
// =============================================================================

export const api = new Hono();
// Enable real trading against registry order book
const USE_REGISTRY = process.env.USE_REGISTRY !== "false"; // true by default
const coordinator = getTradingCoordinator(":memory:", USE_REGISTRY);
const factory = getAgentFactory();

console.log(
  `[API] Registry integration: ${USE_REGISTRY ? "ENABLED" : "DISABLED"}`,
);

// SSE subscribers per market
const subscribers = new Map<string, Set<(msg: Message) => void>>();

// Set up coordinator handlers
coordinator.setHandlers({
  onMessage: (msg) => {
    const subs = subscribers.get(msg.marketId);
    if (subs) {
      for (const callback of subs) {
        callback(msg);
      }
    }
  },
  onTrade: (trade) => {
    console.log(`[API] Trade executed:`, trade);

    // Record trade in all sessions for this market
    for (const session of sessions.values()) {
      if (session.marketId === trade.marketId) {
        session.trades.push({
          id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          buyer: trade.buyerId,
          seller: trade.sellerId,
          token: trade.token,
          quantity: trade.quantity,
          price: trade.price,
          marketId: trade.marketId,
        });
      }
    }
  },
});

// Middleware
api.use("*", cors());
api.use("*", logger());

// =============================================================================
// HEALTH & INFO
// =============================================================================

api.get("/", (c) =>
  c.json({
    name: "Basemarket Trading Floor",
    version: "1.0.0",
    endpoints: {
      "GET /health": "Health check",
      "GET /agents": "List all agents",
      "POST /sessions": "Start a trading session for a market",
      "GET /sessions/:id": "Get session state",
      "GET /sessions/:id/stream": "SSE stream of messages",
      "GET /sessions/:id/interests": "Get interest responses",
      "GET /sessions/:id/floor": "Get main floor messages",
      "GET /sessions/:id/chats": "Get active side chats",
    },
  }),
);

api.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    agents: factory.getAllAgents().length,
  }),
);

// =============================================================================
// AGENTS
// =============================================================================

api.get("/agents", (c) => {
  const agents = factory.getAllAgents();
  return c.json({
    agents: agents.map((a) => ({
      id: a.id,
      handle: a.handle,
      displayName: a.displayName,
      avatar: getAgentAvatar(a.handle),
      emoji: getAgentEmoji(a.handle),
      personality: {
        riskProfile: a.personality.riskProfile,
        tradingStyle: a.personality.tradingStyle,
        tone: a.personality.tone,
        expertise: a.personality.expertise,
      },
    })),
  });
});

api.get("/agents/:id", (c) => {
  const id = c.req.param("id");
  const agent = factory.getAgent(id) || factory.getAgent(`agent_${id}`);

  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json({
    agent: {
      id: agent.id,
      handle: agent.handle,
      displayName: agent.displayName,
      avatar: getAgentAvatar(agent.handle),
      emoji: getAgentEmoji(agent.handle),
      personality: agent.personality,
    },
  });
});

// =============================================================================
// AVATARS
// =============================================================================

/**
 * Get all agent avatars
 */
api.get("/avatars", (c) => {
  return c.json({ avatars: getAllAvatars() });
});

/**
 * Get avatar for specific agent
 */
api.get("/avatars/:handle", (c) => {
  const handle = c.req.param("handle");
  return c.json({
    handle,
    avatar: getAgentAvatar(handle),
    emoji: getAgentEmoji(handle),
  });
});

/**
 * Set custom avatar for an agent
 * POST /avatars/:handle
 * Body: { url: string }
 */
api.post("/avatars/:handle", async (c) => {
  const handle = c.req.param("handle");
  const body = await c.req.json();

  if (!body.url || typeof body.url !== "string") {
    return c.json({ error: "URL required" }, 400);
  }

  // Basic URL validation
  try {
    new URL(body.url);
  } catch {
    return c.json({ error: "Invalid URL" }, 400);
  }

  setAgentAvatar(handle, body.url);

  return c.json({
    success: true,
    handle,
    avatar: body.url,
  });
});

// =============================================================================
// TRADING SESSIONS
// =============================================================================

// Session type
type SessionStatus = "INITIALIZING" | "INTEREST" | "TRADING" | "CLOSED";

interface Session {
  id: string;
  marketId: string;
  marketQuestion?: string;
  status: SessionStatus;
  interests: InterestResponse[];
  floorMessages: Message[];
  sideChats: Map<string, SideChat>;
  trades: Array<{
    id: string;
    timestamp: string;
    buyer: string;
    seller: string;
    token: string;
    quantity: number;
    price: number;
    marketId: string;
  }>;
  startedAt: string;
}

// Active sessions
const sessions = new Map<string, Session>();

/**
 * List all active sessions
 */
api.get("/sessions", (c) => {
  const sessionList = Array.from(sessions.values()).map((s) => ({
    id: s.id,
    marketId: s.marketId,
    marketQuestion: s.marketQuestion,
    status: s.status,
    startedAt: s.startedAt,
    stats: {
      interests: s.interests.length,
      interested: s.interests.filter((i) => i.type === "INTERESTED").length,
      floorMessages: s.floorMessages.length,
      sideChats: s.sideChats.size,
      trades: s.trades.length,
    },
  }));

  return c.json({ sessions: sessionList });
});

/**
 * Get aggregate feed across all active sessions
 */
api.get("/feed", (c) => {
  const limit = parseInt(c.req.query("limit") || "50");

  // Collect all messages from all sessions
  const allMessages: Array<
    Message & { sessionId: string; marketQuestion?: string }
  > = [];

  for (const session of sessions.values()) {
    for (const msg of session.floorMessages) {
      allMessages.push({
        ...msg,
        sessionId: session.id,
        marketQuestion: session.marketQuestion,
      });
    }
  }

  // Sort by createdAt, newest first
  allMessages.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Collect all trades
  const allTrades: Array<
    Session["trades"][0] & { sessionId: string; marketQuestion?: string }
  > = [];

  for (const session of sessions.values()) {
    for (const trade of session.trades) {
      allTrades.push({
        ...trade,
        sessionId: session.id,
        marketQuestion: session.marketQuestion,
      });
    }
  }

  allTrades.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return c.json({
    messages: allMessages.slice(0, limit),
    trades: allTrades.slice(0, limit),
    activeSessions: Array.from(sessions.values()).filter(
      (s) => s.status === "TRADING",
    ).length,
    totalAgents: factory.getAllAgents().length,
  });
});

/**
 * Start a new trading session for a market
 */
api.post("/sessions", async (c) => {
  const body = await c.req.json();
  const { market } = body;

  if (!market || !market.id || !market.question) {
    return c.json({ error: "Market data required" }, 400);
  }

  // Initialize agents if not already done
  if (factory.getAllAgents().length === 0) {
    await coordinator.initializeAgents(10000);
  }

  const sessionId = `session_${market.id}_${Date.now()}`;

  const session: Session = {
    id: sessionId,
    marketId: market.id,
    marketQuestion: market.question,
    status: "INITIALIZING",
    interests: [],
    floorMessages: [],
    sideChats: new Map<string, SideChat>(),
    trades: [],
    startedAt: new Date().toISOString(),
  };

  sessions.set(sessionId, session);
  subscribers.set(market.id, new Set());

  // Start interest phase in background
  (async () => {
    session.status = "INTEREST";
    const interests = await coordinator.runInterestPhase(market);
    session.interests = interests;
    session.status = "TRADING";

    // Start trading loop
    const MAX_ROUNDS = 10;
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      if (session.status !== "TRADING") break;

      // Track current round
      (session as any).currentRound = round;

      // Expire old agreements
      coordinator.expireAgreements();

      // Run floor round (agents in parallel)
      const newMessages = await coordinator.runFloorRound(
        market,
        session.interests,
        session.floorMessages,
        session.sideChats,
        round,
        MAX_ROUNDS,
      );
      session.floorMessages.push(...newMessages);

      // Run all side chats in parallel
      await coordinator.runAllSideChatsParallel(market, session.sideChats);
    }

    session.status = "CLOSED";
  })();

  return c.json({
    session: {
      id: sessionId,
      marketId: market.id,
      status: session.status,
      startedAt: session.startedAt,
    },
  });
});

/**
 * Get session state
 */
api.get("/sessions/:id", (c) => {
  const id = c.req.param("id");
  const session = sessions.get(id);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({
    session: {
      id: session.id,
      marketId: session.marketId,
      status: session.status,
      startedAt: session.startedAt,
      stats: {
        interests: session.interests.length,
        interested: session.interests.filter((i) => i.type === "INTERESTED")
          .length,
        floorMessages: session.floorMessages.length,
        sideChats: session.sideChats.size,
        activeChats: Array.from(session.sideChats.values()).filter(
          (c) => c.status === "NEGOTIATING",
        ).length,
        currentRound: (session as any).currentRound || 0,
        maxRounds: 10,
      },
    },
  });
});

/**
 * Get interest responses for session
 */
api.get("/sessions/:id/interests", (c) => {
  const id = c.req.param("id");
  const session = sessions.get(id);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({
    interests: session.interests,
  });
});

/**
 * Get floor messages
 */
api.get("/sessions/:id/floor", (c) => {
  const id = c.req.param("id");
  const session = sessions.get(id);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const limit = parseInt(c.req.query("limit") || "50");
  const messages = session.floorMessages.slice(-limit);

  return c.json({
    messages,
    total: session.floorMessages.length,
  });
});

/**
 * Get side chats
 */
api.get("/sessions/:id/chats", (c) => {
  const id = c.req.param("id");
  const session = sessions.get(id);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const chats = Array.from(session.sideChats.values()).map((chat) => ({
    id: chat.id,
    participants: chat.participants,
    status: chat.status,
    messageCount: chat.messages.length,
    startedAt: chat.startedAt,
    closedAt: chat.closedAt,
  }));

  return c.json({ chats });
});

/**
 * Get specific side chat
 */
api.get("/sessions/:sessionId/chats/:chatId", (c) => {
  const sessionId = c.req.param("sessionId");
  const chatId = c.req.param("chatId");
  const session = sessions.get(sessionId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const chat = session.sideChats.get(chatId);
  if (!chat) {
    return c.json({ error: "Chat not found" }, 404);
  }

  return c.json({ chat });
});

// =============================================================================
// SSE STREAMING
// =============================================================================

/**
 * Stream messages in real-time via SSE
 */
api.get("/sessions/:id/stream", async (c) => {
  const id = c.req.param("id");
  const session = sessions.get(id);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return streamSSE(c, async (stream) => {
    // Send initial state
    await stream.writeSSE({
      event: "init",
      data: JSON.stringify({
        status: session.status,
        interests: session.interests.length,
        messages: session.floorMessages.length,
      }),
    });

    // Subscribe to new messages
    const callback = async (msg: Message) => {
      await stream.writeSSE({
        event: "message",
        data: JSON.stringify(msg),
      });
    };

    const subs = subscribers.get(session.marketId);
    subs?.add(callback);

    // Keep connection alive
    const keepAlive = setInterval(async () => {
      await stream.writeSSE({
        event: "ping",
        data: JSON.stringify({ timestamp: Date.now() }),
      });
    }, 30000);

    // Cleanup on disconnect
    stream.onAbort(() => {
      clearInterval(keepAlive);
      subs?.delete(callback);
    });

    // Wait until session closes or client disconnects
    while (session.status !== "CLOSED") {
      await new Promise((r) => setTimeout(r, 1000));
    }

    await stream.writeSSE({
      event: "close",
      data: JSON.stringify({ status: "closed" }),
    });
  });
});

// =============================================================================
// MANUAL ACTIONS (for testing)
// =============================================================================

/**
 * Manually trigger a floor round
 */
api.post("/sessions/:id/floor/round", async (c) => {
  const id = c.req.param("id");
  const session = sessions.get(id);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  if (session.status !== "TRADING") {
    return c.json({ error: "Session not in trading state" }, 400);
  }

  // Get market info (simplified)
  const market = {
    id: session.marketId,
    question: "Demo market",
    description: "",
    yesPrice: 0.5,
    noPrice: 0.5,
    volume: 0,
    resolutionDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: "OPEN",
  };

  coordinator.expireAgreements();

  // Track round number (increment from session)
  const currentRound = ((session as any).currentRound || 0) + 1;
  (session as any).currentRound = currentRound;

  const MAX_ROUNDS = 10;
  const newMessages = await coordinator.runFloorRound(
    market,
    session.interests,
    session.floorMessages,
    session.sideChats,
    currentRound,
    MAX_ROUNDS,
  );
  session.floorMessages.push(...newMessages);

  return c.json({
    messages: newMessages,
  });
});

/**
 * Close a session
 */
api.post("/sessions/:id/close", (c) => {
  const id = c.req.param("id");
  const session = sessions.get(id);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  session.status = "CLOSED";

  return c.json({
    session: {
      id: session.id,
      status: session.status,
    },
  });
});

// =============================================================================
// AUTO-TRADING
// =============================================================================

// Track processed markets to avoid re-processing
const processedMarkets = new Set<string>();
let autoTradingActive = false;

/**
 * Start auto-trading loop that polls for new markets
 */
export async function startAutoTrading() {
  if (autoTradingActive) {
    console.log("[AutoTrading] Already running");
    return;
  }

  autoTradingActive = true;
  console.log("[AutoTrading] Starting...");

  // Wait for registry to be available
  let registryReady = false;
  for (let i = 0; i < 30; i++) {
    if (await isRegistryAvailable()) {
      registryReady = true;
      break;
    }
    console.log("[AutoTrading] Waiting for registry...");
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!registryReady) {
    console.log("[AutoTrading] Registry not available, disabling auto-trading");
    autoTradingActive = false;
    return;
  }

  console.log("[AutoTrading] Registry connected!");

  // Initialize agents once
  console.log("[AutoTrading] Initializing agents with $10,000 each...");
  const agents = await coordinator.initializeAgents(10000);
  console.log(`[AutoTrading] Initialized ${agents.length} agents`);

  // Main trading loop
  const POLL_INTERVAL = 60000; // 60 seconds

  while (autoTradingActive) {
    try {
      // Fetch open markets
      const markets = await getOpenMarkets(10);

      // Find new markets
      const newMarkets = markets.filter((m) => !processedMarkets.has(m.id));

      if (newMarkets.length > 0) {
        console.log(`[AutoTrading] Found ${newMarkets.length} new market(s)`);

        // Run sessions SEQUENTIALLY (shared coordinator state doesn't support parallel)
        for (const market of newMarkets) {
          processedMarkets.add(market.id);

          // Start trading session for this market
          console.log(
            `[AutoTrading] Starting session for: ${market.question.slice(0, 50)}...`,
          );

          const marketInfo: MarketInfo = {
            id: market.id,
            question: market.question,
            description: market.description,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
            volume: market.volume,
            resolutionDate: market.resolutionDate,
            status: market.status,
          };

          // Create session
          const sessionId = `session_${market.id}_${Date.now()}`;
          const session: Session = {
            id: sessionId,
            marketId: market.id,
            marketQuestion: market.question,
            status: "INITIALIZING",
            interests: [],
            floorMessages: [],
            sideChats: new Map<string, SideChat>(),
            trades: [],
            startedAt: new Date().toISOString(),
          };

          sessions.set(sessionId, session);
          subscribers.set(market.id, new Set());

          // Run trading session SEQUENTIALLY - await completion before next market
          try {
            await runTradingSession(session, marketInfo);
            console.log(
              `[AutoTrading] Session complete for: ${market.question.slice(0, 30)}...`,
            );
          } catch (err) {
            console.error(`[AutoTrading] Session error for ${market.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("[AutoTrading] Poll error:", err);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

/**
 * Run a complete trading session for a market
 */
async function runTradingSession(session: Session, market: MarketInfo) {
  try {
    // Reset agents for new market
    coordinator.resetAgentsForNewMarket();

    // Interest phase
    session.status = "INTEREST";
    console.log(`[Session ${session.id}] Running interest phase...`);
    const interests = await coordinator.runInterestPhase(market);
    session.interests = interests;

    const interested = interests.filter((i) => i.type === "INTERESTED");
    console.log(
      `[Session ${session.id}] ${interested.length}/${interests.length} agents interested`,
    );

    if (interested.length < 2) {
      console.log(`[Session ${session.id}] Not enough interest, closing`);
      session.status = "CLOSED";
      return;
    }

    // Trading phase
    session.status = "TRADING";
    console.log(`[Session ${session.id}] Starting trading floor...`);

    const MAX_ROUNDS = 10;
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      if (session.status !== "TRADING") break;

      // Track current round
      (session as any).currentRound = round;

      console.log(`[Session ${session.id}] Round ${round}/${MAX_ROUNDS}`);

      coordinator.expireAgreements();

      const newMessages = await coordinator.runFloorRound(
        market,
        session.interests,
        session.floorMessages,
        session.sideChats,
        round,
        MAX_ROUNDS,
      );
      session.floorMessages.push(...newMessages);

      // Run side chats
      await coordinator.runAllSideChatsParallel(market, session.sideChats);

      // Check if all agents left
      const agentsLeft = session.floorMessages.filter(
        (m) => m.type === "AGENT_LEFT",
      ).length;
      const totalAgents = coordinator.getAgentCount();
      if (agentsLeft >= totalAgents) {
        console.log(`[Session ${session.id}] All agents left`);
        break;
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    session.status = "CLOSED";
    console.log(`[Session ${session.id}] Session complete`);
  } catch (err) {
    console.error(`[Session ${session.id}] Error:`, err);
    session.status = "CLOSED";
  }
}
