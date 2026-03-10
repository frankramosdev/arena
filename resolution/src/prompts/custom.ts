/**
 * Custom Resolution Prompt
 *
 * Generates prompts for ad-hoc resolution requests.
 */

import type { CustomResolutionRequest } from "../types/index.js";

/**
 * Generate resolution prompt for a custom request
 */
export function getCustomResolutionPrompt(request: CustomResolutionRequest): string {
  const handles = request.targetHandles?.map((h) => `@${h}`).join(", ") || "N/A";
  const keywords = request.keywords?.join(", ") || "N/A";
  const threshold = request.threshold ?? "N/A";
  const timeWindow = request.timeWindow || "Last 7 days";

  return `# Custom Resolution Task

Resolve this question by gathering evidence from X/Twitter.

## Question

**${request.question}**

${request.context ? `### Context\n${request.context}\n` : ""}

## Parameters

**Verification Type:** ${request.verificationType || "general"}
**Target Handles:** ${handles}
**Keywords:** ${keywords}
**Threshold:** ${threshold}
**Time Window:** ${timeWindow}
${request.resolutionCriteria ? `**Resolution Criteria:** ${request.resolutionCriteria}` : ""}

## Your Task

Use the X API tools to gather evidence and determine if the answer is YES or NO.

${getVerificationGuidance(request)}

## Investigation Steps

1. **Search** for relevant tweets and data
2. **Verify** with multiple data points
3. **Determine** YES, NO, or INVALID with confidence

## Output Format

Return your resolution as JSON:

{
  "outcome": "YES" | "NO" | "INVALID",
  "evidence": {
    "type": "tweet" | "no_tweet" | "engagement" | "follower_count" | "account_action" | "api_error" | "invalid_market",
    "url": "https://x.com/... (if applicable)",
    "tweetId": "tweet ID if found",
    "data": { relevant API response data },
    "explanation": "Detailed explanation of your finding and reasoning",
    "confidence": 0.0-1.0
  }
}

## Confidence Guidelines

- **1.0**: Definitive evidence (exact match found)
- **0.8-0.99**: Strong evidence (clear indicators)
- **0.5-0.79**: Moderate evidence (some uncertainty)
- **<0.5**: Weak evidence (insufficient data)

Now investigate and resolve this question.`;
}

function getVerificationGuidance(request: CustomResolutionRequest): string {
  const handles = request.targetHandles || [];
  const keywords = request.keywords || [];

  switch (request.verificationType) {
    case "tweet_exists":
      if (handles.length > 0) {
        const searchQuery = keywords.length > 0 
          ? `from:${handles[0]} ${keywords.join(" ")}`
          : `from:${handles[0]}`;
        return `### Verification Guidance

**Search Strategy:**
1. \`searchRecentTweets\` with query: "${searchQuery}"
2. If no results, try broader search without keywords
3. Check \`getUserTweets\` for the target's timeline

**Resolve YES** if you find a matching tweet.
**Resolve NO** if no matching tweet exists after thorough search.`;
      }
      return "Search for tweets matching the question criteria.";

    case "follower_milestone":
      if (handles.length > 0 && request.threshold) {
        return `### Verification Guidance

**Search Strategy:**
1. \`getUserByUsername\` with username: "${handles[0]}"
2. Check response.data.public_metrics.followers_count
3. Compare against threshold: ${request.threshold}

**Resolve YES** if followers >= ${request.threshold}
**Resolve NO** if followers < ${request.threshold}`;
      }
      return "Get current follower count and compare to criteria.";

    case "engagement_threshold":
      return `### Verification Guidance

**Search Strategy:**
1. Find the specific tweet using \`searchRecentTweets\`
2. Get full metrics with \`getTweetById\`
3. Check public_metrics (like_count, retweet_count, impression_count)

**Resolve YES** if engagement meets threshold.
**Resolve NO** if engagement below threshold.`;

    case "account_action":
      if (handles.length >= 2) {
        return `### Verification Guidance

**Search Strategy:**
1. \`searchRecentTweets\` with query: "from:${handles[0]} to:${handles[1]}"
2. Check for replies, quotes, or mentions
3. May also check following relationships

**Resolve YES** if the action occurred.
**Resolve NO** if the action did not occur.`;
      }
      return "Search for the specific account action.";

    case "tweet_count":
      if (handles.length > 0) {
        return `### Verification Guidance

**Search Strategy:**
1. \`getUserByUsername\` to get user ID for "${handles[0]}"
2. \`getUserTweets\` to get their recent timeline
3. Filter by keywords if provided: ${keywords.join(", ") || "N/A"}
4. Count matching tweets

**Resolve YES** if count meets threshold.
**Resolve NO** if count below threshold.`;
      }
      return "Count tweets matching the criteria.";

    case "general":
    default:
      return `### Verification Guidance

This is a general question. Use your judgment to:
1. Search for relevant tweets and users
2. Gather data from multiple sources
3. Make a determination based on evidence

Be thorough and cite your sources.`;
  }
}
