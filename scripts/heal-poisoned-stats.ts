#!/usr/bin/env tsx
/**
 * Purge already-poisoned scoring data for one or more handles.
 *
 * The 2026-07-07 scoring-integrity-contract plan (Phases 1-3) stops new
 * degraded fetches from ever being cached, scored, or persisted — but data
 * that was already written *before* that contract shipped stays corrupt
 * forever unless purged, because nothing re-validates already-cached/
 * persisted data retroactively. This script finds and (optionally) deletes
 * that corruption for the handles you name.
 *
 * For each handle it:
 *   1. Reads `stats:v2:merged:<handle>` and `stats:stale:v2:<handle>` from Redis
 *      and checks each against `isPoisonedStats()`.
 *   2. Reads `metrics_snapshots` rows where `prs_merged_count = 0` AND
 *      `commits_total > SNAPSHOT_COMMITS_THRESHOLD` for the handle.
 *   3. In `--apply` mode: deletes any poisoned Redis key, unconditionally
 *      deletes `snapshot:v2:latest:<handle>` (forces a cache rebuild) when
 *      either stats key was poisoned, and deletes the corrupt snapshot rows.
 *
 * IMPORTANT — this script does NOT itself repopulate good data; it only
 * clears the poison so the next good fetch sticks instead of being discarded
 * as a "downgrade" of the (corrupt) cached value.
 *
 * NOTE (#1050 correction): this header previously claimed the server token
 * cannot see private merges and that only the user's authenticated visit
 * heals. That was exactly backwards. The OAuth app requests no `repo` scope,
 * so the USER'S session token is the blind one; the server `GITHUB_TOKEN`
 * holds `repo` and sees everything. Post-purge, healing completes via any
 * tokenless fetch (anonymous badge hit, warm-cache cron) — both resolve to
 * the server token.
 *
 * #1049: detection covers TWO corruption shapes, because #1004 changed what
 * poison looks like. `isPoisonedStats` catches the #1002 era (count collapsed
 * to exactly 0); `isScopeBlindedStats` catches the #1045 era (a
 * plausible-but-wrong POSITIVE count from the token-scoped search, with the
 * sample-derived fields — prsMergedWeight, linesAdded/Deleted — collapsed).
 * juan294's 2026-07-14 rows are the second shape: 140 PRs, weight 3.38,
 * +59/-10 lines. The original zero-only filter was blind to them.
 *
 * Usage:
 *   tsx scripts/heal-poisoned-stats.ts <handle> [<handle>...]           # DRY RUN (default, safe)
 *   tsx scripts/heal-poisoned-stats.ts <handle> [<handle>...] --apply   # actually purge
 *
 * Dry-run is the default on purpose: this operation is irreversible and runs
 * against PRODUCTION. Always review the dry-run footprint before --apply.
 *
 * Talks to the Supabase (PostgREST) and Upstash (REST) HTTP APIs directly so
 * it has no package dependencies beyond tsx and runs from the repo root.
 * Only handles passed as arguments are processed — there is no "scan all
 * snapshot rows" auto-discovery mode.
 *
 * Requires env vars (auto-loaded from .env.local at repo root if not already set):
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Handle matching is case-insensitive (handles are stored lowercased).
 */

import { isPoisonedStats, isScopeBlindedStats } from "../apps/web/lib/github/stats-integrity";
import { loadConfig, type Config } from "./lib/env";

export type { Config };

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in heal-poisoned-stats.test.ts)
// ---------------------------------------------------------------------------

/** Rows with more commits than this while showing zero merged PRs are corrupt. */
export const SNAPSHOT_COMMITS_THRESHOLD = 100;

export interface Args {
  handles: string[];
  apply: boolean;
}

export function parseArgs(argv: string[]): Args {
  const apply = argv.includes("--apply");
  const handles = argv.filter((a) => !a.startsWith("--"));
  if (handles.length === 0) {
    throw new Error(
      "Missing required <handle> argument(s).\n" +
        "Usage: tsx scripts/heal-poisoned-stats.ts <handle> [<handle>...] [--apply]",
    );
  }
  return { handles, apply };
}

