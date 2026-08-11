import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";

const {
  mockRequireSession,
  mockCacheDel,
  mockRateLimit,
  mockRateLimitStrict,
  mockIsValidHandle,
  mockCaptureServerError,
  mockRevalidatePath,
  mockUpdateCraftCache,
  mockInvalidateProfileReadModels,
  mockMaterializeOrchestratedProfile,
  mockPersistOrchestratedSnapshot,
  mockGetSessionGitHubToken,
} = vi.hoisted(() => ({
  mockRequireSession: vi.fn(),
  mockCacheDel: vi.fn(),
  mockRateLimit: vi.fn(),
  mockRateLimitStrict: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockCaptureServerError: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockUpdateCraftCache: vi.fn(),
  mockInvalidateProfileReadModels: vi.fn(),
  mockMaterializeOrchestratedProfile: vi.fn(),
  mockPersistOrchestratedSnapshot: vi.fn(),
  mockGetSessionGitHubToken: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheDel: (...args: unknown[]) => mockCacheDel(...args),
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  rateLimitStrict: (...args: unknown[]) => mockRateLimitStrict(...args),
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: (...args: unknown[]) => mockIsValidHandle(...args),
}));

vi.mock("@/lib/profile/post-write-invalidation", () => ({
  invalidateProfileReadModels: (...args: unknown[]) =>
    mockInvalidateProfileReadModels(...args),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
  withErrorCapture: (_route: unknown, handler: unknown) => handler,
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

vi.mock("@/lib/auth/github-session-token", () => ({
  getSessionGitHubToken: (...args: unknown[]) => mockGetSessionGitHubToken(...args),
}));

const SESSION = {
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
    mockRateLimitStrict.mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    mockCacheDel.mockResolvedValue(undefined);
    mockInvalidateProfileReadModels.mockResolvedValue(undefined);
    mockUpdateCraftCache.mockResolvedValue(undefined);
    mockMaterializeOrchestratedProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockPersistOrchestratedSnapshot.mockResolvedValue(true);
    mockGetSessionGitHubToken.mockResolvedValue("oauth-token");
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
    mockRateLimitStrict.mockResolvedValue({ allowed: false, current: 6, limit: 5 });

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(429);
  });

  it("uses the fail-closed rate limiter (not the fail-open variant)", async () => {
    await POST(makeRequest("testuser"));

    expect(mockRateLimitStrict).toHaveBeenCalledWith(
      "ratelimit:refresh:testuser",
      5,
      3600,
    );
    expect(mockRateLimit).not.toHaveBeenCalled();
  });

  it("rejects the request when Redis is unavailable (fails closed)", async () => {
    // Simulate a Redis outage: the fail-open limiter would allow the request,
    // but the fail-closed limiter blocks it. An auth-critical route must block.
    mockRateLimit.mockResolvedValue({ allowed: true, current: 0, limit: 5 });
    mockRateLimitStrict.mockResolvedValue({ allowed: false, current: 0, limit: 5 });

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(429);
  });

  it("materializes the public profile, persists a replace snapshot, and returns display impact", async () => {
    const res = await POST(makeRequest("testuser"));
    const body = await res.json();

    expect(res.status).toBe(200);
    // Pre-fetch invalidation now routes through the shared helper rather than a
    // duplicated key literal.
    expect(mockInvalidateProfileReadModels).toHaveBeenCalledWith("testuser", {
      stats: true,
    });
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("testuser", {
      token: "oauth-token",
    });
    expect(mockPersistOrchestratedSnapshot).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED,
      { mode: "replace" },
    );
    expect(mockInvalidateProfileReadModels).toHaveBeenCalledWith("testuser", {
      badgeSvg: true,
      history: true,
      snapshot: true,
    });
    expect(body.stats).toEqual(FAKE_MATERIALIZED.stats);
    expect(body.impact).toEqual(FAKE_MATERIALIZED.displayImpact);
  });

  it("persists before invalidating history-backed read models", async () => {
    await POST(makeRequest("testuser"));

    const persistOrder = mockPersistOrchestratedSnapshot.mock.invocationCallOrder[0];
    // Two invalidation calls now bracket the fetch: `{stats}` before it to force
    // the refetch, and the snapshot-derived artifacts after the persist. Only
    // the second is ordered against the persist.
    const postPersistIdx = mockInvalidateProfileReadModels.mock.calls.findIndex(
      (c) => (c[1] as { badgeSvg?: boolean } | undefined)?.badgeSvg === true,
    );
    const invalidateOrder =
      mockInvalidateProfileReadModels.mock.invocationCallOrder[postPersistIdx];

    expect(persistOrder).toBeDefined();
    expect(postPersistIdx).toBeGreaterThanOrEqual(0);
    expect(invalidateOrder).toBeDefined();
    expect(persistOrder!).toBeLessThan(invalidateOrder!);
  });

  it("forces the refetch before materializing, never after", async () => {
    await POST(makeRequest("testuser"));

    const statsInvalidateOrder =
      mockInvalidateProfileReadModels.mock.invocationCallOrder[0];
    const materializeOrder =
      mockMaterializeOrchestratedProfile.mock.invocationCallOrder[0];

    expect(mockInvalidateProfileReadModels.mock.calls[0]![1]).toEqual({ stats: true });
    expect(statsInvalidateOrder!).toBeLessThan(materializeOrder!);
  });

  it("never clears the protected GitHub-derived baseline", async () => {
    await POST(makeRequest("testuser"));

    // `stats:stale:v2:` carries the scope-downgrade protection from #1050;
    // a refresh must never drop it.
    expect(mockCacheDel).not.toHaveBeenCalledWith(
      expect.stringContaining("stats:stale"),
    );
    for (const call of mockInvalidateProfileReadModels.mock.calls) {
      expect(Object.keys(call[1] as object)).not.toContain("staleStats");
    }
  });

  it("updates craft cache when materialized profile carries craft data", async () => {
    await POST(makeRequest("testuser"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockUpdateCraftCache).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED.craftResult,
    );
  });

  it("swallows errors from updateCraftCache via fire-and-forget without affecting the response", async () => {
    mockUpdateCraftCache.mockRejectedValue(new Error("redis unavailable"));

    const res = await POST(makeRequest("testuser"));
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockUpdateCraftCache).toHaveBeenCalledWith(
        "testuser",
        FAKE_MATERIALIZED.craftResult,
      );
    });
  });

  it("does not update craft cache when no craft data is loaded", async () => {
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

  it("returns 401 when no GitHub token is stored for the session", async () => {
    mockGetSessionGitHubToken.mockResolvedValue(null);

    const res = await POST(makeRequest("testuser"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Reauthentication required" });
    expect(mockMaterializeOrchestratedProfile).not.toHaveBeenCalled();
  });

  it("revalidates the share page after a successful refresh", async () => {
    const res = await POST(makeRequest("testuser"));

    expect(res.status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/u/testuser");
  });

  it("returns 500 when the refreshed snapshot cannot be persisted", async () => {
    mockPersistOrchestratedSnapshot.mockResolvedValue(false);

    const res = await POST(makeRequest("testuser"));

    expect(res.status).toBe(500);
    // The pre-fetch `{stats}` invalidation has already run by this point; what
    // must NOT run is the post-persist artifact invalidation.
    expect(mockInvalidateProfileReadModels).not.toHaveBeenCalledWith(
      "testuser",
      expect.objectContaining({ badgeSvg: true }),
    );
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("re-throws when an unexpected error is thrown (handled by withErrorCapture)", async () => {
    mockMaterializeOrchestratedProfile.mockRejectedValue(new Error("unexpected boom"));

    await expect(POST(makeRequest("testuser"))).rejects.toThrow("unexpected boom");
  });
});
