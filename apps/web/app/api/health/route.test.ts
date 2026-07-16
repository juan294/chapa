import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/cache/redis", () => ({
  cacheGetCronLastRun: vi.fn(),
  pingRedis: vi.fn(),
  rateLimit: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/db/supabase", () => ({
  pingSupabase: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalRequestSession: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: vi.fn(),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureOperationalAlert: vi.fn(),
  withErrorCapture: (_route: unknown, handler: unknown) => handler,
}));

// unstable_cache requires a Next.js incremental cache that doesn't exist in
// vitest. Pass-through so the wrapped function still calls the mocked fetch.
vi.mock("next/cache", () => ({
  unstable_cache: <Args extends unknown[], R>(fn: (...args: Args) => R) => fn,
}));

// GitHub API is probed via global fetch — mock at module level
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { GET } from "./route";
import { cacheGetCronLastRun, pingRedis, rateLimit, cacheGet, cacheSet } from "@/lib/cache/redis";
import { pingSupabase } from "@/lib/db/supabase";
import { getOptionalRequestSession } from "@/lib/auth/session";
import { isAdminHandle } from "@/lib/auth/admin";
import { captureOperationalAlert } from "@/lib/analytics/server-errors";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3001/api/health");
}

function makeGitHubRateLimitResponse(
  remaining: number,
  limit: number,
): Response {
  return new Response(
    JSON.stringify({ rate: { remaining, limit, reset: 0, used: 0 } }),
    { status: 200 },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 30 });
  vi.mocked(cacheGetCronLastRun).mockResolvedValue(Date.now());
  // #1052 grace anchor: default to a long-elapsed window so existing tests
  // exercise the post-grace behavior (a null heartbeat is stale). Tests that
  // care about the grace window itself override this.
  vi.mocked(cacheGet).mockResolvedValue(Date.now() - 48 * 60 * 60 * 1000);
  vi.mocked(cacheSet).mockResolvedValue(true);
  vi.mocked(getOptionalRequestSession).mockReturnValue(null);
  vi.mocked(isAdminHandle).mockReturnValue(false);
  // Default: GITHUB_TOKEN not set — skipped
  vi.stubEnv("GITHUB_TOKEN", undefined);
  vi.stubEnv("VERCEL_ENV", "preview");
});

