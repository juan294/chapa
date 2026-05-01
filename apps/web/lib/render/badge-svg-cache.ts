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
const CACHE_TTL_SECONDS = 86_400; // 24h, matches the badge route

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

export async function writeBadgeSvgCache(
  key: string,
  svg: string,
): Promise<boolean> {
  return withCacheFallback(
    cacheSet(key, svg, CACHE_TTL_SECONDS),
    false,
    "badge cache write",
  );
}
