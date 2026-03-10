/**
 * User Storage Operations
 */

import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { User, UserRole } from "../types.js";
import type { UserRow } from "./schema.js";

export function createUser(
  db: Database.Database,
  input: { name: string; role?: UserRole; twitterHandle?: string }
): User {
  const now = new Date().toISOString();
  const userId = nanoid();
  const traderId = nanoid();
  const token = `sig_${nanoid(32)}`;
  const role = input.role || "user";

  // Create trader first (trading state)
  db.prepare(`
    INSERT INTO traders (id, balance, created_at)
    VALUES (?, 10000, ?)
  `).run(traderId, now);

  // Create user (auth + identity)
  db.prepare(`
    INSERT INTO users (id, name, role, token, trader_id, twitter_handle, created_at, last_active_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, input.name, role, token, traderId, input.twitterHandle || null, now, now);

  return getUser(db, userId)!;
}

export function getUser(db: Database.Database, id: string): User | undefined {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? rowToUser(row) : undefined;
}

export function getUserByToken(db: Database.Database, token: string): User | undefined {
  const row = db.prepare("SELECT * FROM users WHERE token = ?").get(token) as UserRow | undefined;
  if (!row) return undefined;

  // Update last active
  db.prepare("UPDATE users SET last_active_at = ? WHERE id = ?")
    .run(new Date().toISOString(), row.id);

  return rowToUser(row);
}

export function getUserByTraderId(db: Database.Database, traderId: string): User | undefined {
  const row = db.prepare("SELECT * FROM users WHERE trader_id = ?").get(traderId) as UserRow | undefined;
  return row ? rowToUser(row) : undefined;
}

export function getUserByTwitterHandle(db: Database.Database, handle: string): User | undefined {
  // Case-insensitive search for twitter handle
  const row = db.prepare("SELECT * FROM users WHERE LOWER(twitter_handle) = LOWER(?)").get(handle) as UserRow | undefined;
  return row ? rowToUser(row) : undefined;
}

export function listUsers(
  db: Database.Database,
  offset = 0,
  limit = 50
): { users: User[]; total: number } {
  const rows = db.prepare(`
    SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset) as UserRow[];
  const { count } = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };

  return {
    users: rows.map(r => rowToUser(r)),
    total: count,
  };
}

export function updateUser(db: Database.Database, user: User): void {
  db.prepare(`
    UPDATE users SET
      name = ?,
      role = ?,
      twitter_handle = ?,
      last_active_at = ?
    WHERE id = ?
  `).run(user.name, user.role, user.twitterHandle || null, new Date().toISOString(), user.id);
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role as UserRole,
    token: row.token,
    traderId: row.trader_id,
    twitterHandle: row.twitter_handle || undefined,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  };
}
