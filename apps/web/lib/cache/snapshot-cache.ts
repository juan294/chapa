/**
 * Redis cache layer for the archived v7/v7.1 receipt store.
 *
 * #1335 phase 5 — the v6 `MetricsSnapshot` cache (getCachedLatestSnapshot,
 * updateSnapshotCache, invalidateSnapshotCache, buildSnapshotKey) is
 * retired along with `metrics_snapshots` itself.
 */

import { verifyScoreReceipt, sealScoreReceipt } from "@chapa/shared";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { cacheGet, cacheSet, cacheDel } from "./redis";
import { dbReceiptManifestV7, dbReadReceiptV7 } from "@/lib/db/snapshots";

const SNAPSHOT_TTL = 86400; // 24 hours

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
