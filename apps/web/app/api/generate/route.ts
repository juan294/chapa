import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { rateLimit } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";
import { computeImpactV6 } from "@/lib/impact/v6";
import { getSessionGitHubToken } from "@/lib/auth/github-session-token";

/**
 * POST /api/generate
 *
 * Warm the badge cache for the authenticated user by fetching their
 * GitHub stats and computing the Impact v6 profile. Called from the
 * /generating/:handle progress page after OAuth login.
 *
 * If the user's stats are already cached, getStats returns them
 * immediately — no redundant GitHub API calls.
 *
 * Rate limited: 10 requests per handle per hour.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { session, error } = requireSession(request);
    if (error) return error;

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

    const token = await getSessionGitHubToken(session);
    if (!token) {
      return NextResponse.json(
        { error: "Reauthentication required" },
        { status: 401 },
      );
    }

    const stats = await getStats(handle, token);
    if (!stats) {
      return NextResponse.json(
        { error: "Failed to fetch stats. Try again later." },
        { status: 502 },
      );
    }

    // Compute impact (also warms any downstream caches)
    computeImpactV6(stats);

    return NextResponse.json({ success: true, handle });
  } catch (err) {
    console.error("[generate] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
