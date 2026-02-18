import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDbGetFeatureFlags = vi.fn();
vi.mock("@/lib/db/feature-flags", () => ({
  dbGetFeatureFlags: () => mockDbGetFeatureFlags(),
}));

const mockRateLimit = vi.fn();
vi.mock("@/lib/cache/redis", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: () => "127.0.0.1",
}));

import { GET } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3001/api/feature-flags");
}

function makeFlag(key: string, enabled: boolean) {
  return {
    id: `uuid-${key}`,
    key,
    enabled,
    description: `${key} flag`,
    config: {},
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/feature-flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 30 });
  });

  it("returns all feature flags", async () => {
    const flags = [
      makeFlag("automated_agents", false),
      makeFlag("studio_enabled", true),
    ];
    mockDbGetFeatureFlags.mockResolvedValue(flags);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.flags).toHaveLength(2);
    expect(body.flags[0].key).toBe("automated_agents");
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 31, limit: 30 });

    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("returns empty array when DB is unavailable", async () => {
    mockDbGetFeatureFlags.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.flags).toEqual([]);
  });

  it("includes Cache-Control header", async () => {
    mockDbGetFeatureFlags.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300",
    );
  });
});
