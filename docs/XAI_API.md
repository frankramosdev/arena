# xAI API — Integration Reference

> What works, what's deprecated, and how to use the current Agent Tools API in this codebase.

---

## Current API Status (March 2026)

| Feature | Status | Notes |
|---|---|---|
| Chat Completions (`/v1/chat/completions`) | ✅ Active | Standard `generateText` with `xai(model)` |
| Responses API (`/v1/responses`) | ✅ Active | Use `xai.responses(model)` + Agent Tools |
| Live Search (`searchParameters`) | ❌ **Deprecated** | Returns HTTP 410 Gone |
| Agent Tools (`x_search`, `web_search`) | ✅ Active | Replacement for Live Search |
| X API Tools (custom via Bearer Token) | ✅ Active | Still works but requires `X_BEARER_TOKEN` |

---

## Migration: Live Search → Agent Tools

### What was removed

The `providerOptions.xai.searchParameters` block was removed from xAI's API:

```typescript
// ❌ BROKEN — HTTP 410 Gone
generateText({
  model: xai("grok-4-1-fast-reasoning"),
  prompt: "...",
  providerOptions: {
    xai: {
      searchParameters: {        // ← this entire block is gone
        mode: "auto",
        returnCitations: true,
        maxSearchResults: 20,
        sources: [
          { type: "x", postFavoriteCount: 5, postViewCount: 500 },
          { type: "news", safeSearch: true },
        ],
      },
    },
  },
});
```

### What replaces it

Use the Responses API with `x_search` as a named tool:

```typescript
import { xai, xSearch } from "@ai-sdk/xai";
import { generateText } from "ai";

// ✅ WORKS
const { text, sources } = await generateText({
  model: xai.responses("grok-4-1-fast-reasoning"),
  prompt: "What has @elonmusk said about xAI recently?",
  tools: {
    x_search: xSearch({ allowedXHandles: ["elonmusk"] }),
  },
  maxSteps: 10,
});

console.log(text);
console.log("Sources:", sources); // Array of X posts with author, text, url, likes
```

---

## xSearch Reference

### Import

```typescript
import { xSearch } from "@ai-sdk/xai";
// or
import { xaiTools } from "@ai-sdk/xai";
// xaiTools.xSearch(args)
```

### Parameters

```typescript
xSearch({
  allowedXHandles?: string[];    // Only search these handles (max 10)
  excludedXHandles?: string[];   // Exclude these handles (max 10)
  fromDate?: string;             // ISO8601: "YYYY-MM-DD"
  toDate?: string;               // ISO8601: "YYYY-MM-DD"
  enableImageUnderstanding?: boolean;  // Analyze images in posts
  enableVideoUnderstanding?: boolean;  // Analyze videos in posts
})
```

**Constraints:**
- `allowedXHandles` and `excludedXHandles` cannot both be set in the same request
- Max 10 handles in either list
- Dates must be ISO8601 format strings

### Return value (from `result.sources`)

```typescript
Array<{
  query: string;    // The search query that was used
  posts: Array<{
    author: string; // X handle (without @)
    text: string;   // Post content
    url: string;    // Direct URL to the post
    likes: number;  // Like count
  }>;
}>
```

### Examples

```typescript
// Search all of X (no filter)
x_search: xSearch()

// Focus on one account — great for markets about specific people
x_search: xSearch({ allowedXHandles: ["elonmusk"] })

// Focus on multiple accounts
x_search: xSearch({ allowedXHandles: ["elonmusk", "naval", "karpathy"] })

// Limit to a date range
x_search: xSearch({
  fromDate: "2026-01-01",
  toDate: "2026-03-10",
})

// Combined: specific user in a date range
x_search: xSearch({
  allowedXHandles: ["frankramosdev"],
  fromDate: "2026-02-01",
})
```

---

## Chat API vs Responses API

The SDK exposes two ways to use xAI models:

### Chat API — `xai(model)`

Routes to `/v1/chat/completions`. Standard LLM behavior.

