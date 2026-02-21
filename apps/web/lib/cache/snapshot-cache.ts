/**
 * Redis cache layer for latest MetricsSnapshot lookups.
 *
 * Wraps dbGetLatestSnapshot() with a Redis cache (24h TTL) to avoid
 * hitting Supabase on every badge/share-page request.
 *
 * Fail-open design: if Redis is unavailable, falls back to Supabase.
 * When a new snapshot is recorded, call updateSnapshotCache() to keep
 * the cache fresh.
 */

import type { MetricsSnapshot } from "@/lib/history/types";
import { cacheGet, cacheSet } from "./redis";
import { dbGetLatestSnapshot } from "@/lib/db/snapshots";

const SNAPSHOT_TTL = 86400; // 24 hours

function snapshotCacheKey(handle: string): string {
  return `snapshot:latest:${handle.toLowerCase()}`;
}

/**
 * Get the latest snapshot for a user, with Redis caching.
 *
 * - Cache hit: return from Redis (no DB call).
 * - Cache miss: fetch from Supabase, cache in Redis, return.
 * - Redis failure: fall back to Supabase directly.
 *
 * Returns null if no snapshot exists.
 */
export async function getCachedLatestSnapshot(
  handle: string,
): Promise<MetricsSnapshot | null> {
  const key = snapshotCacheKey(handle);

  // Try Redis first
  try {
    const cached = await cacheGet<MetricsSnapshot>(key);
    if (cached) return cached;
  } catch {
    // Redis failed — fall through to DB
  }

  // Cache miss or Redis error — fetch from Supabase
  const snapshot = await dbGetLatestSnapshot(handle);

  // Cache the result (only if we got data — don't cache nulls)
  if (snapshot) {
    // Fire-and-forget: don't block on cache write
    cacheSet(key, snapshot, SNAPSHOT_TTL).catch(() => {});
  }

  return snapshot;
}

/**
 * Update the snapshot cache after recording a new snapshot.
 *
 * Call this after dbInsertSnapshot() succeeds to keep the cache fresh.
 * Fire-and-forget safe — silently no-ops on Redis failure.
 */
export async function updateSnapshotCache(
  handle: string,
  snapshot: MetricsSnapshot,
): Promise<void> {
  const key = snapshotCacheKey(handle);
  try {
    await cacheSet(key, snapshot, SNAPSHOT_TTL);
  } catch {
    // Fire-and-forget — cache update is non-critical
  }
}
