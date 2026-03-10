/**
 * Market Resolution Prompt
 *
 * The instruction prompt for resolving a specific market.
 */

import type { PendingMarket } from "../types/index.js";

/**
 * Generate resolution prompt for a specific market
 */
export function getResolutionPrompt(market: PendingMarket): string {
  const verification = market.verification;
  const handles = verification.targetHandles?.map((h) => `@${h}`).join(", ") || "N/A";
  const keywords = verification.keywords?.join(", ") || "N/A";
  const threshold = verification.threshold ?? "N/A";

  return `# Market Resolution Task

Resolve this prediction market by gathering evidence from X/Twitter.

## Market Details

**ID:** ${market.id}
**Question:** ${market.question}
**Description:** ${market.description}
**Resolution Date:** ${market.resolutionDate}
**Status:** ${market.status}

## Verification Method

**Type:** ${verification.type}
**Target Handles:** ${handles}
**Keywords:** ${keywords}
**Threshold:** ${threshold}
**Criteria:** ${verification.resolutionCriteria}

## Your Task

1. Use the appropriate X API tools to verify the outcome
2. For **${verification.type}** verification:

${getVerificationInstructions(verification.type)}

## Resolution Strategy

${getVerificationStrategy(verification.type, verification)}

## Important

- Current time: ${new Date().toISOString()}
- Resolution deadline: ${market.resolutionDate}
- Only consider activity BEFORE the resolution date
- Be thorough - make multiple API calls to verify

## Output

Return your resolution as JSON:

{
  "outcome": "YES" | "NO" | "INVALID",
  "evidence": {
    "type": "tweet" | "no_tweet" | "engagement" | "follower_count" | "account_action" | "api_error" | "invalid_market",
    "url": "https://x.com/user/status/tweetId",
    "tweetId": "tweetId if found",
    "data": { relevant API response data },
    "explanation": "Clear explanation of why this outcome was determined",
    "confidence": 0.95
  }
}

Now resolve this market.`;
}

function getVerificationInstructions(type: string): string {
  switch (type) {
    case "tweet_exists":
      return `   - Search for tweets from the target handle containing keywords
   - Use \`searchRecentTweets\` with query: "from:handle keyword"
   - Check that tweet was posted before resolution date
   - YES = matching tweet found, NO = no matching tweet`;

    case "tweet_count":
      return `   - Get tweets from the target account
   - Use \`getUserByUsername\` first to get user ID
   - Then \`getUserTweets\` to get their timeline
   - Filter by keywords and count matches
   - Compare against threshold`;

    case "engagement_threshold":
      return `   - Find the specific tweet being tracked
   - Use \`searchRecentTweets\` or \`getTweetById\`
   - Check current engagement metrics (likes, retweets, views)
   - Compare against threshold`;

    case "follower_milestone":
      return `   - Get current follower count
   - Use \`getUserByUsername\` with the target handle
   - Check public_metrics.followers_count
   - Compare against threshold`;

    case "account_action":
      return `   - Search for the specific action
   - For replies: "from:handle to:other_handle"
   - For retweets: Check if handle retweeted specific tweet
   - For follows: Check following list (may be limited)`;

    default:
      return `   - Analyze the market criteria
   - Use appropriate X API tools
   - Gather evidence for determination`;
  }
}

function getVerificationStrategy(
  type: string,
  verification: PendingMarket["verification"]
): string {
  const handles = verification.targetHandles || [];
  const keywords = verification.keywords || [];
  const threshold = verification.threshold;

  switch (type) {
    case "tweet_exists":
      if (handles.length > 0 && keywords.length > 0) {
        const searchQuery = `from:${handles[0]} ${keywords.join(" ")}`;
        return `**Recommended approach:**
1. \`searchRecentTweets\` with query: "${searchQuery}"
2. If found, verify tweet date < resolution date
3. If not found via search, try \`getUserByUsername\` → \`getUserTweets\` to scan timeline`;
      }
      return "Search for matching tweets from target accounts.";

    case "follower_milestone":
      if (handles.length > 0 && threshold) {
        return `**Recommended approach:**
1. \`getUserByUsername\` with username: "${handles[0]}"
2. Check response.data.public_metrics.followers_count
3. Compare: ${threshold} <= followers_count ? YES : NO`;
      }
      return "Get current follower count and compare to threshold.";

    case "engagement_threshold":
      if (threshold) {
        return `**Recommended approach:**
1. Find the specific tweet using \`searchRecentTweets\` or ID
2. Get full metrics with \`getTweetById\`
3. Check public_metrics (like_count, retweet_count, etc.)
4. Compare against threshold: ${threshold}`;
      }
      return "Get tweet metrics and compare to threshold.";

    case "account_action":
      if (handles.length >= 2) {
        return `**Recommended approach:**
1. \`searchRecentTweets\` with query: "from:${handles[0]} to:${handles[1]}"
2. Check for replies, quotes, or mentions
3. Verify action occurred before resolution date`;
      }
      return "Search for the specific account action.";

    default:
      return "Use appropriate X API tools to verify the market criteria.";
  }
}
