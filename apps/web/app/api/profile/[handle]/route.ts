import { readPublicObservedScore } from "@/lib/profile/post-write-score";
import { readScoringStatus } from "@/lib/collection/read-scoring-status";
import { type NextRequest, NextResponse } from "next/server";
import { isValidHandle } from "@/lib/validation";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { withErrorCapture } from "@/lib/analytics/server-errors";

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" } as const;
const NO_STORE_HEADERS = { ...CORS_HEADERS, "Cache-Control": "no-store" } as const;

/**
 * GET /api/profile/:handle — Public impact profile snapshot.
 *
 * Returns the current v7.2 receipt projection (dimensions, archetype, tier,
 * optional craft) for a scored subject, or `{ scoringStatus }` when there is
 * no drawable current receipt yet (#1335 phase 5 — v6 and `metrics_snapshots`
 * are retired; there is no legacy fallback left to read).
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

  const current = await readPublicObservedScore(handle);
  if (current.status === "unavailable") {
    return NextResponse.json({ error: "Current scoring is temporarily unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }
  if (current.status === "current") {
    return NextResponse.json({ handle, ...current.projection }, { headers: NO_STORE_HEADERS });
  }

  const scoringStatus = await readScoringStatus(handle);
  if (scoringStatus === null) {
    return NextResponse.json({ error: "Scoring status is temporarily unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ handle, scoringStatus }, { headers: NO_STORE_HEADERS });
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
