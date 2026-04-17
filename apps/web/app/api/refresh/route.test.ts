import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";

const {
  mockRequireSession,
  mockCacheDel,
  mockRateLimit,
  mockIsValidHandle,
  mockInvalidateHistoryCache,
  mockCaptureServerError,
  mockRevalidatePath,
  mockUpdateCraftCache,
  mockMaterializeOrchestratedProfile,
  mockPersistOrchestratedSnapshot,
} = vi.hoisted(() => ({
  mockRequireSession: vi.fn(),
  mockCacheDel: vi.fn(),
  mockRateLimit: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockInvalidateHistoryCache: vi.fn(),
  mockCaptureServerError: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockUpdateCraftCache: vi.fn(),
  mockMaterializeOrchestratedProfile: vi.fn(),
  mockPersistOrchestratedSnapshot: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: (...args: unknown[]) => mockCacheDel(...args),
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: (...args: unknown[]) => mockIsValidHandle(...args),
}));

vi.mock("@/lib/history/history", () => ({
  invalidateHistoryCache: (...args: unknown[]) => mockInvalidateHistoryCache(...args),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  updateCraftCache: (...args: unknown[]) => mockUpdateCraftCache(...args),
}));

vi.mock("@/lib/profile/orchestrated-profile", () => ({
  materializeOrchestratedProfile: (...args: unknown[]) =>
    mockMaterializeOrchestratedProfile(...args),
  persistOrchestratedSnapshot: (...args: unknown[]) =>
    mockPersistOrchestratedSnapshot(...args),
}));

const SESSION = {
  token: "oauth-token",
  login: "testuser",
  name: "Test User",
  avatar_url: "https://example.com/avatar.png",
};

const FAKE_MATERIALIZED = {
  stats: {
    handle: "testuser",
    commitsTotal: 142,
    prsMergedCount: 18,
    reviewsSubmittedCount: 31,
  },
  craftResult: {
    craftScore: 74,
    tier: "Expert",
  },
  rawImpact: {
    adjustedComposite: 76,
    compositeScore: 76,
    dimensions: { delivery: 75, quality: 65, consistency: 70, breadth: 60 },
    archetype: "Builder",
    tier: "High",
    profileType: "collaborative",
    confidence: 85,
    confidencePenalties: [],
    computedAt: "2026-04-17T12:00:00.000Z",
  },
  displayImpact: {
    adjustedComposite: 72,
    compositeScore: 76,
    dimensions: { delivery: 75, quality: 65, consistency: 70, breadth: 60 },
    archetype: "Builder",
    tier: "Solid",
    profileType: "collaborative",
    confidence: 85,
    confidencePenalties: [],
    computedAt: "2026-04-17T12:00:00.000Z",
  },
  snapshot: { date: "2026-04-17", adjustedComposite: 72, tier: "Solid" },
};

function makeRequest(handle?: string): NextRequest {
  const url = handle
    ? `http://localhost:3001/api/refresh?handle=${handle}`
    : "http://localhost:3001/api/refresh";
  return new NextRequest(url, { method: "POST" });
}

describe("POST /api/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockReturnValue({ session: SESSION });
    mockIsValidHandle.mockReturnValue(true);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    mockCacheDel.mockResolvedValue(undefined);
    mockInvalidateHistoryCache.mockResolvedValue(undefined);
    mockUpdateCraftCache.mockResolvedValue(undefined);
    mockMaterializeOrchestratedProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockPersistOrchestratedSnapshot.mockResolvedValue(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireSession.mockReturnValue({
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    });

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when refreshing another user's badge", async () => {
    mockRequireSession.mockReturnValue({
      session: { ...SESSION, login: "otheruser" },
    });

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(403);
  });

  it("returns 400 when handle is missing or invalid", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const res = await POST(makeRequest("bad!!handle"));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 6, limit: 5 });

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(429);
  });

  it("materializes with recomputed craft, persists a replace snapshot, and returns display impact", async () => {
    const res = await POST(makeRequest("testuser"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockCacheDel).toHaveBeenCalledWith("stats:v2:merged:testuser");
    expect(mockInvalidateHistoryCache).toHaveBeenCalledWith("testuser");
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("testuser", {
      token: "oauth-token",
      craftMode: "recompute",
    });
    expect(mockPersistOrchestratedSnapshot).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED,
      { mode: "replace" },
    );
    expect(body.stats).toEqual(FAKE_MATERIALIZED.stats);
    expect(body.impact).toEqual(FAKE_MATERIALIZED.displayImpact);
  });

  it("updates craft cache when recompute returns craft data", async () => {
    await POST(makeRequest("testuser"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockUpdateCraftCache).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED.craftResult,
    );
  });

  it("does not update craft cache when recompute returns no craft data", async () => {
    mockMaterializeOrchestratedProfile.mockResolvedValue({
      ...FAKE_MATERIALIZED,
      craftResult: null,
    });

    await POST(makeRequest("testuser"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockUpdateCraftCache).not.toHaveBeenCalled();
  });

  it("returns 502 and captures the error when canonical materialization fails", async () => {
    mockMaterializeOrchestratedProfile.mockResolvedValue(null);

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(502);
    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/refresh",
        statusCode: 502,
      }),
    );
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates the share page after a successful refresh", async () => {
    const res = await POST(makeRequest("testuser"));

    expect(res.status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/u/testuser");
  });

  it("returns 500 and captures the exception on unexpected failure", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockMaterializeOrchestratedProfile.mockRejectedValue(new Error("unexpected boom"));

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(500);
    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/refresh",
        statusCode: 500,
      }),
    );

    consoleErrorSpy.mockRestore();
  });
});
