/**
 * Feature flags — DB-backed with env-var fallback.
 *
 * Two API styles:
 * - **Sync** (`isStudioEnabledSync`): env-var fallback for tests and code
 *   running outside the hydrated client feature-flag provider.
 * - **Async** (`isStudioEnabled`): checks Supabase first, falls back to
 *   env var — for server components and API routes.
 *
 * Client navigation surfaces should use `ClientFeatureFlagsProvider`, which
 * receives the DB-backed server value from the root layout.
 */

import { dbGetFeatureFlag } from "./db/feature-flags";
import { withTimeout } from "./async/with-timeout";
import {
  getStudioEnabledEnv,
  getBitbucketEnabledEnv,
  getCodebergEnabledEnv,
  getExperimentsEnabledEnv,
  getInsightsEnabledEnv,
} from "@/lib/env";

// ---------------------------------------------------------------------------
// Sync (env-var only) — for client components
// ---------------------------------------------------------------------------

/**
 * Synchronously check whether Creator Studio is enabled (env-var fallback).
 * Client navigation should prefer `useClientFeatureFlags()`.
 *
 * @returns `true` if `NEXT_PUBLIC_STUDIO_ENABLED` is `"true"`
 */
export function isStudioEnabledSync(): boolean {
  return getStudioEnabledEnv() === "true";
}

/**
 * Synchronously check whether Bitbucket integration is enabled (env-var only).
 * Use in client components where `await` is not available.
 *
 * @returns `true` if `NEXT_PUBLIC_BITBUCKET_ENABLED` is `"true"`
 */
export function isBitbucketEnabledSync(): boolean {
  return getBitbucketEnabledEnv() === "true";
}

/**
 * Synchronously check whether Codeberg integration is enabled (env-var only).
 * Use in client components where `await` is not available.
 *
 * @returns `true` if `NEXT_PUBLIC_CODEBERG_ENABLED` is `"true"`
 */
export function isCodebergEnabledSync(): boolean {
  return getCodebergEnabledEnv() === "true";
}

/**
 * Synchronously check whether AI Insights integration is enabled (env-var only).
 * Use in client components where `await` is not available.
 *
 * @returns `true` if `NEXT_PUBLIC_INSIGHTS_ENABLED` is `"true"`
 */
export function isInsightsEnabledSync(): boolean {
  return getInsightsEnabledEnv() === "true";
}

// ---------------------------------------------------------------------------
// Async (DB-backed + env-var fallback) — for server components / API routes
// ---------------------------------------------------------------------------

/** In-process TTL cache for feature flag DB lookups — 5 minutes. */
const FLAG_CACHE_TTL_MS = 5 * 60 * 1000;
const FLAG_DB_TIMEOUT_MS = 500;
const flagCache = new Map<string, { value: boolean; expiresAt: number }>();

async function checkFlag(
  dbKey: string,
  envVar: string | undefined,
): Promise<boolean> {
  const cached = flagCache.get(dbKey);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const flag = await withTimeout(
    dbGetFeatureFlag(dbKey),
    FLAG_DB_TIMEOUT_MS,
    `featureFlag:${dbKey}`,
  ).catch(() => null);
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
    getStudioEnabledEnv(),
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
    getBitbucketEnabledEnv(),
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
    getCodebergEnabledEnv(),
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
    getInsightsEnabledEnv(),
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
