/**
 * Upstash Redis cache layer.
 *
 * All operations are wrapped in try/catch for graceful degradation:
 * if Redis is unreachable, reads return null and writes silently no-op.
 *
 * The client is lazily initialised on first use so that:
 *   1. Environment variables are read at runtime (not import time).
 *   2. The module is easily testable with vi.mock("@upstash/redis").
 */

import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Lazy singleton
// ---------------------------------------------------------------------------

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    console.warn(
      "[cache] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing — cache disabled",
    );
    _redis = null;
    return null;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a cached value by key.
 * Returns `null` on cache miss OR if Redis is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch (error) {
    console.error("[cache] cacheGet failed:", (error as Error).message);
    return null;
  }
}

/**
 * Set a cached value with TTL.
 * Defaults to 24 hours (86 400 seconds). Silently no-ops if Redis is unavailable.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = 86400,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    console.error("[cache] cacheSet failed:", (error as Error).message);
  }
}

/**
 * Delete a cached key.
 * Silently no-ops if Redis is unavailable.
 */
export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.error("[cache] cacheDel failed:", (error as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Ping Redis and return a health status string.
 * - "ok" — Redis responded to PING.
 * - "error" — Redis client exists but PING failed.
 * - "unavailable" — Redis client is null (missing env vars).
 */
export async function pingRedis(): Promise<"ok" | "error" | "unavailable"> {
  const redis = getRedis();
  if (!redis) return "unavailable";

  try {
    await redis.ping();
    return "ok";
  } catch {
    return "error";
  }
}

// ---------------------------------------------------------------------------
// Test helper — reset the cached client (only used by tests)
// ---------------------------------------------------------------------------

/** @internal — exported for tests only. Resets the lazy singleton. */
export function _resetClient(): void {
  _redis = undefined;
}
