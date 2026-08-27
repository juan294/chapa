/**
 * Supabase data access — studio_configs table.
 *
 * Durable persistence for Creator Studio preview configurations. This table
 * is the source of truth and is read directly on every `loadStudioConfig`
 * call. See issue #935.
 *
 * BE-L1 (#1186): `loadStudioConfig` used to consult Redis first, but every
 * cache hit still had to re-validate against a separate Supabase
 * revision-only read before it could be trusted — costing a Redis round
 * trip *plus* a Supabase round trip, strictly more than reading Supabase
 * directly, while adding a failure mode where a valid cached config was
 * discarded because that second, independent Supabase call happened to
 * fail. Reads now go straight to Supabase; there is no cached value for the
 * read path to go stale against, so the migration-035 staleness concern
 * (an older instance's stale publish outliving a newer one) does not apply
 * here — it only ever applied to trusting a cached value on read. The
 * *write* path below (`cacheStudioConfig`/`refreshStudioConfigCache`) still
 * publishes a best-effort mirror to Redis for `PUT /api/studio/config`
 * (`apps/web/app/api/studio/config/route.ts`, out of this file's scope to
 * change); nothing currently reads that mirror back.
 *
 * Read operations fail open when the database is unavailable. Upserts return
 * typed failure results so callers can handle each failure explicitly.
 */

import { getSupabase } from "./supabase";
import { parseRow } from "./parse-row";
import {
  cacheDel,
  cacheSetVersioned,
} from "../cache/redis";
import { withTimeout } from "../async/with-timeout";
import { isValidBadgeConfig } from "../validation";
import type { BadgeConfig } from "@chapa/shared";

export const STUDIO_CONFIG_TTL = 31536000;
export const STUDIO_CONFIG_READ_TIMEOUT_MS = 2_000;
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

/**
 * Load and validate a Studio config for reading.
 *
 * BE-L1 (#1186): reads Supabase directly with no Redis involvement. See the
 * module header for why — every prior "hit" still required a second,
 * independent Supabase round trip to validate the cached revision, so the
 * cache read only added latency and a spurious 503 failure mode without
 * ever avoiding a Supabase call.
 */
export async function loadStudioConfig(
  login: string,
): Promise<StudioConfigReadResult> {
  return dbGetStudioConfig(login.toLowerCase());
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
