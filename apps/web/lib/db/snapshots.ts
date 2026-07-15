/**
 * Supabase data access — metrics_snapshots table.
 *
 * Replaces Redis `history:<handle>` sorted sets.
 * All operations fail-open (return sensible defaults when DB is unavailable).
 * Return types match the existing Redis-backed history API for drop-in compatibility.
 */

import type { MetricsSnapshot } from "@/lib/history/types";
import { getSupabase } from "./supabase";
import { parseRow, parseRows } from "./parse-row";

/** Snapshots older than this are eligible for cleanup. */
export const SNAPSHOT_RETENTION_DAYS = 365;

/** Max rows deleted per cleanup run to avoid locking the table. */
export const SNAPSHOT_CLEANUP_BATCH_SIZE = 1000;

// ---------------------------------------------------------------------------
// Row ↔ Type mapping
// ---------------------------------------------------------------------------

interface SnapshotRow {
  date: string;
  captured_at: string;
  commits_total: number;
  prs_merged_count: number;
  prs_merged_weight: number;
  reviews_submitted: number;
  issues_closed: number;
  repos_contributed: number;
  active_days: number;
  lines_added: number;
  lines_deleted: number;
  total_stars: number;
  total_forks: number;
  total_watchers: number;
  top_repo_share: number;
  max_commits_in_10min: number | null;
  micro_commit_ratio: number | null;
  docs_only_pr_ratio: number | null;
  building: number;
  guarding: number;
  consistency: number;
  breadth: number;
  craft: number | null;
  archetype: string;
  profile_type: string;
  composite_score: number;
  adjusted_composite: number;
  confidence: number;
  tier: string;
  confidence_penalties: Array<{ flag: string; penalty: number }> | null;
}

function rowToSnapshot(row: SnapshotRow): MetricsSnapshot {
  return {
    date: row.date,
    capturedAt: row.captured_at,
    commitsTotal: row.commits_total,
    prsMergedCount: row.prs_merged_count,
    prsMergedWeight: row.prs_merged_weight,
    reviewsSubmittedCount: row.reviews_submitted,
    issuesClosedCount: row.issues_closed,
    reposContributed: row.repos_contributed,
    activeDays: row.active_days,
    linesAdded: row.lines_added,
    linesDeleted: row.lines_deleted,
    totalStars: row.total_stars,
    totalForks: row.total_forks,
    totalWatchers: row.total_watchers,
    topRepoShare: row.top_repo_share,
    // Design decision: default to 0, not undefined. maxCommitsIn10Min is
    // required (not optional) in MetricsSnapshot. Impact scoring expects a
    // number — undefined would cause NaN in burst-commit penalty calculations.
    // The DB column is nullable only for rows inserted before this field existed.
    maxCommitsIn10Min: row.max_commits_in_10min ?? 0,
    ...(row.micro_commit_ratio != null && {
      microCommitRatio: row.micro_commit_ratio,
    }),
    ...(row.docs_only_pr_ratio != null && {
      docsOnlyPrRatio: row.docs_only_pr_ratio,
    }),
    delivery: row.building,
    quality: row.guarding,
    consistency: row.consistency,
    breadth: row.breadth,
    ...(row.craft != null && { craft: row.craft }),
    archetype: row.archetype as MetricsSnapshot["archetype"],
    profileType: row.profile_type as MetricsSnapshot["profileType"],
    compositeScore: row.composite_score,
    adjustedComposite: row.adjusted_composite,
    confidence: row.confidence,
    tier: row.tier as MetricsSnapshot["tier"],
    ...(row.confidence_penalties && row.confidence_penalties.length > 0
      ? {
          confidencePenalties: row.confidence_penalties as MetricsSnapshot["confidencePenalties"],
        }
      : {}),
  };
}

function snapshotToRow(
  handle: string,
  s: MetricsSnapshot,
): Record<string, unknown> {
  // NOT-NULL numeric columns below are forwarded WITHOUT a `?? 0` default on
  // purpose (detect, don't mask). MetricsSnapshot types these as required
  // numbers, so `undefined` should never occur; if it ever does at runtime, we
  // want the resulting Postgres 23502 (not_null_violation) to surface rather
  // than silently persisting a fabricated 0 that would corrupt the score. The
  // failure is made observable, not swallowed: dbReplaceSnapshot returns
  // `data !== null` and the caller reports `persisted: false` + captures the
  // error. Only genuinely-nullable columns get `?? null` (see below).
  return {
    handle: handle.toLowerCase(),
    date: s.date,
    captured_at: s.capturedAt,
    commits_total: s.commitsTotal,
    prs_merged_count: s.prsMergedCount,
    prs_merged_weight: s.prsMergedWeight,
    reviews_submitted: s.reviewsSubmittedCount,
    issues_closed: s.issuesClosedCount,
    repos_contributed: s.reposContributed,
    active_days: s.activeDays,
    lines_added: s.linesAdded,
    lines_deleted: s.linesDeleted,
    total_stars: s.totalStars,
    total_forks: s.totalForks,
    total_watchers: s.totalWatchers,
    top_repo_share: s.topRepoShare,
    max_commits_in_10min: s.maxCommitsIn10Min,
    micro_commit_ratio: s.microCommitRatio ?? null,
    docs_only_pr_ratio: s.docsOnlyPrRatio ?? null,
    building: s.delivery,
    guarding: s.quality,
    consistency: s.consistency,
    breadth: s.breadth,
    craft: s.craft ?? null,
    archetype: s.archetype,
    profile_type: s.profileType,
    composite_score: s.compositeScore,
    adjusted_composite: s.adjustedComposite,
    confidence: s.confidence,
    tier: s.tier,
    confidence_penalties:
      s.confidencePenalties && s.confidencePenalties.length > 0
        ? s.confidencePenalties
        : null,
  };
}

