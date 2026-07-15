/**
 * Reconciled snapshot write — a lightweight saga over the two stores a profile
 * snapshot lives in: the durable Supabase `metrics_snapshots` row and the Redis
 * latest-snapshot cache.
 *
 * True distributed transactions across Redis + Supabase are not feasible, so
 * this instead makes any *partial* failure within a single call observable:
 * when the durable write commits but the cache update fails, the two stores
 * diverge (Supabase has the fresh score, Redis serves a stale one until the
 * next warm-cache). That divergence is emitted as a structured operational
 * alert — via the existing `captureOperationalAlert` path
 * (CHAPA_ALERT_WEBHOOK_URL) — instead of being silently swallowed, so
 * operators can repair it (see issue #975).
 *
 * What this saga does NOT guarantee (#1015): it has no visibility across
 * separate calls. Multiple producers (badge route `after()`, warm-cache cron,
 * `/api/recalculate`, `/api/refresh`) can write the same handle+date
 * concurrently with no lock ordering between them — last-writer-wins at both
 * the Supabase and Redis layers. A cross-call race like that is not detected
 * or alerted on here; it is expected to self-heal at the next warm-cache pass
 * rather than being actively coordinated (accepted risk, not a bug).
 */

import { captureOperationalAlert } from "@/lib/analytics/server-errors";
import { isRedisConfigured } from "@/lib/cache/redis";
import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import {
  dbInsertSnapshot,
  dbReplaceSnapshot,
  type SnapshotInsertOutcome,
} from "@/lib/db/snapshots";
import type { MetricsSnapshot } from "@/lib/history/types";

export type SnapshotPersistenceMode = "insert" | "replace";

export interface SnapshotWriteResult {
  /** The durable Supabase write succeeded (row inserted, replaced, or a benign duplicate). */
  persisted: boolean;
  /** The Redis snapshot cache now reflects the durable write. */
  cacheUpdated: boolean;
  /**
   * Partial failure: the durable store committed a *fresh* write but the
   * cache did not, so the two stores have diverged and a reconciliation alert
   * has been emitted. The durable store is authoritative; reads heal at the
   * next warm-cache.
   */
  reconciliationRequired: boolean;
  /**
   * Tri-state detail of the durable write itself (#1015/#1016):
   * - "inserted": a fresh row was written this call (insert-mode new row, or
   *   any successful replace-mode write).
   * - "duplicate": insert-mode found an existing handle+date row and skipped
   *   (ON CONFLICT DO NOTHING) — benign, the durable store was already correct.
   * - "failed": the durable write did not happen at all.
   */
  writeOutcome: SnapshotInsertOutcome;
}

async function performDurableWrite(
  handle: string,
  snapshot: MetricsSnapshot,
  mode: SnapshotPersistenceMode,
): Promise<SnapshotInsertOutcome> {
  if (mode === "replace") {
    const ok = await dbReplaceSnapshot(handle, snapshot);
    // Replace mode always deliberately overwrites — there is no "duplicate"
    // concept, only success ("inserted") or failure.
    return ok ? "inserted" : "failed";
  }
  return dbInsertSnapshot(handle, snapshot);
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
  const writeOutcome = await performDurableWrite(handle, snapshot, options.mode);

  // Durable write genuinely failed: the db layer already logged, and the
  // cache was left untouched, so the two stores never diverged — nothing to
  // reconcile at this layer. (Callers that need failure escalation add it
  // themselves — see lib/profile/public-profile.ts persistProfileSnapshot,
  // #1009 — since only they have the route/status context to report it well,
  // and alerting here too would double-fire for every caller.)
  if (writeOutcome === "failed") {
    return {
      persisted: false,
      cacheUpdated: false,
      reconciliationRequired: false,
      writeOutcome,
    };
  }

  // #1015 — A benign duplicate still gets an opportunistic cache refresh: the
  // durable row is known-good (just not freshly written this call), so there's
  // no reason to leave the cache mirror untouched.
  const cacheUpdated = await updateSnapshotCache(handle, snapshot);
  if (cacheUpdated) {
    return { persisted: true, cacheUpdated: true, reconciliationRequired: false, writeOutcome };
  }

  // Cache write failed. If there is no Redis layer at all, reads fall back to
  // Supabase, so there is no stale-serve risk and nothing to reconcile.
  if (!isRedisConfigured()) {
    return { persisted: true, cacheUpdated: false, reconciliationRequired: false, writeOutcome };
  }

  // A "duplicate" outcome means the durable row already existed before this
  // call. If the cache is stale, either the original insert call already
  // alerted on this exact divergence, or Redis is persistently unavailable —
  // in which case every subsequent duplicate-mode hit for the same handle
  // would re-fire this alert and flood the webhook. Only a genuinely fresh
  // write ("inserted") escalates.
  if (writeOutcome === "duplicate") {
    return { persisted: true, cacheUpdated: false, reconciliationRequired: false, writeOutcome };
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

  return { persisted: true, cacheUpdated: false, reconciliationRequired: true, writeOutcome };
}
