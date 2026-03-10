/**
 * Resolution API Server
 * 
 * Exposes endpoints for early resolution requests.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

import { ResolutionAgent } from "../agent/index.js";
import { EarlyResolutionRequestSchema, CustomResolutionRequestSchema } from "../types/index.js";
import { CONFIG } from "../config/index.js";
import { log } from "../utils/index.js";

export function createApiServer(agent: ResolutionAgent) {
  const app = new Hono();

  // Middleware
  app.use("*", cors());

  // Health check
  app.get("/health", (c) => {
    return c.json({ status: "ok", service: "resolution-agent" });
  });

  // Get resolution stats
  app.get("/stats", async (c) => {
    return c.json({
      status: "running",
      checkIntervalMs: CONFIG.resolution.checkIntervalMs,
      monitorHoursAhead: CONFIG.resolution.monitorHoursAhead,
    });
  });

  // Request early resolution
  app.post("/resolve", async (c) => {
    try {
      const body = await c.req.json();
      
      const parseResult = EarlyResolutionRequestSchema.safeParse(body);
      if (!parseResult.success) {
        return c.json({ error: "Invalid request", details: parseResult.error.errors }, 400);
      }

      const { marketId, reason, evidence } = parseResult.data;

      log.info(`API: Early resolution request for ${marketId}`);

      const result = await agent.requestEarlyResolution(marketId, reason);

      if (!result) {
        return c.json({ error: "Market not found or not eligible for resolution" }, 404);
      }

      return c.json({
        success: true,
        marketId: result.marketId,
        outcome: result.outcome,
        evidence: result.evidence,
        resolvedAt: result.resolvedAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`API error: ${msg}`);
      return c.json({ error: msg }, 500);
    }
  });

  // Trigger immediate resolution cycle
  app.post("/cycle", async (c) => {
    try {
      log.info("API: Manual resolution cycle triggered");
      const stats = await agent.runResolutionCycle();
      return c.json({
        success: true,
        ...stats,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`API error: ${msg}`);
      return c.json({ error: msg }, 500);
    }
  });

  // Custom resolution (ad-hoc testing)
  app.post("/custom", async (c) => {
    try {
      const body = await c.req.json();

      const parseResult = CustomResolutionRequestSchema.safeParse(body);
      if (!parseResult.success) {
        return c.json({ error: "Invalid request", details: parseResult.error.errors }, 400);
      }

      log.info(`API: Custom resolution request: "${parseResult.data.question.slice(0, 50)}..."`);

      const result = await agent.resolveCustom(parseResult.data);

      return c.json({
        success: true,
        ...result,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`API error: ${msg}`);
      return c.json({ error: msg }, 500);
    }
  });

  return app;
}

export function startApiServer(agent: ResolutionAgent, port: number = CONFIG.api.port): void {
  const app = createApiServer(agent);

  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    log.info(`API server running on http://localhost:${info.port}`);
    log.info("Endpoints:");
    log.info("  GET  /health       - Health check");
    log.info("  GET  /stats        - Get agent stats");
    log.info("  POST /resolve      - Request early resolution");
    log.info("  POST /cycle        - Trigger resolution cycle");
    log.info("  POST /custom       - Custom resolution (ad-hoc testing)");
  });
}
