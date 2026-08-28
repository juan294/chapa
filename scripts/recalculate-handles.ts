#!/usr/bin/env tsx
/**
 * Force one or more handles to be recomputed from source with the CURRENT
 * scoring code, and make the corrected value actually persist.
 *
 * Reach for this after shipping a scoring fix, when data that is already
 * cached/persisted for a handle was computed by the OLD (wrong) code. A plain
 * cache-bust is not enough: deleting the stats cache alone does not force a
 * fresh GitHub fetch, because the badge route checks its own SVG cache first
 * and returns early on a hit — and even when a fresh fetch does happen, the
 * recomputed snapshot silently fails to persist (see step 5 below) unless the
 * dirty marker is set first. This script performs the full sequence.
 *
 * As of writing, this has not been run against production for an active
 * incident — the BE-H1 chained-`mergeStats` fix that motivated building it
 * turned out, on inspection, to have flipped nobody's classification (every
 * affected handle's review-to-PR ratio was already far below the 0.15
 * threshold). It is a standing tool for the next time a scoring fix needs to
 * be back-applied to already-persisted data, not a response to one now.
 *
 * For each handle, in `--apply` mode, this:
 *   1. Deletes `stats:v2:merged:<handle>` — the composed stats cache — so the
 *      next request recomposes instead of serving the old-code value.
 *   2. NEVER deletes `stats:stale:v2:<handle>` — the protected GitHub-derived
 *      baseline the #1002/#1004/#1050 degraded-fetch guards compare against.
 *      That is `heal-poisoned-stats.ts`'s job, only when the baseline is
 *      itself poisoned, which is a different situation from "correct data,
 *      old scoring code."
 *   3. Deletes `snapshot:v2:latest:<handle>` — the cached EMA prior — so the
 *      smoothing policy doesn't blend the corrected value against a stale
 *      (old-code) prior.
 *   4. Deletes today's badge SVG cache entry for every supported locale
 *      (the key is locale-scoped, one per locale per day — see
 *      `apps/web/lib/render/badge-svg-cache.ts:84`). This step is what makes
 *      the trigger in step 6 actually reach the scoring pipeline at all: the
 *      badge route checks this cache BEFORE calling into `materializeProfile`
 *      and returns the cached SVG unchanged on a hit, regardless of what was
 *      done to the stats cache in step 1.
 *   5. Sets `stats:dirty:<handle>` (see `apps/web/lib/cache/dirty-stats.ts`).
 *      This is the load-bearing step. `materializeProfile` reads this marker
 *      into `inputsChanged`, and `persistProfileSnapshot` uses
 *      `{ mode: inputsChanged ? "replace" : "insert" }`. Without it, the
 *      recomputed snapshot hits the `UNIQUE(handle, date)` constraint, comes
 *      back `duplicate`, and the corrected value silently does not persist —
 *      the live badge would show the fresh number, but the stored trend
 *      snapshot for today would still hold the old-code value forever. The
 *      marker must be set BEFORE step 6's request, not after.
 *   6. Triggers the recompute with an anonymous (tokenless) GET to
 *      `/u/<handle>/badge.svg`. Per the #1050 correction (see
 *      `heal-poisoned-stats.ts`'s header), an anonymous request resolves to
 *      the server `GITHUB_TOKEN`, which carries `repo` scope and is
 *      private-inclusive — the user's own OAuth session token is the blind
 *      one and cannot repopulate private-repo merges. The base URL defaults
 *      to production and is configurable via `--base-url=<url>` (e.g. to
 *      point at a preview deployment or local dev server instead).
 *
 * After `--apply`, this re-reads the `metrics_snapshots` row for today
 * (polling briefly — the durable snapshot write runs in Vercel's `after()`,
 * i.e. after the HTTP response above already went out, per #1013 — so an
 * immediate single re-read would frequently and falsely report "unchanged")
 * and reports whether it actually changed. "Recalculated" is meant to be an
 * observation of the persisted row, not a hope that the trigger worked.
 *
 * Usage:
 *   tsx scripts/recalculate-handles.ts <handle> [<handle>...]                    # DRY RUN (default, safe)
 *   tsx scripts/recalculate-handles.ts <handle> [<handle>...] --apply            # actually recalculate
 *   tsx scripts/recalculate-handles.ts <handle> --apply --base-url=http://localhost:3001
 *
 * Dry-run is the default on purpose: this operation is irreversible and (by
 * default) runs against PRODUCTION. Always review the dry-run footprint
 * before --apply. Dry-run performs NO network calls at all — the footprint is
 * fully determined by the handle, today's date, and the base URL, so there is
 * nothing to read before printing what would happen.
 *
 * Talks to the Supabase (PostgREST) and Upstash (REST) HTTP APIs directly so
 * it has no package dependencies beyond tsx and runs from the repo root.
 * Only handles passed as arguments are processed — there is no "scan all
 * handles" auto-discovery mode.
 *
 * Requires env vars (auto-loaded from .env.local at repo root if not already set):
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Handle matching is case-insensitive (handles are stored lowercased).
 */

