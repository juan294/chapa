/**
 * Supabase data access — metrics_snapshots table.
 *
 * Replaces Redis `history:<handle>` sorted sets.
 * All operations fail-open (return sensible defaults when DB is unavailable).
 * Return types match the existing Redis-backed history API for drop-in compatibility.
 */

import type { MetricsSnapshot } from "@/lib/history/types";
import { getSupabase } from "./supabase";

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
    building: row.building,
    guarding: row.guarding,
    consistency: row.consistency,
    breadth: row.breadth,
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
    building: s.building,
    guarding: s.guarding,
    consistency: s.consistency,
    breadth: s.breadth,
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
 * Insert a snapshot. Uses ON CONFLICT DO NOTHING for date-based dedup.
 * Returns true if inserted, false if duplicate or on error.
 */
export async function dbInsertSnapshot(
  handle: string,
  snapshot: MetricsSnapshot,
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const { error, status } = await db
      .from("metrics_snapshots")
      .upsert(snapshotToRow(handle, snapshot), {
        onConflict: "handle,date",
        ignoreDuplicates: true,
      });

    if (error) throw error;
    // status 201 = inserted, 200 = duplicate (ignored)
    return status === 201;
  } catch (error) {
    console.error(
      "[db] dbInsertSnapshot failed:",
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

    return (data ?? []).map((row) => rowToSnapshot(row as unknown as SnapshotRow));
  } catch (error) {
    console.error("[db] dbGetSnapshots failed:", (error as Error).message);
    return [];
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

    return rowToSnapshot(data as unknown as SnapshotRow);
  } catch (error) {
    console.error(
      "[db] dbGetLatestSnapshot failed:",
      (error as Error).message,
    );
    return null;
  }
}

/**
 * Get the total number of snapshots for a user.
 * Returns 0 on error or when DB is unavailable.
 */
export async function dbGetSnapshotCount(handle: string): Promise<number> {
  const db = getSupabase();
  if (!db) return 0;

  try {
    const { count, error } = await db
      .from("metrics_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("handle", handle.toLowerCase());

    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    console.error(
      "[db] dbGetSnapshotCount failed:",
      (error as Error).message,
    );
    return 0;
  }
}
