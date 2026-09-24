import { enqueueAndReportScoringStatus } from "@/lib/profile/post-write-score";
import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { rateLimitStrict } from "@/lib/cache/redis";
import { updateCraftCache } from "@/lib/cache/craft-cache";
import { isValidHandle } from "@/lib/validation";
import { captureServerError, withErrorCapture } from "@/lib/analytics/server-errors";
import { findUnusableSourceLinks } from "@/lib/platform/source-diagnostics";
import { getRequestId } from "@/lib/log";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { revalidatePath } from "next/cache";
import { invalidateProfileReadModels } from "@/lib/profile/post-write-invalidation";
import { materializeOrchestratedProfile } from "@/lib/profile/orchestrated-profile";
import { getSessionGitHubToken } from "@/lib/auth/github-session-token";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * POST /api/refresh?handle=:handle
 *
 * Force-refresh a user's badge data by clearing the cache and fetching
 * fresh stats from GitHub, then (re-)enqueues v7.2 collection and reports
 * the resulting scoring status (#1335 phase 5 — the v6 immediate
 * snapshot-replace-and-return path, and the per-request verification-record
 * write it fed, are retired along with `metrics_snapshots` and
 * `verification_records`; issuance itself only happens from fan-in).
 * Auth required — only the badge owner can refresh their own badge.
 *
 * Rate limited: 5 refreshes per handle per hour.
 */
export const POST = withErrorCapture("/api/refresh", async (request: NextRequest) => {
  const requestId = getRequestId(request);
  const handle = request.nextUrl.searchParams.get("handle");
  if (!handle || !isValidHandle(handle)) {
    return NextResponse.json(
      { error: "Missing or invalid handle parameter" },
      { status: 400 },
    );
  }

  // Auth: require session cookie
  const { session, error } = requireSession(request);
  if (error) return error;

  // Only the badge owner can refresh their own badge (case-insensitive)
  if (session.login.toLowerCase() !== handle.toLowerCase()) {
    return NextResponse.json(
      { error: "You can only refresh your own badge" },
      { status: 403 },
    );
  }

  // Rate limit: 5 refreshes per handle per hour (normalize key)
  const normalizedHandle = handle.toLowerCase();
  const rl = await rateLimitStrict(`ratelimit:refresh:${normalizedHandle}`, 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many refreshes. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // Pre-fetch invalidation: drop the composed stats entry so getStats misses
  // and refetches from GitHub. Routed through invalidateProfileReadModels so the
  // key literal lives in exactly one place (post-write-invalidation.ts) — this
  // was a hand-maintained duplicate of client.ts's key until #1060 versioned it.
  await invalidateProfileReadModels(handle, { stats: true });

  const token = await getSessionGitHubToken(session);
  if (!token) {
    return NextResponse.json(
      { error: "Reauthentication required" },
      { status: 401 },
    );
  }

  const materialized = await materializeOrchestratedProfile(handle, {
    token,
  });
  if (!materialized) {
    // A connected platform whose token can no longer be refreshed makes the
    // whole fetch null — a connected source must not silently disappear from
    // an aggregate. Retrying cannot fix that, so name the connection instead
    // of returning a bare 502 the user can only stare at (same treatment as
    // /api/generate).
    const unusable = await findUnusableSourceLinks(handle);
    if (unusable.length > 0) {
      return NextResponse.json(
        { error: `Reconnect ${unusable.join(", ")} to include it in your profile.`, staleSources: unusable },
        { status: 409 },
      );
    }
    void captureServerError({
      route: "/api/refresh",
      statusCode: 502,
      error: new Error(`Failed to fetch stats for handle: ${handle}`),
      requestId,
    });
    return NextResponse.json(
      { error: "Failed to fetch stats. Try again later." },
      { status: 502 },
    );
  }

  if (!materialized.statsComplete) {
    return NextResponse.json(
      {
        error: "Refreshed data looks incomplete and was not saved. Try again later.",
        reason: "stats_incomplete",
      },
      { status: 422 },
    );
  }

  // Post-fetch invalidation: clear the artifacts derived from the stats
  // just fetched. Deliberately separate from the pre-fetch call above,
  // which exists to force the refetch — the two serve different purposes
  // and must not be collapsed into one. Neither ever clears
  // `stats:stale:v2:`: that is the protected GitHub-derived baseline, and
  // dropping it would discard the scope-downgrade protection established
  // by #1050.
  await invalidateProfileReadModels(handle, { badgeSvg: true });

  // #1335 phase 4/5 — a refresh is an owner-initiated recompute, so it is
  // where a registered subject's v7.2 collection is (re-)enqueued. Issuance
  // itself now happens only from fan-in, once every connected source is
  // complete — never synchronously here. `scheduleCollectionAdvance` runs a
  // bounded slice in the background (`after()`) so the badge doesn't wait a
  // full 5-minute cron tick for its first progress.
  const scoringStatus = await enqueueAndReportScoringStatus(handle, "refresh");

  const craftResult = materialized.craftResult;
  if (craftResult) {
    fireAndForget(() => updateCraftCache(handle, craftResult), () => undefined);
  }

  // Invalidate ISR cache so the share page rebuilds with OAuth-sourced data
  revalidatePath(`/u/${handle}`);

  if (scoringStatus === null) {
    return NextResponse.json({ error: "Scoring status is temporarily unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ success: true, scoringStatus }, { headers: NO_STORE_HEADERS });
});
