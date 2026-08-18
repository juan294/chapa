import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { rateLimitStrict } from "@/lib/cache/redis";
import { updateCraftCache } from "@/lib/cache/craft-cache";
import { isValidHandle } from "@/lib/validation";
import { captureServerError, withErrorCapture } from "@/lib/analytics/server-errors";
import { getRequestId } from "@/lib/log";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { revalidatePath } from "next/cache";
import { invalidateProfileReadModels } from "@/lib/profile/post-write-invalidation";
import {
  materializeOrchestratedProfile,
  persistOrchestratedSnapshot,
} from "@/lib/profile/orchestrated-profile";
import { getSessionGitHubToken } from "@/lib/auth/github-session-token";

/**
 * POST /api/refresh?handle=:handle
 *
 * Force-refresh a user's badge data by clearing the cache and
 * fetching fresh stats from GitHub. Auth required — only the
 * badge owner can refresh their own badge.
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

  // #1076 — persistOrchestratedSnapshot's #1003 gate would refuse to persist
  // stats that look incomplete/poisoned anyway (and already emits its own
  // snapshot_skipped_incomplete_stats telemetry); check it here so the
  // intentional skip (422) is distinguishable from a genuine write failure
  // (500) up front, rather than inferring the reason from a bare `!persisted`.
  if (!materialized.statsComplete) {
    return NextResponse.json(
      {
        error: "Refreshed data looks incomplete and was not saved. Try again later.",
        reason: "stats_incomplete",
      },
      { status: 422 },
    );
  }

  const persisted = await persistOrchestratedSnapshot(handle, materialized, {
    mode: "replace",
  });
  if (!persisted) {
    void captureServerError({
      route: "/api/refresh",
      statusCode: 500,
      error: new Error(`Failed to persist refreshed snapshot for handle: ${handle}`),
      requestId,
    });
    return NextResponse.json(
      { error: "Failed to save refreshed profile. Try again later." },
      { status: 500 },
    );
  }

  // Post-persist invalidation: clear the artifacts derived from the snapshot
  // just written. Deliberately separate from the pre-fetch call above, which
  // exists to force the refetch — the two serve different purposes and must not
  // be collapsed into one. Neither ever clears `stats:stale:v2:`: that is the
  // protected GitHub-derived baseline, and dropping it would discard the
  // scope-downgrade protection established by #1050.
  await invalidateProfileReadModels(handle, {
    badgeSvg: true,
    snapshot: true,
    history: true,
  });

  // Update craft cache after the durable snapshot write succeeds.
  const craftResult = materialized.craftResult;
  if (craftResult) {
    fireAndForget(() => updateCraftCache(handle, craftResult), () => undefined);
  }

  // Invalidate ISR cache so the share page rebuilds with OAuth-sourced data
  revalidatePath(`/u/${handle}`);

  return NextResponse.json({
    stats: materialized.stats,
    impact: materialized.displayImpact,
  });
});
