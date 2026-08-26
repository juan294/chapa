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
import { cacheGet, cacheSet } from "../cache/redis";

export const STUDIO_CONFIG_TTL = 31536000;

export type StudioConfigUpsertResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unavailable" | "constraint" | "error";
      code?: string;
    };

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
 * Returns a typed result so the API can distinguish retryable storage outages,
 * invalid persisted values, and unexpected failures.
 */
export async function dbUpsertStudioConfig(
  handle: string,
  config: unknown,
): Promise<StudioConfigUpsertResult> {
  const db = getSupabase();
  if (!db) return { ok: false, reason: "unavailable" };

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
    return { ok: true };
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;

    if (code === "23505") return { ok: true };

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof error.message === "string"
          ? error.message
          : String(error);

    console.error(
      "[db] dbUpsertStudioConfig failed:",
      message,
    );

    if (code === "23502" || code === "22P02" || code === "22003") {
      return { ok: false, reason: "constraint", code };
    }

    return code
      ? { ok: false, reason: "error", code }
      : { ok: false, reason: "error" };
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

/** Load a studio config from Redis, falling back to its durable Supabase row. */
export async function loadStudioConfig(login: string): Promise<unknown | null> {
  const cacheKey = `config:${login}`;
  const cached = await cacheGet<unknown>(cacheKey);
  if (cached !== null) return cached;

  const dbConfig = await dbGetStudioConfig(login);
  if (dbConfig === null) return null;

  void cacheSet(cacheKey, dbConfig, STUDIO_CONFIG_TTL).catch((error: unknown) => {
    console.warn(
      "[studio/config] Redis rehydration failed (best-effort):",
      error instanceof Error ? error.message : String(error),
    );
  });

  return dbConfig;
}