/**
 * Lowercase + trim a handle and assert it is a valid GitHub-style handle.
 *
 * Same guard as `delete-user.ts`'s `normalizeHandle`: the handle is
 * interpolated into Redis key names and PostgREST `eq` filters, so we
 * hard-fail on anything outside [a-z0-9-].
 */
export function normalizeHandle(raw: string): string {
  const handle = raw.trim().toLowerCase();
  if (!handle) {
    throw new Error("Handle is empty.");
  }
  if (!/^[a-z0-9-]+$/.test(handle)) {
    throw new Error(
      `Invalid handle "${raw}". Only letters, digits, and hyphens are allowed ` +
        "(no wildcards, spaces, or punctuation).",
    );
  }
  return handle;
}

/** Matches the literal key `getStats`/`_fetchAndCache` read/write in client.ts. */
export function mergedStatsKey(handle: string): string {
  return `stats:v2:merged:${handle}`;
}

/**
 * Matches the literal baseline key `_fetchAndCache` reads/writes in client.ts.
 * Versioned to `v2` by #1060: it now holds GitHub-derived data only, so that
 * the integrity guards compare like against like.
 */
export function staleStatsKey(handle: string): string {
  return `stats:stale:v2:${handle}`;
}

/** Matches the literal key `_loadOverlays` reads in client.ts. */
export function supplementalKey(handle: string): string {
  return `supplemental:${handle}`;
}

/** Matches `buildSnapshotKey()` in `apps/web/lib/cache/snapshot-cache.ts`. */
export function snapshotKey(handle: string): string {
  return `snapshot:v2:latest:${handle}`;
}

// ---------------------------------------------------------------------------
// Upstash REST
// ---------------------------------------------------------------------------

