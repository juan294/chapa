import { SCORING_POLICY } from "@chapa/shared";
import type { ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { readPublicObservedScore } from "@/lib/profile/post-write-score";
import { readScoringStatus } from "@/lib/collection/read-scoring-status";
import { type NextRequest, NextResponse } from "next/server";
import { isValidHandle } from "@/lib/validation";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { withErrorCapture } from "@/lib/analytics/server-errors";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * GET /api/insights/:handle — Read craft score (public, no auth).
 *
 * Returns the current v7.2 receipt's Craft outcome, or `{ scoringStatus }`
 * when there is no drawable current receipt yet (#1335 phase 5 — the v6
 * independent `dbGetToolInsights` fallback is retired; Craft is read only
 * from the receipt that was actually scored, never an unpublished upload).
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

  // #1335 phase 5 — the `scoring_v7_rendering` selector is retired; v7.2 is
  // the only rendered policy.
  const selection: ScoringRenderSelection = {
    enabled: true,
    machinePolicy: SCORING_POLICY,
    cacheable: true,
    capturedAt: Date.now(),
  };
  const current = await readPublicObservedScore(handle, selection);
  if (current.status === "unavailable") {
    return NextResponse.json({ error: "Current scoring is temporarily unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }
  if (current.status === "current") {
    return NextResponse.json(
      { handle, policyVersion: current.projection.policyVersion, identity: current.projection.identity, craft: current.projection.craft },
      { headers: NO_STORE_HEADERS },
    );
  }

  const scoringStatus = await readScoringStatus(handle);
  if (scoringStatus === null) {
    return NextResponse.json({ error: "Scoring status is temporarily unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ handle, scoringStatus }, { headers: NO_STORE_HEADERS });
});
