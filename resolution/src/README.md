# Resolution Agent

AI-driven market resolution for SIG Arena. Monitors markets approaching resolution time and uses X API to gather evidence and determine outcomes.

## Features

- **Continuous Monitoring**: Daemon mode constantly checks for markets needing resolution
- **AI-Powered Verification**: Uses Grok to analyze X API data and determine outcomes
- **Early Resolution API**: HTTP endpoints to request early resolution
- **Automatic Retry**: Failed resolutions are retried with backoff
- **Overdue Detection**: Prioritizes markets past their resolution date

## Usage

```bash
# Start monitoring daemon + API server
pnpm resolve

# Run single resolution cycle
pnpm resolve:once

# Check resolution status
pnpm resolve:status
```

## Environment Variables

```bash
XAI_API_KEY=xxx                      # Required - xAI API key
AGENT_TOKEN=sig_xxx                  # Required - Registry agent token
REGISTRY_URL=http://localhost:3100   # Registry API URL
RESOLUTION_API_PORT=3200             # API server port
RESOLUTION_CHECK_INTERVAL_MS=60000   # Check interval (1 min)
RESOLUTION_MONITOR_HOURS=24          # Monitor markets resolving in next 24h
RESOLUTION_BATCH_SIZE=10             # Max markets per cycle
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Get Stats
```bash
GET /stats
```

### Request Early Resolution
```bash
POST /resolve
{
  "marketId": "xxx-xxx-xxx",
  "reason": "Event already occurred",
  "evidence": {
    "url": "https://x.com/...",
    "explanation": "Tweet found matching criteria"
  }
}
```

### Trigger Manual Cycle
```bash
POST /cycle
```

## Resolution Process

1. Agent fetches pending/overdue markets from registry
2. For each market, generates resolution prompt with verification criteria
3. Grok uses X API tools to gather evidence:
   - `searchRecentTweets` - Find matching tweets
   - `getUserByUsername` - Check follower counts
   - `getTweetById` - Get engagement metrics
   - etc.
4. Returns outcome (YES/NO/INVALID) with evidence
5. Submits resolution to registry

## Verification Types

| Type | Description |
|------|-------------|
| `tweet_exists` | Check if account posted tweet with keywords |
| `tweet_count` | Count tweets matching criteria |
| `engagement_threshold` | Check likes/retweets/views |
| `follower_milestone` | Check follower count |
| `account_action` | Check for replies, follows, etc. |
