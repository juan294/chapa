/**
 * Feature flags — DB-backed with env-var fallback.
 *
 * Two API styles:
 * - **Sync** (`feature-flags-sync.ts`): env-var fallback for client code
 *   running outside the hydrated client feature-flag provider.
 * - **Async** (this module): checks Supabase first, falls back to env vars
 *   for server components and API routes.
 *
 * Client navigation surfaces should use `ClientFeatureFlagsProvider`, which
 * receives the DB-backed server value from the root layout.
 */

import { unstable_cache } from "next/cache";
import { dbGetFeatureFlag } from "./db/feature-flags";
import { withTimeout } from "./async/with-timeout";
import {
  getExperimentsEnabledEnv,
} from "@/lib/env";
import {
  isStudioEnabledSync,
  isBitbucketEnabledSync,
  isCodebergEnabledSync,
  isInsightsEnabledSync,
} from "./feature-flags-sync";

export {
  isStudioEnabledSync,
  isBitbucketEnabledSync,
  isCodebergEnabledSync,
  isInsightsEnabledSync,
};

// ---------------------------------------------------------------------------
// Async (DB-backed + env-var fallback) — for server components / API routes
// ---------------------------------------------------------------------------

/** In-process TTL cache for feature flag DB lookups — 5 minutes. */
const FLAG_CACHE_TTL_MS = 5 * 60 * 1000;
const FLAG_DB_TIMEOUT_MS = 500;
const FEATURE_FLAG_CACHE_TAG = "feature-flags";
const flagCache = new Map<string, { value: boolean; expiresAt: number }>();

// Wrap dbGetFeatureFlag in Next.js's data cache so the underlying Upstash REST
// `no-store` fetch does not force any consuming server component (including
// the root layout) into dynamic rendering. Without this, every page that
// inherits the layout — including ISR-eligible pages like /about and
// /archetypes/* — gets server-rendered on each request.
const fetchFlagFromDbCached = unstable_cache(
  (key: string) =>
    withTimeout(
      dbGetFeatureFlag(key),
      FLAG_DB_TIMEOUT_MS,
      `featureFlag:${key}`,
    ).catch(() => null),
  ["feature-flag-v1"],
  { revalidate: 300, tags: [FEATURE_FLAG_CACHE_TAG] },
);

async function checkFlag(
  dbKey: string,
  envVar: string | undefined,
): Promise<boolean> {
  const cached = flagCache.get(dbKey);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const flag = await fetchFlagFromDbCached(dbKey);
  const value = flag !== null ? flag.enabled : envVar?.trim() === "true";
  flagCache.set(dbKey, { value, expiresAt: Date.now() + FLAG_CACHE_TTL_MS });
  return value;
}

export function invalidateFeatureFlagCache(key?: string): void {
  if (key) {
    flagCache.delete(key);
    return;
  }

  flagCache.clear();
}

/**
 * Check whether Creator Studio is enabled (DB-backed, env-var fallback).
 * Use in server components and API routes.
 *
 * @returns `true` if the `studio_enabled` flag is on in DB or `NEXT_PUBLIC_STUDIO_ENABLED` is `"true"`
 */
export async function isStudioEnabled(): Promise<boolean> {
  return checkFlag(
    "studio_enabled",
    isStudioEnabledSync() ? "true" : undefined,
  );
}

/**
 * Check whether experimental pages are enabled (DB-backed, env-var fallback).
 * Use in server components and API routes.
 *
 * @returns `true` if the `experiments_enabled` flag is on in DB or `NEXT_PUBLIC_EXPERIMENTS_ENABLED` is `"true"`
 */
export async function isExperimentsEnabled(): Promise<boolean> {
  return checkFlag(
    "experiments_enabled",
    getExperimentsEnabledEnv(),
  );
}

/**
 * Check whether Bitbucket integration is enabled (DB-backed, env-var fallback).
 * Use in server components and API routes.
 *
 * @returns `true` if the `bitbucket_integration` flag is on in DB or `NEXT_PUBLIC_BITBUCKET_ENABLED` is `"true"`
 */
export async function isBitbucketEnabled(): Promise<boolean> {
  return checkFlag(
    "bitbucket_integration",
    isBitbucketEnabledSync() ? "true" : undefined,
  );
}

/**
 * Check whether Codeberg integration is enabled (DB-backed, env-var fallback).
 * Use in server components and API routes.
 *
 * @returns `true` if the `codeberg_integration` flag is on in DB or `NEXT_PUBLIC_CODEBERG_ENABLED` is `"true"`
 */
export async function isCodebergEnabled(): Promise<boolean> {
  return checkFlag(
    "codeberg_integration",
    isCodebergEnabledSync() ? "true" : undefined,
  );
}

/**
 * Check whether AI Insights integration is enabled (DB-backed, env-var fallback).
 * Use in server components and API routes.
 *
 * @returns `true` if the `insights_integration` flag is on in DB or `NEXT_PUBLIC_INSIGHTS_ENABLED` is `"true"`
 */
export async function isInsightsEnabled(): Promise<boolean> {
  return checkFlag(
    "insights_integration",
    isInsightsEnabledSync() ? "true" : undefined,
  );
}

/**
 * Check if a specific agent is enabled.
 * Requires BOTH the master `automated_agents` toggle AND the individual
 * agent flag to be enabled. Returns false if either is missing or disabled.
 */
export async function isAgentEnabled(agentKey: string): Promise<boolean> {
  const master = await withTimeout(
    dbGetFeatureFlag("automated_agents"),
    FLAG_DB_TIMEOUT_MS,
    "featureFlag:automated_agents",
  ).catch(() => null);
  if (!master?.enabled) return false;

  const agent = await withTimeout(
    dbGetFeatureFlag(agentKey),
    FLAG_DB_TIMEOUT_MS,
    `featureFlag:${agentKey}`,
  ).catch(() => null);
  return agent?.enabled ?? false;
}

/** Reset internal cache — for tests only. */
export function _resetFlagCache(): void {
  invalidateFeatureFlagCache();
}
