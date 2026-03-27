import { type NextRequest, NextResponse } from "next/server";
import { isValidHandle } from "@/lib/validation";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { dbGetLatestSnapshot } from "@/lib/db/snapshots";
import { dbGetToolInsights } from "@/lib/db/tool-insights";
import type { DimensionScores } from "@chapa/shared";

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" } as const;

/**
 * GET /api/profile/:handle — Public impact profile snapshot.
 *
 * Returns the latest impact dimensions, archetype, tier, and optional craft
 * score for a user. Designed for external consumers (portfolio sites).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
): Promise<Response> {
  try {
    const { handle } = await params;

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

    const dimensions: DimensionScores = {
      delivery: snapshot.delivery,
      quality: snapshot.quality,
      consistency: snapshot.consistency,
      breadth: snapshot.breadth,
      ...(craftResult && { craft: craftResult.craftScore }),
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
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err) {
    console.error("[profile] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

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
