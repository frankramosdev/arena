/**
 * Agent Prompts
 *
 * System prompts and context builders for agent LLM calls.
 */

import type {
  Agent,
  AgentState,
  MarketInfo,
  InterestResponse,
  SideChat,
  Message,
  TentativeAgreement,
  ExternalUpdate,
} from "../types/index.js";

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

export function buildSystemPrompt(agent: Agent): string {
  const { personality } = agent;

  return `You are ${agent.displayName} (@${agent.handle}), a trading agent on Basemarket - a prediction market where AI agents trade.

## YOUR PERSONALITY

${personality.bio}

## YOUR TRADING PHILOSOPHY

${personality.tradingPhilosophy}

## YOUR STYLE

- Risk tolerance: ${personality.riskProfile}
- Trading approach: ${personality.tradingStyle}
- Communication: ${personality.tone}, ${personality.verbosity}
${personality.usesEmoji ? "- You use emoji to express yourself" : "- You rarely use emoji"}
${personality.catchphrases.length > 0 ? `- Your catchphrases: "${personality.catchphrases.join('", "')}"` : ""}

## TOPICS

- Expertise: ${personality.expertise.join(", ") || "General"}
- You avoid: ${personality.avoids.join(", ") || "Nothing specific"}

## RULES

1. Always stay in character
2. Be conversational but decisive
3. Your messages should feel natural, not robotic
4. You can disagree, trash talk, or praise - whatever fits your personality
5. Always respond with valid JSON as specified in the prompt

## OUTPUT FORMAT

You ALWAYS respond with a JSON object. The format depends on where you are (main floor vs side chat).
Never include anything outside the JSON object.`;
}

// =============================================================================
// INTEREST PROMPT (Phase 1)
// =============================================================================

export function buildInterestPrompt(
  agent: Agent,
  market: MarketInfo,
  balance: number,
): string {
  const maxPosition = balance * agent.personality.maxPositionPercent;
  const maxPositionPct = (agent.personality.maxPositionPercent * 100).toFixed(
    0,
  );

  // Check if this is a priority market (@frankramosdev)
  const isPriorityMarket =
    market.question.toLowerCase().includes("@frankramosdev") ||
    market.description.toLowerCase().includes("@frankramosdev");

  const priorityNote = isPriorityMarket
    ? `\n⭐ PRIORITY MARKET: This is a @frankramosdev market - you should participate! Research and take a position.\n`
    : "";

  return `NEW MARKET: "${market.question}"

Description: ${market.description}
Current Prices: YES $${market.yesPrice.toFixed(2)} | NO $${market.noPrice.toFixed(2)}
Volume: $${market.volume.toLocaleString()} | Resolves: ${market.resolutionDate}
${priorityNote}
## YOUR FINANCIAL STATE
- Balance: $${balance.toLocaleString()}
- Max position size: ${maxPositionPct}% = $${maxPosition.toLocaleString()}
- RISK RULE: Never bet more than ${maxPositionPct}% on any single market. You need capital for other opportunities.

RESEARCH: You have X/Twitter search and API tools. Use them to research before deciding. For example, if the market is about someone tweeting, look up their recent tweets.

Are you interested? FIRST research with tools, THEN respond with JSON:

INTERESTED: {"type": "INTERESTED", "side": "BUY"|"SELL", "token": "YES"|"NO", "price": 0.01-0.99, "quantity": <number up to ${Math.floor(maxPosition)}>, "message": "<your take>"}

NOT INTERESTED: {"type": "PASS", "message": "<brief reason>"}`;
}

// =============================================================================
// MAIN FLOOR PROMPT (Phase 2+)
// =============================================================================

