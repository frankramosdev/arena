/**
 * Personality Creator API
 * 
 * HTTP API for generating trading personalities from Twitter profiles.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { PersonalityCreatorAgent } from "../agent/index.js";
import { log } from "../utils/index.js";

const app = new Hono();

// Enable CORS
app.use("/*", cors());

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", service: "personality-creator" });
});

// =============================================================================
// CREATE PERSONALITY
// =============================================================================

interface CreatePersonalityRequest {
  username: string;
}

app.post("/create", async (c) => {
  try {
    const body = await c.req.json<CreatePersonalityRequest>();
    
    if (!body.username) {
      return c.json({ error: "username is required" }, 400);
    }

    const username = body.username.replace("@", "").toLowerCase();
    log.info(`API: Creating personality for @${username}`);

    const agent = new PersonalityCreatorAgent();
    const result = await agent.createPersonality(username);

    log.success(`API: Generated personality for @${username}`);
    
    return c.json({
      success: true,
      agent: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`API: Failed to create personality: ${message}`);
    
    return c.json({
      success: false,
      error: message,
    }, 500);
  }
});

// =============================================================================
// GET STATUS (for polling during generation)
// =============================================================================

// In-memory status tracking for active jobs
const activeJobs = new Map<string, {
  status: "pending" | "researching" | "generating" | "complete" | "failed";
  progress?: string;
  result?: unknown;
  error?: string;
  startedAt: number;
}>();

app.post("/create/async", async (c) => {
  try {
    const body = await c.req.json<CreatePersonalityRequest>();
    
    if (!body.username) {
      return c.json({ error: "username is required" }, 400);
    }

    const username = body.username.replace("@", "").toLowerCase();
    const jobId = `job_${username}_${Date.now()}`;

    // Initialize job
    activeJobs.set(jobId, {
      status: "pending",
      progress: "Starting research...",
      startedAt: Date.now(),
    });

    // Start async generation
    (async () => {
      try {
        activeJobs.set(jobId, {
          ...activeJobs.get(jobId)!,
          status: "researching",
          progress: "Fetching Twitter profile and tweets...",
        });

        const agent = new PersonalityCreatorAgent();
        
        activeJobs.set(jobId, {
          ...activeJobs.get(jobId)!,
          status: "generating",
          progress: "Analyzing personality with Grok...",
        });

        const result = await agent.createPersonality(username);

        activeJobs.set(jobId, {
          ...activeJobs.get(jobId)!,
          status: "complete",
          progress: "Done!",
          result,
        });

        log.success(`API: Async job ${jobId} complete`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        activeJobs.set(jobId, {
          ...activeJobs.get(jobId)!,
          status: "failed",
          error: message,
        });
        log.error(`API: Async job ${jobId} failed: ${message}`);
      }
    })();

    return c.json({
      jobId,
      status: "pending",
      message: `Started personality generation for @${username}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

app.get("/status/:jobId", (c) => {
  const jobId = c.req.param("jobId");
  const job = activeJobs.get(jobId);

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  // Clean up old completed jobs (after 5 minutes)
  if (job.status === "complete" || job.status === "failed") {
    if (Date.now() - job.startedAt > 5 * 60 * 1000) {
      activeJobs.delete(jobId);
    }
  }

  return c.json({
    jobId,
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.error,
  });
});

export default app;
