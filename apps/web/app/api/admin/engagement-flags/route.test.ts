import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: vi.fn(),
}));

vi.mock("@/lib/db/feature-flags", () => ({
  dbGetFeatureFlags: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 10 }),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: () => "127.0.0.1",
}));

import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { dbGetFeatureFlags } from "@/lib/db/feature-flags";
import { rateLimit } from "@/lib/cache/redis";
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
  vi.mocked(readSessionCookie).mockReturnValue({ login: "admin", token: "tok", name: "Admin", avatar_url: "" });
  vi.mocked(isAdminHandle).mockReturnValue(true);
  vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 10 });
});

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3001/api/admin/engagement-flags", {
    headers: { cookie: "chapa_session=abc" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/admin/engagement-flags", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    vi.mocked(isAdminHandle).mockReturnValue(false);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns only engagement-related flags", async () => {
    vi.mocked(dbGetFeatureFlags).mockResolvedValue([
      { id: "1", key: "automated_agents", enabled: true, description: "Master toggle", config: {}, createdAt: "", updatedAt: "" },
      { id: "2", key: "score_notifications", enabled: false, description: "Score notifications", config: {}, createdAt: "", updatedAt: "" },
      { id: "3", key: "studio_enabled", enabled: true, description: "Studio", config: {}, createdAt: "", updatedAt: "" },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.flags).toHaveLength(1);
    expect(body.flags[0].key).toBe("score_notifications");
    expect(body.flags[0].enabled).toBe(false);
  });

  it("returns empty array when no engagement flags exist", async () => {
    vi.mocked(dbGetFeatureFlags).mockResolvedValue([
      { id: "1", key: "automated_agents", enabled: true, description: "Master toggle", config: {}, createdAt: "", updatedAt: "" },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.flags).toHaveLength(0);
  });

  it("returns 504 when Supabase call times out", async () => {
    vi.useFakeTimers();

    vi.mocked(dbGetFeatureFlags).mockImplementation(
      () => new Promise(() => {}),
    );

    const resPromise = GET(makeRequest());
    await vi.advanceTimersByTimeAsync(10_001);

    const res = await resPromise;
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error).toMatch(/timeout/i);

    vi.useRealTimers();
  });

  describe("branch coverage: rate limiting", () => {
    it("returns 429 when rate limited", async () => {
      vi.mocked(rateLimit).mockResolvedValue({ allowed: false, current: 11, limit: 10 });

      const res = await GET(makeRequest());
      expect(res.status).toBe(429);

      const body = await res.json();
      expect(body.error).toContain("Too many requests");
      expect(res.headers.get("Retry-After")).toBe("60");
    });
  });

  describe("branch coverage: missing NEXTAUTH_SECRET", () => {
    it("returns 500 when NEXTAUTH_SECRET is not set", async () => {
      vi.stubEnv("NEXTAUTH_SECRET", "");

      const res = await GET(makeRequest());
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe("Server misconfigured");
    });

    it("returns 500 when NEXTAUTH_SECRET is undefined", async () => {
      vi.stubEnv("NEXTAUTH_SECRET", undefined);

      const res = await GET(makeRequest());
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe("Server misconfigured");
    });
  });

  describe("branch coverage: flag description fallback", () => {
    it("uses empty string when flag description is null", async () => {
      vi.mocked(dbGetFeatureFlags).mockResolvedValue([
        { id: "1", key: "score_notifications", enabled: true, description: null, config: {}, createdAt: "", updatedAt: "" },
      ]);

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.flags).toHaveLength(1);
      expect(body.flags[0].description).toBe("");
    });

    it("preserves flag description when present", async () => {
      vi.mocked(dbGetFeatureFlags).mockResolvedValue([
        { id: "1", key: "score_notifications", enabled: true, description: "Notify on score change", config: {}, createdAt: "", updatedAt: "" },
      ]);

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.flags[0].description).toBe("Notify on score change");
    });
  });

  describe("branch coverage: NEXTAUTH_SECRET with whitespace", () => {
    it("trims NEXTAUTH_SECRET whitespace before checking", async () => {
      vi.stubEnv("NEXTAUTH_SECRET", "  test-secret  ");

      const res = await GET(makeRequest());
      // Should succeed — the trimmed secret is non-empty
      expect(res.status).toBe(200);
    });
  });
});
