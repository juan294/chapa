/**
 * Reconciled snapshot write — a lightweight saga over the two stores a profile
 * snapshot lives in: the durable Supabase `metrics_snapshots` row and the Redis
 * latest-snapshot cache.
 *
 * True distributed transactions across Redis + Supabase are not feasible, so
 * this instead makes any *partial* failure observable: when the durable write
 * commits but the cache update fails, the two stores diverge (Supabase has the
 * fresh score, Redis serves a stale one until the next warm-cache). That
 * divergence is emitted as a structured operational alert — via the existing
 * `captureOperationalAlert` path (CHAPA_ALERT_WEBHOOK_URL) — instead of being
 * silently swallowed, so operators can repair it (see issue #975).
 */

import { captureOperationalAlert } from "@/lib/analytics/server-errors";
import { isRedisConfigured } from "@/lib/cache/redis";
import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { dbInsertSnapshot, dbReplaceSnapshot } from "@/lib/db/snapshots";
import type { MetricsSnapshot } from "@/lib/history/types";

export type SnapshotPersistenceMode = "insert" | "replace";

export interface SnapshotWriteResult {
  /** The durable Supabase write succeeded (row inserted or updated). */
  persisted: boolean;
  /** The Redis snapshot cache now reflects the durable write. */
  cacheUpdated: boolean;
  /**
   * Partial failure: the durable store committed but the cache did not, so the
   * two stores have diverged and a reconciliation alert has been emitted. The
   * durable store is authoritative; reads heal at the next warm-cache.
   */
  reconciliationRequired: boolean;
}

/**
 * Persist a snapshot to Supabase and mirror it into the Redis cache as one
 * envelope, surfacing any partial failure rather than swallowing it.
 */
export async function reconcileSnapshotWrite(
  handle: string,
  snapshot: MetricsSnapshot,
  options: { mode: SnapshotPersistenceMode },
): Promise<SnapshotWriteResult> {
  const persisted =
    options.mode === "replace"
      ? await dbReplaceSnapshot(handle, snapshot)
      : await dbInsertSnapshot(handle, snapshot);

  // Durable write failed: the db layer already logged, and the cache was left
  // untouched, so the two stores never diverged — nothing to reconcile.
  if (!persisted) {
    return { persisted: false, cacheUpdated: false, reconciliationRequired: false };
  }

  const cacheUpdated = await updateSnapshotCache(handle, snapshot);
  if (cacheUpdated) {
    return { persisted: true, cacheUpdated: true, reconciliationRequired: false };
  }

  // Cache write failed. If there is no Redis layer at all, reads fall back to
  // Supabase, so there is no stale-serve risk and nothing to reconcile.
  if (!isRedisConfigured()) {
    return { persisted: true, cacheUpdated: false, reconciliationRequired: false };
  }

  // Genuine divergence: Supabase committed the fresh snapshot but the live
  // Redis cache still holds the previous one. Emit a structured signal so
  // operators can repair instead of the inconsistency being silent.
  await captureOperationalAlert({
    signal: "profile_snapshot_write_reconciliation",
    severity: "P2",
    summary:
      "Profile snapshot committed to Supabase but the Redis cache update failed — stores diverged",
    route: "lib/profile/snapshot-write",
    properties: {
      handle,
      mode: options.mode,
      date: snapshot.date,
      durableWrite: "ok",
      cacheWrite: "failed",
    },
  });

  return { persisted: true, cacheUpdated: false, reconciliationRequired: true };
}
