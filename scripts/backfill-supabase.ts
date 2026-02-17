#!/usr/bin/env tsx
/**
 * Phase 3: Backfill existing Redis data into Supabase.
 *
 * Scans production Redis for permanent data (metric snapshots, user registry,
 * verification records) and inserts into Supabase Postgres tables.
 *
 * Usage:
 *   tsx scripts/backfill-supabase.ts              # full backfill
 *   tsx scripts/backfill-supabase.ts --dry-run    # preview without writing
 *
 * Requires env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
 *                    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent — uses ON CONFLICT DO NOTHING / ignoreDuplicates.
 * Safe to re-run at any time.
 *
 * Refs #354
 */

import { Redis } from "@upstash/redis";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  parseRedisSnapshot,
  parseRedisUser,
  parseRedisVerification,
  snapshotToRow,
  verificationToRow,
} from "./backfill-parsers";

// ---------------------------------------------------------------------------
// Backfill logic
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50;

async function scanAllKeys(redis: Redis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  do {
    const [nextCursor, batch] = await redis.scan(cursor, {
      match: pattern,
      count: 100,
    });
    keys.push(...batch);
    cursor =
      typeof nextCursor === "string" ? parseInt(nextCursor, 10) : nextCursor;
  } while (cursor !== 0);
  return keys;
}

async function backfillSnapshots(
  redis: Redis,
  supabase: SupabaseClient,
  dryRun: boolean,
): Promise<{ scanned: number; inserted: number; errors: number }> {
  console.log("\n--- Backfilling metric snapshots ---");

  const keys = await scanAllKeys(redis, "history:*");
  console.log(`Found ${keys.length} history keys`);

  let scanned = 0;
  let inserted = 0;
  let errors = 0;

  for (const key of keys) {
    const handle = key.replace("history:", "");
    // Upstash auto-deserializes JSON — members are objects, not strings
    const members = await redis.zrange<unknown[]>(key, 0, -1);

    for (const member of members) {
      scanned++;
      const snapshot = parseRedisSnapshot(member);
      if (!snapshot) {
        console.warn(`  [SKIP] Invalid snapshot in ${key}`);
        errors++;
        continue;
      }

      if (dryRun) {
        inserted++;
        continue;
      }

      try {
        const { error } = await supabase
          .from("metrics_snapshots")
          .upsert(snapshotToRow(handle, snapshot), {
            onConflict: "handle,date",
            ignoreDuplicates: true,
          });
        if (error) throw error;
        inserted++;
      } catch (err) {
        console.error(
          `  [ERROR] ${handle}/${snapshot.date}: ${(err as Error).message}`,
        );
        errors++;
      }
    }

    if (scanned % 100 === 0 && scanned > 0) {
      console.log(`  Progress: ${scanned} snapshots processed...`);
    }
  }

  console.log(
    `  Done: ${scanned} scanned, ${inserted} inserted, ${errors} errors`,
  );
  return { scanned, inserted, errors };
}

async function backfillUsers(
  redis: Redis,
  supabase: SupabaseClient,
  dryRun: boolean,
): Promise<{ scanned: number; inserted: number; errors: number }> {
  console.log("\n--- Backfilling user registry ---");

  const keys = await scanAllKeys(redis, "user:registered:*");
  console.log(`Found ${keys.length} registered user keys`);

  let scanned = 0;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    const rows: { handle: string }[] = [];

    for (const key of batch) {
      scanned++;
      const value = await redis.get(key);
      const parsed = parseRedisUser(value);
      if (!parsed) {
        console.warn(`  [SKIP] Invalid user data in ${key}`);
        errors++;
        continue;
      }
      rows.push({ handle: parsed.handle });
    }

    if (dryRun) {
      inserted += rows.length;
      continue;
    }

    if (rows.length > 0) {
      try {
        const { error } = await supabase
          .from("users")
          .upsert(rows, { onConflict: "handle", ignoreDuplicates: true });
        if (error) throw error;
        inserted += rows.length;
      } catch (err) {
        console.error(`  [ERROR] batch insert: ${(err as Error).message}`);
        errors += rows.length;
      }
    }
  }

  console.log(
    `  Done: ${scanned} scanned, ${inserted} inserted, ${errors} errors`,
  );
  return { scanned, inserted, errors };
}

async function backfillVerifications(
  redis: Redis,
  supabase: SupabaseClient,
  dryRun: boolean,
): Promise<{ scanned: number; inserted: number; errors: number }> {
  console.log("\n--- Backfilling verification records ---");

  const keys = await scanAllKeys(redis, "verify:*");
  const hashKeys = keys.filter((k) => !k.startsWith("verify-handle:"));
  console.log(
    `Found ${keys.length} verify keys (${hashKeys.length} hash keys, ${keys.length - hashKeys.length} handle indexes skipped)`,
  );

  let scanned = 0;
  let inserted = 0;
  let errors = 0;

  for (const key of hashKeys) {
    scanned++;
    const hash = key.replace("verify:", "");

    const value = await redis.get(key);
    const record = parseRedisVerification(value);
    if (!record) {
      console.warn(`  [SKIP] Invalid verification in ${key}`);
      errors++;
      continue;
    }

    if (dryRun) {
      inserted++;
      continue;
    }

    try {
      const { error } = await supabase
        .from("verification_records")
        .upsert(verificationToRow(hash, record), {
          onConflict: "hash",
          ignoreDuplicates: true,
        });
      if (error) throw error;
      inserted++;
    } catch (err) {
      console.error(`  [ERROR] ${hash}: ${(err as Error).message}`);
      errors++;
    }
  }

  console.log(
    `  Done: ${scanned} scanned, ${inserted} inserted, ${errors} errors`,
  );
  return { scanned, inserted, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=== Chapa: Backfill Redis → Supabase ===");
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);

  // Connect to Redis
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!redisUrl || !redisToken) {
    console.error(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN",
    );
    process.exit(1);
  }

  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
    retry: { retries: 2, backoff: (n) => n * 1000 },
  });

  // Connect to Supabase
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // Run all three backfills
  const snapshots = await backfillSnapshots(redis, supabase, dryRun);
  const users = await backfillUsers(redis, supabase, dryRun);
  const verifications = await backfillVerifications(redis, supabase, dryRun);

  // Summary
  console.log("\n=== Summary ===");
  console.log(
    `Snapshots:     ${snapshots.inserted}/${snapshots.scanned} (${snapshots.errors} errors)`,
  );
  console.log(
    `Users:         ${users.inserted}/${users.scanned} (${users.errors} errors)`,
  );
  console.log(
    `Verifications: ${verifications.inserted}/${verifications.scanned} (${verifications.errors} errors)`,
  );

  const totalErrors = snapshots.errors + users.errors + verifications.errors;
  if (totalErrors > 0) {
    console.warn(`\n${totalErrors} total errors — check logs above`);
    process.exit(1);
  }

  console.log("\nBackfill complete");
}

// Only run main when executed directly (not imported by tests)
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("backfill-supabase.ts") ||
    process.argv[1].endsWith("backfill-supabase"));

if (isDirectRun) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
