# Trading Service — Operations & Integration Notes

> Lessons learned running the trading floor locally and integrating the xAI Agent Tools API.

---

## Running the Trading Service

### The Right Way

Always start the trading service with environment variables loaded from the root `.env`:

```bash
# From the workspace root
export $(cat .env | grep -v '^#' | xargs) && pnpm trading
```

Or simply:

```bash
pnpm trading
```

The `server.ts` file now automatically loads the root `.env` via `dotenv` at startup, so plain `pnpm trading` works as long as the `.env` file exists at the monorepo root.

### Why This Matters

The trading service runs as a child process of pnpm. Without explicitly loading `.env`, the `XAI_API_KEY` (and other secrets) are **not** available to the Node process. When the key is missing:

- All 5 agents throw `AI_LoadAPIKeyError` during the interest phase
- Every session shows `0/5 interested`
- Sessions close immediately with 0 messages
- The trading floor appears empty

---

## Common Failure Modes

### 1. Missing `XAI_API_KEY` → Empty Trading Floor

**Symptom:** Sessions exist in `/sessions` but all show `interested: 0, floorMessages: 0, status: CLOSED`.

**Cause:** The `XAI_API_KEY` environment variable was not loaded when the server started.

**Fix:** Ensure `.env` is loaded at startup. The `dotenv` call at the top of `trading/src/api/server.ts` handles this automatically:

```typescript
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });
```

**Diagnosis:**

```bash
# Check if the running server has the key
ps eww -p $(lsof -ti:3300 -sTCP:LISTEN) | tr ' ' '\n' | grep XAI
```

---

### 2. Deprecated Live Search API → HTTP 410 Gone

**Symptom:** Agents throw `APICallError [AI_APICallError]: Gone` with response body:

```json
{"error":"Live search is deprecated. Please switch to the Agent Tools API: https://docs.x.ai/docs/guides/tools/overview"}
```

**Cause:** The old `providerOptions.xai.searchParameters` (Live Search) was removed by xAI. Any code using this pattern will fail:

```typescript
// ❌ BROKEN — Live Search was deprecated (HTTP 410)
generateText({
  model: xai("grok-4-1-fast-reasoning"),
  providerOptions: {
    xai: {
      searchParameters: {
        mode: "auto",
        sources: [{ type: "x" }, { type: "news" }],
      },
    },
  },
});
```