async function redis(cfg: Config, cmd: string[]): Promise<unknown> {
  const res = await fetch(
    `${cfg.redisUrl}/${cmd.map(encodeURIComponent).join("/")}`,
    { headers: { Authorization: `Bearer ${cfg.redisToken}` } },
  );
  if (!res.ok) {
    throw new Error(`Redis ${cmd[0]} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()).result;
}

/** Parsed subset of StatsData that the two poison predicates need. */
interface ParsedStats {
  prsMergedCount: number;
  commitsTotal: number;
  issuesClosedCount: number;
  prsMergedWeight?: number;
  linesAdded?: number;
  linesDeleted?: number;
}

/** Parse a raw Redis GET result into the fields the poison predicates need, or null. */
function parseStatsValue(raw: unknown): ParsedStats | null {
  if (raw === null || raw === undefined) return null;
  const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (typeof obj !== "object" || obj === null) return null;
  const { prsMergedCount, commitsTotal, issuesClosedCount, prsMergedWeight, linesAdded, linesDeleted } =
    obj as Record<string, unknown>;
  if (
    typeof prsMergedCount !== "number" ||
    typeof commitsTotal !== "number" ||
    typeof issuesClosedCount !== "number"
  ) {
    return null;
  }
  return {
    prsMergedCount,
    commitsTotal,
    issuesClosedCount,
    ...(typeof prsMergedWeight === "number" && { prsMergedWeight }),
    ...(typeof linesAdded === "number" && { linesAdded }),
    ...(typeof linesDeleted === "number" && { linesDeleted }),
  };
}

/**
 * Extract only the fields the stale-supplemental check needs (#1060), with no
 * requirement that the value be a complete `StatsData` — a composed entry and a
 * `SupplementalStats` envelope are different shapes and both are read here.
 */
function parseSupplementalShape(
  raw: unknown,
): { hasSupplementalData?: boolean; fetchedAt?: string; uploadedAt?: string } | null {
  if (raw === null || raw === undefined) return null;
  let obj: unknown;
  try {
    obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const { hasSupplementalData, fetchedAt, uploadedAt } = obj as Record<string, unknown>;
  return {
    ...(typeof hasSupplementalData === "boolean" && { hasSupplementalData }),
    ...(typeof fetchedAt === "string" && { fetchedAt }),
    ...(typeof uploadedAt === "string" && { uploadedAt }),
  };
}

/**
 * Is this cached stats value poisoned under EITHER corruption shape?
 *
 * The blindness check requires the sample-derived fields; a legacy value
 * without them can only be judged by the zero-shape — the proof standard for
 * a destructive purge is "demonstrably corrupt", never "cannot be shown
 * clean".
 */
function statsValueIsPoisoned(s: ParsedStats): boolean {
  if (isPoisonedStats(s)) return true;
  if (
    typeof s.prsMergedWeight === "number" &&
    typeof s.linesAdded === "number" &&
    typeof s.linesDeleted === "number"
  ) {
    return isScopeBlindedStats({
      prsMergedCount: s.prsMergedCount,
      prsMergedWeight: s.prsMergedWeight,
      linesAdded: s.linesAdded,
      linesDeleted: s.linesDeleted,
    });
  }
  return false;
}

// ---------------------------------------------------------------------------
// Supabase PostgREST
// ---------------------------------------------------------------------------

/** Snapshot row as PostgREST returns it (snake_case), sample fields nullable on legacy rows. */
export interface SnapshotRow {
  date: string;
  prs_merged_count: number;
  prs_merged_weight: number | null;
  lines_added: number | null;
  lines_deleted: number | null;
  commits_total: number;
  issues_closed: number;
}

const SNAPSHOT_ROW_COLUMNS =
  "date,prs_merged_count,prs_merged_weight,lines_added,lines_deleted,commits_total,issues_closed";

/**
 * Select the dates of demonstrably-corrupt snapshot rows, under either shape.
 *
 * Evaluated in TS rather than SQL so the heal script and the persist-boundary
 * gate share ONE set of predicates (`stats-integrity.ts`) — the previous
 * SQL-side `prs_merged_count=eq.0` filter silently diverged from what
 * "poisoned" meant after #1004, which is how juan294's 140-count rows became
 * undetectable (#1049).
 *
 * Zero-shape rows keep the extra `commits_total > SNAPSHOT_COMMITS_THRESHOLD`
 * conservatism the SQL filter had. Legacy rows with null sample fields can
 * only be judged by the zero shape — the standard for deletion is
 * "demonstrably corrupt", never "cannot be shown clean".
 */
export function selectPoisonedSnapshotDates(rows: SnapshotRow[]): string[] {
  const dates: string[] = [];
  for (const row of rows) {
    const zeroShape =
      isPoisonedStats({
        prsMergedCount: row.prs_merged_count,
        commitsTotal: row.commits_total,
        issuesClosedCount: row.issues_closed,
      }) && row.commits_total > SNAPSHOT_COMMITS_THRESHOLD;

    const blindedShape =
      row.prs_merged_weight !== null &&
      row.lines_added !== null &&
      row.lines_deleted !== null &&
      isScopeBlindedStats({
        prsMergedCount: row.prs_merged_count,
        prsMergedWeight: row.prs_merged_weight,
        linesAdded: row.lines_added,
        linesDeleted: row.lines_deleted,
      });

    if (zeroShape || blindedShape) dates.push(row.date);
  }
  return dates.sort();
}

async function supaFetchSnapshotRows(cfg: Config, handle: string): Promise<SnapshotRow[]> {
  const res = await fetch(
    `${cfg.supaUrl}/rest/v1/metrics_snapshots?handle=eq.${handle}&select=${SNAPSHOT_ROW_COLUMNS}`,
    {
      headers: {
        apikey: cfg.supaKey,
        Authorization: `Bearer ${cfg.supaKey}`,
      },
    },
  );
  if (!res.ok) {
    throw new Error(`fetch metrics_snapshots: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as SnapshotRow[];
}

/** Delete exactly the reviewed dates — never a broad filter (#1049). */
async function supaDeleteSnapshotsByDate(
  cfg: Config,
  handle: string,
  dates: string[],
): Promise<number> {
  if (dates.length === 0) return 0;
  const res = await fetch(
    `${cfg.supaUrl}/rest/v1/metrics_snapshots?handle=eq.${handle}&date=in.(${dates.join(",")})`,
    {
      method: "DELETE",
      headers: {
        apikey: cfg.supaKey,
        Authorization: `Bearer ${cfg.supaKey}`,
        Prefer: "return=representation",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`delete metrics_snapshots: ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as unknown[]).length : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Per-handle heal
// ---------------------------------------------------------------------------

/**
 * #1060 — detect a composed entry that never absorbed the current supplemental.
 *
 * This shape is not "poisoned" by either predicate above: it is structurally
 * valid GitHub-derived data that simply predates (or never saw) the EMU merge.
 * `mergeStats` stamps `hasSupplementalData` on any composed value, so its
 * absence alongside an existing supplemental record proves the entry was
 * written from a value that never included it. A composed entry whose
 * `fetchedAt` predates the upload is the same defect one step later: it
 * absorbed an *older* supplemental than the one now on record.
 *
 * The repair is to drop the composed entry so the next tokenless request
 * recomposes it. The baseline key is deliberately left alone — it is the
 * protected GitHub-derived record, not the defective value.
 */
export function isSupplementalStale(
  merged: { hasSupplementalData?: boolean; fetchedAt?: string } | null,
  supplemental: { uploadedAt?: string } | null,
): boolean {
  if (!supplemental || !merged) return false;
  if (merged.hasSupplementalData !== true) return true;
  if (!merged.fetchedAt || !supplemental.uploadedAt) return false;
  return merged.fetchedAt < supplemental.uploadedAt;
}

export interface HealResult {
  handle: string;
  mergedPoisoned: boolean;
  stalePoisoned: boolean;
  /** #1060 — composed entry exists but never absorbed the current supplemental. */
  supplementalStale: boolean;
  poisonedSnapshotRows: number;
  /** Exact dates queued for deletion — printed in dry-run for operator review. */
  poisonedSnapshotDates: string[];
  deletedRedisKeys: string[];
  deletedSnapshotRows: number;
}

export async function healHandle(
  cfg: Config,
  rawHandle: string,
  apply: boolean,
): Promise<HealResult> {
  const handle = normalizeHandle(rawHandle);

  const [mergedRaw, staleRaw, supplementalRaw] = await Promise.all([
    redis(cfg, ["GET", mergedStatsKey(handle)]),
    redis(cfg, ["GET", staleStatsKey(handle)]),
    redis(cfg, ["GET", supplementalKey(handle)]),
  ]);

  const mergedStats = parseStatsValue(mergedRaw);
  const staleStats = parseStatsValue(staleRaw);

  const mergedPoisoned = mergedStats !== null && statsValueIsPoisoned(mergedStats);
  const stalePoisoned = staleStats !== null && statsValueIsPoisoned(staleStats);
  const supplementalStale = isSupplementalStale(
    parseSupplementalShape(mergedRaw),
    parseSupplementalShape(supplementalRaw),
  );

  const snapshotRows = await supaFetchSnapshotRows(cfg, handle);
  const poisonedSnapshotDates = selectPoisonedSnapshotDates(snapshotRows);
  const poisonedSnapshotRows = poisonedSnapshotDates.length;

  const deletedRedisKeys: string[] = [];
  let deletedSnapshotRows = 0;

  if (apply) {
    // #1060 — a stale-supplemental entry is repaired the same way as a poisoned
    // one: drop the composed value so the next tokenless request recomposes it.
    if (mergedPoisoned || supplementalStale) {
      await redis(cfg, ["DEL", mergedStatsKey(handle)]);
      deletedRedisKeys.push(mergedStatsKey(handle));
    }
    // The baseline holds GitHub-derived data only, so a stale supplemental is
    // never a reason to drop it — only genuine poison is.
    if (stalePoisoned) {
      await redis(cfg, ["DEL", staleStatsKey(handle)]);
      deletedRedisKeys.push(staleStatsKey(handle));
    }
    if (mergedPoisoned || stalePoisoned || supplementalStale) {
      await redis(cfg, ["DEL", snapshotKey(handle)]);
      deletedRedisKeys.push(snapshotKey(handle));
    }
    if (poisonedSnapshotDates.length > 0) {
      deletedSnapshotRows = await supaDeleteSnapshotsByDate(cfg, handle, poisonedSnapshotDates);
    }
  }

  return {
    handle,
    mergedPoisoned,
    stalePoisoned,
    supplementalStale,
    poisonedSnapshotRows,
    poisonedSnapshotDates,
    deletedRedisKeys,
    deletedSnapshotRows,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function run(rawArgs: string[]): Promise<void> {
  const { handles, apply } = parseArgs(rawArgs);
  const cfg = loadConfig();

  const mode = apply ? "APPLY (mutating)" : "DRY RUN (read-only)";
  console.log(`\n=== ${mode} — healing poisoned stats for ${handles.length} handle(s) ===\n`);

  let totalPoisonedKeys = 0;
  let totalPoisonedRows = 0;

  for (const rawHandle of handles) {
    const result = await healHandle(cfg, rawHandle, apply);
    console.log(`--- ${result.handle} ---`);
    console.log(`  ${mergedStatsKey(result.handle).padEnd(30)} poisoned: ${result.mergedPoisoned}`);
    console.log(`  ${staleStatsKey(result.handle).padEnd(30)} poisoned: ${result.stalePoisoned}`);
    console.log(
      `  ${supplementalKey(result.handle).padEnd(30)} not absorbed by composed entry: ` +
        `${result.supplementalStale}`,
    );
    console.log(
      `  metrics_snapshots poisoned rows (zero-shape or scope-blinded): ${result.poisonedSnapshotRows}` +
        (result.poisonedSnapshotDates.length > 0
          ? ` -> [${result.poisonedSnapshotDates.join(", ")}]`
          : ""),
    );
    if (apply) {
      if (result.deletedRedisKeys.length > 0) {
        console.log(`      -> DELETED Redis key(s): ${result.deletedRedisKeys.join(", ")}`);
      }
      if (result.deletedSnapshotRows > 0) {
        console.log(`      -> DELETED ${result.deletedSnapshotRows} snapshot row(s)`);
      }
    }
    totalPoisonedKeys +=
      (result.mergedPoisoned ? 1 : 0) +
      (result.stalePoisoned ? 1 : 0) +
      // Counted so a handle whose ONLY defect is an unabsorbed supplemental
      // still reports as needing repair rather than "nothing to heal".
      (!result.mergedPoisoned && result.supplementalStale ? 1 : 0);
    totalPoisonedRows += result.poisonedSnapshotRows;
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Poisoned Redis keys found:    ${totalPoisonedKeys}`);
  console.log(`  Poisoned snapshot rows found: ${totalPoisonedRows}`);
  if (!apply) {
    if (totalPoisonedKeys + totalPoisonedRows === 0) {
      console.log(`\nNo poisoned data found. Nothing to heal.`);
    } else {
      console.log(
        `\nDRY RUN only — nothing was deleted.\n` +
          `Re-run with --apply to purge the poisoned data above:\n` +
          `  tsx scripts/heal-poisoned-stats.ts ${handles.join(" ")} --apply`,
      );
    }
  } else {
    console.log(
      `\nHealing complete. The next tokenless fetch (anonymous badge hit or the ` +
        `hourly warm-cache cron) repopulates good data via the repo-scoped server ` +
        `GITHUB_TOKEN — this script does not fetch fresh data itself.`,
    );
  }
}

// Only run when executed directly (not when imported by tests).
const isDirectRun =
  typeof process !== "undefined" &&
  !!process.argv[1] &&
  (process.argv[1].endsWith("heal-poisoned-stats.ts") ||
    process.argv[1].endsWith("heal-poisoned-stats"));

if (isDirectRun) {
  run(process.argv.slice(2)).catch((err) => {
    console.error("\nError:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
