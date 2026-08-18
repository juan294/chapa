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

/** Every Supabase table that stores per-user rows, keyed by handle column. */
export const SUPABASE_TABLES: ReadonlyArray<{ table: string; column: string }> =
  [
    { table: "users", column: "handle" },
    { table: "metrics_snapshots", column: "handle" },
    { table: "verification_records", column: "handle" },
    { table: "user_platforms", column: "handle" },
    { table: "supplemental_stats", column: "target_handle" },
    { table: "tool_insights", column: "handle" },
    { table: "campaign_sends", column: "handle" },
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
    throw new Error(`count ${table}: ${res.status} ${await res.text()}`);
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
    throw new Error(`delete ${table}: ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as unknown[]).length : 0;
  } catch {
    return 0;
  }
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
  let totalRows = 0;
  for (const { table, column } of SUPABASE_TABLES) {
    const count = await supaCount(cfg, table, column, handle);
    totalRows += count;
    console.log(`  ${table.padEnd(22)} ${column}=${handle}: ${count} row(s)`);
    if (doDelete && count > 0) {
      const deleted = await supaDelete(cfg, table, column, handle);
      console.log(`      -> DELETED ${deleted} row(s)`);
    }
  }

  // --- Redis ---
  console.log("\n--- Redis (Upstash) ---");
  const pattern = redisScanPattern(handle);
  const keys = await scanAllKeys(cfg, pattern);
  console.log(`  Found ${keys.length} key(s) matching ${pattern}:`);
  for (const k of keys) console.log(`    ${k}`);
  if (doDelete && keys.length > 0) {
    for (const k of keys) await redis(cfg, ["DEL", k]);
    console.log(`  -> DELETED ${keys.length} key(s)`);
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
    console.log(`\nDeletion complete. Re-run without --delete to verify zero.`);
  }
}

// Only run when executed directly (not when imported by tests).
const isDirectRun =
  typeof process !== "undefined" &&
  !!process.argv[1] &&
  (process.argv[1].endsWith("delete-user.ts") ||
    process.argv[1].endsWith("delete-user"));

if (isDirectRun) {
  run(process.argv.slice(2)).catch((err) => {
    console.error("\nError:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
