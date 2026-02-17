import { getRawRedis } from "@/lib/cache/redis";
import {
  dbInsertSnapshot,
  dbGetSnapshots,
  dbGetLatestSnapshot,
  dbGetSnapshotCount,
} from "@/lib/db/snapshots";
import type { MetricsSnapshot } from "./types";

/** Redis key prefix for history sorted sets. */
const KEY_PREFIX = "history:";

/** Build the Redis key for a user's history. */
function historyKey(handle: string): string {
  return `${KEY_PREFIX}${handle.toLowerCase()}`;
}

/** Convert a YYYY-MM-DD date to Unix timestamp (midnight UTC, seconds). */
function dateToScore(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getTime() / 1000;
}

/**
 * Record a snapshot in the user's history sorted set.
 *
 * Deduplicates by checking if any member with today's date score already
 * exists (via ZRANGE BYSCORE with LIMIT 1). This ensures at most one
 * snapshot per user per day, even if `capturedAt` timestamps differ.
 *
 * Returns `true` if written, `false` if skipped (duplicate) or on error.
 */
export async function recordSnapshot(
  handle: string,
  snapshot: MetricsSnapshot,
): Promise<boolean> {
  const redis = getRawRedis();
  if (!redis) return false;

  const key = historyKey(handle);
  const score = dateToScore(snapshot.date);

  try {
    // Check if any snapshot for this date already exists
    const existing = await redis.zrange(key, score, score, {
      byScore: true,
      count: 1,
      offset: 0,
    });
    if (existing && existing.length > 0) return false;

    await redis.zadd(key, { score, member: JSON.stringify(snapshot) });

    // Dual-write to Supabase (fire-and-forget)
    dbInsertSnapshot(handle, snapshot).catch(() => {});

    return true;
  } catch (error) {
    console.error("[history] recordSnapshot failed:", (error as Error).message);
    return false;
  }
}

/**
 * Get all snapshots for a user, optionally filtered by date range.
 * Reads from Supabase (Phase 4).
 *
 * @param handle - GitHub handle (case-insensitive)
 * @param from - Start date (YYYY-MM-DD), inclusive. Omit for all-time.
 * @param to - End date (YYYY-MM-DD), inclusive. Omit for all-time.
 */
export async function getSnapshots(
  handle: string,
  from?: string,
  to?: string,
): Promise<MetricsSnapshot[]> {
  return dbGetSnapshots(handle, from, to);
}

/**
 * Get the most recent snapshot for a user.
 * Reads from Supabase (Phase 4).
 * Returns `null` if no snapshots exist or on error.
 */
export async function getLatestSnapshot(
  handle: string,
): Promise<MetricsSnapshot | null> {
  return dbGetLatestSnapshot(handle);
}

/**
 * Get the total number of snapshots stored for a user.
 * Reads from Supabase (Phase 4).
 * Returns 0 on error or if DB is unavailable.
 */
export async function getSnapshotCount(handle: string): Promise<number> {
  return dbGetSnapshotCount(handle);
}

/**
 * Prune oldest snapshots from a user's history sorted set.
 *
 * Uses ZREMRANGEBYRANK to remove entries from the low end (oldest scores)
 * when the total count exceeds `maxEntries`. This prevents unbounded growth
 * of history sorted sets over time.
 *
 * Note: No longer called from recordSnapshot (Phase 4 — Postgres has no row cap).
 * Kept for direct invocation until Phase 5 removes Redis history entirely.
 */
export async function pruneSnapshots(
  handle: string,
  maxEntries: number,
): Promise<void> {
  const redis = getRawRedis();
  if (!redis) return;

  const key = historyKey(handle);

  try {
    const count = await redis.zcard(key);
    if (count <= maxEntries) return;

    // Remove oldest entries: ranks 0 through (count - maxEntries - 1)
    const removeCount = count - maxEntries;
    await redis.zremrangebyrank(key, 0, removeCount - 1);
  } catch (error) {
    console.error("[history] pruneSnapshots failed:", (error as Error).message);
  }
}
