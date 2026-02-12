import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";
import { cacheDel, rateLimit } from "@/lib/cache/redis";
import { getStats90d } from "@/lib/github/client";
import { computeImpactV3 } from "@/lib/impact/v3";
import { isValidHandle } from "@/lib/validation";

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
  const handle = request.nextUrl.searchParams.get("handle");
  if (!handle || !isValidHandle(handle)) {
    return NextResponse.json(
      { error: "Missing or invalid handle parameter" },
      { status: 400 },
    );
  }

  // Auth: require session cookie
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const cookieHeader = request.headers.get("cookie");
  const session = readSessionCookie(cookieHeader, sessionSecret);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  // Only the badge owner can refresh their own badge
  if (session.login !== handle) {
    return NextResponse.json(
      { error: "You can only refresh your own badge" },
      { status: 403 },
    );
  }

  // Rate limit: 5 refreshes per handle per hour
  const rl = await rateLimit(`ratelimit:refresh:${handle}`, 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many refreshes. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  // Clear cached stats so getStats90d fetches fresh from GitHub
  await cacheDel(`stats:${handle}`);

  // Fetch fresh stats with the user's OAuth token for better rate limits
  const stats = await getStats90d(handle, session.token);
  if (!stats) {
    return NextResponse.json(
      { error: "Failed to fetch stats from GitHub. Try again later." },
      { status: 502 },
    );
  }

  const impact = computeImpactV3(stats);

  return NextResponse.json({ stats, impact });
}
