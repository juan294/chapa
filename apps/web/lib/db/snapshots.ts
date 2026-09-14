/**
 * Supabase data access — metrics_snapshots table.
 *
 * Replaces Redis `history:<handle>` sorted sets.
 * All operations fail-open (return sensible defaults when DB is unavailable).
 * Return types match the existing Redis-backed history API for drop-in compatibility.
 */

import { canonicalJson, sealScoreReceipt, verifyScoreReceipt } from "@chapa/shared";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
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
  headline_score: number | null;
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
    ...(typeof row.headline_score === "number" && { headlineScore: row.headline_score }),
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
    headline_score: s.headlineScore ?? null,
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
  "headline_score",
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
 * Handles with a recent standing, best first, whatever their row records.
 *
 * Ranking hint only: the smoothed composite it orders by is NOT publishable
 * (see dbGetTopScoredProfiles), so this returns handles, never scores. The
 * caller materializes each one to read the badge's own number.
 */
export async function dbGetScoredCandidates(
  eligibleHandles: string[],
  limit: number,
  today = new Date(),
): Promise<string[]> {
  const db = getSupabase();
  if (!db || limit <= 0) return [];

  const eligible = [...new Set(eligibleHandles.map((handle) => handle.toLowerCase()).filter(Boolean))];
  if (eligible.length === 0) return [];

  const since = new Date(today.getTime() - TOP_SCORE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

  try {
    const { data, error } = await db
      .from("metrics_snapshots")
      .select("handle, date, adjusted_composite")
      .in("handle", eligible)
      .gte("date", since)
      .order("date", { ascending: false })
      .limit(TOP_SCORE_SCAN_LIMIT);

    if (error) throw error;

    const latest = new Map<string, number>();
    for (const row of Array.isArray(data) ? data : []) {
      const { handle, adjusted_composite: score } = row as { handle?: unknown; adjusted_composite?: unknown };
      if (typeof handle !== "string" || !handle.trim()) continue;
      if (typeof score !== "number" || !Number.isFinite(score)) continue;
      const key = handle.toLowerCase();
      if (latest.has(key)) continue;
      latest.set(key, score);
    }

    return [...latest.entries()]
      .sort(([handleA, scoreA], [handleB, scoreB]) => scoreB - scoreA || handleA.localeCompare(handleB))
      .slice(0, limit)
      .map(([handle]) => handle);
  } catch (error) {
    console.error("[db] dbGetScoredCandidates failed:", (error as Error).message);
    return [];
  }
}

/** One entry of the landing page's top-score strip. */
export interface TopScoredProfile {
  handle: string;
  score: number;
  tier: string;
  /** Assigned by the leaderboard, which is the only place that knows the full
   * ordering; a row on its own has no place. */
  rank: number;
}

/** How far back a snapshot still counts as a current standing. A handle that
 * stopped being scored drops out rather than holding a podium spot forever. */
const TOP_SCORE_WINDOW_DAYS = 30;
/** Row ceiling for the scan below: bounded work, and enough rows to cover the
 * window at one snapshot per handle per day. */
const TOP_SCORE_SCAN_LIMIT = 2000;

/**
 * The highest current scores among `eligibleHandles`, best first.
 *
 * "Current" means each handle's most recent snapshot inside
 * TOP_SCORE_WINDOW_DAYS, not its best ever: this is a standing, so a score a
 * handle no longer holds must not keep it on the podium.
 *
 * `eligibleHandles` is required and never widened here. A snapshot exists for
 * any handle whose badge was ever rendered, including developers who never
 * signed up (someone embedding a stranger's badge in a README is enough), and
 * putting those people on a public podium promotes them without their
 * involvement. The caller passes the registered handles, and an empty list
 * means an empty board.
 */
export async function dbGetTopScoredProfiles(
  eligibleHandles: string[],
  limit = 3,
  today = new Date(),
): Promise<TopScoredProfile[]> {
  const db = getSupabase();
  if (!db || limit <= 0) return [];

  const eligible = [...new Set(eligibleHandles.map((handle) => handle.toLowerCase()).filter(Boolean))];
  if (eligible.length === 0) return [];

  const since = new Date(today.getTime() - TOP_SCORE_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  try {
    const { data, error } = await db
      .from("metrics_snapshots")
      .select("handle, date, headline_score, tier")
      .in("handle", eligible)
      // Only rows that recorded the badge's own number. A row written before
      // migration 047 cannot say what its headline was, and the smoothed
      // composite is a different number — publishing it would contradict the
      // badge the row links to, so the handle waits for its next capture
      // instead. `pnpm run recalculate-handles <handle> --apply` fills one in.
      .not("headline_score", "is", null)
      .gte("date", since)
      .order("date", { ascending: false })
      .limit(TOP_SCORE_SCAN_LIMIT);

    if (error) throw error;

    const latest = new Map<string, TopScoredProfile>();
    for (const row of Array.isArray(data) ? data : []) {
      const { handle, headline_score: score, tier } = row as {
        handle?: unknown; headline_score?: unknown; tier?: unknown;
      };
      if (typeof handle !== "string" || !handle.trim()) continue;
      // The badge's number, or nothing at all. The smoothed composite is a
      // different number and must never stand in for it.
      if (typeof score !== "number" || !Number.isFinite(score)) continue;
      const key = handle.toLowerCase();
      // Rows arrive newest first, so the first row per handle is its standing.
      if (latest.has(key)) continue;
      latest.set(key, { handle: key, score, tier: typeof tier === "string" ? tier : "", rank: 0 });
    }

    return [...latest.values()]
      .sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle))
      .slice(0, limit);
  } catch (error) {
    console.error("[db] dbGetTopScoredProfiles failed:", (error as Error).message);
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

// V7 APIs are additive: legacy metrics/history callers retain their original semantics.
export class ReceiptHistoryError extends Error {
  constructor(readonly code: string) { super("Receipt history operation failed"); }
}
async function receiptRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const db = getSupabase();
  if (!db) throw new ReceiptHistoryError("unavailable");
  const { data, error } = await db.rpc(name, args);
  if (error) throw new ReceiptHistoryError(error.code);
  return data;
}
interface StoredTrendRow {
  policy_version: "v7";
  date: string;
  receipt_id: string;
  raw_value: number;
  value: number;
  previous_receipt_id: string | null;
}
export interface ReceiptManifestV7 {
  readonly revisionId: string;
  readonly policyVersion: "v7";
  readonly trend: import("@chapa/shared").TrendAnchor | null;
}
function receiptManifest(value: unknown): ReceiptManifestV7 {
  if (!value || typeof value !== "object") throw new ReceiptHistoryError("contract");
  const row = value as Record<string, unknown>;
  if (typeof row.revisionId !== "string" || row.policyVersion !== "v7") throw new ReceiptHistoryError("contract");
  let trend: import("@chapa/shared").TrendAnchor | null = null;
  if (row.trend !== null) {
    const t = row.trend as StoredTrendRow;
    if (!t || t.policy_version !== "v7" || t.receipt_id !== row.revisionId || typeof t.date !== "string" || !Number.isFinite(t.value) || t.value < 0 || t.value > 100 || !Number.isFinite(t.raw_value) || t.raw_value < 0 || t.raw_value > 100 || (t.previous_receipt_id !== null && typeof t.previous_receipt_id !== "string")) throw new ReceiptHistoryError("contract");
    trend = { policyVersion: t.policy_version, referenceDate: t.date, receiptRevisionId: t.receipt_id, rawPoint: t.raw_value, unroundedValue: t.value, previousAnchorRevisionId: t.previous_receipt_id };
  }
  return { revisionId: row.revisionId, policyVersion: row.policyVersion, trend };
}
/** Every public read checks present consent through the service-only manifest RPC. */
export async function dbReceiptManifestV7(owner: string, revisionId?: string): Promise<ReceiptManifestV7 | null> {
  const value = await receiptRpc("scoring_v7_receipt_manifest", { p_owner: owner.toLowerCase(), p_revision: revisionId ?? null });
  return value === null ? null : receiptManifest(value);
}
export async function dbReadReceiptV7(owner: string, revisionId?: string): Promise<import("@/lib/history/snapshot").ReceiptSnapshotV7 | null> {
  const value = await receiptRpc("scoring_v7_read_receipt", { p_owner: owner.toLowerCase(), p_revision: revisionId ?? null });
  if (value === null) return null;
  const manifest = receiptManifest(value);
  const canonical = (value as Record<string, unknown>).canonicalReceipt;
  if (typeof canonical !== "string") throw new ReceiptHistoryError("contract");
  const envelope = await sealScoreReceipt(JSON.parse(canonical));
  if (canonicalJson(envelope.receipt) !== canonical || envelope.receipt.revisionId !== manifest.revisionId) throw new ReceiptHistoryError("contract");
  return buildReceiptSnapshotV7(envelope, manifest.trend);
}
/** Reuse the exact prepared envelope on retries. Conflicting payloads never overwrite history.
 * Durable receipt + optional trend commit in one database transaction before success. */
export async function dbPublishReceiptV7(owner: string, actor: string, envelope: import("@chapa/shared").HashedScoreReceipt): Promise<{ status: "inserted" | "duplicate"; snapshot: import("@/lib/history/snapshot").ReceiptSnapshotV7 }> {
  const receipt = await verifyScoreReceipt(envelope);
  const value = await receiptRpc("scoring_v7_publish_receipt", { p_owner: owner.toLowerCase(), p_actor: actor.toLowerCase(), p_receipt: receipt, p_canonical: canonicalJson(receipt) });
  if (!value || typeof value !== "object") throw new ReceiptHistoryError("contract");
  const row = value as Record<string, unknown>;
  if ((row.status !== "inserted" && row.status !== "duplicate") || row.canonicalReceipt !== canonicalJson(receipt)) throw new ReceiptHistoryError("contract");
  const manifest = receiptManifest({ revisionId: receipt.revisionId, policyVersion: receipt.policyVersion, trend: row.trend });
  return { status: row.status, snapshot: buildReceiptSnapshotV7(await sealScoreReceipt(receipt), manifest.trend) };
}
