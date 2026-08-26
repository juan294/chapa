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
import {
  cacheDel,
  cacheGet,
  cacheSetVersioned,
} from "../cache/redis";
import { withTimeout } from "../async/with-timeout";
import { isValidBadgeConfig } from "../validation";
import type { BadgeConfig } from "@chapa/shared";

export const STUDIO_CONFIG_TTL = 31536000;
export const STUDIO_CONFIG_NEGATIVE_TTL = 60;
export const STUDIO_CONFIG_READ_TIMEOUT_MS = 2_000;
export const STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY = {
  kind: "studio-config-not-found",
  version: 1,
  revision: 0,
} as const;
export const STUDIO_CONFIG_CACHE_ENTRY_VERSION = 1;

export type StudioConfigUpsertResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unavailable" | "constraint" | "error";
      code?: string;
    };

export type StudioConfigReadResult =
  | { status: "found"; config: BadgeConfig; revision: number }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "invalid" };

type StudioConfigRevisionReadResult =
  | { status: "found"; revision: number }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "invalid" };

interface StudioConfigRow {
  handle: string;
  config: unknown;
  updated_at: string;
  revision: number;
}

const REQUIRED_KEYS: readonly (keyof StudioConfigRow & string)[] = [
  "handle",
  "config",
  "updated_at",
  "revision",
];

interface StudioConfigCacheEntry {
  kind: "studio-config";
  version: typeof STUDIO_CONFIG_CACHE_ENTRY_VERSION;
  revision: number;
  config: BadgeConfig;
}

function isValidStudioConfigRevision(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

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
    entry.version === STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY.version &&
    entry.revision === STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY.revision
  );
}

function isStudioConfigCacheEntry(value: unknown): value is StudioConfigCacheEntry {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    entry.kind === "studio-config" &&
    entry.version === STUDIO_CONFIG_CACHE_ENTRY_VERSION &&
    typeof entry.revision === "number" &&
    Number.isSafeInteger(entry.revision) &&
    entry.revision > 0 &&
    isValidBadgeConfig(entry.config)
  );
}

/** Publish a committed Studio config to Redis without changing API success. */
export async function cacheStudioConfig(
  login: string,
  config: BadgeConfig,
  revision: number,
): Promise<void> {
  const cacheKey = `config:${login.toLowerCase()}`;
  const entry: StudioConfigCacheEntry = {
    kind: "studio-config",
    version: STUDIO_CONFIG_CACHE_ENTRY_VERSION,
    revision,
    config,
  };
  const stored = await cacheSetVersioned(
    cacheKey,
    entry,
    revision,
    STUDIO_CONFIG_TTL,
  );
  if (stored === "failed") {
    console.warn(
      "[studio/config] Redis write failed (best-effort):",
      "cacheSetVersioned returned failed",
    );
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
          .select("handle, config, updated_at, revision")
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

    if (!isValidStudioConfigRevision(row.revision)) {
      console.error(
        "[STUDIO_CONFIG_FALLBACK] Invalid persisted Studio configuration revision",
        { handle: handle.toLowerCase() },
      );
      return { status: "invalid" };
    }

    return { status: "found", config: row.config, revision: row.revision };
  } catch (error) {
    console.error(
      "[STUDIO_CONFIG_FALLBACK] dbGetStudioConfig failed:",
      errorMessage(error),
    );
    return { status: "unavailable" };
  }
}

/** Read only the durable revision used to validate a cached payload. */
async function dbGetStudioConfigRevision(
  handle: string,
): Promise<StudioConfigRevisionReadResult> {
  const db = getSupabase();
  if (!db) return { status: "unavailable" };

  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        db
          .from("studio_configs")
          .select("revision")
          .eq("handle", handle.toLowerCase())
          .maybeSingle(),
      ),
      STUDIO_CONFIG_READ_TIMEOUT_MS,
      "dbGetStudioConfigRevision",
    );

    if (error) throw error;
    if (!data) return { status: "not_found" };

    const revision = (data as { revision?: unknown }).revision;
    if (!isValidStudioConfigRevision(revision)) {
      console.error(
        "[STUDIO_CONFIG_FALLBACK] Invalid persisted Studio configuration revision",
        { handle: handle.toLowerCase() },
      );
      return { status: "invalid" };
    }

    return { status: "found", revision };
  } catch (error) {
    console.error(
      "[STUDIO_CONFIG_FALLBACK] dbGetStudioConfigRevision failed:",
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

  if (cached !== null) {
    const positiveEntry = isStudioConfigCacheEntry(cached) ? cached : null;
    const negativeEntry = isNegativeCacheEntry(cached);
    if (positiveEntry || negativeEntry) {
      const durableRevision = await dbGetStudioConfigRevision(normalizedLogin);
      if (
        positiveEntry &&
        durableRevision.status === "found" &&
        durableRevision.revision === positiveEntry.revision
      ) {
        return {
          status: "found",
          config: positiveEntry.config,
          revision: positiveEntry.revision,
        };
      }
      if (negativeEntry && durableRevision.status === "not_found") {
        return { status: "not_found" };
      }
      if (
        durableRevision.status === "unavailable" ||
        durableRevision.status === "invalid"
      ) {
        return { status: durableRevision.status };
      }

      await cacheDel(cacheKey);
      if (durableRevision.status === "not_found") {
        void cacheSetVersioned(
          cacheKey,
          STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY,
          STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY.revision,
          STUDIO_CONFIG_NEGATIVE_TTL,
        );
        return { status: "not_found" };
      }
    } else {
      const legacy = isValidBadgeConfig(cached);
      console[legacy ? "warn" : "error"](
        legacy
          ? "[STUDIO_CONFIG_FALLBACK] Migrating unversioned cached Studio configuration"
          : "[STUDIO_CONFIG_FALLBACK] Invalid cached Studio configuration",
        { handle: normalizedLogin },
      );
      await cacheDel(cacheKey);
    }
  }

  const dbResult = await dbGetStudioConfig(normalizedLogin);
  if (dbResult.status === "not_found") {
    void cacheSetVersioned(
      cacheKey,
      STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY,
      STUDIO_CONFIG_NEGATIVE_CACHE_ENTRY.revision,
      STUDIO_CONFIG_NEGATIVE_TTL,
    );
    return dbResult;
  }
  if (dbResult.status !== "found") return dbResult;

  void cacheStudioConfig(normalizedLogin, dbResult.config, dbResult.revision);

  return dbResult;
}

/** Refresh Redis from the current durable row after a successful upsert. */
export async function refreshStudioConfigCache(login: string): Promise<void> {
  const normalizedLogin = login.toLowerCase();
  const result = await dbGetStudioConfig(normalizedLogin);
  if (result.status === "found") {
    await cacheStudioConfig(normalizedLogin, result.config, result.revision);
    return;
  }

  // A durable save already succeeded. If its readback is temporarily
  // unavailable, remove any older cache value and let the next GET retry.
  await cacheDel(`config:${normalizedLogin}`);
}
