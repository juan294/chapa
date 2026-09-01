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
  isStudioDemoEnabledSync,
  isBitbucketEnabledSync,
  isCodebergEnabledSync,
  isGitlabEnabledSync,
  isInsightsEnabledSync,
  isWebmcpEnabledSync,
} from "./feature-flags-sync";

export {
  isStudioEnabledSync,
  isStudioDemoEnabledSync,
  isBitbucketEnabledSync,
  isCodebergEnabledSync,
  isGitlabEnabledSync,
  isInsightsEnabledSync,
  isWebmcpEnabledSync,
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
// Matches the `revalidate = 3600` declared by the nine `/[locale]/*` content
// pages that read flags via the root layout on every render. A SHORTER
// value here than the page's own declared revalidate lets Next clamp each
// page's effective ISR window to whichever value this data-cache dependency
// happened to register on a given build worker — nondeterministic per
// route/locale for identical source (#1178 / PE-M3). Keep these in sync.
// Staleness is still bounded independently by the in-process `flagCache`
// Map's 5-minute TTL below (the ONLY bound on a warm serverless instance
// that never observes `revalidateTag`) and by `revalidateTag` on every
// admin flag mutation (`apps/web/app/api/admin/feature-flags/route.ts`).
// Keep the 500ms request deadline OUTSIDE this data-cache producer. A slow
// successful lookup should keep running and warm the cache after the current
// request falls back. If the timeout rejects inside `unstable_cache`, Next.js
// reports it as a cache revalidation error even though `checkFlag` handles the
// degraded request. The outer timeout also preserves #1203's rule: its env
// fallback is never passed into `unstable_cache`, so a transient deadline does
// not become a cached negative for the full revalidation window.
const fetchFlagFromDbCached = unstable_cache(
  (key: string) => dbGetFeatureFlag(key),
  ["feature-flag-v1"],
  { revalidate: 3600, tags: [FEATURE_FLAG_CACHE_TAG] },
);

async function checkFlag(
  dbKey: string,
  envVar: string | undefined,
): Promise<boolean> {
  const cached = flagCache.get(dbKey);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  let flag: Awaited<ReturnType<typeof fetchFlagFromDbCached>>;
  try {
    flag = await withTimeout(
      fetchFlagFromDbCached(dbKey),
      FLAG_DB_TIMEOUT_MS,
      `featureFlag:${dbKey}`,
    );
  } catch {
    // The lookup failed (timeout or DB error). Degrade to the env var for THIS
    // request only and cache nothing, so the next call retries and can still
    // pick up the real row. Caching here would turn a transient blip into a
    // 5-minute outage for the flag, which is how #1203 took Studio down.
    return envVar?.trim() === "true";
  }

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
 * Check whether anonymous Creator Studio demo mode is enabled.
 * Keep this server-side; demo access is gated before rendering Studio.
 *
 * @returns `true` if the `studio_demo_enabled` flag is on in DB or `NEXT_PUBLIC_STUDIO_DEMO_ENABLED` is `"true"`
 */
export async function isStudioDemoEnabled(): Promise<boolean> {
  return checkFlag(
    "studio_demo_enabled",
    isStudioDemoEnabledSync() ? "true" : undefined,
  );
}

/**
 * Check whether browser-side WebMCP registration is enabled.
 * Use in server components and API routes.
 *
 * @returns `true` if the `webmcp_enabled` flag is on in DB or `NEXT_PUBLIC_WEBMCP_ENABLED` is `"true"`
 */
export async function isWebmcpEnabled(): Promise<boolean> {
  return checkFlag(
    "webmcp_enabled",
    isWebmcpEnabledSync() ? "true" : undefined,
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
 * Check whether GitLab integration is enabled (DB-backed, env-var fallback).
 * Use in server components and API routes.
 *
 * @returns `true` if the `gitlab_integration` flag is on in DB or `NEXT_PUBLIC_GITLAB_ENABLED` is `"true"`
 */
export async function isGitlabEnabled(): Promise<boolean> {
  return checkFlag(
    "gitlab_integration",
    isGitlabEnabledSync() ? "true" : undefined,
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
