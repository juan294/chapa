import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { scanKeys, cacheMGet, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { computeImpactV4 } from "@/lib/impact/v4";
import type { StatsData } from "@chapa/shared";

/**
 * GET /api/admin/users
 *
 * Returns a list of all users with cached stats in Redis, plus their
 * computed Impact v4 results. Session auth + admin handle check.
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

  // Scan for all cached stats keys
  const keys = await scanKeys("stats:v2:*");
  if (keys.length === 0) {
    return NextResponse.json(
      { users: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Bulk-fetch all stats
  const statsValues = await cacheMGet<StatsData>(keys);

  // Build user list with cherry-picked fields + computed impact
  const users = statsValues
    .filter((s): s is StatsData => s != null)
    .map((stats) => {
      const impact = computeImpactV4(stats);
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
        tier: impact.tier,
        adjustedComposite: impact.adjustedComposite,
        confidence: impact.confidence,
      };
    });

  return NextResponse.json(
    { users },
    { headers: { "Cache-Control": "no-store" } },
  );
}
