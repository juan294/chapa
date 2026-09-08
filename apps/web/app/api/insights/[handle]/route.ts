import { readScoringRenderSelection } from "@/lib/scoring-render-selection";
import { readPublicObservedScore } from "@/lib/profile/post-write-score";
import { type NextRequest, NextResponse } from "next/server";
import { isValidHandle } from "@/lib/validation";
import { dbGetToolInsights } from "@/lib/db/tool-insights";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { withErrorCapture } from "@/lib/analytics/server-errors";

/**
 * GET /api/insights/:handle — Read craft score (public, no auth).
 * Returns { craftScore: CraftResult | null }.
 * No raw_data is exposed — only the computed scores.
 */
export const GET = withErrorCapture("/api/insights/[handle]", async (
  request: NextRequest,
  ctx,
) => {
  const { handle } = await (ctx as { params: Promise<{ handle: string }> }).params;

  if (!isValidHandle(handle)) {
    return NextResponse.json(
      { error: "Invalid handle format" },
      { status: 400 },
    );
  }

  // Rate limit: 60 req/IP/min
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:insights:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const selection = await readScoringRenderSelection();
  const current = await readPublicObservedScore(handle, selection);
  if (current.status === "unavailable") return NextResponse.json({ error: "Current scoring is temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  if (current.status === "current") return NextResponse.json({ handle, ...current.projection }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });

  // Authoritative rule: dbGetToolInsights returns the latest uploaded report.
  const craftScore = await dbGetToolInsights(handle);

  return NextResponse.json({ policyVersion: "v6", craftScore }, { headers: { "Cache-Control": "no-store" } });
});
