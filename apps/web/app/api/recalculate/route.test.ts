import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — hoisted before any imports that depend on them
// ---------------------------------------------------------------------------

const {
  mockResolveRequestAuth,
  mockRateLimit,
  mockGetStats,
  mockComputeImpactV6,
  mockDbGetToolInsights,
  mockBuildSnapshot,
  mockDbReplaceSnapshot,
  mockUpdateSnapshotCache,
  mockGetTier,
} = vi.hoisted(() => ({
  mockResolveRequestAuth: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetStats: vi.fn(),
  mockComputeImpactV6: vi.fn(),
  mockDbGetToolInsights: vi.fn(),
  mockBuildSnapshot: vi.fn(),
  mockDbReplaceSnapshot: vi.fn(),
  mockUpdateSnapshotCache: vi.fn(),
  mockGetTier: vi.fn(),
}));

vi.mock("@/lib/auth/resolve-request-auth", () => ({
  resolveRequestAuth: mockResolveRequestAuth,
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/github/client", () => ({
  getStats: mockGetStats,
}));

vi.mock("@/lib/impact/v6", () => ({
  computeImpactV6: mockComputeImpactV6,
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  getCachedCraftScore: mockDbGetToolInsights,
}));

vi.mock("@/lib/history/snapshot", () => ({
  buildSnapshot: mockBuildSnapshot,
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbReplaceSnapshot: mockDbReplaceSnapshot,
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  updateSnapshotCache: mockUpdateSnapshotCache,
}));

vi.mock("@/lib/impact/utils", () => ({
  getTier: mockGetTier,
}));

// ---------------------------------------------------------------------------
// Import handler AFTER mocks
// ---------------------------------------------------------------------------

import { POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH = { handle: "TestUser" };

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/recalculate",
    { method: "POST" },
  );
}

function makeStats() {
  return {
    handle: "testuser",
    commitsTotal: 150,
    prsMergedCount: 30,
    reviewsSubmittedCount: 0,
  };
}

function makeImpact(overrides: Record<string, unknown> = {}) {
  return {
    adjustedComposite: 61,
    compositeScore: 65,
    dimensions: {
      delivery: 75,
      quality: 40,
      consistency: 60,
      breadth: 55,
    },
    archetype: "Builder",
    tier: "Solid",
    profileType: "solo",
    confidence: 85,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveRequestAuth.mockResolvedValue(AUTH);
  mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 20 });
  mockGetStats.mockResolvedValue(makeStats());
  mockComputeImpactV6.mockReturnValue(makeImpact());
  mockDbGetToolInsights.mockResolvedValue({
    craftScore: 69,
    tier: "Expert",
  });
  mockBuildSnapshot.mockReturnValue({ date: "2026-03-08" });
  mockDbReplaceSnapshot.mockResolvedValue(true);
  mockUpdateSnapshotCache.mockResolvedValue(undefined);
  mockGetTier.mockReturnValue("Solid");
});

// ---------------------------------------------------------------------------
// POST /api/recalculate
// ---------------------------------------------------------------------------

describe("POST /api/recalculate", () => {
  it("returns 401 when not authenticated", async () => {
    mockResolveRequestAuth.mockResolvedValue(null);
    const resp = await POST(makeRequest());
    expect(resp.status).toBe(401);
  });

  it("accepts Bearer token authentication", async () => {
    mockResolveRequestAuth.mockResolvedValue({ handle: "cli-user" });
    mockGetStats.mockResolvedValue(makeStats());
    const req = new NextRequest(
      "https://chapa.thecreativetoken.com/api/recalculate",
      {
        method: "POST",
        headers: { Authorization: "Bearer cli.token.here" },
      },
    );
    const resp = await POST(req);
    expect(resp.status).toBe(200);
    expect(mockResolveRequestAuth).toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      current: 21,
      limit: 20,
    });
    const resp = await POST(makeRequest());
    expect(resp.status).toBe(429);
    const body = await resp.json();
    expect(body.error).toContain("Too many requests");
  });

  it("returns recalculated impact with craft score", async () => {
    const resp = await POST(makeRequest());
    const body = await resp.json();

    expect(resp.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.adjustedComposite).toBe(61);
    expect(body.craftScore).toBe(69);
    expect(body.craftTier).toBe("Expert");
    expect(body.dimensions).toBeDefined();
    expect(body.archetype).toBe("Builder");
  });

  it("replaces today's snapshot via dbReplaceSnapshot", async () => {
    await POST(makeRequest());

    expect(mockDbReplaceSnapshot).toHaveBeenCalledWith(
      "testuser",
      expect.any(Object),
    );
    expect(mockUpdateSnapshotCache).toHaveBeenCalledWith(
      "testuser",
      expect.any(Object),
    );
  });

  it("works without craft score (no insights uploaded)", async () => {
    mockDbGetToolInsights.mockResolvedValue(null);

    const resp = await POST(makeRequest());
    const body = await resp.json();

    expect(body.craftScore).toBeNull();
    expect(body.craftTier).toBeNull();
    expect(body.success).toBe(true);
  });

  it("returns 502 when stats cannot be loaded", async () => {
    mockGetStats.mockResolvedValue(null);

    const resp = await POST(makeRequest());
    expect(resp.status).toBe(502);
  });

  it("uses raw adjusted composite (calls getTier, not smoothScore)", async () => {
    mockComputeImpactV6.mockReturnValue(makeImpact({ adjustedComposite: 61 }));
    mockGetTier.mockReturnValue("Solid");

    const resp = await POST(makeRequest());
    const body = await resp.json();

    expect(body.adjustedComposite).toBe(61);
    expect(mockGetTier).toHaveBeenCalledWith(61);
  });

  it("returns success even if snapshot replacement fails", async () => {
    mockDbReplaceSnapshot.mockResolvedValue(false);

    const resp = await POST(makeRequest());
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    // Should NOT update cache if replacement failed
    expect(mockUpdateSnapshotCache).not.toHaveBeenCalled();
  });

  it("lowercases handle for all operations", async () => {
    await POST(makeRequest());

    expect(mockGetStats).toHaveBeenCalledWith("testuser", undefined);
    expect(mockDbGetToolInsights).toHaveBeenCalledWith("testuser");
    expect(mockDbReplaceSnapshot).toHaveBeenCalledWith(
      "testuser",
      expect.any(Object),
    );
  });

  it("passes craft score to computeImpactV6", async () => {
    mockDbGetToolInsights.mockResolvedValue({
      craftScore: 69,
      tier: "Expert",
    });

    await POST(makeRequest());

    expect(mockComputeImpactV6).toHaveBeenCalledWith(
      expect.any(Object),
      69,
    );
  });

  it("passes undefined craft score when no insights exist", async () => {
    mockDbGetToolInsights.mockResolvedValue(null);

    await POST(makeRequest());

    expect(mockComputeImpactV6).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
    );
  });
});
