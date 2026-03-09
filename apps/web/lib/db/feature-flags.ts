/**
 * Supabase data access — feature_flags table.
 *
 * All operations fail-open (return sensible defaults when DB is unavailable).
 *
 * Feature flags are cached in Redis with a 1-hour TTL to reduce Supabase
 * queries. Cache keys:
 *   - `ff:all` — all flags (for dbGetFeatureFlags)
 *   - `ff:key:{key}` — single flag by key (for dbGetFeatureFlag)
 *
 * Cache is invalidated on update (dbUpdateFeatureFlag).
 * Fail-open: if Redis is unavailable, falls through to Supabase.
 */

import type { FeatureFlag } from "@chapa/shared";
import { cacheGet, cacheSet, cacheDel } from "../cache/redis";
import { getSupabase } from "./supabase";
import { parseRows, parseRow } from "./parse-row";

// ---------------------------------------------------------------------------
// Cache constants
// ---------------------------------------------------------------------------

const CACHE_KEY_ALL = "ff:all";
const CACHE_KEY_PREFIX = "ff:key:";
const CACHE_TTL_SECONDS = 3600; // 1 hour

// ---------------------------------------------------------------------------
// Row type
// ---------------------------------------------------------------------------

interface FeatureFlagRow {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const REQUIRED_KEYS: readonly (keyof FeatureFlagRow)[] = [
  "id",
  "key",
  "enabled",
  "created_at",
  "updated_at",
] as const;

function rowToFlag(row: FeatureFlagRow): FeatureFlag {
  return {
    id: row.id,
    key: row.key,
    enabled: row.enabled,
    description: row.description,
    config: row.config ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get all feature flags, ordered by key.
 * Checks Redis cache first; falls through to Supabase on cache miss.
 * Returns empty array when DB is unavailable.
 */
export async function dbGetFeatureFlags(): Promise<FeatureFlag[]> {
  // Try cache first (fail-open: if Redis throws, fall through to Supabase)
  try {
    const cached = await cacheGet<FeatureFlag[]>(CACHE_KEY_ALL);
    if (cached) return cached;
  } catch {
    // Redis unavailable — continue to Supabase
  }

  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from("feature_flags")
      .select("id, key, enabled, description, config, created_at, updated_at")
      .order("key");

    if (error) throw error;

    const flags = parseRows<FeatureFlagRow>(
      data,
      REQUIRED_KEYS,
      "feature_flags",
    ).map(rowToFlag);

    // Cache for 1 hour (cacheSet is internally safe — never throws)
    await cacheSet(CACHE_KEY_ALL, flags, CACHE_TTL_SECONDS);

    return flags;
  } catch (error) {
    console.error("[db] dbGetFeatureFlags failed:", (error as Error).message);
    return [];
  }
}

/**
 * Get a single feature flag by key.
 * Checks Redis cache first; falls through to Supabase on cache miss.
 * Returns null when not found or DB is unavailable.
 */
export async function dbGetFeatureFlag(
  key: string,
): Promise<FeatureFlag | null> {
  // Try cache first (fail-open: if Redis throws, fall through to Supabase)
  try {
    const cached = await cacheGet<FeatureFlag>(`${CACHE_KEY_PREFIX}${key}`);
    if (cached) return cached;
  } catch {
    // Redis unavailable — continue to Supabase
  }

  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("feature_flags")
      .select("id, key, enabled, description, config, created_at, updated_at")
      .eq("key", key)
      .maybeSingle();

    if (error) throw error;

    const row = parseRow<FeatureFlagRow>(data, REQUIRED_KEYS, "feature_flags");
    const flag = row ? rowToFlag(row) : null;

    // Cache for 1 hour (cacheSet is internally safe — never throws)
    if (flag) {
      await cacheSet(`${CACHE_KEY_PREFIX}${key}`, flag, CACHE_TTL_SECONDS);
    }

    return flag;
  } catch (error) {
    console.error("[db] dbGetFeatureFlag failed:", (error as Error).message);
    return null;
  }
}

/**
 * Update a feature flag by key.
 * Invalidates Redis cache on success.
 * Returns true on success, false on failure or DB unavailable.
 */
export async function dbUpdateFeatureFlag(
  key: string,
  updates: { enabled?: boolean; config?: Record<string, unknown> },
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.enabled !== undefined) payload.enabled = updates.enabled;
    if (updates.config !== undefined) payload.config = updates.config;

    const { error } = await db
      .from("feature_flags")
      .update(payload)
      .eq("key", key);

    if (error) throw error;

    // Invalidate cache (cacheDel is internally safe — never throws)
    await Promise.all([
      cacheDel(`${CACHE_KEY_PREFIX}${key}`),
      cacheDel(CACHE_KEY_ALL),
    ]);

    return true;
  } catch (error) {
    console.error("[db] dbUpdateFeatureFlag failed:", (error as Error).message);
    return false;
  }
}
