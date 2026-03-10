/**
 * Personality Creator API Server
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { serve } from "@hono/node-server";
import app from "./index.js";
import { log } from "../utils/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../../../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const PORT = parseInt(process.env.PERSONALITY_CREATOR_PORT || "3400", 10);

log.info(`Starting Personality Creator API on port ${PORT}...`);

serve({
  fetch: app.fetch,
  port: PORT,
});

log.success(`Personality Creator API running at http://localhost:${PORT}`);
log.info("Endpoints:");
log.info("  POST /create         - Create personality (sync)");
log.info("  POST /create/async   - Create personality (async with polling)");
log.info("  GET  /status/:jobId  - Get async job status");
log.info("  GET  /health         - Health check");
