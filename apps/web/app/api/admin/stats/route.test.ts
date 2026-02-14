import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/cache/redis", () => ({
  getBadgeStats: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 10 }),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { getBadgeStats, rateLimit } from "@/lib/cache/redis";

const VALID_SECRET = "test-admin-secret-123";

beforeEach(() => {
  vi.stubEnv("ADMIN_SECRET", VALID_SECRET);
  vi.mocked(getBadgeStats).mockResolvedValue({ total: 42, unique: 7 });
  vi.mocked(rateLimit).mockResolvedValue({ allowed: true, current: 1, limit: 10 });
});

function makeRequest(secret?: string): NextRequest {
  const url = "https://chapa.thecreativetoken.com/api/admin/stats";
  const headers: Record<string, string> = {};
  if (secret !== undefined) {
    headers["Authorization"] = `Bearer ${secret}`;
  }
  return new NextRequest(url, { headers });
}

describe("GET /api/admin/stats", () => {
  it("returns stats with valid secret", async () => {
    const res = await GET(makeRequest(VALID_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      badges: { total: 42, unique: 7 },
    });
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when ADMIN_SECRET env var is not set", async () => {
    vi.stubEnv("ADMIN_SECRET", "");
    const res = await GET(makeRequest(VALID_SECRET));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ allowed: false, current: 11, limit: 10 });
    const res = await GET(makeRequest(VALID_SECRET));
    expect(res.status).toBe(429);
  });

  it("returns zeros when Redis is unavailable", async () => {
    vi.mocked(getBadgeStats).mockResolvedValue({ total: 0, unique: 0 });
    const res = await GET(makeRequest(VALID_SECRET));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.badges).toEqual({ total: 0, unique: 0 });
  });

  it("uses timing-safe comparison for secret", async () => {
    // A secret that's the same length but different should still be rejected
    const sameLength = "x".repeat(VALID_SECRET.length);
    const res = await GET(makeRequest(sameLength));
    expect(res.status).toBe(401);
  });
});
