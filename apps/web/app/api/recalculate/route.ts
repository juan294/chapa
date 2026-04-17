import { type NextRequest, NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/auth/resolve-request-auth";
import { rateLimit } from "@/lib/cache/redis";
import { updateCraftCache } from "@/lib/cache/craft-cache";
import {
  materializeOrchestratedProfile,
  persistOrchestratedSnapshot,
} from "@/lib/profile/orchestrated-profile";

/**
 * POST /api/recalculate — Force-recalculate impact score.
 *
 * Fetches stats (cached or fresh), recomputes craft score from stored
 * raw insights data (applying the current formula), computes fresh
 * impact, replaces today's snapshot, and returns the new score.
 *
 * Craft recomputation ensures formula changes are retroactively applied
 * without requiring the user to re-upload their insights report.
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

  const materialized = await materializeOrchestratedProfile(handle, {
    token: auth.token,
    craftMode: "recompute",
  });

  if (!materialized) {
    return NextResponse.json(
      { error: "Could not load stats. Try again later." },
      { status: 502 },
    );
  }

  // Update craft cache so subsequent badge views use the recomputed score
  if (materialized.craftResult) {
    updateCraftCache(handle, materialized.craftResult).catch(() => {});
  }

  await persistOrchestratedSnapshot(handle, materialized, {
    mode: "replace",
  });

  return NextResponse.json({
    success: true,
    adjustedComposite: materialized.displayImpact.adjustedComposite,
    displayAdjustedComposite: materialized.displayImpact.adjustedComposite,
    rawAdjustedComposite: materialized.rawImpact.adjustedComposite,
    compositeScore: materialized.displayImpact.compositeScore,
    dimensions: materialized.displayImpact.dimensions,
    archetype: materialized.displayImpact.archetype,
    tier: materialized.displayImpact.tier,
    profileType: materialized.displayImpact.profileType,
    craftScore: materialized.craftResult?.craftScore ?? null,
    craftTier: materialized.craftResult?.tier ?? null,
  });
}