function snapshotToInsertRow(
  handle: string,
  s: MetricsSnapshot,
): Record<string, unknown> {
  const { captured_at, ...row } = snapshotToRow(handle, s);
  void captured_at;
  return row;
}

/** Keys required on every SnapshotRow — used by parseRow for runtime validation. */
const SNAPSHOT_REQUIRED_KEYS: readonly (keyof SnapshotRow)[] = [
  "date",
  "captured_at",
  "commits_total",
  "prs_merged_count",
  "prs_merged_weight",
  "reviews_submitted",
  "issues_closed",
  "repos_contributed",
  "active_days",
  "lines_added",
  "lines_deleted",
  "total_stars",
  "total_forks",
  "total_watchers",
  "top_repo_share",
  "building",
  "guarding",
  "consistency",
  "breadth",
  "archetype",
  "profile_type",
  "composite_score",
  "adjusted_composite",
  "confidence",
  "tier",
] as const;

// Select clause for all snapshot columns (excludes id and handle)
const SNAPSHOT_COLUMNS = [
  "date",
  "captured_at",
  "commits_total",
  "prs_merged_count",
  "prs_merged_weight",
  "reviews_submitted",
  "issues_closed",
  "repos_contributed",
  "active_days",
  "lines_added",
  "lines_deleted",
  "total_stars",
  "total_forks",
  "total_watchers",
  "top_repo_share",
  "max_commits_in_10min",
  "micro_commit_ratio",
  "docs_only_pr_ratio",
  "building",
  "guarding",
  "consistency",
  "breadth",
  "craft",
  "archetype",
  "profile_type",
  "composite_score",
  "adjusted_composite",
  "confidence",
  "tier",
  "confidence_penalties",
].join(", ");

// ---------------------------------------------------------------------------
// Public API — matches existing history.ts signatures
// ---------------------------------------------------------------------------

/**
 * Tri-state outcome of a `dbInsertSnapshot` call (#1015/#1016):
 * - "inserted": a new row was written this call.
 * - "duplicate": the handle+date row already existed — ON CONFLICT DO NOTHING
 *   silently ignored the write. Benign, not a failure.
 * - "failed": the write did not happen (DB unavailable or a genuine error).
 */
export type SnapshotInsertOutcome = "inserted" | "duplicate" | "failed";

/**
 * Insert a snapshot. Uses ON CONFLICT DO NOTHING for date-based dedup.
 *
 * Detects insert vs. duplicate via row presence in the `.select("id")`
 * response, NOT the HTTP status code (#1016) — status 201 vs. 200 is an
 * undocumented PostgREST/supabase-js implementation detail that could change
 * silently on a dependency upgrade. This mirrors `dbReplaceSnapshot`'s
 * existing presence-based detection below.
 */
export async function dbInsertSnapshot(
  handle: string,
  snapshot: MetricsSnapshot,
): Promise<SnapshotInsertOutcome> {
  const db = getSupabase();
  if (!db) return "failed";

  try {
    const { data, error } = await db
      .from("metrics_snapshots")
      .upsert(snapshotToInsertRow(handle, snapshot), {
        onConflict: "handle,date",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) throw error;
    return data && data.length > 0 ? "inserted" : "duplicate";
  } catch (error) {
    console.error(
      "[db] dbInsertSnapshot failed:",
      (error as Error).message,
    );
    return "failed";
  }
}

/**
 * Replace today's snapshot for a user. Uses ON CONFLICT DO UPDATE
 * instead of DO NOTHING — overwrites all columns if a same-day row exists.
 *
 * Use this for deliberate user actions (insights upload, recalculate)
 * where the score has legitimately changed mid-day and the new snapshot
 * should be the reference for EMA smoothing.
 *
 * Returns true if the row was written (inserted or updated), false on error.
 */
export async function dbReplaceSnapshot(
  handle: string,
  snapshot: MetricsSnapshot,
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const row = snapshotToRow(handle, snapshot);
    const { data, error } = await db
      .from("metrics_snapshots")
      .upsert(row, {
        onConflict: "handle,date",
      })
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return data !== null;
  } catch (error) {
    console.error(
      "[db] dbReplaceSnapshot failed:",
      (error as Error).message,
    );
    return false;
  }
}

