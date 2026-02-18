import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { cacheMGet, rateLimit } from "@/lib/cache/redis";
import { dbGetUsers } from "@/lib/db/users";
import { getClientIp } from "@/lib/http/client-ip";
import { computeImpactV4 } from "@/lib/impact/v4";
import { applyEMA } from "@/lib/impact/smoothing";
import { getTier } from "@/lib/impact/utils";
import { dbGetLatestSnapshot } from "@/lib/db/snapshots";
import type { StatsData } from "@chapa/shared";

/** Fields returned per user. Users without stats have `statsExpired: true`. */
interface AdminUserEntry {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  fetchedAt: string | null;
  commitsTotal: number | null;
  prsMergedCount: number | null;
  reviewsSubmittedCount: number | null;
  activeDays: number | null;
  reposContributed: number | null;
  totalStars: number | null;
  archetype: string | null;
  tier: string | null;
  adjustedComposite: number | null;
  confidence: number | null;
  statsExpired: boolean;
}

/**
 * GET /api/admin/users
 *
 * Discovers ALL registered users from Supabase (Phase 4).
 * Loads stats from Redis cache (ephemeral). Returns stats + impact
 * where available; marks users with expired stats.
 */
export async function GET(request: NextRequest) {
  // Rate limit: 10 requests per IP per 60 seconds
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-users:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // Auth: require session cookie
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieHeader = request.headers.get("cookie");
  const session = readSessionCookie(cookieHeader, sessionSecret);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin check
  if (!isAdminHandle(session.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Discover all user handles from Supabase
  const registeredUsers = await dbGetUsers();
  const handles = registeredUsers.map((u) => u.handle);

  if (handles.length === 0) {
    return NextResponse.json(
      { users: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // For each handle, try to load stats (primary first, then stale fallback)
  const primaryStatsKeys = handles.map((h) => `stats:v2:${h}`);
  const staleStatsKeys = handles.map((h) => `stats:stale:${h}`);

  const [primaryValues, staleValues] = await Promise.all([
    cacheMGet<StatsData>(primaryStatsKeys),
    cacheMGet<StatsData>(staleStatsKeys),
  ]);

  // Build user list — use primary stats if available, stale as fallback.
  // Apply EMA smoothing (matching badge/share page behavior) so the admin
  // panel shows the same score the user sees on their badge.
  const users: AdminUserEntry[] = await Promise.all(
    handles.map(async (handle, i) => {
      const stats = primaryValues[i] ?? staleValues[i] ?? null;

      if (!stats) {
        // User exists in Supabase but stats cache fully expired
        return {
          handle,
          displayName: null,
          avatarUrl: null,
          fetchedAt: null,
          commitsTotal: null,
          prsMergedCount: null,
          reviewsSubmittedCount: null,
          activeDays: null,
          reposContributed: null,
          totalStars: null,
          archetype: null,
          tier: null,
          adjustedComposite: null,
          confidence: null,
          statsExpired: true,
        };
      }

      const impact = computeImpactV4(stats);

      // EMA smoothing: fetch previous day's smoothed score from Supabase
      const latestSnapshot = await dbGetLatestSnapshot(handle);
      const previousSmoothed = latestSnapshot?.adjustedComposite ?? null;
      const smoothedScore = applyEMA(impact.adjustedComposite, previousSmoothed);

      return {
        handle: stats.handle,
        displayName: stats.displayName ?? null,
        avatarUrl: stats.avatarUrl ?? null,
        fetchedAt: stats.fetchedAt,
        commitsTotal: stats.commitsTotal,
        prsMergedCount: stats.prsMergedCount,
        reviewsSubmittedCount: stats.reviewsSubmittedCount,
        activeDays: stats.activeDays,
        reposContributed: stats.reposContributed,
        totalStars: stats.totalStars,
        archetype: impact.archetype,
        tier: getTier(smoothedScore),
        adjustedComposite: smoothedScore,
        confidence: impact.confidence,
        statsExpired: false,
      };
    }),
  );

  return NextResponse.json(
    { users },
    { headers: { "Cache-Control": "no-store" } },
  );
}