export function buildMainFloorPrompt(
  agent: Agent,
  state: AgentState,
  market: MarketInfo,
  floorMessages: Message[],
  interests: InterestResponse[],
  activeSideChats: { participants: string[]; startedAt: string }[],
  otherAgents: Agent[],
  roundNumber: number = 1,
  agentsWhoLeft: string[] = [],
  maxRounds: number = 10,
): string {
  // Find potential counterparties (opposite side)
  const myInterest = interests.find((i) => i.agentId === agent.id);
  const myToken = myInterest?.token;
  const mySide = myInterest?.side;

  // Counterparties: if I'm BUY YES, I need SELL YES or BUY NO
  // if I'm BUY NO, I need SELL NO or BUY YES
  const counterparties = interests.filter((i) => {
    if (i.agentId === agent.id || i.type !== "INTERESTED") return false;
    if (!myToken || !mySide) return true; // Show all if we don't have a position
    if (mySide === "BUY") {
      // I want to buy, need sellers of same token OR buyers of opposite
      return (
        (i.token === myToken && i.side === "SELL") ||
        (i.token !== myToken && i.side === "BUY")
      );
    } else {
      // I want to sell, need buyers of same token OR sellers of opposite
      return (
        (i.token === myToken && i.side === "BUY") ||
        (i.token !== myToken && i.side === "SELL")
      );
    }
  });

  const counterpartyHandles = counterparties.map((c) =>
    c.agentId.replace("agent_", ""),
  );

  // Build interests summary
  const buyYes = interests.filter(
    (i) => i.type === "INTERESTED" && i.side === "BUY" && i.token === "YES",
  );
  const buyNo = interests.filter(
    (i) => i.type === "INTERESTED" && i.side === "BUY" && i.token === "NO",
  );

  const interestsSection = `BULLS (BUY YES): ${buyYes.map((i) => `@${i.agentId.replace("agent_", "")} ${i.quantity}@$${i.price?.toFixed(2)}`).join(", ") || "none"}
BEARS (BUY NO): ${buyNo.map((i) => `@${i.agentId.replace("agent_", "")} ${i.quantity}@$${i.price?.toFixed(2)}`).join(", ") || "none"}`;

  // Build pending agreements section
  const pendingSection =
    state.tentativeAgreements.length > 0
      ? "\nPENDING DEALS: " +
        state.tentativeAgreements
          .map((t) => {
            const isBuyer = t.buyerId === agent.id;
            const counterparty = isBuyer ? t.sellerId : t.buyerId;
            return `${isBuyer ? "BUY" : "SELL"} ${t.quantity} ${t.token}@$${t.price.toFixed(2)} with @${counterparty.replace("agent_", "")} [ID: ${t.id}]`;
          })
          .join("; ")
      : "";

  // Build recent messages (last 10)
  const recentMessages = floorMessages
    .slice(-10)
    .map((m) => {
      const sender =
        m.agentId === "SYSTEM"
          ? "SYSTEM"
          : `@${m.agentId.replace("agent_", "")}`;
      return `${sender}: ${m.text}`;
    })
    .join("\n");

  // Check urgency
  const noCounterparties =
    counterparties.length === 0 && myInterest?.type === "INTERESTED";
  const roundsLeft = maxRounds - roundNumber;
  const isUrgent = roundsLeft <= 2; // Round 8, 9
  const isFinal = roundsLeft <= 1; // Round 9

  // Who's still on floor
  const onFloorHandles = otherAgents.map((a) => "@" + a.handle);
  const leftHandles = agentsWhoLeft.map((id) => "@" + id.replace("agent_", ""));

  const maxPosition =
    state.availableBalance * agent.personality.maxPositionPercent;

  return `MARKET: "${market.question}" | YES $${market.yesPrice.toFixed(2)} | NO $${market.noPrice.toFixed(2)}
ROUND ${roundNumber}/${maxRounds}${isUrgent ? ` ⚠️ ${roundsLeft} ROUNDS LEFT!` : ""}

YOU: $${state.availableBalance.toLocaleString()} available | Max bet: $${maxPosition.toLocaleString()} | Position: ${formatPosition(state.positions.get(market.id))}${pendingSection}
${state.researchContext ? `\n${state.researchContext}\n` : ""}

ON FLOOR: ${onFloorHandles.length > 0 ? onFloorHandles.join(", ") : "nobody else"}${leftHandles.length > 0 ? ` | LEFT: ${leftHandles.join(", ")}` : ""}

${interestsSection}

${counterpartyHandles.length > 0 ? `POTENTIAL COUNTERPARTIES: ${counterpartyHandles.map((h) => "@" + h).join(", ")}` : `NO DIRECT COUNTERPARTIES YET - everyone is on your side. Try to convince someone to take the other side! Offer to ${mySide === "BUY" ? "SELL" : "BUY"} ${myToken === "YES" ? "NO" : "YES"} at a good price.`}

RECENT CHAT:
${recentMessages || "(empty)"}

---
YOUR TURN.
${isFinal ? "🚨 FINAL ROUND - FINALIZE deals or LEAVE_FLOOR NOW!\n" : ""}${isUrgent && !isFinal ? "⚠️ WRAP UP - Finalize pending deals and prepare to leave!\n" : ""}${state.tentativeAgreements.length > 0 ? "⚠️ PENDING DEALS - FINALIZE them: " + state.tentativeAgreements.map((t) => t.id).join(", ") + "\n" : ""}${
    counterpartyHandles.length > 0
      ? `💡 START_SIDE_CHAT with ${counterpartyHandles
          .slice(0, 2)
          .map((h) => "@" + h)
          .join(", ")} to trade!\n`
      : ""
  }${noCounterparties && roundNumber < 4 ? "💬 No counterparties yet - CHAT to convince someone to take the other side!\n" : ""}${noCounterparties && roundNumber >= 4 ? "❌ No counterparties after 4 rounds of trying - LEAVE_FLOOR.\n" : ""}
ACTIONS:
- CHAT: {"action": "CHAT", "text": "<message>"} - discuss, debate, try to find/convince counterparties
- START_SIDE_CHAT: {"action": "START_SIDE_CHAT", "text": "<why>", "withAgents": ["handle1"]} - negotiate privately
- FINALIZE_AGREEMENT: {"action": "FINALIZE_AGREEMENT", "text": "<msg>", "agreementId": "<id>"}
- LEAVE_FLOOR: {"action": "LEAVE_FLOOR", "text": "<goodbye>"} - only after 4+ rounds with no trades`;
}

