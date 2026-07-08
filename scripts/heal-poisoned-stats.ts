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
 *   1. Reads `stats:v2:merged:<handle>` and `stats:stale:<handle>` from Redis
 *      and checks each against `isPoisonedStats()`.
 *   2. Reads `metrics_snapshots` rows where `prs_merged_count = 0` AND
 *      `commits_total > SNAPSHOT_COMMITS_THRESHOLD` for the handle.
 *   3. In `--apply` mode: deletes any poisoned Redis key, unconditionally
 *      deletes `snapshot:v2:latest:<handle>` (forces a cache rebuild) when
 *      either stats key was poisoned, and deletes the corrupt snapshot rows.
 *
 * IMPORTANT — this script does NOT itself repopulate good data. The GitHub
 * server token used by cron/bulk-recalculate cannot see a user's private-repo
 * merges (see #1002), so it cannot heal the data on its own. Healing
 * completes when the user's next **authenticated** visit (or `/api/refresh`)
 * repopulates good, Phase-1/2-protected data — this script only clears the
 * poison so that next good fetch sticks instead of being discarded as a
 * "downgrade" of the (corrupt) cached value.
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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPoisonedStats } from "../apps/web/lib/github/stats-integrity";

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

/** Matches the literal key `_fetchAndCache` reads/writes in client.ts. */
export function staleStatsKey(handle: string): string {
  return `stats:stale:${handle}`;
}

/** Matches `buildSnapshotKey()` in `apps/web/lib/cache/snapshot-cache.ts`. */
export function snapshotKey(handle: string): string {
  return `snapshot:v2:latest:${handle}`;
}

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------

/** Load .env.local from repo root, only filling vars not already in env. */
function loadEnvLocal(): void {
  try {
    const path = join(process.cwd(), ".env.local");
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // No .env.local — rely on already-exported env vars.
  }
}

export interface Config {
  redisUrl: string;
  redisToken: string;
  supaUrl: string;
  supaKey: string;
}

function loadConfig(): Config {
  loadEnvLocal();
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const supaUrl = process.env.SUPABASE_URL?.trim();
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!redisUrl || !redisToken) {
    throw new Error(
      "Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.",
    );
  }
  if (!supaUrl || !supaKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { redisUrl, redisToken, supaUrl, supaKey };
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

/** Parse a raw Redis GET result into the subset of StatsData isPoisonedStats needs, or null. */
function parseStatsValue(
  raw: unknown,
): { prsMergedCount: number; commitsTotal: number; issuesClosedCount: number } | null {
  if (raw === null || raw === undefined) return null;
  const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (typeof obj !== "object" || obj === null) return null;
  const { prsMergedCount, commitsTotal, issuesClosedCount } = obj as Record<string, unknown>;
  if (
    typeof prsMergedCount !== "number" ||
    typeof commitsTotal !== "number" ||
    typeof issuesClosedCount !== "number"
  ) {
    return null;
  }
  return { prsMergedCount, commitsTotal, issuesClosedCount };
}

// ---------------------------------------------------------------------------
// Supabase PostgREST
// ---------------------------------------------------------------------------

function poisonedSnapshotFilter(handle: string): string {
  return `handle=eq.${handle}&prs_merged_count=eq.0&commits_total=gt.${SNAPSHOT_COMMITS_THRESHOLD}`;
}

async function supaCountPoisonedSnapshots(
  cfg: Config,
  handle: string,
): Promise<number> {
  const res = await fetch(
    `${cfg.supaUrl}/rest/v1/metrics_snapshots?${poisonedSnapshotFilter(handle)}&select=handle`,
    {
      method: "HEAD",
      headers: {
        apikey: cfg.supaKey,
        Authorization: `Bearer ${cfg.supaKey}`,
        Prefer: "count=exact",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`count metrics_snapshots: ${res.status} ${await res.text()}`);
  }
  const range = res.headers.get("content-range"); // "*/<total>"
  return range ? Number(range.split("/")[1]) : 0;
}

async function supaDeletePoisonedSnapshots(
  cfg: Config,
  handle: string,
): Promise<number> {
  const res = await fetch(
    `${cfg.supaUrl}/rest/v1/metrics_snapshots?${poisonedSnapshotFilter(handle)}`,
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

export interface HealResult {
  handle: string;
  mergedPoisoned: boolean;
  stalePoisoned: boolean;
  poisonedSnapshotRows: number;
  deletedRedisKeys: string[];
  deletedSnapshotRows: number;
}

export async function healHandle(
  cfg: Config,
  rawHandle: string,
  apply: boolean,
): Promise<HealResult> {
  const handle = normalizeHandle(rawHandle);

  const [mergedRaw, staleRaw] = await Promise.all([
    redis(cfg, ["GET", mergedStatsKey(handle)]),
    redis(cfg, ["GET", staleStatsKey(handle)]),
  ]);

  const mergedStats = parseStatsValue(mergedRaw);
  const staleStats = parseStatsValue(staleRaw);

  const mergedPoisoned = mergedStats !== null && isPoisonedStats(mergedStats);
  const stalePoisoned = staleStats !== null && isPoisonedStats(staleStats);

  const poisonedSnapshotRows = await supaCountPoisonedSnapshots(cfg, handle);

  const deletedRedisKeys: string[] = [];
  let deletedSnapshotRows = 0;

  if (apply) {
    if (mergedPoisoned) {
      await redis(cfg, ["DEL", mergedStatsKey(handle)]);
      deletedRedisKeys.push(mergedStatsKey(handle));
    }
    if (stalePoisoned) {
      await redis(cfg, ["DEL", staleStatsKey(handle)]);
      deletedRedisKeys.push(staleStatsKey(handle));
    }
    if (mergedPoisoned || stalePoisoned) {
      await redis(cfg, ["DEL", snapshotKey(handle)]);
      deletedRedisKeys.push(snapshotKey(handle));
    }
    if (poisonedSnapshotRows > 0) {
      deletedSnapshotRows = await supaDeletePoisonedSnapshots(cfg, handle);
    }
  }

  return {
    handle,
    mergedPoisoned,
    stalePoisoned,
    poisonedSnapshotRows,
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
      `  metrics_snapshots poisoned rows (prs_merged_count=0 AND commits_total>${SNAPSHOT_COMMITS_THRESHOLD}): ${result.poisonedSnapshotRows}`,
    );
    if (apply) {
      if (result.deletedRedisKeys.length > 0) {
        console.log(`      -> DELETED Redis key(s): ${result.deletedRedisKeys.join(", ")}`);
      }
      if (result.deletedSnapshotRows > 0) {
        console.log(`      -> DELETED ${result.deletedSnapshotRows} snapshot row(s)`);
      }
    }
    totalPoisonedKeys += (result.mergedPoisoned ? 1 : 0) + (result.stalePoisoned ? 1 : 0);
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
      `\nHealing complete. The next AUTHENTICATED visit (or /api/refresh) for each ` +
        `handle repopulates good data — this script does not fetch fresh data itself.`,
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
