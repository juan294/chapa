import { type NextRequest, NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/auth/resolve-request-auth";
import { rateLimit } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { getCachedCraftScore } from "@/lib/cache/craft-cache";
import { buildSnapshot } from "@/lib/history/snapshot";
import { dbReplaceSnapshot } from "@/lib/db/snapshots";
import {
  updateSnapshotCache,
} from "@/lib/cache/snapshot-cache";
import { getTier } from "@/lib/impact/utils";

/**
 * POST /api/recalculate — Force-recalculate impact score.
 *
 * Fetches stats (cached or fresh), gets craft score from DB,
 * computes fresh impact, replaces today's snapshot, and returns
 * the new score + dimensions.
 *
 * Use after any deliberate user action that changes the score
 * (insights upload, platform connect/disconnect).
 *
 * Auth: Bearer token (CLI token or GitHub PAT) or session cookie.
 * Rate limited: 20 requests/handle/hour.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await resolveRequestAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const handle = auth.handle.toLowerCase();

  // Rate limit: 20 per handle per hour
  const rl = await rateLimit(`ratelimit:recalculate:${handle}`, 20, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // Fetch stats and craft score in parallel (independent operations)
  const [stats, craftResult] = await Promise.all([
    getStats(handle, auth.token),
    getCachedCraftScore(handle),
  ]);

  if (!stats) {
    return NextResponse.json(
      { error: "Could not load stats. Try again later." },
      { status: 502 },
    );
  }

  // Compute fresh impact with craft included
  const impact = computeImpactV4(stats, craftResult?.craftScore ?? undefined);

  // For recalculate: use the RAW adjusted composite, NOT EMA-smoothed.
  // This is a deliberate action — the user wants to see the actual score.
  // The raw adjustedComposite already has recency + confidence applied,
  // just no EMA dampening.
  impact.tier = getTier(impact.adjustedComposite);

  // Build snapshot and REPLACE today's (not insert-ignore)
  const snapshot = buildSnapshot(stats, impact);
  const replaced = await dbReplaceSnapshot(handle, snapshot);

  if (replaced) {
    // Update Redis cache so subsequent badge views use the new snapshot
    await updateSnapshotCache(handle, snapshot);
  }

  return NextResponse.json({
    success: true,
    adjustedComposite: impact.adjustedComposite,
    compositeScore: impact.compositeScore,
    dimensions: impact.dimensions,
    archetype: impact.archetype,
    tier: impact.tier,
    profileType: impact.profileType,
    craftScore: craftResult?.craftScore ?? null,
    craftTier: craftResult?.tier ?? null,
  });
}
