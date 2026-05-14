/**
 * Client-safe feature flag helpers backed by public env vars only.
 *
 * Server code that needs DB-backed flags should import from `feature-flags.ts`.
 */

import {
  getStudioEnabledEnv,
  getBitbucketEnabledEnv,
  getCodebergEnabledEnv,
  getInsightsEnabledEnv,
} from "@/lib/env";

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
