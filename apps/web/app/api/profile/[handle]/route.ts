import { readScoringRenderSelection, type ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { readPublicObservedScore } from "@/lib/profile/post-write-score";
import { type NextRequest, NextResponse } from "next/server";
import { isValidHandle } from "@/lib/validation";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { getCachedLatestSnapshot } from "@/lib/cache/snapshot-cache";
import { materializeDisplayProfile } from "@/lib/profile/materialize-profile";
import { dbGetToolInsights } from "@/lib/db/tool-insights";
import type { DimensionScores } from "@chapa/shared";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import { legacyViewModel, type ScoreViewModel } from "@/lib/profile/score-view-model";

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" } as const;

/** Legacy fallback keeps its historical EMA aliases; the fresh headline is
 * explicitly v6 and uses the already captured policy clock. */
async function getDisplayHeadline(handle: string, selection: ScoringRenderSelection): Promise<{ displayScore: number | null; displayTier: string | null; scoring: ScoreViewModel | null }> {
  try {
    const materialized = await materializeDisplayProfile(handle, { readOnly: true, scoringSelection: { ...selection, enabled: false, machinePolicy: "v6" } });
    if (!materialized) return { displayScore: null, displayTier: null, scoring: null };
    const scoring = legacyViewModel(materialized.displayImpact);
    return { displayScore: scoring.composite.kind === "point" ? scoring.composite.display : null, displayTier: scoring.tier, scoring };
  } catch {
    return { displayScore: null, displayTier: null, scoring: null };
  }
}

/**
 * GET /api/profile/:handle — Public impact profile snapshot.
 *
 * Returns the latest impact dimensions, archetype, tier, and optional craft
 * score for a user. Designed for external consumers (portfolio sites).
 *
 * Current v7.2 aliases share one canonical display point. Only the explicitly
 * labelled v6 fallback retains historical smoothed aliases and fresh headline.
 */
export const GET = withErrorCapture("/api/profile/[handle]", async (
  request: NextRequest,
  ctx,
) => {
  const { handle } = await (ctx as { params: Promise<{ handle: string }> }).params;

  if (!isValidHandle(handle)) {
    return NextResponse.json(
      { error: "Invalid handle format" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Rate limit: 60 req/IP/min
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:profile:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": "60" } },
    );
  }

  const selection = await readScoringRenderSelection();
  const current = await readPublicObservedScore(handle, selection);
  if (current.status === "unavailable") return NextResponse.json({ error: "Current scoring is temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  if (current.status === "current") return NextResponse.json({ handle, ...current.projection }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });

  const snapshot = await getCachedLatestSnapshot(handle);

  if (!snapshot) {
    return NextResponse.json(
      { error: "No profile found for this handle" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  // Prefer snapshot.craft (computed at same time as other dimensions) for consistency.
  // Fall back to the latest uploaded tool-insights report for legacy rows
  // without the craft column.
  const craftResult = snapshot.craft == null
    ? await dbGetToolInsights(handle)
    : null;
  const craftScore = snapshot.craft ?? (craftResult ? craftResult.craftScore : undefined);

  // Only after the 404 above — the missing-snapshot path stays a cheap cache read.
  const { displayScore, displayTier, scoring } = await getDisplayHeadline(handle, selection);

  const dimensions: DimensionScores = {
    delivery: snapshot.delivery,
    quality: snapshot.quality,
    consistency: snapshot.consistency,
    breadth: snapshot.breadth,
    ...(craftScore != null && { craft: craftScore }),
  };

  return NextResponse.json(
    {
      handle,
      policyVersion: "v6",
      dimensions,
      compositeScore: snapshot.compositeScore,
      adjustedComposite: snapshot.adjustedComposite,
      archetype: snapshot.archetype,
      tier: snapshot.tier,
      craft: craftResult
        ? {
            tool: craftResult.tool,
            tier: craftResult.tier,
            score: craftResult.craftScore,
          }
        : null,
      snapshotDate: snapshot.date,
      computedAt: snapshot.capturedAt,
      // #1062 — fresh, matches the badge. Null when it cannot be computed.
      displayScore,
      displayTier,
      scoring,
    },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control":
          "no-store",
      },
    },
  );
});

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
