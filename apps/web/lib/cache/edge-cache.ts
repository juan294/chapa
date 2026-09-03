/**
 * Vercel edge-cache purge for rendered badge responses.
 *
 * The SVG and OG routes tag every cacheable response with their per-handle
 * tag via `Vercel-Cache-Tag`. This module purges those tags from Vercel's edge
 * — the layer a Redis `cacheDel` never reaches — so a Studio save (or any
 * other invalidation trigger) changes what the next viewer sees, not just
 * what origin serves.
 *
 * Foreground revalidation (`dangerouslyDeleteByTag`, not the eventually-
 * consistent `invalidateByTag`) is deliberate: one tag maps to one handle's
 * badge, so there is no stampede to fear, and the whole point of this purge is
 * that the very next request must see the new badge.
 */
import { dangerouslyDeleteByTag } from "@vercel/functions";
import { getVercelEnv } from "@/lib/env";
import { withTimeout } from "@/lib/async/with-timeout";
import { captureServerEvent } from "@/lib/analytics/server-errors";

export type EdgePurgeOutcome = "purged" | "skipped" | "failed";

export const EDGE_PURGE_DEADLINE_MS = 1_500;

/** One tag per handle. Lowercased the same way buildBadgeSvgCacheKey lowercases. */
export function badgeEdgeCacheTag(handle: string): string {
  return `badge-${handle.toLowerCase()}`;
}

/** One OG-image tag per handle, matching the normalized Redis cache key. */
export function ogImageEdgeCacheTag(handle: string): string {
  return `og-${handle.toLowerCase()}`;
}

/**
 * Purge every edge-cached response carrying `tag`, with foreground
 * revalidation so the next request is guaranteed a fresh origin fetch.
 *
 * Outside a Vercel deployment (local dev, unit tests, CI) there is no edge
 * cache to purge, so this returns "skipped" without calling the SDK. Never
 * throws: a purge that fails is reported so the caller can tell the truth
 * instead of claiming success.
 */
export async function purgeEdgeCacheTag(tag: string): Promise<EdgePurgeOutcome> {
  if (!getVercelEnv()) return "skipped";

  try {
    await withTimeout(dangerouslyDeleteByTag(tag), EDGE_PURGE_DEADLINE_MS, "edge cache purge");
    return "purged";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[edge-cache] purge failed:", tag, message);
    void captureServerEvent("badge_edge_purge_failed", { tag, message });
    return "failed";
  }
}
