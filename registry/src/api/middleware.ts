/**
 * API Middleware
 */

import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import type { User } from "../types.js";
import { registry } from "./index.js";

// Extend Hono context to include user
declare module "hono" {
  interface ContextVariableMap {
    user: User;
  }
}

/**
 * Bearer token authentication middleware
 * 
 * Extracts token from Authorization header and validates against user database.
 * Sets `c.var.user` on successful auth.
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
  }
  
  const token = authHeader.slice(7); // Remove "Bearer "
  
  // Look up user by token
  const user = registry.getUserByToken(token);
  
  if (!user) {
    throw new HTTPException(401, { message: "Invalid token" });
  }
  
  // Set user in context
  c.set("user", user);
  
  await next();
}

/**
 * Admin-only middleware
 * Must be used after authMiddleware
 */
export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get("user");
  
  if (!user || user.role !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }
  
  await next();
}

/**
 * Agent-only middleware (admin or agent role)
 * Must be used after authMiddleware
 */
export async function agentMiddleware(c: Context, next: Next) {
  const user = c.get("user");
  
  if (!user || (user.role !== "admin" && user.role !== "agent")) {
    throw new HTTPException(403, { message: "Agent or admin access required" });
  }
  
  await next();
}
