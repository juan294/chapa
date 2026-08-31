/**
 * Supabase data access — studio_configs table.
 *
 * Durable persistence for Creator Studio preview configurations. This table
 * is the source of truth and is both read and written directly — no Redis
 * cache sits in front of it. See issue #935.
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
 * here — it only ever applied to trusting a cached value on read.
 *
 * BE-L1 remediation: the write side (`cacheStudioConfig`/
 * `refreshStudioConfigCache`, formerly called from
 * `apps/web/app/api/studio/config/route.ts`) was removed along with it —
 * once the read path stopped consulting Redis, nothing read that mirror
 * back, so publishing it on every save was a pure write with no consumer.
 * `PUT /api/studio/config` now only commits to Supabase.
 *
 * Read operations fail open when the database is unavailable. Upserts return
 * typed failure results so callers can handle each failure explicitly.
 */

import { getSupabase } from "./supabase";
import { parseRow } from "./parse-row";
import { withTimeout } from "../async/with-timeout";
import {
  isValidBadgeConfig,
  stripRetiredBadgeConfigKeys,
  withDefaultBadgeConfigKeys,
} from "../validation";
import type { BadgeConfig } from "@chapa/shared";

export const STUDIO_CONFIG_READ_TIMEOUT_MS = 2_000;

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
    // #1191: rows written before the three preview-only categories were
    // dropped still carry those keys, and isValidBadgeConfig rejects extra
    // fields. Strip them first so a legacy row migrates in place rather than
    // being reported invalid, which would silently discard a durable write and
    // hand the owner back the default badge.
    //
    // #1242: the same hazard in the other direction. isValidBadgeConfig also
    // requires every key to be PRESENT, so a row saved before `palette` existed
    // would fail for the field it could not have had. Default the missing ones
    // in, then validate.
    const config = row
      ? withDefaultBadgeConfigKeys(stripRetiredBadgeConfigKeys(row.config))
      : undefined;
    if (!row || !isValidBadgeConfig(config)) {
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

    return { status: "found", config, revision: row.revision };
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