describe("GET /api/health", () => {
  it("returns 200 with status 'ok' when both Redis and Supabase are reachable", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.dependencies.redis).toBe("ok");
    expect(body.dependencies.supabase).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBeUndefined();
  });

  it("returns 503 with status 'degraded' when Redis ping fails", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("error");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.redis).toBe("error");
    expect(body.dependencies.supabase).toBe("ok");
    expect(captureOperationalAlert).toHaveBeenCalledWith({
      signal: "health_degraded",
      severity: "P1",
      summary: "Health check is degraded",
      route: "/api/health",
      properties: {
        dependencies: {
          redis: "error",
          supabase: "ok",
          github: "skipped",
          cronHeartbeats: expect.any(Object),
          alertWebhook: "skipped",
        },
      },
    });
  });

  it("returns 200 with 'skipped' when Redis env vars are not configured (#634)", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("skipped");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.dependencies.redis).toBe("skipped");
    expect(captureOperationalAlert).not.toHaveBeenCalled();
  });

  it("returns 503 when production Redis config is missing", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.mocked(pingRedis).mockResolvedValueOnce("skipped");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.redis).toBe("skipped");
    expect(captureOperationalAlert).toHaveBeenCalled();
  });

  it("returns 200 with 'skipped' when Supabase env vars are not configured (#634)", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("skipped");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.dependencies.supabase).toBe("skipped");
  });

  it("returns 503 with status 'degraded' when Supabase errors", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("error");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.redis).toBe("ok");
    expect(body.dependencies.supabase).toBe("error");
  });

  it("returns 503 with status 'degraded' when both Redis and Supabase fail", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("error");
    vi.mocked(pingSupabase).mockResolvedValueOnce("error");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.redis).toBe("error");
    expect(body.dependencies.supabase).toBe("error");
  });

  it("returns 503 when a cron heartbeat is stale", async () => {
    const twentySevenHoursAgo = Date.now() - 27 * 60 * 60 * 1000;
    vi.mocked(cacheGetCronLastRun).mockImplementation(async (name: string) =>
      name === "warm-cache" ? twentySevenHoursAgo : Date.now(),
    );
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.cronHeartbeats["warm-cache"].stale).toBe(true);
    expect(captureOperationalAlert).toHaveBeenCalled();
  });

  it("returns 503 when the latency-check cron heartbeat is stale (#1018)", async () => {
    const twentySevenHoursAgo = Date.now() - 27 * 60 * 60 * 1000;
    vi.mocked(cacheGetCronLastRun).mockImplementation(async (name: string) =>
      name === "latency-check" ? twentySevenHoursAgo : Date.now(),
    );
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.cronHeartbeats["latency-check"].stale).toBe(true);
    expect(captureOperationalAlert).toHaveBeenCalled();
  });

  it("#1047/#1050: degrades when the server token has lost `repo` scope", async () => {
    // The scoring pipeline's fetchScope logic (client.ts, #1050) treats a
    // tokenless fetch as private-inclusive precisely because the server
    // GITHUB_TOKEN carries `repo`. If that ever stops being true, every badge
    // silently reverts to a public-only view of its user — juan294 saw 140 of
    // 987 merged PRs that way, and Delivery fell 100 -> 58 with no error
    // anywhere. That assumption must be monitored, not assumed.
    vi.stubEnv("GITHUB_TOKEN", "server-pat");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "x-oauth-scopes": "gist, read:org, workflow" }), // no repo
      json: async () => ({ rate: { remaining: 4000, limit: 5000 } }),
    });
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.github).toBe("insufficient_scope");
  });

  it("#1047/#1050: stays ok when the server token carries `repo` scope", async () => {
    vi.stubEnv("GITHUB_TOKEN", "server-pat");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "x-oauth-scopes": "gist, read:org, repo, workflow" }),
      json: async () => ({ rate: { remaining: 4000, limit: 5000 } }),
    });
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dependencies.github).toBe("ok");
  });

  it("#1052: does NOT degrade for a missing heartbeat inside the durable grace window", async () => {
    // A freshly-registered cron has not run yet. sync-audience/latency-check/
    // process-campaigns are daily, so after a deploy that first registers them
    // (#1052) their heartbeats are legitimately null for up to ~24h. Degrading
    // then would report a real fix as an outage.
    //
    // The grace is anchored to a DURABLE first-seen marker in Redis, not to
    // process uptime — the mistake #1047 removed. PROCESS_STARTED_AT resets on
    // every serverless cold start, so its window could never elapse; a Redis
    // anchor survives cold starts and deploys, so the window genuinely expires.
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    vi.mocked(cacheGet).mockResolvedValue(twoHoursAgo);
    vi.mocked(cacheGetCronLastRun).mockResolvedValue(null);
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.dependencies.cronHeartbeats["warm-cache"].stale).toBe(false);
  });

  it("#1052: sets the durable anchor on first observation and grants grace", async () => {
    vi.mocked(cacheGet).mockResolvedValue(null); // no anchor yet
    vi.mocked(cacheGetCronLastRun).mockResolvedValue(null);
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dependencies.cronHeartbeats["warm-cache"].stale).toBe(false);
    expect(cacheSet).toHaveBeenCalledWith(
      "cron:health:first-seen",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("#1047: degrades when a heartbeat is missing entirely", async () => {
    // Previously a missing heartbeat was excused by a grace window measured
    // from PROCESS_STARTED_AT (module load). On Vercel every cold start
    // reloads the module, so a lambda essentially never lives long enough for
    // a 2h process-uptime grace to elapse — the null case was excused forever
    // and reported `stale: false`. Production on 2026-07-16 showed all four
    // heartbeats null, all `stale: false`, overall `status: "ok"`, while the
    // scoring pipeline was actively persisting corrupt data (#1045).
    //
    // Heartbeats live in Redis and survive deploys, so once the grace window
    // has genuinely elapsed a null means "never ran, or older than the 26h
    // TTL" — degraded, not new. Anchor is 48h old: every cron (slowest is
    // daily) has had a chance to run.
    const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
    vi.mocked(cacheGet).mockResolvedValue(fortyEightHoursAgo);
    vi.mocked(cacheGetCronLastRun).mockResolvedValue(null);
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.cronHeartbeats["warm-cache"].stale).toBe(true);
    expect(body.dependencies.cronHeartbeats["latency-check"].stale).toBe(true);
    expect(captureOperationalAlert).toHaveBeenCalled();
  });

  it("always returns a valid timestamp", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ allowed: false, current: 31, limit: 30 });

    const response = await GET(makeRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    const body = await response.json();
    expect(body.error).toMatch(/too many requests/i);
  });

  describe("alertWebhook configuration status (#943)", () => {
    it("reports alertWebhook as 'skipped' when CHAPA_ALERT_WEBHOOK_URL is not set", async () => {
      vi.stubEnv("CHAPA_ALERT_WEBHOOK_URL", undefined);
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.dependencies.alertWebhook).toBe("skipped");
    });

    it("reports alertWebhook as 'configured' when CHAPA_ALERT_WEBHOOK_URL is set", async () => {
      vi.stubEnv("CHAPA_ALERT_WEBHOOK_URL", "https://hooks.example.com/webhook");
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.dependencies.alertWebhook).toBe("configured");
    });
  });

  describe("GitHub API probe (#709)", () => {
    it("reports github as 'skipped' when GITHUB_TOKEN is not set", async () => {
      vi.stubEnv("GITHUB_TOKEN", undefined);
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.dependencies.github).toBe("skipped");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("reports github as 'ok' with rateLimit data when GITHUB_TOKEN is set and API responds", async () => {
      vi.stubEnv("GITHUB_TOKEN", "ghp_test_token");
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");
      mockFetch.mockResolvedValueOnce(makeGitHubRateLimitResponse(4999, 5000));

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.dependencies.github).toBe("ok");
      expect(body.dependencies.githubRateLimit).toBeUndefined();
    });

    it("returns 503 when GitHub quota is below the floor", async () => {
      vi.stubEnv("GITHUB_TOKEN", "ghp_test_token");
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");
      mockFetch.mockResolvedValueOnce(makeGitHubRateLimitResponse(499, 5000));

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.status).toBe("degraded");
      expect(body.dependencies.githubQuotaLow).toBe(true);
      expect(captureOperationalAlert).toHaveBeenCalled();
    });

    it("calls the GitHub rate_limit endpoint with Authorization header", async () => {
      vi.stubEnv("GITHUB_TOKEN", "ghp_test_token");
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");
      mockFetch.mockResolvedValueOnce(makeGitHubRateLimitResponse(60, 60));

      await GET(makeRequest());

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/rate_limit",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "token ghp_test_token",
          }),
        }),
      );
    });

    it("reports github as 'error' and status 'degraded' when fetch throws", async () => {
      vi.stubEnv("GITHUB_TOKEN", "ghp_test_token");
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");
      mockFetch.mockRejectedValueOnce(new Error("network error"));

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.status).toBe("degraded");
      expect(body.dependencies.github).toBe("error");
    });

    it("reports github as 'error' and status 'degraded' when API returns non-2xx", async () => {
      vi.stubEnv("GITHUB_TOKEN", "ghp_test_token");
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");
      mockFetch.mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }));

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.status).toBe("degraded");
      expect(body.dependencies.github).toBe("error");
    });

    it("does not degrade overall status when github is 'skipped'", async () => {
      vi.stubEnv("GITHUB_TOKEN", undefined);
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
    });

    it("redacts githubRateLimit details for unauthenticated callers", async () => {
      vi.stubEnv("GITHUB_TOKEN", "ghp_test_token");
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");
      mockFetch.mockResolvedValueOnce(makeGitHubRateLimitResponse(4999, 5000));

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.dependencies.github).toBe("ok");
      expect(body.dependencies.githubRateLimit).toBeUndefined();
    });

    it("caches the GitHub probe via unstable_cache to avoid redundant API calls", async () => {
      const source = await import("node:fs").then((fs) =>
        fs.promises.readFile(
          new URL("./route.ts", import.meta.url).pathname,
          "utf8",
        ),
      );
      expect(source).toMatch(/unstable_cache\(/);
      expect(source).toMatch(/health-github-probe/);
      expect(source).toMatch(/revalidate:\s*60/);
    });

    it("includes githubRateLimit details for admin sessions", async () => {
      vi.stubEnv("GITHUB_TOKEN", "ghp_test_token");
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");
      vi.mocked(getOptionalRequestSession).mockReturnValue({
        token: "t",
        login: "admin",
        name: "Admin",
        avatar_url: "",
      });
      vi.mocked(isAdminHandle).mockReturnValue(true);
      mockFetch.mockResolvedValueOnce(makeGitHubRateLimitResponse(4999, 5000));

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.dependencies.github).toBe("ok");
      expect(body.dependencies.githubRateLimit).toEqual({
        remaining: 4999,
        limit: 5000,
      });
    });
  });
});
