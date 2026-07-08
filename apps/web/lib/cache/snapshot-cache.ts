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
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { cacheGet, cacheSet, cacheDel } from "./redis";
import { dbGetLatestSnapshot } from "@/lib/db/snapshots";
import { CACHE_VERSION } from "./version";

const SNAPSHOT_TTL = 86400; // 24 hours

export function buildSnapshotKey(handle: string): string {
  return `snapshot:${CACHE_VERSION}:latest:${handle.toLowerCase()}`;
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
  const key = buildSnapshotKey(handle);

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
    fireAndForget(() => cacheSet(key, snapshot, SNAPSHOT_TTL), () => undefined);
  }

  return snapshot;
}

/**
 * Update the snapshot cache after recording a new snapshot.
 *
 * Call this after dbInsertSnapshot() succeeds to keep the cache fresh.
 * Never throws. Returns `true` if the cache now reflects the snapshot,
 * `false` if the write failed or Redis is unavailable — callers that
 * reconcile durable-vs-cache writes use this to detect divergence.
 */
export async function updateSnapshotCache(
  handle: string,
  snapshot: MetricsSnapshot,
): Promise<boolean> {
  const key = buildSnapshotKey(handle);
  return cacheSet(key, snapshot, SNAPSHOT_TTL);
}

/**
 * Delete the cached latest snapshot for a user.
 *
 * Call this after any action that changes the user's score mid-day
 * (insights upload, platform connect, recalculate) so the next
 * badge/share-page request fetches a fresh snapshot from DB.
 *
 * Fire-and-forget safe — silently no-ops on Redis failure.
 */
export async function invalidateSnapshotCache(
  handle: string,
): Promise<void> {
  const key = buildSnapshotKey(handle);
  try {
    await cacheDel(key);
  } catch {
    // Fire-and-forget — cache invalidation is non-critical
  }
}
