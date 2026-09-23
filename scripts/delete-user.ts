#!/usr/bin/env tsx
/**
 * Delete a single user and ALL data associated with their handle.
 *
 * Removes the user from every per-handle Supabase table and every Redis
 * (Upstash) key that references the handle. Use this to wipe a test account
 * so it can be re-created from scratch, or to honour a deletion request.
 *
 * Usage:
 *   tsx scripts/delete-user.ts <handle>            # DRY RUN — discover only (default, safe)
 *   tsx scripts/delete-user.ts <handle> --delete   # actually delete, then verify
 *
 * Dry-run is the default on purpose: this operation is irreversible and runs
 * against PRODUCTION. Always review the dry-run footprint before --delete.
 *
 * Talks to the Supabase (PostgREST) and Upstash (REST) HTTP APIs directly so
 * it has no package dependencies beyond tsx and runs from the repo root.
 *
 * Requires env vars (auto-loaded from .env.local at repo root if not already set):
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Handle matching is case-insensitive (handles are stored lowercased).
 */

import { loadConfig, type Config } from "./lib/env";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in delete-user.test.ts)
// ---------------------------------------------------------------------------

/**
 * Every Supabase table that stores per-user rows, keyed by handle column.
 *
 * A table appears once per handle-bearing column: `merge_operations` and
 * `supplemental_stats` each record BOTH sides of an EMU merge, and the work
 * account named in `source_handle` is this user's data just as much as the
 * primary identity in `target_handle` is.
 *
 * Keep this list exhaustive. `delete-user.test.ts` reads
 * `supabase/migrations/` and fails if any handle-bearing column is missing
 * here, because the script's verify pass only re-checks the tables it knows
 * about — an omission reports a clean deletion while leaving rows behind.
 */
