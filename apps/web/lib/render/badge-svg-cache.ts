/**
 * Shared full-response SVG cache for the badge — read by both the
 * `/u/[handle]/badge.svg` route and the share page (#720). Centralizing
 * the key format here ensures both paths point at the same Redis slot and
 * one cannot drift away from the other.
 */
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { CACHE_VERSION } from "@/lib/cache/version";
import { TimeoutError, withTimeout } from "@/lib/async/with-timeout";

/**
 * #1014 — this deadline was previously 250ms, which under Redis tail latency
 * (e.g. launch-traffic spikes) regularly misclassified a genuine cache-hit as
 * a miss, forcing an unnecessary full materialize+render (up to the 3000ms
 * cache-miss SLO budget) instead of a fast cache-hit response. 500ms leaves
 * enough headroom below the 800ms cache-hit SLO for the network round-trip
 * and response construction that follow a successful read.
 */
const CACHE_DEADLINE_MS = 500;
export const BADGE_RENDER_VARIANT = "warm-amber-v2";

/**
 * Base TTL for badge SVG cache entries.
 *
 * The key format includes the render variant and today's UTC date, so
 * the key already encodes freshness. The TTL is set slightly longer than 24h so
 * the entry survives into the next day and can be served as a "stale" fallback
 * for lock-losers (PE-M2) before the new day's SVG is rendered.
 *
 * A per-handle jitter of up to 2 hours is added on top of this base to spread
 * UTC-midnight recompute load across handles (PE-S1). The key shape is NOT
 * changed — only the expiry differs between handles.
 */
const CACHE_TTL_BASE_SECONDS = 86_400; // 24h
const CACHE_TTL_JITTER_MAX_SECONDS = 7_200; // up to +2h jitter (PE-S1)

/**
 * Compute a stable per-handle jitter offset (0 to CACHE_TTL_JITTER_MAX_SECONDS).
 *
 * Uses a simple sum-of-char-codes hash so that different handles get different
 * effective cache expiry times, spreading the UTC-midnight recompute herd.
 * The algorithm is intentionally trivial — we only need stable distribution
 * across handles, not cryptographic strength.
 */
export function handleCacheJitterSeconds(handle: string): number {
  const lower = handle.toLowerCase();
  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = (hash * 31 + lower.charCodeAt(i)) >>> 0; // keep it 32-bit unsigned
  }
  return hash % (CACHE_TTL_JITTER_MAX_SECONDS + 1);
}

export function buildBadgeSvgCacheKey(handle: string, date: string): string {
  return `badge:${CACHE_VERSION}:${handle.toLowerCase()}:${BADGE_RENDER_VARIANT}:${date}`;
}

export function buildBadgeSvgRenderLockKey(handle: string, date: string): string {
  return buildBadgeSvgCacheKey(handle, date).replace(/^badge:/, "badge-lock:");
}

async function withCacheFallback<T>(
  promise: Promise<T>,
  fallback: T,
  label: string,
): Promise<T> {
  try {
    return await withTimeout(promise, CACHE_DEADLINE_MS, label);
  } catch {
    return fallback;
  }
}

export async function readBadgeSvgCache(key: string): Promise<string | null> {
  return withCacheFallback(
    cacheGet<string>(key),
    null,
    "badge cache read",
  );
}

export interface BadgeSvgCacheReadResult {
  /** The cached SVG, or null on a genuine miss, a Redis error, or a deadline timeout. */
  svg: string | null;
  /**
   * #1014 — true when the read did not resolve within CACHE_DEADLINE_MS. This
   * is NOT a genuine cache miss: the underlying Redis read may still complete
   * (with a hit) after we've already given up waiting on it. Callers that emit
   * Server-Timing metrics should surface this distinctly from a real miss so
   * the failure mode is observable instead of silently looking like normal
   * cache churn.
   */
  timedOut: boolean;
}

/**
 * Read the badge SVG cache and distinguish a deadline timeout from a genuine
 * miss or Redis error (#1014). Use this at the route's primary cache-hit check
 * so a timeout can be reported distinctly in Server-Timing; other call sites
 * that don't need this distinction can keep using {@link readBadgeSvgCache}.
 */
export async function readBadgeSvgCacheWithStatus(
  key: string,
): Promise<BadgeSvgCacheReadResult> {
  try {
    const svg = await withTimeout(
      cacheGet<string>(key),
      CACHE_DEADLINE_MS,
      "badge cache read",
    );
    return { svg, timedOut: false };
  } catch (err) {
    if (err instanceof TimeoutError) {
      return { svg: null, timedOut: true };
    }
    return { svg: null, timedOut: false };
  }
}

/**
 * Write the rendered SVG to the badge cache.
 *
 * The TTL is base 24h + a per-handle jitter of up to 2h (PE-S1) to spread
 * UTC-midnight cache expiry across handles and avoid a recompute herd.
 * The render variant is part of the key so a visual contract change can
 * invalidate old SVGs. Within one variant, only expiry differs per handle.
 *
 * @param key  - Cache key built by {@link buildBadgeSvgCacheKey}
 * @param svg  - Rendered SVG string
 * @param handle - The GitHub handle (used to derive the jitter offset)
 */
export async function writeBadgeSvgCache(
  key: string,
  svg: string,
  handle: string,
): Promise<boolean> {
  const ttl = CACHE_TTL_BASE_SECONDS + handleCacheJitterSeconds(handle);
  return withCacheFallback(
    cacheSet(key, svg, ttl),
    false,
    "badge cache write",
  );
}
