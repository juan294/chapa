import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/cache/redis", () => ({
  pingRedis: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/db/supabase", () => ({
  pingSupabase: vi.fn(),
}));

// GitHub API is probed via global fetch — mock at module level
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { GET } from "./route";
import { pingRedis, rateLimit } from "@/lib/cache/redis";
import { pingSupabase } from "@/lib/db/supabase";

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
  // Default: GITHUB_TOKEN not set — skipped
  delete process.env.GITHUB_TOKEN;
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
  });

  it("returns 200 with 'skipped' when Redis env vars are not configured (#634)", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("skipped");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.dependencies.redis).toBe("skipped");
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

  describe("GitHub API probe (#709)", () => {
    it("reports github as 'skipped' when GITHUB_TOKEN is not set", async () => {
      delete process.env.GITHUB_TOKEN;
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
      process.env.GITHUB_TOKEN = "ghp_test_token";
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");
      mockFetch.mockResolvedValueOnce(makeGitHubRateLimitResponse(4999, 5000));

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(body.dependencies.github).toBe("ok");
      expect(body.dependencies.githubRateLimit).toEqual({ remaining: 4999, limit: 5000 });
    });

    it("calls the GitHub rate_limit endpoint with Authorization header", async () => {
      process.env.GITHUB_TOKEN = "ghp_test_token";
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
      process.env.GITHUB_TOKEN = "ghp_test_token";
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
      process.env.GITHUB_TOKEN = "ghp_test_token";
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
      delete process.env.GITHUB_TOKEN;
      vi.mocked(pingRedis).mockResolvedValueOnce("ok");
      vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
    });
  });
});