export const SUPABASE_TABLES: ReadonlyArray<{ table: string; column: string; deletion?: "scoring_v7_rpc" }> =
  [
    { table: "users", column: "handle" },
    { table: "metrics_snapshots", column: "handle" },
    { table: "verification_records", column: "handle" },
    // Also removes platform_token_refresh_attempts through its mandatory
    // link_id -> user_platforms.id ON DELETE CASCADE (migration046). That
    // operational child has no handle column; do not filter its UUID by handle.
    { table: "user_platforms", column: "handle" },
    { table: "studio_configs", column: "handle" },
    { table: "supplemental_stats", column: "target_handle" },
    { table: "supplemental_stats", column: "source_handle" },
    { table: "merge_operations", column: "target_handle" },
    { table: "merge_operations", column: "source_handle" },
    { table: "tool_insights", column: "handle" },
    { table: "campaign_sends", column: "handle" },
    // Enumerate for discovery; only the atomic RPC may delete v7 data.
    { table: "scoring_v7_subjects", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_v7_sources", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_v7_source_observations", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_v7_reviewer_grants", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_v7_reviewer_grants", column: "reviewer_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_v7_evidence_references", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_v7_evidence", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_v7_assessments", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_v7_assessments", column: "evaluator_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_v7_raw_artifacts", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_v7_receipts", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_v7_trend_anchors", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "report_craft_reports", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "report_craft_selection", column: "owner_handle", deletion: "scoring_v7_rpc" },
    { table: "scoring_observed_current", column: "owner_handle", deletion: "scoring_v7_rpc" },
    // scoring_collection_jobs.owner_handle REFERENCES scoring_v7_subjects
    // ON DELETE CASCADE (migration 055, #1335 phase 3); staged events cascade
    // again from the job row. Enumerated for discovery only -- the withdrawal
    // RPC's cascade already removes both, same as every other row above.
    { table: "scoring_collection_jobs", column: "owner_handle", deletion: "scoring_v7_rpc" },
  ];

export interface Args {
  handle: string;
  doDelete: boolean;
}

export function parseArgs(argv: string[]): Args {
  const doDelete = argv.includes("--delete");
  const handle = argv.find((a) => !a.startsWith("--"));
  if (!handle) {
    throw new Error(
      "Missing required <handle> argument.\n" +
        "Usage: tsx scripts/delete-user.ts <handle> [--delete]",
    );
  }
  return { handle, doDelete };
}

/**
 * Lowercase + trim a handle and assert it is a valid GitHub-style handle.
 *
 * This is the critical safety guard: the handle is interpolated into a Redis
 * SCAN glob (`*<handle>*`) and PostgREST `eq` filters. A stray `*`, space, or
 * punctuation could turn a targeted delete into a mass delete or a broken
 * query, so we hard-fail on anything outside [a-z0-9-].
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

export function redisScanPattern(handle: string): string {
  return `*${handle}*`;
}

function receiptCacheKeys(revisionId: string): string[] {
  return ["v7", "v7.2"].map(policy => `snapshot:${policy}:receipt:${revisionId}`);
}

/** A SCAN substring is discovery only; ownership follows an explicit namespace schema. */
export function classifyRedisOwnership(key: string, handle: string, revisionIds: readonly string[] = []): "owned" | "foreign" | "unresolved" {
  if (revisionIds.some(id => receiptCacheKeys(id).includes(key))) return "owned";
  const fields = key.split(":");
  let owner: string | undefined;
  if (fields.length === 2 && ["avatar", "history", "supplemental", "score-bump", "verify-handle"].includes(fields[0]!)) owner = fields[1];
  else if (fields[0] === "history" && fields.length >= 3 && fields.length <= 4 && fields.slice(2).every(date => /^\d{4}-\d{2}-\d{2}$/.test(date))) owner = fields[1];
  else if (fields.length === 3 && ((fields[0] === "craft" && fields[1] === "v2") || (fields[0] === "supplemental" && fields[1] === "v7") || (fields[0] === "stats" && fields[1] === "dirty") || (fields[0] === "badge" && fields[1] === "notified"))) owner = fields[2];
  else if (fields.length === 4 && ((fields[0] === "stats" && fields[1] === "v2" && ["merged", "github", "gitlab", "bitbucket", "codeberg"].includes(fields[2]!)) || (fields[0] === "stats" && fields[1] === "stale" && fields[2] === "v2") || (fields[0] === "snapshot" && fields[1] === "v2" && fields[2] === "latest"))) owner = fields[3];
  else if (fields.length === 5 && fields[0] === "stats" && fields[1] === "v2" && ["github", "gitlab", "bitbucket", "codeberg"].includes(fields[2]!) && fields[4] === "neg") owner = fields[3];
  else if (fields.length === 4 && fields[0] === "sideeffects" && fields[1] === "done" && /^\d{4}-\d{2}-\d{2}$/.test(fields[3]!)) owner = fields[2];
  else if (fields.length === 6 && ((fields[0] === "badge" && fields[1] === "v2") || (fields[0] === "og-image" && fields[1] === "v5"))) owner = fields[2];
  else if (fields.length === 7 && (((fields[0] === "badge" || fields[0] === "badge-lock") && fields[1] === "v2") || (fields[0] === "og-image" && fields[1] === "v5")) && ["v6", "v7.2"].includes(fields[4]!) && /^\d{4}-\d{2}-\d{2}$/.test(fields[5]!) && ["en", "es"].includes(fields[6]!)) owner = fields[2];
  return owner === undefined ? "unresolved" : owner === handle ? "owned" : "foreign";
}

function receiptIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(id => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))) throw new Error("Invalid receipt cleanup response");
  return [...new Set(value as string[])];
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
    throw new Error(`Redis ${cmd[0]} failed: ${res.status}`);
  }
  const body = await res.json();
  if (body.error || !("result" in body)) throw new Error("Redis command failed");
  return body.result;
}

async function scanAllKeys(cfg: Config, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = (await redis(cfg, [
      "SCAN",
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      "500",
    ])) as [string, string[]];
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");
  return [...new Set(keys)].sort();
}

// ---------------------------------------------------------------------------
// Supabase PostgREST
// ---------------------------------------------------------------------------

async function supaCount(
  cfg: Config,
  table: string,
  column: string,
  handle: string,
): Promise<number> {
  const res = await fetch(
    `${cfg.supaUrl}/rest/v1/${table}?${column}=eq.${handle}&select=${column}`,
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
    throw new Error(`count ${table}: ${res.status}`);
  }
  const range = res.headers.get("content-range"); // "*/<total>"
  return range ? Number(range.split("/")[1]) : 0;
}

async function supaDelete(
  cfg: Config,
  table: string,
  column: string,
  handle: string,
): Promise<number> {
  const res = await fetch(
    `${cfg.supaUrl}/rest/v1/${table}?${column}=eq.${handle}`,
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
    throw new Error(`delete ${table}: ${res.status}`);
  }
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as unknown[]).length : 0;
  } catch {
    return 0;
  }
}

