import { type NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { cacheGetCronLastRun, pingRedis, rateLimit } from "@/lib/cache/redis";
import { getChapaAlertWebhookUrl, getGithubToken, getVercelEnv } from "@/lib/env";
import { isAdminHandle } from "@/lib/auth/admin";
import { getOptionalRequestSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";
import { pingSupabase } from "@/lib/db/supabase";
import { captureOperationalAlert, withErrorCapture } from "@/lib/analytics/server-errors";

/** Shape returned for a successful GitHub probe. */
interface GitHubRateLimit {
  remaining: number;
  limit: number;
}

const GITHUB_RATE_LIMIT_FLOOR = 500;
const CRON_HEARTBEAT_TTL_MS = 26 * 60 * 60 * 1000;
const MISSING_HEARTBEAT_GRACE_MS = 2 * 60 * 60 * 1000;
const PROCESS_STARTED_AT = Date.now();
const CRON_HEARTBEATS = [
  "warm-cache",
  "sync-audience",
  "process-campaigns",
] as const;

interface CronHeartbeatStatus {
  lastRun: number | null;
  stale: boolean;
  ageMs: number | null;
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
  const token = getGithubToken();
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

// Cache the GitHub rate_limit probe for 60 s so concurrent health probes
// share a single outbound call instead of each hitting GitHub separately.
const cachedPingGitHub = unstable_cache(pingGitHub, ["health-github-probe"], {
  revalidate: 60,
});

async function getCronHeartbeatStatuses(): Promise<
  Record<(typeof CRON_HEARTBEATS)[number], CronHeartbeatStatus>
> {
  const now = Date.now();
  const missingHeartbeatIsStale =
    now - PROCESS_STARTED_AT > MISSING_HEARTBEAT_GRACE_MS;
  const entries = await Promise.all(
    CRON_HEARTBEATS.map(async (name) => {
      const lastRun = await cacheGetCronLastRun(name);
      const ageMs = lastRun == null ? null : now - lastRun;
      return [
        name,
        {
          lastRun,
          ageMs,
          stale:
            lastRun == null
              ? missingHeartbeatIsStale
              : ageMs !== null && ageMs > CRON_HEARTBEAT_TTL_MS,
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<
    (typeof CRON_HEARTBEATS)[number],
    CronHeartbeatStatus
  >;
}

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring.
 * Rate limited: 30 requests per IP per 60 seconds.
 */
export const GET = withErrorCapture("/api/health", async (request: NextRequest) => {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:health:${ip}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const [redisStatus, supabaseStatus, githubResult, cronHeartbeats] = await Promise.all([
    pingRedis(),
    pingSupabase(),
    cachedPingGitHub(),
    getCronHeartbeatStatuses(),
  ]);
  const session = getOptionalRequestSession(request);
  const isAdmin = session ? isAdminHandle(session.login) : false;

  // "skipped" is acceptable in preview/dev where optional integrations degrade
  // gracefully. In production, skipped core dependencies indicate missing
  // runtime configuration and must fail health so smoke/monitoring can catch it.
  const isProduction = getVercelEnv() === "production";
  const isHealthy = (s: string) =>
    s === "ok" || (!isProduction && s === "skipped");
  const staleCrons = Object.entries(cronHeartbeats)
    .filter(([, heartbeat]) => heartbeat.stale)
    .map(([name]) => name);
  const githubQuotaLow =
    githubResult.status === "ok" &&
    githubResult.rateLimit !== undefined &&
    githubResult.rateLimit.remaining < GITHUB_RATE_LIMIT_FLOOR;
  const status =
    isHealthy(redisStatus) &&
    isHealthy(supabaseStatus) &&
    isHealthy(githubResult.status) &&
    staleCrons.length === 0 &&
    !githubQuotaLow
      ? "ok"
      : "degraded";
  const httpStatus = status === "ok" ? 200 : 503;
  const dependencies = {
    redis: redisStatus,
    supabase: supabaseStatus,
    github: githubResult.status,
    cronHeartbeats,
    ...(githubQuotaLow && { githubQuotaLow: true }),
    alertWebhook: getChapaAlertWebhookUrl() ? "configured" : "skipped",
    ...(isAdmin && githubResult.rateLimit && {
      githubRateLimit: githubResult.rateLimit,
    }),
  };

  if (status === "degraded") {
    void captureOperationalAlert({
      signal: "health_degraded",
      severity: "P1",
      summary: "Health check is degraded",
      route: "/api/health",
      properties: { dependencies },
    });
  }

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      dependencies,
    },
    { status: httpStatus },
  );
});
