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

import { verifyScoreReceipt, sealScoreReceipt } from "@chapa/shared";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import type { MetricsSnapshot } from "@/lib/history/types";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { cacheGet, cacheSet, cacheDel } from "./redis";
import { dbGetLatestSnapshot, dbReceiptManifestV7, dbReadReceiptV7 } from "@/lib/db/snapshots";
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

/** V7 caches only immutable public receipt bytes. Consent and selected revision
 * are always read from authorized durable state before consulting Redis.
 * Opaque revision-only keys let S14 purge/sweep from content-free tombstones.
 * S14 must retain a retryable tombstone sweep for interrupted/failed cleanup;
 * this request path reports cleanup failure and never claims successful removal. */
export function buildReceiptSnapshotKeyV7(revisionId: string): string {
  return `snapshot:v7:receipt:${revisionId}`;
}
export async function getCachedReceiptSnapshotV7(owner: string, revisionId?: string): Promise<import("@/lib/history/snapshot").ReceiptSnapshotV7 | null> {
  const manifest = await dbReceiptManifestV7(owner, revisionId);
  if (!manifest) return null;
  const key = buildReceiptSnapshotKeyV7(manifest.revisionId);
  let envelope: import("@chapa/shared").HashedScoreReceipt | null = null;
  try {
    const cached = await cacheGet<import("@chapa/shared").HashedScoreReceipt>(key);
    if (cached) {
      const receipt = await verifyScoreReceipt(cached);
      if (receipt.revisionId === manifest.revisionId) envelope = await sealScoreReceipt(receipt);
    }
  } catch { /* Invalid/unavailable cache falls back to an authorized durable read. */ }
  if (!envelope) {
    const snapshot = await dbReadReceiptV7(owner, manifest.revisionId);
    if (!snapshot) { await removeReceiptCacheV7(key); return null; }
    envelope = snapshot.receipt;
    // Await the write so withdrawal invalidation can order against this request.
    try { await cacheSet(key, envelope, SNAPSHOT_TTL); } catch { /* Receipt remains durable. */ }
  }
  // Recheck after asynchronous cache operations; revoked/replaced selections cannot escape a delayed hit.
  let current: Awaited<ReturnType<typeof dbReceiptManifestV7>>;
  try { current = await dbReceiptManifestV7(owner, revisionId); }
  catch (error) { await removeReceiptCacheV7(key); throw error; }
  if (!current || current.revisionId !== envelope.receipt.revisionId) {
    await removeReceiptCacheV7(key);
    return null;
  }
  return buildReceiptSnapshotV7(envelope, current.trend);
}

export class ReceiptCacheCleanupError extends Error {
  readonly code = "receipt_cache_cleanup_failed";
  constructor() { super("Receipt cache cleanup failed; tombstone cleanup remains required"); }
}
/** Redis reports false on transport failure; neither false nor throws prove deletion. */
async function removeReceiptCacheV7(key: string): Promise<void> {
  let deleted: boolean;
  try { deleted = await cacheDel(key); } catch { throw new ReceiptCacheCleanupError(); }
  if (!deleted) throw new ReceiptCacheCleanupError();
}
