/**
 * Supabase data access — feature_flags table.
 *
 * All operations fail-open (return sensible defaults when DB is unavailable).
 */

import type { FeatureFlag } from "@chapa/shared";
import { getSupabase } from "./supabase";
import { parseRows, parseRow } from "./parse-row";

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
 * Returns empty array when DB is unavailable.
 */
export async function dbGetFeatureFlags(): Promise<FeatureFlag[]> {
  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from("feature_flags")
      .select("id, key, enabled, description, config, created_at, updated_at")
      .order("key");

    if (error) throw error;

    return parseRows<FeatureFlagRow>(data, REQUIRED_KEYS, "feature_flags").map(
      rowToFlag,
    );
  } catch (error) {
    console.error("[db] dbGetFeatureFlags failed:", (error as Error).message);
    return [];
  }
}

/**
 * Get a single feature flag by key.
 * Returns null when not found or DB is unavailable.
 */
export async function dbGetFeatureFlag(
  key: string,
): Promise<FeatureFlag | null> {
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
    return row ? rowToFlag(row) : null;
  } catch (error) {
    console.error("[db] dbGetFeatureFlag failed:", (error as Error).message);
    return null;
  }
}

/**
 * Update a feature flag by key.
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
    return true;
  } catch (error) {
    console.error("[db] dbUpdateFeatureFlag failed:", (error as Error).message);
    return false;
  }
}