/**
 * Get snapshots for a user, optionally filtered by date range.
 * Ordered by date ascending (oldest first) — matches Redis ZRANGE behavior.
 */
export async function dbGetSnapshots(
  handle: string,
  from?: string,
  to?: string,
): Promise<MetricsSnapshot[]> {
  const db = getSupabase();
  if (!db) return [];

  try {
    let query = db
      .from("metrics_snapshots")
      .select(SNAPSHOT_COLUMNS)
      .eq("handle", handle.toLowerCase())
      .order("date", { ascending: true });

    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);

    const { data, error } = await query;
    if (error) throw error;

    return parseRows<SnapshotRow>(data, SNAPSHOT_REQUIRED_KEYS, "metrics_snapshots").map(rowToSnapshot);
  } catch (error) {
    console.error("[db] dbGetSnapshots failed:", (error as Error).message);
    return [];
  }
}

/**
 * Get the latest snapshot for each handle in a single query.
 * Returns a Map keyed by lowercase handle. Handles with no snapshots
 * are simply absent from the Map. Short-circuits on empty input.
 */
export async function dbGetLatestSnapshotBatch(
  handles: string[],
): Promise<Map<string, MetricsSnapshot>> {
  if (handles.length === 0) return new Map();

  const db = getSupabase();
  if (!db) return new Map();

  const lowered = handles.map((h) => h.toLowerCase());

  try {
    const { data, error } = await db
      .from("metrics_snapshots")
      .select(`handle, ${SNAPSHOT_COLUMNS}`)
      .in("handle", lowered)
      .order("handle", { ascending: true })
      .order("date", { ascending: false });

    if (error) throw error;

    const rows = parseRows<SnapshotRow & { handle: string }>(
      data,
      SNAPSHOT_REQUIRED_KEYS,
      "metrics_snapshots",
    );

    // Deduplicate: keep first row per handle (latest date due to ordering)
    const map = new Map<string, MetricsSnapshot>();
    for (const row of rows) {
      const key = row.handle.toLowerCase();
      if (!map.has(key)) {
        map.set(key, rowToSnapshot(row));
      }
    }

    return map;
  } catch (error) {
    console.error(
      "[db] dbGetLatestSnapshotBatch failed:",
      (error as Error).message,
    );
    return new Map();
  }
}

/**
 * Get the most recent snapshot for a user.
 * Returns null if no snapshots exist or on error.
 */
export async function dbGetLatestSnapshot(
  handle: string,
): Promise<MetricsSnapshot | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("metrics_snapshots")
      .select(SNAPSHOT_COLUMNS)
      .eq("handle", handle.toLowerCase())
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = parseRow<SnapshotRow>(data, SNAPSHOT_REQUIRED_KEYS, "metrics_snapshots");
    if (!row) return null;

    return rowToSnapshot(row);
  } catch (error) {
    console.error(
      "[db] dbGetLatestSnapshot failed:",
      (error as Error).message,
    );
    return null;
  }
}

/**
 * Maximum batch-delete iterations per `dbCleanOldSnapshots()` call. Bounds
 * worst-case runtime (a batch a day keeping pace with retention growth) while
 * still letting the cleanup catch up past a single SNAPSHOT_CLEANUP_BATCH_SIZE
 * batch when eligible rows accumulate.
 */
export const SNAPSHOT_CLEANUP_MAX_ITERATIONS = 20;

/**
 * Delete snapshots older than SNAPSHOT_RETENTION_DAYS (batched to avoid table locks).
 * Loops until a batch deletes fewer than SNAPSHOT_CLEANUP_BATCH_SIZE rows (caught up)
 * or SNAPSHOT_CLEANUP_MAX_ITERATIONS is reached (safety cap on worst-case runtime).
 * Intended to be called from cron (warm-cache).
 * Returns the total number of deleted rows, or 0 on error.
 */
export async function dbCleanOldSnapshots(): Promise<number> {
  const db = getSupabase();
  if (!db) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SNAPSHOT_RETENTION_DAYS);

  let totalDeleted = 0;

  try {
    for (let i = 0; i < SNAPSHOT_CLEANUP_MAX_ITERATIONS; i++) {
      const { data, error } = await db
        .from("metrics_snapshots")
        .delete()
        .lt("captured_at", cutoff.toISOString())
        .limit(SNAPSHOT_CLEANUP_BATCH_SIZE)
        .select("id");

      if (error) throw error;
      const deletedCount = data?.length ?? 0;
      totalDeleted += deletedCount;

      if (deletedCount < SNAPSHOT_CLEANUP_BATCH_SIZE) break;
    }
    return totalDeleted;
  } catch (error) {
    console.error(
      "[db] dbCleanOldSnapshots failed:",
      (error as Error).message,
    );
    return totalDeleted;
  }
}
