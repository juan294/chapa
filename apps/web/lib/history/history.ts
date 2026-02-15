import { getRawRedis } from "@/lib/cache/redis";
import type { MetricsSnapshot } from "./types";

/** Redis key prefix for history sorted sets. */
const KEY_PREFIX = "history:";

/** Maximum snapshots to retain per user (one per day, ~1 year). */
const MAX_SNAPSHOTS = 365;

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

    // Fire-and-forget: prune old entries to prevent unbounded growth
    pruneSnapshots(handle, MAX_SNAPSHOTS).catch(() => {});

    return true;
  } catch (error) {
    console.error("[history] recordSnapshot failed:", (error as Error).message);
    return false;
  }
}

/**
 * Get all snapshots for a user, optionally filtered by date range.
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
  const redis = getRawRedis();
  if (!redis) return [];

  const key = historyKey(handle);
  const min = from ? dateToScore(from) : "-inf";
  const max = to ? dateToScore(to) : "+inf";

  try {
    const members = await redis.zrange<string[]>(key, min, max, {
      byScore: true,
    });
    return members.map((m) => JSON.parse(m) as MetricsSnapshot);
  } catch (error) {
    console.error("[history] getSnapshots failed:", (error as Error).message);
    return [];
  }
}

/**
 * Get the most recent snapshot for a user.
 * Returns `null` if no snapshots exist or on error.
 *
 * @prebuilt Part of the pre-built history API surface — intended for
 * future consumers (share page, admin dashboard). Not yet imported.
 */
export async function getLatestSnapshot(
  handle: string,
): Promise<MetricsSnapshot | null> {
  const redis = getRawRedis();
  if (!redis) return null;

  const key = historyKey(handle);

  try {
    const members = await redis.zrange<string[]>(key, "+inf", "-inf", {
      byScore: true,
      rev: true,
      count: 1,
      offset: 0,
    });
    const first = members?.[0];
    if (!first) return null;
    return JSON.parse(first) as MetricsSnapshot;
  } catch (error) {
    console.error(
      "[history] getLatestSnapshot failed:",
      (error as Error).message,
    );
    return null;
  }
}

/**
 * Get the total number of snapshots stored for a user.
 * Returns 0 on error or if Redis is unavailable.
 *
 * @prebuilt Part of the pre-built history API surface — intended for
 * future consumers (share page, admin dashboard). Not yet imported.
 */
export async function getSnapshotCount(handle: string): Promise<number> {
  const redis = getRawRedis();
  if (!redis) return 0;

  try {
    return await redis.zcard(historyKey(handle));
  } catch (error) {
    console.error(
      "[history] getSnapshotCount failed:",
      (error as Error).message,
    );
    return 0;
  }
}

/**
 * Prune oldest snapshots from a user's history sorted set.
 *
 * Uses ZREMRANGEBYRANK to remove entries from the low end (oldest scores)
 * when the total count exceeds `maxEntries`. This prevents unbounded growth
 * of history sorted sets over time.
 *
 * Designed to be called fire-and-forget after `recordSnapshot` writes.
 * Silently no-ops if Redis is unavailable or on error.
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
