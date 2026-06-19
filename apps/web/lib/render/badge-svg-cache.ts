/**
 * Shared full-response SVG cache for the badge — read by both the
 * `/u/[handle]/badge.svg` route and the share page (#720). Centralizing
 * the key format here ensures both paths point at the same Redis slot and
 * one cannot drift away from the other.
 */
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { CACHE_VERSION } from "@/lib/cache/version";
import { withTimeout } from "@/lib/async/with-timeout";

const CACHE_DEADLINE_MS = 250;

/**
 * Base TTL for badge SVG cache entries.
 *
 * The KEY format (`badge:{version}:{handle}:{date}`) uses today's UTC date, so
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
  return `badge:${CACHE_VERSION}:${handle.toLowerCase()}:warm-amber:${date}`;
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

/**
 * Write the rendered SVG to the badge cache.
 *
 * The TTL is base 24h + a per-handle jitter of up to 2h (PE-S1) to spread
 * UTC-midnight cache expiry across handles and avoid a recompute herd.
 * The cache KEY shape is unchanged — only the expiry differs per handle.
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
