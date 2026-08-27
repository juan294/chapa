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
import { withTimeout } from "@/lib/async/with-timeout";
import { getUpstashRedisRestUrl, getUpstashRedisRestToken } from "@/lib/env";

// ---------------------------------------------------------------------------
// Lazy singleton
// ---------------------------------------------------------------------------

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;

  const url = getUpstashRedisRestUrl();
  const token = getUpstashRedisRestToken();

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

/**
 * Whether a Redis cache layer is configured (URL + token present).
 *
 * Distinguishes "no cache layer" from "cache write failed": when Redis is not
 * configured, cache writes are no-ops by design and reads fall back to the
 * durable store, so a failed `cacheSet` implies no store divergence. Callers
 * that reconcile durable-vs-cache writes use this to avoid false-positive
 * alerts on unconfigured deployments.
 */
export function isRedisConfigured(): boolean {
  return Boolean(getUpstashRedisRestUrl() && getUpstashRedisRestToken());
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
 * Atomically merge fields into a JSON object stored in Redis.
 *
 * The read, merge, and TTL refresh run in one Lua script, so concurrent
 * callers cannot overwrite fields written by another request between a
 * separate GET and SET. Returns false when Redis is unavailable or the
 * update fails.
 */
export async function cacheMergeJson<T extends object>(
  key: string,
  patch: Partial<T>,
  ttlSeconds: number,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const script = `
local raw = redis.call("GET", KEYS[1])
local value = {}
if raw then
  value = cjson.decode(raw)
end
local patch = cjson.decode(ARGV[1])
for field, field_value in pairs(patch) do
  value[field] = field_value
end
redis.call("SET", KEYS[1], cjson.encode(value), "EX", ARGV[2])
return 1
`;

  try {
    await redis.eval<[string, string], number>(
      script,
      [key],
      [JSON.stringify(patch), String(ttlSeconds)],
    );
    return true;
  } catch (error) {
    console.error("[cache] cacheMergeJson failed:", (error as Error).message);
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
// Bulk read: MGET
// ---------------------------------------------------------------------------

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

/** Result of a rate-limit check: whether the request is allowed plus current/max counts. */
export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
}

export interface QuotaReservationResult {
  allowed: boolean;
  current: number;
  limit: number;
}

/**
 * Atomically increment a fixed-window rate-limit counter and ensure it has
 * a TTL, in a single Redis round trip.
 *
 * **BE-M3 fix**: the previous implementation issued `INCR` then, only when
 * `current === 1`, a separate `EXPIRE` call. Those were two independent REST
 * round-trips (`retry: { retries: 0 }`) — if the `EXPIRE` failed or the
 * request was killed in between, the key was left with a counter and NO
 * TTL. Because the JS-level guard only ever retries `EXPIRE` when
 * `current === 1`, that state could never self-correct: the counter would
 * grow forever and the bucket would never reset (a permanent lockout on
 * fail-closed routes). This script checks the key's actual TTL server-side
 * on every call — if it's unset (`-1`), it sets it — so a stranded key
 * self-heals on the very next request instead of staying broken forever.
 * Doing this inside one atomic `EVAL` (rather than unconditionally calling
 * `EXPIRE` after every `INCR`, as `cacheIncr()` does) also preserves exact
 * fixed-window semantics: a client that keeps polling after tripping the
 * limit does not keep pushing the window's reset time out, and the
 * fail-open badge/profile/history routes don't pay for a second round trip
 * on every request.
 */
const RATE_LIMIT_INCR_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if redis.call("TTL", KEYS[1]) == -1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

async function incrRateLimitCounter(
  redis: Redis,
  key: string,
  windowSeconds: number,
): Promise<number> {
  return redis.eval<[string], number>(
    RATE_LIMIT_INCR_SCRIPT,
    [key],
    [String(windowSeconds)],
  );
}

/**
 * Check and increment a rate limit counter.
 * Uses an atomic Redis Lua script (INCR + self-healing TTL) for a
 * fixed-window counter — see `RATE_LIMIT_INCR_SCRIPT` for why.
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
    const current = await incrRateLimitCounter(redis, key, windowSeconds);
    return { allowed: current <= limit, current, limit };
  } catch {
    // Fail open — don't block requests if Redis is down
    return { allowed: true, current: 0, limit };
  }
}

/**
 * Check and increment a rate limit counter — **fail-closed** variant.
 *
 * Identical to `rateLimit()` in the happy path, but returns
 * `{ allowed: false }` when Redis is unavailable (missing credentials)
 * or throws an error. Use this on auth and write routes where losing
 * rate-limit enforcement during a Redis outage is unacceptable.
 *
 * **Public badge read routes must continue to use `rateLimit()` (fail-open)**
 * to preserve availability when Redis is temporarily down.
 *
 * @param key - Rate limit key (e.g. "ratelimit:callback:1.2.3.4")
 * @param limit - Maximum allowed requests in the window
 * @param windowSeconds - Window duration in seconds
 * @returns Whether the request is allowed, or `{ allowed: false }` if Redis is unavailable (fail-closed)
 */
export async function rateLimitStrict(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  // Fail-closed: if Redis is unconfigured, block the request
  if (!redis) return { allowed: false, current: 0, limit };

  try {
    const current = await incrRateLimitCounter(redis, key, windowSeconds);
    return { allowed: current <= limit, current, limit };
  } catch {
    // Fail closed — block requests if Redis is down on security-sensitive routes
    return { allowed: false, current: 0, limit };
  }
}

/**
 * Refund one unit of quota previously consumed by `rateLimitStrict()` (or
 * `rateLimit()`) — for use when the request that consumed it failed
 * downstream and shouldn't cost the caller one of a scarce number of
 * attempts. Decrements the same fixed-window counter via `INCRBY -1`,
 * leaving its TTL untouched.
 *
 * Deliberately **not** built on `cacheIncr()`: that helper is fail-open
 * (owned by the campaign-send-quota feature) and would silently drop a
 * refund on a Redis error. This is fail-closed like `rateLimitStrict()` —
 * it reports whether the refund actually landed so callers on fail-closed
 * routes can surface a dropped refund (e.g. via `captureServerError`)
 * instead of silently over-charging the user's quota.
 *
 * @param key - The same rate-limit key passed to `rateLimitStrict()`/`rateLimit()`
 * @returns Whether the refund was applied
 */
export async function refundRateLimit(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    await redis.incrby(key, -1);
    return true;
  } catch (error) {
    console.error("[cache] refundRateLimit failed:", (error as Error).message);
    return false;
  }
}

/**
 * Atomically reserve quota in Redis using a single pipeline for
 * read + increment + TTL refresh.
 *
 * Returns the post-reservation counter when allowed. If the reservation would
 * exceed the limit, the increment is immediately compensated and the previous
 * counter is returned. Redis failures are fail-open.
 */
export async function cacheReserveQuota(
  key: string,
  amount: number,
  limit: number,
  ttlSeconds: number,
): Promise<QuotaReservationResult> {
  const redis = getRedis();
  if (!redis || amount <= 0) {
    return { allowed: true, current: 0, limit };
  }

  try {
    const pipeline = redis.pipeline();
    pipeline.get<number>(key);
    pipeline.incrby(key, amount);
    pipeline.expire(key, ttlSeconds);

    const [beforeRaw, afterRaw] = await pipeline.exec<[number | null, number, number]>();
    const before = beforeRaw ?? 0;
    const after = typeof afterRaw === "number" ? afterRaw : before + amount;

    if (after > limit) {
      await redis.incrby(key, -amount);
      return { allowed: false, current: before, limit };
    }

    return { allowed: true, current: after, limit };
  } catch (error) {
    console.error("[cache] cacheReserveQuota failed:", (error as Error).message);
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
 * Check Redis health via a lightweight data-access operation.
 * Uses `dbsize()` instead of `ping()` to verify actual data access,
 * not just connectivity (satisfies CLAUDE.md health-check requirement).
 * - "ok" — Redis responded to DBSIZE.
 * - "error" — Redis client exists but DBSIZE failed.
 * - "skipped" — Redis client is null (missing env vars).
 */
export async function pingRedis(): Promise<"ok" | "error" | "skipped"> {
  const redis = getRedis();
  if (!redis) return "skipped";

  try {
    await withTimeout(redis.dbsize(), 5000, "pingRedis");
    return "ok";
  } catch {
    return "error";
  }
}

// ---------------------------------------------------------------------------
// Cron heartbeat helpers
// ---------------------------------------------------------------------------

/** Read the last successful completion timestamp for a cron route. */
export async function cacheGetCronLastRun(name: string): Promise<number | null> {
  const value = await cacheGet<number>(`cron:lastrun:${name}`);
  return typeof value === "number" ? value : null;
}

// ---------------------------------------------------------------------------
// Atomic set-if-not-exists (SETNX) — used for once-per-day guards
// ---------------------------------------------------------------------------

/** Outcome of a set-if-not-exists attempt: newly written, already existed, or Redis unavailable. */
export type CacheSetNxStatus = "acquired" | "exists" | "unavailable";

/**
 * Set a key with a TTL only if it does not already exist (Redis SET NX EX).
 *
 * Returns:
 * - `"acquired"` when the key was newly written
 * - `"exists"` when the key already existed
 * - `"unavailable"` when Redis is unavailable or throws
 */
export async function cacheSetNxStatus(
  key: string,
  ttlSeconds: number,
): Promise<CacheSetNxStatus> {
  const redis = getRedis();
  if (!redis) return "unavailable";

  try {
    const result = await redis.set(key, 1, { ex: ttlSeconds, nx: true });
    // Upstash returns "OK" when the key is newly set, null when it already existed.
    return result === "OK" ? "acquired" : "exists";
  } catch (error) {
    console.error("[cache] cacheSetNx failed:", (error as Error).message);
    return "unavailable";
  }
}

/**
 * Boolean wrapper for callers that only care whether the key was newly acquired.
 */
export async function cacheSetNx(key: string, ttlSeconds: number): Promise<boolean> {
  return (await cacheSetNxStatus(key, ttlSeconds)) === "acquired";
}

// ---------------------------------------------------------------------------
// Atomic increment (used for daily campaign send quota)
// ---------------------------------------------------------------------------

/**
 * Atomically increment a Redis counter by `amount`.
 *
 * When `ttlSeconds` is provided, `EXPIRE` is called unconditionally after
 * `INCRBY`. This is idempotent (refreshes the same TTL) and avoids a race
 * condition where concurrent callers could skip the expiry, leaving a key
 * that never expires.
 *
 * Returns the new counter value, or `0` if Redis is unavailable (fail-open).
 *
 * **Note:** Callers should treat a return value of `0` as "zero or unknown"
 * — it is indistinguishable from a genuine zero count when Redis is down.
 */
export async function cacheIncr(
  key: string,
  amount: number = 1,
  ttlSeconds?: number,
): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  try {
    const newVal = await redis.incrby(key, amount);
    // Always refresh TTL — idempotent and avoids race under concurrency
    if (ttlSeconds) {
      await redis.expire(key, ttlSeconds);
    }
    return newVal;
  } catch (error) {
    console.error("[cache] cacheIncr failed:", (error as Error).message);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Test helper — reset the cached client (only used by tests)
// ---------------------------------------------------------------------------

/** @internal — exported for tests only. Resets the lazy singleton. */
export function _resetClient(): void {
  _redis = undefined;
}
