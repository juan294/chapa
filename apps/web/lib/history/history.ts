import {
  dbGetSnapshots,
  dbGetLatestSnapshot,
} from "@/lib/db/snapshots";
import type { MetricsSnapshot } from "./types";

/**
 * Get all snapshots for a user, optionally filtered by date range.
 * Reads from Supabase.
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
 * Reads from Supabase.
 * Returns `null` if no snapshots exist or on error.
 */
export async function getLatestSnapshot(
  handle: string,
): Promise<MetricsSnapshot | null> {
  return dbGetLatestSnapshot(handle);
}