// =============================================================================
// SIDE CHAT PROMPT (Phase 3)
// =============================================================================

export function buildSideChatPrompt(
  agent: Agent,
  state: AgentState,
  market: MarketInfo,
  chat: SideChat,
  otherParticipants: Agent[],
): string {
  const participantsSection = otherParticipants
    .map((other) => {
      return `@${other.handle}`;
    })
    .join(", ");

  // Build chat history
  const chatHistory = chat.messages
    .map((m) => {
      const sender =
        m.agentId === "SYSTEM"
          ? "SYSTEM"
          : `@${m.agentId.replace("agent_", "")}`;
      let text = m.text;
      if (m.order) {
        text += ` [${m.order.side} ${m.order.quantity} ${m.order.token} @ $${m.order.price.toFixed(2)}]`;
      }
      return `${sender}: ${text}`;
    })
    .join("\n");

  // Current proposal (if any)
  const lastProposal = findLastProposal(chat.messages, agent.id);
  const proposalSection = lastProposal
    ? `\n⚠️ PROPOSAL ON TABLE: @${lastProposal.agentId.replace("agent_", "")} offers ${lastProposal.order?.side} ${lastProposal.order?.quantity} ${lastProposal.order?.token} @ $${lastProposal.order?.price.toFixed(2)} - AGREE or COUNTER!`
    : "";

  // Check if negotiation is stalling
  const messageCount = chat.messages.length;
  const noProposals = !chat.messages.some(
    (m) => m.type === "PROPOSE" || m.type === "COUNTER",
  );
  const stallingWarning =
    messageCount > 4 && noProposals
      ? "\n⚠️ 4+ messages without a PROPOSE - make an offer or LEAVE_CHAT!"
      : "";

  const maxPosition =
    state.availableBalance * agent.personality.maxPositionPercent;

  return `SIDE CHAT: "${market.question}" | YES $${market.yesPrice.toFixed(2)} | NO $${market.noPrice.toFixed(2)}

YOU: $${state.availableBalance.toLocaleString()} available | Max bet: $${maxPosition.toLocaleString()} | Position: ${formatPosition(state.positions.get(market.id))}
WITH: ${participantsSection}
Duration: ${formatDuration(Date.now() - new Date(chat.startedAt).getTime())}

CONVERSATION:
${chatHistory || "(Starting - make an offer!)"}
${proposalSection}${stallingWarning}

---
YOUR TURN. Respond with JSON:

- PROPOSE/COUNTER: {"action": "PROPOSE", "text": "<message>", "side": "BUY"|"SELL", "token": "YES"|"NO", "price": 0.01-0.99, "quantity": <num>}
- AGREE: {"action": "AGREE", "text": "<message>"} - accepts proposal, creates tentative deal
- REJECT: {"action": "REJECT", "text": "<message>"} - closes chat, no deal
- LEAVE_CHAT: {"action": "LEAVE_CHAT", "text": "<goodbye>"} - exit anytime
- CHAT: {"action": "CHAT", "text": "<message>"} - discuss (but don't stall forever!)

${lastProposal ? "There is a proposal - AGREE, COUNTER, or REJECT it!" : "No proposal yet - PROPOSE to start negotiating!"}`;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatPosition(
  position: { yesTokens: number; noTokens: number } | undefined,
): string {
  if (!position || (position.yesTokens === 0 && position.noTokens === 0)) {
    return "No position";
  }

  const parts = [];
  if (position.yesTokens > 0) parts.push(`${position.yesTokens} YES`);
  if (position.noTokens > 0) parts.push(`${position.noTokens} NO`);
  return parts.join(", ");
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function findLastProposal(
  messages: Message[],
  excludeAgentId: string,
): Message | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (
      (m.type === "PROPOSE" || m.type === "COUNTER") &&
      m.agentId !== excludeAgentId
    ) {
      return m;
    }
  }
  return null;
}
