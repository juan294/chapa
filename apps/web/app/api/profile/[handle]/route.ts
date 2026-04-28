import { type NextRequest, NextResponse } from "next/server";
import { isValidHandle } from "@/lib/validation";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { dbGetLatestSnapshot } from "@/lib/db/snapshots";
import { dbGetToolInsights } from "@/lib/db/tool-insights";
import type { DimensionScores } from "@chapa/shared";
import { withErrorCapture } from "@/lib/analytics/server-errors";

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" } as const;

/**
 * GET /api/profile/:handle — Public impact profile snapshot.
 *
 * Returns the latest impact dimensions, archetype, tier, and optional craft
 * score for a user. Designed for external consumers (portfolio sites).
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

  const [snapshot, craftResult] = await Promise.all([
    dbGetLatestSnapshot(handle),
    dbGetToolInsights(handle),
  ]);

  if (!snapshot) {
    return NextResponse.json(
      { error: "No profile found for this handle" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  // Prefer snapshot.craft (computed at same time as other dimensions) for consistency.
  // Fall back to the latest uploaded tool-insights report for legacy rows
  // without the craft column.
  const craftScore = snapshot.craft ?? (craftResult ? craftResult.craftScore : undefined);

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
