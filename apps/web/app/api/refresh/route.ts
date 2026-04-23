import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { cacheDel, rateLimit } from "@/lib/cache/redis";
import { updateCraftCache } from "@/lib/cache/craft-cache";
import { isValidHandle } from "@/lib/validation";
import { captureServerError } from "@/lib/analytics/server-errors";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { revalidatePath } from "next/cache";
import { invalidateProfileReadModels } from "@/lib/profile/post-write-invalidation";
import {
  materializeOrchestratedProfile,
  persistOrchestratedSnapshot,
} from "@/lib/profile/orchestrated-profile";

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

    const materialized = await materializeOrchestratedProfile(handle, {
      token: session.token,
      craftMode: "recompute",
    });
    if (!materialized) {
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

    const persisted = await persistOrchestratedSnapshot(handle, materialized, {
      mode: "replace",
    });
    if (!persisted) {
      void captureServerError({
        route: "/api/refresh",
        statusCode: 500,
        error: new Error(`Failed to persist refreshed snapshot for handle: ${handle}`),
      });
      return NextResponse.json(
        { error: "Failed to save refreshed profile. Try again later." },
        { status: 500 },
      );
    }

    await invalidateProfileReadModels(handle, { history: true });

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
