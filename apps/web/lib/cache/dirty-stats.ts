/**
 * Dirty-stats signal — set when scoring inputs have legitimately changed
 * mid-day (e.g. supplemental EMU upload) so the smoothing policy and
 * snapshot persistence layer can refresh today's stored score instead of
 * waiting for tomorrow's cron run. See issue #826.
 */

import { cacheGet, cacheSet, cacheDel } from "./redis";

/** TTL for the dirty marker. 1 hour is long enough to survive a normal user
 * page-load round trip after the upload, and short enough that a stale flag
 * never lingers across days. The marker is also cleared explicitly once a
 * fresh snapshot has been persisted. */
export const DIRTY_STATS_TTL = 3600;

export function dirtyStatsKey(handle: string): string {
  return `stats:dirty:${handle.toLowerCase()}`;
}

/** Mark a handle's stats as having changed since today's snapshot was taken. */
export async function markStatsDirty(handle: string): Promise<void> {
  await cacheSet(dirtyStatsKey(handle), 1, DIRTY_STATS_TTL);
}

/** Has the handle been marked dirty since today's snapshot? */
export async function isStatsDirty(handle: string): Promise<boolean> {
  const value = await cacheGet<number>(dirtyStatsKey(handle));
  return value != null;
}

/** Clear the dirty marker after a fresh snapshot has been persisted. */
export async function clearStatsDirty(handle: string): Promise<void> {
  await cacheDel(dirtyStatsKey(handle));
}