**Fix:** Use the Agent Tools API instead — see [xAI Agent Tools API](#xai-agent-tools-api) below.

---

### 3. Unhandled Promise Rejection Crashes the Server

**Symptom:** The trading server crashes mid-session with no error message. `lsof -i:3300 -sTCP:LISTEN` shows the port is closed.

**Cause:** Background async IIFEs without error handlers. In Node.js 24+, an unhandled promise rejection crashes the process:

```typescript
// ❌ DANGEROUS — no error handling, can crash the server
(async () => {
  const interests = await coordinator.runInterestPhase(market);
  // ...
})();
```

**Fix:** Always wrap background async blocks:

```typescript
// ✓ SAFE
(async () => {
  try {
    const interests = await coordinator.runInterestPhase(market);
    // ...
  } catch (err) {
    console.error(`[Session ${session.id}] Fatal error:`, err);
    session.status = "CLOSED";
  }
})();
```

---

## xAI Agent Tools API

### Overview

xAI replaced the deprecated Live Search API with the **Agent Tools API** in early 2026. The key differences:

| Old (Deprecated) | New (Agent Tools API) |
|---|---|
| `providerOptions.xai.searchParameters` | `xai.tools.xSearch()` |
| `xai("model-name")` chat completions | `xai.responses("model-name")` Responses API |
| No per-request handle filtering | `allowedXHandles` param to focus search |
| Returns citations in a separate field | Citations in `result.sources` |

### Vercel AI SDK Integration

```typescript
import { xai, xSearch } from "@ai-sdk/xai";
import { generateText } from "ai";

const { text, sources } = await generateText({
  model: xai.responses("grok-4-1-fast-reasoning"),
  prompt: "What is @frankramosdev building?",
  tools: {
    x_search: xSearch({ allowedXHandles: ["frankramosdev"] }),
  },
  maxSteps: 50,
});
```

### Key Points

- **Use `xai.responses(model)`** (not `xai(model)`) when using Agent Tools. This routes to the `/v1/responses` endpoint instead of `/v1/chat/completions`.
- **`allowedXHandles`** restricts X Search to posts from specific accounts (max 10). This dramatically improves relevance for market research — e.g., when a market asks "Will @elonmusk tweet about X?", pass `allowedXHandles: ["elonmusk"]`.
- **`excludedXHandles`** works the opposite way. Cannot be combined with `allowedXHandles` in the same request.
- **`fromDate` / `toDate`** limit the search date range (ISO8601: `"YYYY-MM-DD"`).
- **`maxSteps`** replaces `stopWhen: stepCountIs(N)` when using the Responses API.

### Available Agent Tools (as of SDK v2.0.62)

```typescript
import { xSearch, xai } from "@ai-sdk/xai";

// X Search — searches posts on X/Twitter
xSearch()
xSearch({ allowedXHandles: ["elonmusk", "naval"] })
xSearch({ fromDate: "2026-01-01", toDate: "2026-03-10" })

// Web Search — searches the web
xai.tools.webSearch()

// Code Execution
xai.tools.codeExecution()

// Image/Video Understanding (for posts with media)
xSearch({ enableImageUnderstanding: true })
xSearch({ enableVideoUnderstanding: true })
```

### How the Trading Agents Use xSearch

During the **interest phase**, each agent researches the market using `xSearch` before deciding whether to trade:

```typescript
// Extract @handles from the market question
const handles = extractHandles(`${market.question} ${market.description}`);
// e.g., ["frankramosdev", "workloopai"] for "Will @frankramosdev post..."

const result = await generateText({
  model: xai.responses(MODEL),
  system: systemPrompt,
  prompt: buildInterestPrompt(agent, market, balance),
  tools: {
    x_search: handles.length > 0
      ? xSearch({ allowedXHandles: handles })
      : xSearch(),
  },
  maxSteps: 50,
});
```

This gives agents 13–32 real X posts per agent as context, resulting in much higher interest rates (5/5 interested vs 0/5 without proper research).

The **floor and side-chat phases** use the regular Chat API (`xai(MODEL)`) — agents already have research context from the interest phase and don't need to search X again during negotiation.

---

## Model Reference

Valid model IDs for `@ai-sdk/xai` (as of v2.0.62):

```
grok-4-1                     — Latest Grok 4.1
grok-4-1-fast-reasoning      — Grok 4.1 fast with reasoning (default for trading agents)
grok-4-1-fast-non-reasoning  — Grok 4.1 fast without reasoning
grok-4                       — Grok 4
grok-3                       — Grok 3
grok-3-fast                  — Grok 3 fast
grok-3-mini                  — Grok 3 mini
grok-2-1212                  — Grok 2 (stable)
```

Models usable with Responses API (`xai.responses(model)`):

```
grok-4-1, grok-4-1-fast-reasoning, grok-4-1-fast-non-reasoning,
grok-4, grok-4-fast, grok-4-fast-non-reasoning
```

Configure via environment variable:

```bash
XAI_MODEL=grok-4-1-fast-reasoning  # default
```

---

## Architecture: Why Two API Modes?

The trading service uses two different API modes deliberately:

| Phase | API Mode | Why |
|---|---|---|
| Interest (research) | `xai.responses(MODEL)` + `xSearch` | Needs real-time X data to evaluate markets |
| Main Floor (decisions) | `xai(MODEL)` chat completions | Fast structured output, no research needed |
| Side Chats (negotiation) | `xai(MODEL)` chat completions | Fast structured output, no research needed |

The Responses API is slower (agent makes multiple tool calls to search X) but produces much better decisions. The Chat API is fast and cheap — agents already have their research from the interest phase stored in `researchContext`.

---

## Session Lifecycle

```
POST /sessions
  → status: INITIALIZING
  → status: INTEREST    (agents call xSearch, decide BUY/SELL/PASS)
  → status: TRADING     (up to 10 rounds on main floor + side chats)
  → status: CLOSED

GET /feed               → aggregate across all active sessions
GET /sessions           → list all sessions with stats
GET /sessions/:id/floor → messages for one session
```

Sessions are **in-memory only**. All sessions are lost on server restart. The auto-trading loop marks processed market IDs in a `processedMarkets` Set (also in-memory), so restarting the server will re-process all open markets.

---

## Auto-Trading Loop

On startup, `startAutoTrading()` runs automatically (controlled by `AUTO_TRADE` env var, defaults to `true`):

1. Waits up to 60 seconds for the registry to be available
2. Initializes 5 agents with $10,000 each (or resumes existing registry traders)
3. Fetches up to 10 open markets from the registry
4. Runs sessions **sequentially** (not in parallel — shared coordinator state)
5. Polls every 60 seconds for new markets

Markets that have already been processed in the current server session are skipped. To re-run a market, restart the server.

---

## Troubleshooting Checklist

```
[ ] Is XAI_API_KEY set?
    → ps eww -p $(lsof -ti:3300 -sTCP:LISTEN) | tr ' ' '\n' | grep XAI

[ ] Is the trading server running?
    → curl http://localhost:3300/health

[ ] Are sessions being created?
    → curl http://localhost:3300/sessions | python3 -m json.tool

[ ] Are agents interested (not all PASS)?
    → Check stats.interested > 0 in sessions response

[ ] Are there messages in the feed?
    → curl "http://localhost:3300/feed?limit=10"

[ ] Is the registry accessible from the trading server?
    → curl http://localhost:3100/health

[ ] Check logs for specific errors:
    - "AI_LoadAPIKeyError" → XAI_API_KEY not in environment
    - "Gone" / HTTP 410    → Using deprecated Live Search API
    - "Too Many Requests"  → xAI rate limit, wait and retry
    - "EADDRINUSE"         → Port 3300 already in use
```
