/**
 * Supabase data access — studio_configs table.
 *
 * Durable persistence for Creator Studio preview configurations.
 * Redis remains the hot read path with a 365-day TTL; this table is the
 * source of truth so Redis eviction doesn't permanently destroy a user's
 * saved Studio preview configuration. See issue #935.
 *
 * Read operations fail open when the database is unavailable. Upserts return
 * typed failure results so callers can handle each failure explicitly.
 */

import { getSupabase } from "./supabase";
import { parseRow } from "./parse-row";
import { cacheDel, cacheGet, cacheSet } from "../cache/redis";
import { withTimeout } from "../async/with-timeout";
import { isValidBadgeConfig } from "../validation";
import type { BadgeConfig } from "@chapa/shared";

export const STUDIO_CONFIG_TTL = 31536000;
export const STUDIO_CONFIG_NEGATIVE_TTL = 60;
export const STUDIO_CONFIG_READ_TIMEOUT_MS = 2_000;
export const STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY = {
  kind: "studio-config-not-found",
  version: 1,
} as const;

export type StudioConfigUpsertResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unavailable" | "constraint" | "error";
      code?: string;
    };

export type StudioConfigReadResult =
  | { status: "found"; config: BadgeConfig }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "invalid" };

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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
}

function isNegativeCacheEntry(
  value: unknown,
): value is typeof STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    entry.kind === STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY.kind &&
    entry.version === STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY.version
  );
}

async function setCacheBestEffort(
  cacheKey: string,
  value: unknown,
  ttl: number,
  operation: string,
): Promise<boolean> {
  try {
    const stored = await cacheSet(cacheKey, value, ttl);
    if (!stored) {
      console.warn(
        `[studio/config] Redis ${operation} failed (best-effort):`,
        "cacheSet returned false",
      );
    }
    return stored;
  } catch (error) {
    console.warn(
      `[studio/config] Redis ${operation} failed (best-effort):`,
      errorMessage(error),
    );
    return false;
  }
}

/** Publish a committed Studio config to Redis without changing API success. */
export async function cacheStudioConfig(
  login: string,
  config: BadgeConfig,
): Promise<void> {
  const cacheKey = `config:${login.toLowerCase()}`;
  const stored = await setCacheBestEffort(
    cacheKey,
    config,
    STUDIO_CONFIG_TTL,
    "write",
  );
  if (!stored) {
    // A failed publication must not leave an older year-long value
    // authoritative after Redis recovers.
    await cacheDel(cacheKey);
  }
}

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

    console.error(
      "[db] dbUpsertStudioConfig failed:",
      errorMessage(error),
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
 * Fetch and validate the persisted Studio config while preserving distinct
 * miss, unavailable, and invalid outcomes.
 */
export async function dbGetStudioConfig(
  handle: string,
): Promise<StudioConfigReadResult> {
  const db = getSupabase();
  if (!db) return { status: "unavailable" };

  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        db
          .from("studio_configs")
          .select("handle, config, updated_at")
          .eq("handle", handle.toLowerCase())
          .maybeSingle(),
      ),
      STUDIO_CONFIG_READ_TIMEOUT_MS,
      "dbGetStudioConfig",
    );

    if (error) throw error;
    if (!data) return { status: "not_found" };

    const row = parseRow<StudioConfigRow>(data, REQUIRED_KEYS, "studio_configs");
    if (!row || !isValidBadgeConfig(row.config)) {
      console.error(
        "[STUDIO_CONFIG_FALLBACK] Invalid persisted Studio configuration",
        { handle: handle.toLowerCase() },
      );
      return { status: "invalid" };
    }

    return { status: "found", config: row.config };
  } catch (error) {
    console.error(
      "[STUDIO_CONFIG_FALLBACK] dbGetStudioConfig failed:",
      errorMessage(error),
    );
    return { status: "unavailable" };
  }
}

/** Load and validate a Studio config from Redis, then durable Supabase storage. */
export async function loadStudioConfig(
  login: string,
): Promise<StudioConfigReadResult> {
  const normalizedLogin = login.toLowerCase();
  const cacheKey = `config:${normalizedLogin}`;
  let cached: unknown = null;

  try {
    cached = await withTimeout(
      cacheGet<unknown>(cacheKey),
      STUDIO_CONFIG_READ_TIMEOUT_MS,
      "loadStudioConfig cache read",
    );
  } catch (error) {
    console.error(
      "[STUDIO_CONFIG_FALLBACK] Studio config cache read failed:",
      errorMessage(error),
    );
  }

  if (isNegativeCacheEntry(cached)) return { status: "not_found" };
  if (cached !== null) {
    if (isValidBadgeConfig(cached)) {
      return { status: "found", config: cached };
    }
    console.error(
      "[STUDIO_CONFIG_FALLBACK] Invalid cached Studio configuration",
      { handle: normalizedLogin },
    );
    await cacheDel(cacheKey);
  }

  const dbResult = await dbGetStudioConfig(normalizedLogin);
  if (dbResult.status === "not_found") {
    void setCacheBestEffort(
      cacheKey,
      STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY,
      STUDIO_CONFIG_NEGATIVE_TTL,
      "negative-cache write",
    );
    return dbResult;
  }
  if (dbResult.status !== "found") return dbResult;

  void setCacheBestEffort(
    cacheKey,
    dbResult.config,
    STUDIO_CONFIG_TTL,
    "rehydration",
  );

  return dbResult;
}
