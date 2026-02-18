/**
 * Feature flags — DB-backed with env-var fallback.
 *
 * Two API styles:
 * - **Sync** (`isStudioEnabledSync`): env-var only — for client components
 *   and synchronous code that can't await.
 * - **Async** (`isStudioEnabled`): checks Supabase first, falls back to
 *   env var — for server components and API routes.
 *
 * Client components should use the sync variants or receive the flag value
 * as a prop from a server component.
 */

import { dbGetFeatureFlag } from "./db/feature-flags";

// ---------------------------------------------------------------------------
// Sync (env-var only) — for client components
// ---------------------------------------------------------------------------

export function isStudioEnabledSync(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_ENABLED?.trim() === "true";
}

// ---------------------------------------------------------------------------
// Async (DB-backed + env-var fallback) — for server components / API routes
// ---------------------------------------------------------------------------

async function checkFlag(
  dbKey: string,
  envVar: string | undefined,
): Promise<boolean> {
  const flag = await dbGetFeatureFlag(dbKey);
  if (flag !== null) return flag.enabled;
  return envVar?.trim() === "true";
}

export async function isStudioEnabled(): Promise<boolean> {
  return checkFlag(
    "studio_enabled",
    process.env.NEXT_PUBLIC_STUDIO_ENABLED,
  );
}

export async function isExperimentsEnabled(): Promise<boolean> {
  return checkFlag(
    "experiments_enabled",
    process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED,
  );
}

/**
 * Check if a specific agent is enabled.
 * Requires BOTH the master `automated_agents` toggle AND the individual
 * agent flag to be enabled. Returns false if either is missing or disabled.
 */
export async function isAgentEnabled(agentKey: string): Promise<boolean> {
  const master = await dbGetFeatureFlag("automated_agents");
  if (!master?.enabled) return false;

  const agent = await dbGetFeatureFlag(agentKey);
  return agent?.enabled ?? false;
}

/** Reset internal state — for tests only. */
export function _resetFlagCache(): void {
  // Reserved for future caching if needed.
}