import { loadConfig, type Config } from "./lib/env";
// Zero-dependency, alias-free modules — safe to import directly under tsx.
// `apps/web/lib/render/badge-svg-cache.ts` itself is NOT imported here: it
// pulls in `@/lib/cache/redis` etc. via Next.js `@/` path aliases that tsx
// cannot resolve when this script runs standalone outside the Next build, so
// its `BADGE_RENDER_VARIANT` constant and key format are duplicated below
// instead (same convention `heal-poisoned-stats.ts` uses for the other keys).
import { CACHE_VERSION } from "../apps/web/lib/cache/version";
import { SUPPORTED_LOCALES, type Locale } from "../apps/web/lib/i18n/types";

export type { Config };

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in recalculate-handles.test.ts)
// ---------------------------------------------------------------------------

export const DEFAULT_BASE_URL = "https://chapa.thecreativetoken.com";

export interface Args {
  handles: string[];
  apply: boolean;
  baseUrl: string;
}

export function parseArgs(argv: string[]): Args {
  const apply = argv.includes("--apply");
  const handles: string[] = [];
  let baseUrl = DEFAULT_BASE_URL;
  for (const arg of argv) {
    if (arg === "--apply") continue;
    if (arg.startsWith("--base-url=")) {
      baseUrl = arg.slice("--base-url=".length).replace(/\/+$/, "");
      continue;
    }
    if (arg.startsWith("--")) continue; // ignore unknown flags rather than fail
    handles.push(arg);
  }
  if (handles.length === 0) {
    throw new Error(
      "Missing required <handle> argument(s).\n" +
        "Usage: tsx scripts/recalculate-handles.ts <handle> [<handle>...] [--apply] [--base-url=<url>]",
    );
  }
  return { handles, apply, baseUrl };
}

/**
 * Lowercase + trim a handle and assert it is a valid GitHub-style handle.
 *
 * Same guard as `delete-user.ts`'s and `heal-poisoned-stats.ts`'s
 * `normalizeHandle`: the handle is interpolated into Redis key names, a
 * PostgREST `eq` filter, and a URL path segment, so we hard-fail on anything
 * outside [a-z0-9-]. This is the ONLY injection barrier before any key or URL
 * is constructed — callers must run this before building anything else.
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
 * Matches the literal PROTECTED baseline key `_fetchAndCache` reads/writes in
 * client.ts. Exported only so tests can assert it is never passed to a
 * mutating call — this script must never delete it.
 */
export function staleStatsKey(handle: string): string {
  return `stats:stale:v2:${handle}`;
}

/** Matches `buildSnapshotKey()` in `apps/web/lib/cache/snapshot-cache.ts`. */
export function snapshotKey(handle: string): string {
  return `snapshot:v2:latest:${handle}`;
}

/** Matches `dirtyStatsKey()` in `apps/web/lib/cache/dirty-stats.ts:17`. */
export function dirtyStatsKey(handle: string): string {
  return `stats:dirty:${handle}`;
}

/** Matches `DIRTY_STATS_TTL` in `apps/web/lib/cache/dirty-stats.ts:14`. */
export const DIRTY_STATS_TTL_SECONDS = 3600;

/** Matches `BADGE_RENDER_VARIANT` in `apps/web/lib/render/badge-svg-cache.ts:20`. */
export const BADGE_RENDER_VARIANT = "warm-amber-v3";

/**
 * Matches `buildBadgeSvgCacheKey()` in
 * `apps/web/lib/render/badge-svg-cache.ts:84`. The key is locale-scoped
 * (#1181) — a handle has one entry per locale per day.
 */
export function badgeSvgCacheKey(handle: string, date: string, locale: Locale): string {
  return `badge:${CACHE_VERSION}:${handle.toLowerCase()}:${BADGE_RENDER_VARIANT}:${date}:${locale}`;
}

/** Today's date in the same `YYYY-MM-DD` UTC form `public-profile.ts` uses for the day guard/snapshot date. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function badgeUrl(baseUrl: string, handle: string): string {
  return `${baseUrl}/u/${handle}/badge.svg`;
}

export interface Footprint {
  handle: string;
  /** The composed stats cache — deleted so the next fetch recomposes. */
  mergedKey: string;
  /** The cached EMA prior — deleted so smoothing doesn't blend a stale prior. */
  snapshotKey: string;
  /** Today's badge SVG cache entry, one per supported locale. */
  badgeKeys: string[];
  /** The dirty marker — SET, never deleted. */
  dirtyKey: string;
  dirtyTtlSeconds: number;
  /** The anonymous trigger request. */
  triggerUrl: string;
  /** The protected GitHub-derived baseline — documented here, NEVER touched. */
  protectedBaselineKey: string;
}

