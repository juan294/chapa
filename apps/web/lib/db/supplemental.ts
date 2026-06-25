/**
 * Supabase data access — supplemental_stats table.
 *
 * Durable persistence for supplemental EMU/work-account uploads from the CLI.
 * Redis remains the hot read path with a 24h TTL; this table is the source of
 * truth so a missed CLI upload doesn't silently drop work data from scores.
 *
 * All operations fail-open (return sensible defaults when DB is unavailable).
 * See issue #825.
 */

import type { SupplementalStats, StatsData } from "@chapa/shared";
import { getSupabase } from "./supabase";
import { parseRow } from "./parse-row";

interface SupplementalRow {
  target_handle: string;
  source_handle: string;
  stats: StatsData;
  uploaded_at: string;
}

const REQUIRED_KEYS: readonly (keyof SupplementalRow & string)[] = [
  "target_handle",
  "source_handle",
  "stats",
  "uploaded_at",
];

const SELECT_COLUMNS = "target_handle, source_handle, stats, uploaded_at" as const;

function rowToSupplemental(row: SupplementalRow): SupplementalStats {
  return {
    targetHandle: row.target_handle,
    sourceHandle: row.source_handle,
    stats: row.stats,
    uploadedAt: row.uploaded_at,
  };
}

/**
 * Upsert a supplemental stats record. One row per target handle — the latest
 * upload replaces any prior one.
 * Returns true on success, false when DB is unavailable or on error.
 */
export async function dbUpsertSupplemental(
  handle: string,
  supplemental: SupplementalStats,
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const { error } = await db
      .from("supplemental_stats")
      .upsert(
        {
          target_handle: handle.toLowerCase(),
          source_handle: supplemental.sourceHandle,
          stats: supplemental.stats,
          uploaded_at: supplemental.uploadedAt,
        },
        { onConflict: "target_handle" },
      );

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[db] dbUpsertSupplemental failed:", (error as Error).message);
    return false;
  }
}

/**
 * Fetch the persisted supplemental stats for a handle. Returns null on miss
 * or when Supabase is unavailable.
 */
export async function dbGetSupplemental(
  handle: string,
): Promise<SupplementalStats | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("supplemental_stats")
      .select(SELECT_COLUMNS)
      .eq("target_handle", handle.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = parseRow<SupplementalRow>(data, REQUIRED_KEYS, "supplemental_stats");
    return row ? rowToSupplemental(row) : null;
  } catch (error) {
    console.error("[db] dbGetSupplemental failed:", (error as Error).message);
    return null;
  }
}

/**
 * Delete the persisted supplemental stats for a handle (e.g. user opt-out).
 * Returns true on success, false on failure or when Supabase is unavailable.
 */
export async function dbDeleteSupplemental(handle: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const { error } = await db
      .from("supplemental_stats")
      .delete()
      .eq("target_handle", handle.toLowerCase());

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[db] dbDeleteSupplemental failed:", (error as Error).message);
    return false;
  }
}
