import { type NextRequest, NextResponse } from "next/server";
import { isValidHandle } from "@/lib/validation";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { getCachedLatestSnapshot } from "@/lib/cache/snapshot-cache";
import { materializeDisplayProfile } from "@/lib/profile/materialize-profile";
import { dbGetToolInsights } from "@/lib/db/tool-insights";
import type { DimensionScores } from "@chapa/shared";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import { readScoreReceiptV7 } from "@/lib/profile/score-receipt-v7";
import { receiptViewModel, renderableScore } from "@/lib/profile/score-view-model";

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" } as const;

/**
 * #1062 — the fresh, badge-consistent headline.
 *
 * `adjustedComposite`/`tier` on this endpoint come from the persisted snapshot
 * and are EMA-smoothed for the trend sparkline (#1001), while the badge, share
 * page and verification record all show the FRESH score. After a step change in
 * inputs the two diverge sharply — an EMU merge took frivas to a badge headline
 * of 69/Solid while this endpoint still reported 25/Emerging.
 *
 * Rather than silently change the meaning of two published fields, the fresh
 * pair is exposed additively. Read-only materialization: this is a public,
 * CORS-enabled GET and must never trigger a cache write.
 *
 * Failure here is non-fatal by design — the endpoint predates these fields and
 * must keep serving the snapshot half if the fresh score cannot be computed.
 *
 * #1180 (PE-L2) — uses `materializeDisplayProfile`, not
 * `materializePublicProfile`. The caller above already read
 * `getCachedLatestSnapshot(handle)` once for the snapshot half of this
 * response; `materializePublicProfile` (via `materializeProfile`) would
 * perform a SECOND, identical `getCachedLatestSnapshot` read whose result
 * only ever feeds the EMA-smoothed *persisted* snapshot (#1001) — never
 * `displayImpact`, which is always the fresh score and therefore genuinely
 * snapshot-independent. `materializeDisplayProfile` skips that lookup (and
 * the dirty-marker lookup) entirely rather than deduplicating it.
 */
async function getDisplayHeadline(
  handle: string,
): Promise<{ displayScore: number | null; displayTier: string | null }> {
  try {
    const materialized = await materializeDisplayProfile(handle, {
      readOnly: true,
    });
    if (!materialized) return { displayScore: null, displayTier: null };
    // #1311 — documented as "the fresh value shown on the badge", so it is read
    // from the model the badge draws. A v7 evidence range has no single number
    // and reports null here rather than a point an external consumer would
    // republish as exact; `scoring` on this same response carries the interval
    // for anyone who wants it.
    const drawn = renderableScore(materialized.scoring);
    return materialized.scoring.composite.kind === "point"
      ? { displayScore: drawn.composite, displayTier: drawn.tier }
      : { displayScore: null, displayTier: drawn.tier };
  } catch {
    return { displayScore: null, displayTier: null };
  }
}

/**
 * GET /api/profile/:handle — Public impact profile snapshot.
 *
 * Returns the latest impact dimensions, archetype, tier, and optional craft
 * score for a user. Designed for external consumers (portfolio sites).
 *
 * `adjustedComposite`/`tier` are the smoothed trend values; `displayScore`/
 * `displayTier` are the fresh values shown on the badge (#1062).
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
  const { displayScore, displayTier } = await getDisplayHeadline(handle);
  const receipt = await readScoreReceiptV7(handle);

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
      // S15 — additive. Once a v7 receipt is issued, every consumer projects
      // that one artifact through the shared view model, so this block, the
      // badge, the share page and the verification link name the same
      // revision. Null until v7 is issued for this subject; the v6 fields
      // above keep their existing meaning either way.
      scoring: receipt ? receiptViewModel(handle, receipt) : null,
    },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control":
          "public, s-maxage=300, stale-while-revalidate=3600",
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