```typescript
import { xai } from "@ai-sdk/xai";

generateText({
  model: xai("grok-4-1-fast-reasoning"),
  system: "...",
  prompt: "...",
  // tools: { custom tools only, not Agent Tools }
})
```

Use when:
- Fast structured output
- Custom tools (your own Zod schemas)
- No real-time X/web search needed

### Responses API — `xai.responses(model)`

Routes to `/v1/responses`. Required for Agent Tools (`x_search`, `web_search`, etc.).

```typescript
import { xai, xSearch } from "@ai-sdk/xai";

generateText({
  model: xai.responses("grok-4-1-fast-reasoning"),
  system: "...",
  prompt: "...",
  tools: {
    x_search: xSearch(),          // ← Agent Tool
    web_search: xai.tools.webSearch(), // ← Agent Tool
  },
  maxSteps: 50,  // replaces stopWhen: stepCountIs(N)
})
```

Use when:
- Real-time X or web search needed
- Citations/sources needed in response
- Multi-step research (agent decides when to search)

**Note:** `stopWhen: stepCountIs(N)` syntax from the Chat API does not work with `xai.responses()`. Use `maxSteps: N` instead.

---

## Models Supporting the Responses API

As of `@ai-sdk/xai@2.0.62`:

```
grok-4-1
grok-4-1-fast-reasoning      ← default in this codebase
grok-4-1-fast-non-reasoning
grok-4
grok-4-fast
grok-4-fast-non-reasoning
```

All other models (grok-3, grok-2, etc.) only support the Chat API.

---

## Environment Variables

```bash
# Required: xAI API key
XAI_API_KEY=xai-...

# Optional: override the model (defaults to grok-4-1-fast-reasoning)
XAI_MODEL=grok-4-1-fast-reasoning
```

The `XAI_API_KEY` is automatically picked up by `@ai-sdk/xai` from the environment — no need to pass it explicitly in code.

---

## Rate Limits

xAI rate limits apply per API key. When 5 agents call in parallel during the interest phase, rate limits can be hit. The AI SDK retries automatically with exponential backoff (3 attempts by default).

If you see `RetryError: Failed after 3 attempts. Last error: Too Many Requests`:
- Reduce parallelism (stagger agent calls)
- Increase retry count/delay
- Use a higher-tier API key

The error is caught gracefully in `coordinator.ts` — agents that hit rate limits return a `PASS` instead of crashing the session.

---

## Citations

When using the Responses API with search tools, citations are returned in `result.sources`:

```typescript
const result = await generateText({
  model: xai.responses("grok-4-1-fast-reasoning"),
  prompt: "What has @elonmusk been posting about?",
  tools: { x_search: xSearch({ allowedXHandles: ["elonmusk"] }) },
});

// result.sources is an array of posts found during search
for (const source of result.sources ?? []) {
  console.log(source); // { query, posts: [{ author, text, url, likes }] }
}
```

---

## Full Example: Market Research Agent

This is roughly how the trading agents use xSearch to evaluate a prediction market:

```typescript
import { xai, xSearch } from "@ai-sdk/xai";
import { generateText } from "ai";

const market = {
  question: "Will @frankramosdev post a tweet containing 'AI' by end of week?",
  description: "@frankramosdev is the founder of @workloopai...",
};

// Extract handles mentioned in the market
const handles = market.question.match(/@([A-Za-z0-9_]+)/g)?.map(h => h.slice(1)) ?? [];
// → ["frankramosdev"]

const result = await generateText({
  model: xai.responses("grok-4-1-fast-reasoning"),
  system: "You are a prediction market trader. Research the market and decide.",
  prompt: `Market: ${market.question}\n\nResearch recent activity and respond with JSON:
{"type": "INTERESTED", "side": "BUY", "token": "YES", "price": 0.55, "quantity": 100, "message": "..."}
or
{"type": "PASS", "message": "..."}`,
  tools: {
    x_search: xSearch({
      allowedXHandles: handles,
      fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10), // last 7 days
    }),
  },
  maxSteps: 20,
});

console.log("Decision:", result.text);
console.log("Posts found:", result.sources?.flatMap(s => s.posts).length ?? 0);
```