/** Preserve issued-receipt revocations and cross-owner reviewer cleanup atomically. */
async function deleteScoringV7User(cfg: Config, handle: string): Promise<string[]> {
  const res = await fetch(`${cfg.supaUrl}/rest/v1/rpc/scoring_v7_delete_user_with_receipts`, {
    method: "POST",
    headers: {
      apikey: cfg.supaKey,
      Authorization: `Bearer ${cfg.supaKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_handle: handle }),
  });
  if (!res.ok) {
    throw new Error(`scoring_v7_delete_user: ${res.status}`);
  }
  return receiptIds(await res.json());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function run(rawArgs: string[]): Promise<void> {
  const { handle: rawHandle, doDelete } = parseArgs(rawArgs);
  const handle = normalizeHandle(rawHandle);
  const cfg = loadConfig();

  const mode = doDelete ? "DELETION" : "DRY RUN (read-only)";
  console.log(`\n=== ${mode} for handle: ${handle} ===\n`);

  // --- Supabase ---
  console.log("--- Supabase ---");
  let revisionIds: string[] = [];
  if (doDelete) {
    // Fail before legacy/Redis destruction if tombstone-preserving cleanup fails.
    revisionIds = await deleteScoringV7User(cfg, handle);
    console.log("  v7 scoring data withdrawn atomically; receipt revocations retained.");
  }
  let totalRows = 0;
  for (const { table, column, deletion } of SUPABASE_TABLES) {
    const count = await supaCount(cfg, table, column, handle);
    totalRows += count;
    console.log(`  ${table.padEnd(22)} ${column}=${handle}: ${count} row(s)`);
    if (doDelete && deletion === "scoring_v7_rpc" && count > 0) {
      throw new Error(`scoring_v7_delete_user left rows in ${table}.${column}`);
    }
    if (doDelete && deletion !== "scoring_v7_rpc" && count > 0) {
      const deleted = await supaDelete(cfg, table, column, handle);
      console.log(`      -> DELETED ${deleted} row(s)`);
    }
  }

  // --- Redis ---
  console.log("\n--- Redis (Upstash) ---");
  const pattern = redisScanPattern(handle);
  const discovered = await scanAllKeys(cfg, pattern);
  const keys = [...new Set([...discovered.filter(key => classifyRedisOwnership(key, handle, revisionIds) === "owned"), ...revisionIds.flatMap(receiptCacheKeys)])];
  const unresolved = discovered.filter(key => classifyRedisOwnership(key, handle, revisionIds) === "unresolved").length;
  console.log(`  Found ${keys.length} key(s) with proven ownership; ${unresolved} unresolved namespace match(es).`);
  // Never print keys: unknown namespaces may embed private project names or tokens.
  let failedKeys = 0;
  if (doDelete) {
    for (const key of keys) {
      try {
        const deleted = await redis(cfg, ["DEL", key]);
        if (deleted !== 0 && deleted !== 1) failedKeys++;
      } catch { failedKeys++; }
    }
    console.log(`  -> Removed/absent ${keys.length - failedKeys} key(s); ${failedKeys} failed.`);
  }

  // --- Summary ---
  console.log(`\n=== Summary ===`);
  console.log(`  Supabase rows: ${totalRows}`);
  console.log(`  Redis keys:    ${keys.length}`);
  if (!doDelete) {
    if (totalRows + keys.length === 0) {
      console.log(`\nNo data found for "${handle}". Nothing to delete.`);
    } else {
      console.log(
        `\nDRY RUN only — nothing was deleted.\n` +
          `Re-run with --delete to remove the data above:\n` +
          `  tsx scripts/delete-user.ts ${handle} --delete`,
      );
    }
  } else {
    if (unresolved > 0 || failedKeys > 0) throw new Error(`Deletion incomplete: ${unresolved} unresolved namespace match(es), ${failedKeys} failed cache removal(s).`);
    if (revisionIds.length === 0) {
      console.log("  Deletion accepted; receipt cache cleanup pending confirmation by the recurring background sweep.");
      // Nonzero CLI status prevents automation from treating an erased mapping
      // as proof that a previous failed receipt deletion completed.
      throw new Error("Deletion accepted; receipt cache cleanup pending background confirmation.");
    }
    console.log(`\nKnown owned data removed. Re-run discovery to verify; recurring receipt sweep handles late writes.`);
  }
}

// Only run when executed directly (not when imported by tests).
const isDirectRun =
  typeof process !== "undefined" &&
  !!process.argv[1] &&
  (process.argv[1].endsWith("delete-user.ts") ||
    process.argv[1].endsWith("delete-user"));

if (isDirectRun) {
  run(process.argv.slice(2)).catch(() => {
    console.error("\nDeletion did not complete; review the content-free progress counters above.");
    process.exit(1);
  });
}
