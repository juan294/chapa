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

  _redis = new Redis({ url, token, retry: { retries: 0, backoff: () => 0 } });
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
 * Set a cached value with optional TTL.
 * Defaults to 6 hours (21 600 seconds). Pass 0 for no expiry (persistent).
 * Returns `true` on success, `false` if Redis is unavailable or write fails.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = 21600,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    if (ttlSeconds > 0) {
      await redis.set(key, value, { ex: ttlSeconds });
    } else {
      await redis.set(key, value);
    }
    return true;
  } catch (error) {
    console.error("[cache] cacheSet failed:", (error as Error).message);
    return false;
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
// Bulk read: SCAN + MGET
// ---------------------------------------------------------------------------

/**
 * Scan Redis for keys matching a glob pattern.
 * Iterates SCAN until cursor returns to 0. Returns all matching keys.
 * Returns `[]` if Redis is unavailable or on error.
 */
export async function scanKeys(pattern: string): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];

  try {
    const keys: string[] = [];
    let cursor = 0;
    do {
      const [nextCursor, batch] = await redis.scan(cursor, {
        match: pattern,
        count: 100,
      });
      keys.push(...batch);
      cursor = typeof nextCursor === "string" ? parseInt(nextCursor, 10) : nextCursor;
    } while (cursor !== 0);
    return keys;
  } catch (error) {
    console.error("[cache] scanKeys failed:", (error as Error).message);
    return [];
  }
}

/**
 * Get multiple cached values by key in a single MGET call.
 * Returns an array of values (may include `null` for missing keys).
 * Returns `[]` if Redis is unavailable, on error, or when given no keys.
 */
export async function cacheMGet<T>(keys: string[]): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  const redis = getRedis();
  if (!redis) return [];

  try {
    const values = await redis.mget<(T | null)[]>(...keys);
    return values;
  } catch (error) {
    console.error("[cache] cacheMGet failed:", (error as Error).message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Rate limiting (sliding window counter via INCR + EXPIRE)
//
// DESIGN DECISION: Fail-open rate limiting
//
// When Redis is unavailable (connection error, timeout, missing credentials),
// the rate limiter allows all requests through (fail-open) rather than
// rejecting them (fail-closed). This is an intentional availability-first
// design choice:
//
//   - Chapa is a public badge service. Blocking all badge requests because
//     Redis is temporarily down would break every embedded badge across the
//     internet. Availability is more important than strict rate enforcement.
//
//   - Rate limiting is a secondary defense. The primary protection against
//     abuse is GitHub's own API rate limits (5,000/hr authenticated). Our
//     rate limiter adds a courtesy layer on top, not a critical gate.
//
//   - Redis outages are transient. Upstash has high availability, so
//     fail-open windows are expected to be short (seconds to minutes).
//
// Accepted risk: During a Redis outage, an attacker could bypass our rate
// limits. This is mitigated by GitHub's upstream limits and CDN-level
// caching (s-maxage=21600 on badge responses).
//
// See also: GitHub issue #300
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
}

/**
 * Check and increment a rate limit counter.
 * Uses Redis INCR + EXPIRE for a fixed-window counter.
 *
 * **Fail-open by design**: returns `{ allowed: true }` when Redis is
 * unavailable. See the design decision comment above for rationale.
 *
 * @param key - Rate limit key (e.g. "ratelimit:login:1.2.3.4")
 * @param limit - Maximum allowed requests in the window
 * @param windowSeconds - Window duration in seconds
 * @returns Whether the request is allowed, or allowed if Redis is unavailable (fail-open)
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return { allowed: true, current: 0, limit };

  try {
    const current = await redis.incr(key);
    // Set expiry only on first increment (when counter is 1)
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    return { allowed: current <= limit, current, limit };
  } catch {
    // Fail open — don't block requests if Redis is down
    return { allowed: true, current: 0, limit };
  }
}

// ---------------------------------------------------------------------------
// Badge generation tracking
// ---------------------------------------------------------------------------

const BADGES_TOTAL_KEY = "stats:badges_generated";
const BADGES_UNIQUE_KEY = "stats:unique_badges";

/**
 * Track a badge generation event (fire-and-forget).
 *
 * Increments the total badge counter and adds the handle to a HyperLogLog
 * for approximate unique developer count. Both operations are non-blocking
 * and fail silently if Redis is unavailable.
 */
export async function trackBadgeGenerated(handle: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await Promise.all([
      redis.incr(BADGES_TOTAL_KEY),
      redis.pfadd(BADGES_UNIQUE_KEY, handle.toLowerCase()),
    ]);
  } catch {
    // Fire-and-forget — badge tracking is non-critical
  }
}

export interface BadgeStats {
  total: number;
  unique: number;
}

/**
 * Retrieve badge generation stats.
 * Returns `{ total: 0, unique: 0 }` if Redis is unavailable or keys don't exist.
 */
export async function getBadgeStats(): Promise<BadgeStats> {
  const redis = getRedis();
  if (!redis) return { total: 0, unique: 0 };

  try {
    const [total, unique] = await Promise.all([
      redis.get<number>(BADGES_TOTAL_KEY),
      redis.pfcount(BADGES_UNIQUE_KEY),
    ]);
    return {
      total: total ?? 0,
      unique: unique ?? 0,
    };
  } catch {
    return { total: 0, unique: 0 };
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