/** Pure — the entire mutation plan for one handle, with no I/O. */
export function computeFootprint(handle: string, baseUrl: string, today: string): Footprint {
  return {
    handle,
    mergedKey: mergedStatsKey(handle),
    snapshotKey: snapshotKey(handle),
    badgeKeys: SUPPORTED_LOCALES.map((locale) => badgeSvgCacheKey(handle, today, locale)),
    dirtyKey: dirtyStatsKey(handle),
    dirtyTtlSeconds: DIRTY_STATS_TTL_SECONDS,
    triggerUrl: badgeUrl(baseUrl, handle),
    protectedBaselineKey: staleStatsKey(handle),
  };
}

/** Snapshot row as PostgREST returns it (snake_case) — shape-agnostic on purpose. */
export type SnapshotRow = Record<string, unknown>;

/**
 * Excluded from the before/after comparison because it always differs on any
 * recompute (a fresh capture timestamp) even when the score itself did not
 * change — comparing it would make every apply report "changed" trivially.
 */
const SNAPSHOT_VOLATILE_KEYS = ["captured_at"];

/** Pure — did the persisted row actually change (ignoring the volatile capture timestamp)? */
export function snapshotChanged(before: SnapshotRow | null, after: SnapshotRow | null): boolean {
  if (before === null && after === null) return false;
  if (before === null || after === null) return true;
  const strip = (row: SnapshotRow): SnapshotRow => {
    const copy = { ...row };
    for (const key of SNAPSHOT_VOLATILE_KEYS) delete copy[key];
    return copy;
  };
  return JSON.stringify(strip(before)) !== JSON.stringify(strip(after));
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

// ---------------------------------------------------------------------------
// Supabase PostgREST
// ---------------------------------------------------------------------------

async function supaFetchSnapshotRow(
  cfg: Config,
  handle: string,
  date: string,
): Promise<SnapshotRow | null> {
  const res = await fetch(
    `${cfg.supaUrl}/rest/v1/metrics_snapshots?handle=eq.${handle}&date=eq.${date}&select=*`,
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
  const rows = (await res.json()) as SnapshotRow[];
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Per-handle recompute
// ---------------------------------------------------------------------------

export interface RecalculateOptions {
  /** Max snapshot re-reads while waiting for the after()-deferred write to land. */
  verifyAttempts?: number;
  /** Delay between re-reads, in ms. */
  verifyDelayMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

const DEFAULT_VERIFY_ATTEMPTS = 5;
const DEFAULT_VERIFY_DELAY_MS = 1500;

export interface RecalculateResult {
  handle: string;
  footprint: Footprint;
  /** Only populated in --apply mode. */
  beforeSnapshot: SnapshotRow | null;
  /** Only populated in --apply mode. */
  afterSnapshot: SnapshotRow | null;
  /** null in dry-run mode (not applicable). */
  changed: boolean | null;
  deletedRedisKeys: string[];
  dirtyMarkerSet: boolean;
  triggerRequested: boolean;
  triggerStatus: number | null;
}

export async function recalculateHandle(
  cfg: Config,
  rawHandle: string,
  apply: boolean,
  baseUrl: string,
  today: string,
  options: RecalculateOptions = {},
): Promise<RecalculateResult> {
  // Validate BEFORE building any key or URL — this is the only injection barrier.
  const handle = normalizeHandle(rawHandle);
  const footprint = computeFootprint(handle, baseUrl, today);

  if (!apply) {
    // Dry run performs NO network calls — the footprint above is the entire
    // report, deterministically derived from the handle/date/baseUrl alone.
    return {
      handle,
      footprint,
      beforeSnapshot: null,
      afterSnapshot: null,
      changed: null,
      deletedRedisKeys: [],
      dirtyMarkerSet: false,
      triggerRequested: false,
      triggerStatus: null,
    };
  }

  const {
    verifyAttempts = DEFAULT_VERIFY_ATTEMPTS,
    verifyDelayMs = DEFAULT_VERIFY_DELAY_MS,
    sleepFn = defaultSleep,
  } = options;

  const beforeSnapshot = await supaFetchSnapshotRow(cfg, handle, today);

  const deletedRedisKeys: string[] = [];
  await redis(cfg, ["DEL", footprint.mergedKey]);
  deletedRedisKeys.push(footprint.mergedKey);
  await redis(cfg, ["DEL", footprint.snapshotKey]);
  deletedRedisKeys.push(footprint.snapshotKey);
  for (const key of footprint.badgeKeys) {
    await redis(cfg, ["DEL", key]);
    deletedRedisKeys.push(key);
  }

  // Load-bearing: MUST happen before the trigger request. `materializeProfile`
  // reads this marker synchronously on the very next badge request, and it is
  // the only thing that makes the corrected value overwrite today's row
  // instead of hitting the UNIQUE(handle, date) constraint as a no-op
  // duplicate. TTL matches the real writer's (`markStatsDirty`) exactly.
  await redis(cfg, ["SET", footprint.dirtyKey, "1", "EX", String(footprint.dirtyTtlSeconds)]);
  const dirtyMarkerSet = true;

  let triggerStatus: number | null = null;
  try {
    const res = await fetch(footprint.triggerUrl);
    triggerStatus = res.status;
  } catch {
    // Request attempted but failed (network error, timeout, etc.) — reported
    // via triggerStatus: null rather than aborting the whole run.
  }
  // The request is always attempted, whether or not it succeeded.
  const triggerRequested = true;

  // The durable snapshot write runs in Vercel's after() — AFTER the HTTP
  // response above was already sent (#1013) — so an immediate single re-read
  // would frequently and falsely report "unchanged". Poll briefly instead.
  let afterSnapshot = await supaFetchSnapshotRow(cfg, handle, today);
  for (
    let attempt = 1;
    attempt < verifyAttempts && !snapshotChanged(beforeSnapshot, afterSnapshot);
    attempt++
  ) {
    await sleepFn(verifyDelayMs);
    afterSnapshot = await supaFetchSnapshotRow(cfg, handle, today);
  }

  return {
    handle,
    footprint,
    beforeSnapshot,
    afterSnapshot,
    changed: snapshotChanged(beforeSnapshot, afterSnapshot),
    deletedRedisKeys,
    dirtyMarkerSet,
    triggerRequested,
    triggerStatus,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function run(rawArgs: string[]): Promise<void> {
  const { handles, apply, baseUrl } = parseArgs(rawArgs);
  const cfg = loadConfig();
  const today = todayUtc();

  const mode = apply ? "APPLY (mutating)" : "DRY RUN (read-only, no network calls)";
  console.log(
    `\n=== ${mode} — recalculating ${handles.length} handle(s) for ${today} against ${baseUrl} ===\n`,
  );

  for (const rawHandle of handles) {
    const result = await recalculateHandle(cfg, rawHandle, apply, baseUrl, today);
    const f = result.footprint;
    console.log(`--- ${result.handle} ---`);
    console.log(`  Would DELETE: ${f.mergedKey}`);
    console.log(`  Would DELETE: ${f.snapshotKey}`);
    for (const k of f.badgeKeys) console.log(`  Would DELETE: ${k}`);
    console.log(`  Would SET:    ${f.dirtyKey} = 1 (EX ${f.dirtyTtlSeconds}s)`);
    console.log(`  Would GET:    ${f.triggerUrl}  (anonymous — resolves to server GITHUB_TOKEN, #1050)`);
    console.log(`  NEVER touched (protected baseline): ${f.protectedBaselineKey}`);

    if (apply) {
      console.log(`  -> DELETED ${result.deletedRedisKeys.length} Redis key(s)`);
      console.log(`  -> SET dirty marker: ${result.dirtyMarkerSet}`);
      console.log(
        `  -> Triggered ${f.triggerUrl} -> HTTP ${result.triggerStatus ?? "ERROR (request failed)"}`,
      );
      console.log(
        `  -> Snapshot for ${today}: ${result.changed ? "CHANGED" : "UNCHANGED"} ` +
          `(before: ${result.beforeSnapshot ? "existed" : "none"}, ` +
          `after: ${result.afterSnapshot ? "existed" : "none"})`,
      );
    }
  }

  console.log(`\n=== Summary ===`);
  if (!apply) {
    const baseUrlFlag = baseUrl === DEFAULT_BASE_URL ? "" : ` --base-url=${baseUrl}`;
    console.log(
      `\nDRY RUN only — nothing was deleted, no dirty marker was set, no request was sent.\n` +
        `Re-run with --apply to force recalculation for the handle(s) above:\n` +
        `  tsx scripts/recalculate-handles.ts ${handles.join(" ")} --apply${baseUrlFlag}`,
    );
  } else {
    console.log(
      `\nRecalculation triggered for ${handles.length} handle(s). "CHANGED" above means the ` +
        `metrics_snapshots row for ${today} was observed to differ before vs. after — an ` +
        `observation, not an assumption. "UNCHANGED" can legitimately mean the corrected code ` +
        `produces the same score as before, not that the recompute failed.`,
    );
  }
}

// Only run when executed directly (not when imported by tests).
const isDirectRun =
  typeof process !== "undefined" &&
  !!process.argv[1] &&
  (process.argv[1].endsWith("recalculate-handles.ts") ||
    process.argv[1].endsWith("recalculate-handles"));

if (isDirectRun) {
  run(process.argv.slice(2)).catch((err) => {
    console.error("\nError:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
