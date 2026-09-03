import { type NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { cacheGetCronLastRun, pingRedis, rateLimit, cacheGet, cacheSet } from "@/lib/cache/redis";
import { getChapaAlertWebhookUrl, getGithubToken, getVercelEnv } from "@/lib/env";
import { isAdminHandle } from "@/lib/auth/admin";
import { getOptionalRequestSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";
import { pingSupabase } from "@/lib/db/supabase";
import { captureOperationalAlert, withErrorCapture } from "@/lib/analytics/server-errors";
import { getMissingFontFiles } from "@/lib/render/font-files";

/** Shape returned for a successful GitHub probe. */
interface GitHubRateLimit {
  remaining: number;
  limit: number;
}

const GITHUB_RATE_LIMIT_FLOOR = 500;
const CRON_HEARTBEAT_TTL_MS = 26 * 60 * 60 * 1000;

/**
 * Durable anchor for the missing-heartbeat grace window (#1052).
 *
 * A newly-registered cron has not run yet: the daily ones (sync-audience
 * 03:30, latency-check 06:15, process-campaigns 08:00) legitimately report a
 * null heartbeat for up to ~24h after the deploy that first registers them.
 * Degrading during that window would report a fix as an outage.
 *
 * Anchored in Redis rather than to process uptime. #1047 removed a grace
 * measured from PROCESS_STARTED_AT because that window could never elapse —
 * every serverless cold start reloads the module, so the null branch was
 * excused forever and four dead crons went unreported for months (#1052). A
 * Redis anchor survives cold starts and deploys, so this window genuinely
 * expires and the check can still fail.
 *
 * The 90-day TTL is a safety valve, not a schedule: if it ever lapses the
 * grace simply restarts for one cycle rather than pinning health green.
 */
const CRON_GRACE_ANCHOR_KEY = "cron:health:first-seen";
const CRON_GRACE_ANCHOR_TTL_SECONDS = 90 * 24 * 60 * 60;
const CRON_HEARTBEATS = [
  "warm-cache",
  "sync-audience",
  "process-campaigns",
  "latency-check",
] as const;

interface CronHeartbeatStatus {
  lastRun: number | null;
  stale: boolean;
  ageMs: number | null;
}

/** Probe GitHub's rate_limit API to verify reachability AND token capability.
 *
 * Reachability alone is not enough. The scoring pipeline's `fetchScope` logic
 * (`lib/github/client.ts`, #1050) treats a tokenless fetch as private-inclusive
 * *because* the server GITHUB_TOKEN carries `repo` scope. If that token is ever
 * rotated to one without `repo`, every badge silently reverts to a public-only
 * view of its user: juan294 saw 140 of 987 merged PRs that way, `prsMergedWeight`
 * collapsed 120 -> 3.38, and Delivery fell 100 -> 58 — with no error raised
 * anywhere, because a scope-blind token is a perfectly valid token.
 *
 * This probe therefore asserts the capability the pipeline depends on, rather
 * than merely that GitHub answered.
 *
 * Returns:
 * - "skipped"             — GITHUB_TOKEN not configured (no probe attempted)
 * - "ok"                  — API reachable, token authenticates and holds `repo`
 * - "insufficient_scope"  — token works but lacks `repo`: stats would be blinded
 * - "error"               — request failed, or non-2xx (a 401 means the token
 *                           does not authenticate at all)
 */
async function pingGitHub(): Promise<{
  status: "ok" | "error" | "skipped" | "insufficient_scope";
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
    const rateLimit = { remaining: data.rate.remaining, limit: data.rate.limit };

    // GitHub reports the token's granted scopes on every authenticated REST
    // response. Absent header => a fine-grained PAT or GitHub App token, whose
    // permissions this header cannot express; don't claim insufficiency we
    // cannot actually observe (a false alarm here would page on every check).
    const scopeHeader = response.headers.get("x-oauth-scopes");
    if (scopeHeader !== null) {
      const scopes = scopeHeader.split(",").map((s) => s.trim());
      if (!scopes.includes("repo")) {
        return { status: "insufficient_scope", rateLimit };
      }
    }

    return { status: "ok", rateLimit };
  } catch {
    return { status: "error" };
  }
}

// Cache the GitHub rate_limit probe for 60 s so concurrent health probes
// share a single outbound call instead of each hitting GitHub separately.
const cachedPingGitHub = unstable_cache(pingGitHub, ["health-github-probe"], {
  revalidate: 60,
});

/**
 * True while a missing heartbeat is still explainable by "this cron has not
 * had its first scheduled run yet" rather than "this cron is broken".
 *
 * The anchor records the first time health observed this deployment's Redis.
 * Until CRON_HEARTBEAT_TTL_MS (26h) has passed since then — comfortably more
 * than the slowest cron's daily cadence — a null heartbeat is expected.
 *
 * When Redis is unavailable, `cacheGet` returns null and the write fails, so
 * this reports "in grace" and suppresses a cron alarm. That is intentional:
 * heartbeats live in Redis, so a Redis outage makes cron staleness
 * unknowable, not false. The Redis probe itself already degrades the response
 * in that case, so the outage is still reported — just not misattributed to
 * the crons.
 */
async function isWithinCronGraceWindow(now: number): Promise<boolean> {
  const anchor = await cacheGet<number>(CRON_GRACE_ANCHOR_KEY);

  if (typeof anchor !== "number") {
    // First observation (or Redis unavailable). Record it and grant grace.
    // Fire-and-forget, wrapped in Promise.resolve so neither a rejection nor a
    // non-promise return can throw here — /api/health must never 500 because
    // an advisory marker write failed.
    void Promise.resolve(cacheSet(CRON_GRACE_ANCHOR_KEY, now, CRON_GRACE_ANCHOR_TTL_SECONDS)).catch(
      () => undefined,
    );
    return true;
  }

  return now - anchor <= CRON_HEARTBEAT_TTL_MS;
}

async function getCronHeartbeatStatuses(): Promise<
  Record<(typeof CRON_HEARTBEATS)[number], CronHeartbeatStatus>
> {
  const now = Date.now();

  // #1052: is a null heartbeat currently excusable? Only while the durable
  // grace window is still open — i.e. the app has not yet been observed for
  // long enough that every cron (slowest cadence: daily) must have run.
  const missingHeartbeatIsStale = !(await isWithinCronGraceWindow(now));

  const entries = await Promise.all(
    CRON_HEARTBEATS.map(async (name) => {
      const lastRun = await cacheGetCronLastRun(name);
      const ageMs = lastRun == null ? null : now - lastRun;
      return [
        name,
        {
          lastRun,
          ageMs,
          // #1047: a missing heartbeat is stale once the grace window closes.
          //
          // The original grace was measured from PROCESS_STARTED_AT (module
          // load). That is coherent for a long-lived server and meaningless
          // here: on Vercel every cold start reloads the module, so a lambda
          // never survived the 2h window and this was effectively a constant
          // `false` — the null branch, the most degraded state a cron has, was
          // the one state the check could never report. It hid #1052 (four
          // crons that had never run at all) for the life of the project.
          //
          // The replacement is anchored in Redis, which survives cold starts
          // and deploys, so the window actually expires.
          stale: lastRun == null ? missingHeartbeatIsStale : ageMs! > CRON_HEARTBEAT_TTL_MS,
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

  // #1275 — the OG rasterizer's fonts. From v2.8.0 to v2.29.4 the deployed
  // function could not open them and every social card shipped with no
  // text, with nothing to say so. Reported here and alerted at P2; it does
  // not flip the health status, because a text-less social card is a defect
  // to fix, not an outage to page for, and the deployment smoke asserts 200.
  const missingFonts = getMissingFontFiles();
  const fontsStatus: "ok" | "missing" = missingFonts.length === 0 ? "ok" : "missing";

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
    fonts: fontsStatus,
    ...(missingFonts.length > 0 && { missingFonts }),
    ...(isAdmin && githubResult.rateLimit && {
      githubRateLimit: githubResult.rateLimit,
    }),
  };

  if (fontsStatus === "missing") {
    void captureOperationalAlert({
      signal: "og_fonts_missing",
      severity: "P2",
      summary: "Bundled badge fonts are missing; OG images render without text",
      route: "/api/health",
      properties: { missingFonts },
    });
  }

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
