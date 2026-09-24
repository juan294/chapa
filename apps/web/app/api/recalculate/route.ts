import { enqueueAndReportScoringStatus } from "@/lib/profile/post-write-score";
import { type NextRequest, NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/auth/resolve-request-auth";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp, NO_TRUSTED_IP } from "@/lib/http/client-ip";
import { updateCraftCache } from "@/lib/cache/craft-cache";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { revalidatePath } from "next/cache";
import { invalidateProfileReadModels } from "@/lib/profile/post-write-invalidation";
import { materializeOrchestratedProfile } from "@/lib/profile/orchestrated-profile";
import { withErrorCapture } from "@/lib/analytics/server-errors";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * POST /api/recalculate — Force-recalculate a subject's score.
 *
 * Fetches fresh stats, (re-)enqueues v7.2 collection for the same reason,
 * and reports the resulting scoring status (#1335 phase 5 — the v6
 * immediate snapshot-replace-and-return path is retired along with
 * `metrics_snapshots`; issuance itself only happens from fan-in, once
 * every connected source is complete).
 *
 * Auth: Bearer token (CLI token or GitHub PAT) or session cookie.
 * Rate limited: 20 requests/handle/hour.
 */
export const POST = withErrorCapture("/api/recalculate", async (request: NextRequest) => {
  // BE-H2 (#860): IP rate-limit BEFORE auth — prevents bogus tokens from burning
  // the shared GitHub API quota via fetchGitHubUser calls in resolveRequestAuth.
  const ip = getClientIp(request);
  const ipRlKey =
    ip === NO_TRUSTED_IP
      ? "ratelimit:recalculate-ip:no-ip"
      : `ratelimit:recalculate-ip:${ip}`;
  const ipRl = await rateLimit(ipRlKey, 10, 3600);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

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
    ignoreSnapshot: true,
  });

  if (!materialized) {
    return NextResponse.json(
      { error: "Could not load stats. Try again later." },
      { status: 502 },
    );
  }

  if (!materialized.statsComplete) {
    return NextResponse.json(
      {
        error: "Recalculated data looks incomplete and was not saved. Try again later.",
        reason: "stats_incomplete",
      },
      { status: 422 },
    );
  }

  await invalidateProfileReadModels(handle, { badgeSvg: true });

  // #1335 phase 4/5 — recalculate exists to make a subject's published
  // numbers current after a scoring change, so it (re-)enqueues collection
  // for the same reason a snapshot used to be rewritten here. Issuance
  // itself happens only from fan-in, once every connected source is
  // complete.
  const scoringStatus = await enqueueAndReportScoringStatus(handle, "refresh");

  const craftResult = materialized.craftResult;
  if (craftResult) {
    fireAndForget(() => updateCraftCache(handle, craftResult), () => undefined);
  }

  revalidatePath(`/u/${handle}`);

  if (scoringStatus === null) {
    return NextResponse.json({ error: "Scoring status is temporarily unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ success: true, scoringStatus }, { headers: NO_STORE_HEADERS });
});
