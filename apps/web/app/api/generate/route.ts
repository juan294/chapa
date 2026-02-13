import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";
import { rateLimit } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";

/**
 * POST /api/generate
 *
 * Warm the badge cache for the authenticated user by fetching their
 * GitHub stats and computing the Impact v4 profile. Called from the
 * /generating/:handle progress page after OAuth login.
 *
 * If the user's stats are already cached, getStats returns them
 * immediately — no redundant GitHub API calls.
 *
 * Rate limited: 10 requests per handle per hour.
 */
export async function POST(request: NextRequest): Promise<Response> {
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

  const handle = session.login;

  // Rate limit: 10 generates per handle per hour
  const rl = await rateLimit(
    `ratelimit:generate:${handle.toLowerCase()}`,
    10,
    3600,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const stats = await getStats(handle, session.token);
  if (!stats) {
    return NextResponse.json(
      { error: "Failed to fetch stats from GitHub. Try again later." },
      { status: 502 },
    );
  }

  // Compute impact (also warms any downstream caches)
  computeImpactV4(stats);

  return NextResponse.json({ success: true, handle });
}
