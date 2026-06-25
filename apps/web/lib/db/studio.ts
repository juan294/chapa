/**
 * Supabase data access — studio_configs table.
 *
 * Durable persistence for Creator Studio badge customization configs.
 * Redis remains the hot read path with a 365-day TTL; this table is the
 * source of truth so Redis eviction doesn't permanently destroy a user's
 * badge customization. See issue #935.
 *
 * All operations fail-open (return sensible defaults when DB is unavailable).
 */

import { getSupabase } from "./supabase";
import { parseRow } from "./parse-row";

interface StudioConfigRow {
  handle: string;
  config: unknown;
  updated_at: string;
}

const REQUIRED_KEYS: readonly (keyof StudioConfigRow & string)[] = [
  "handle",
  "config",
  "updated_at",
];

/**
 * Upsert a studio config for a handle. One row per handle — the latest save
 * replaces any prior one.
 * Returns true on success, false when DB is unavailable or on error.
 */
export async function dbUpsertStudioConfig(
  handle: string,
  config: unknown,
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const { error } = await db
      .from("studio_configs")
      .upsert(
        {
          handle: handle.toLowerCase(),
          config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "handle" },
      );

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[db] dbUpsertStudioConfig failed:", (error as Error).message);
    return false;
  }
}

/**
 * Fetch the persisted studio config for a handle. Returns null on miss or
 * when Supabase is unavailable.
 */
export async function dbGetStudioConfig(handle: string): Promise<unknown | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("studio_configs")
      .select("handle, config, updated_at")
      .eq("handle", handle.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = parseRow<StudioConfigRow>(data, REQUIRED_KEYS, "studio_configs");
    return row ? row.config : null;
  } catch (error) {
    console.error("[db] dbGetStudioConfig failed:", (error as Error).message);
    return null;
  }
}
