import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { cacheDel, rateLimit } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";
import { computeImpactV6 } from "@/lib/impact/v6";
import { dbRecomputeCraft } from "@/lib/db/tool-insights";
import { updateCraftCache } from "@/lib/cache/craft-cache";
import { isValidHandle } from "@/lib/validation";
import { buildSnapshot } from "@/lib/history/snapshot";
import { dbReplaceSnapshot } from "@/lib/db/snapshots";
import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { invalidateHistoryCache } from "@/lib/history/history";
import { captureServerError } from "@/lib/analytics/server-errors";
import { revalidatePath } from "next/cache";

/**
 * POST /api/refresh?handle=:handle
 *
 * Force-refresh a user's badge data by clearing the cache and
 * fetching fresh stats from GitHub. Auth required — only the
 * badge owner can refresh their own badge.
 *
 * Rate limited: 5 refreshes per handle per hour.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
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
    const rl = await rateLimit(`ratelimit:refresh:${normalizedHandle}`, 5, 3600);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many refreshes. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }

    // Clear cached stats so getStats fetches fresh from GitHub
    // Key must match lib/github/client.ts cache key: "stats:v2:merged:<handle>" (lowercase)
    await cacheDel(`stats:v2:merged:${normalizedHandle}`);

    // Invalidate history cache so next /api/history/:handle request fetches fresh data
    await invalidateHistoryCache(handle);

    // Fetch fresh stats and recompute craft in parallel
    const [stats, craftResult] = await Promise.all([
      getStats(handle, session.token),
      dbRecomputeCraft(handle),
    ]);
    if (!stats) {
      void captureServerError({
        route: "/api/refresh",
        statusCode: 502,
        error: new Error(`Failed to fetch stats for handle: ${handle}`),
      });
      return NextResponse.json(
        { error: "Failed to fetch stats. Try again later." },
        { status: 502 },
      );
    }

    // Update craft cache so badge views use the recomputed score
    if (craftResult) {
      updateCraftCache(handle, craftResult).catch(() => {});
    }

    const impact = computeImpactV6(stats, craftResult?.craftScore ?? undefined);

    // Replace today's snapshot — a user-initiated refresh means the score has
    // legitimately changed (e.g. after a scoring fix). dbReplaceSnapshot uses
    // UPSERT so it overwrites the existing same-day row instead of silently
    // skipping via ON CONFLICT DO NOTHING.
    const snapshot = buildSnapshot(stats, impact);
    dbReplaceSnapshot(handle, snapshot)
      .then((replaced) => {
        if (replaced) updateSnapshotCache(handle, snapshot);
      })
      .catch(() => {});

    // Invalidate ISR cache so the share page rebuilds with OAuth-sourced data
    revalidatePath(`/u/${handle}`);

    return NextResponse.json({ stats, impact });
  } catch (err) {
    console.error("[refresh] Unhandled error:", err);
    void captureServerError({
      route: "/api/refresh",
      statusCode: 500,
      error: err,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
