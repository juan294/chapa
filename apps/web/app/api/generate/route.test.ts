import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before imports
vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: vi.fn(),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: vi.fn(),
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi.fn(),
}));

import { POST } from "./route";
import { readSessionCookie } from "@/lib/auth/github";
import { getStats } from "@/lib/github/client";
import { computeImpactV4 } from "@/lib/impact/v4";
import { rateLimit } from "@/lib/cache/redis";
import type { StatsData, ImpactV4Result } from "@chapa/shared";

const mockReadSession = vi.mocked(readSessionCookie);
const mockGetStats = vi.mocked(getStats);
const mockComputeImpact = vi.mocked(computeImpactV4);
const mockRateLimit = vi.mocked(rateLimit);

function makeRequest(cookie?: string): NextRequest {
  const req = new NextRequest("http://localhost:3001/api/generate", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
  return req;
}

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXTAUTH_SECRET = "test-secret";
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 10 });
  });

  it("returns 401 when no session cookie is present", async () => {
    mockReadSession.mockReturnValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Authentication required");
  });

  it("returns 500 when NEXTAUTH_SECRET is missing", async () => {
    delete process.env.NEXTAUTH_SECRET;
    const res = await POST(makeRequest("chapa_session=abc"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Server misconfigured");
  });

  it("returns 429 when rate-limited", async () => {
    mockReadSession.mockReturnValue({
      token: "ghp_test",
      login: "juan294",
      name: "Juan",
      avatar_url: "https://example.com/avatar.png",
    });
    mockRateLimit.mockResolvedValue({ allowed: false, current: 11, limit: 10 });

    const res = await POST(makeRequest("chapa_session=abc"));
    expect(res.status).toBe(429);
  });

  it("returns 200 with success when stats are generated", async () => {
    mockReadSession.mockReturnValue({
      token: "ghp_test",
      login: "juan294",
      name: "Juan",
      avatar_url: "https://example.com/avatar.png",
    });
    const fakeStats = { handle: "juan294", commitsTotal: 100 } as unknown as StatsData;
    const fakeImpact = { archetype: "Builder", adjustedComposite: 72 } as unknown as ImpactV4Result;
    mockGetStats.mockResolvedValue(fakeStats);
    mockComputeImpact.mockReturnValue(fakeImpact);

    const res = await POST(makeRequest("chapa_session=abc"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.handle).toBe("juan294");
  });

  it("calls getStats with the session handle and token", async () => {
    mockReadSession.mockReturnValue({
      token: "ghp_test",
      login: "juan294",
      name: "Juan",
      avatar_url: "https://example.com/avatar.png",
    });
    mockGetStats.mockResolvedValue({ handle: "juan294" } as unknown as StatsData);
    mockComputeImpact.mockReturnValue({ archetype: "Builder" } as unknown as ImpactV4Result);

    await POST(makeRequest("chapa_session=abc"));

    expect(mockGetStats).toHaveBeenCalledWith("juan294", "ghp_test");
  });

  it("returns 502 when GitHub API fails", async () => {
    mockReadSession.mockReturnValue({
      token: "ghp_test",
      login: "juan294",
      name: "Juan",
      avatar_url: "https://example.com/avatar.png",
    });
    mockGetStats.mockResolvedValue(null);

    const res = await POST(makeRequest("chapa_session=abc"));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("Failed to fetch");
  });
});
