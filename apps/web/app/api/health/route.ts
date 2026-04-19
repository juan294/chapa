import { type NextRequest, NextResponse } from "next/server";
import { pingRedis, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { pingSupabase } from "@/lib/db/supabase";

/** Shape returned for a successful GitHub probe. */
interface GitHubRateLimit {
  remaining: number;
  limit: number;
}

/** Probe GitHub's rate_limit API to verify reachability.
 *
 * Returns:
 * - "skipped" — GITHUB_TOKEN not configured (no probe attempted)
 * - "ok"      — API reachable; rateLimit data attached
 * - "error"   — request failed or non-2xx response
 */
async function pingGitHub(): Promise<{
  status: "ok" | "error" | "skipped";
  rateLimit?: GitHubRateLimit;
}> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return { status: "skipped" };

  try {
    const response = await fetch("https://api.github.com/rate_limit", {
      headers: {
        Authorization: `token ${token}`,
        "User-Agent": "chapa-health-check",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return { status: "error" };

    const data = (await response.json()) as {
      rate: { remaining: number; limit: number };
    };
    return {
      status: "ok",
      rateLimit: {
        remaining: data.rate.remaining,
        limit: data.rate.limit,
      },
    };
  } catch {
    return { status: "error" };
  }
}

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring.
 * Rate limited: 30 requests per IP per 60 seconds.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:health:${ip}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const [redisStatus, supabaseStatus, githubResult] = await Promise.all([
    pingRedis(),
    pingSupabase(),
    pingGitHub(),
  ]);

  // "skipped" = env vars not configured (preview deploys) — not degraded.
  // Only "error" = configured but failing — triggers 503.
  const isHealthy = (s: string) => s === "ok" || s === "skipped";
  const status =
    isHealthy(redisStatus) &&
    isHealthy(supabaseStatus) &&
    isHealthy(githubResult.status)
      ? "ok"
      : "degraded";
  const httpStatus = status === "ok" ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: redisStatus,
        supabase: supabaseStatus,
        github: githubResult.status,
        ...(githubResult.rateLimit && {
          githubRateLimit: githubResult.rateLimit,
        }),
      },
    },
    { status: httpStatus },
  );
}
