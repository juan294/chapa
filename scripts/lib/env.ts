/**
 * Shared credential-loading/config helpers for the production-data-mutation
 * scripts (`delete-user.ts`, `heal-poisoned-stats.ts`).
 *
 * Extracted (#1100) because a safety fix applied to one script's env
 * bootstrap silently would not have applied to the other — the two blocks
 * were byte-identical duplicates with no shared module tying them together.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Load .env.local from repo root, only filling vars not already in env. */
export function loadEnvLocal(): void {
  try {
    const path = join(process.cwd(), ".env.local");
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // No .env.local — rely on already-exported env vars.
  }
}

export interface Config {
  redisUrl: string;
  redisToken: string;
  supaUrl: string;
  supaKey: string;
}

export function loadConfig(): Config {
  loadEnvLocal();
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const supaUrl = process.env.SUPABASE_URL?.trim();
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!redisUrl || !redisToken) {
    throw new Error(
      "Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.",
    );
  }
  if (!supaUrl || !supaKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { redisUrl, redisToken, supaUrl, supaKey };
}
