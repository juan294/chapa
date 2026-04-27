import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const {
  mockResolveRequestAuth,
  mockRateLimit,
  mockUpdateCraftCache,
  mockInvalidateProfileReadModels,
  mockRevalidatePath,
  mockMaterializeOrchestratedProfile,
  mockPersistOrchestratedSnapshot,
} = vi.hoisted(() => ({
  mockResolveRequestAuth: vi.fn(),
  mockRateLimit: vi.fn(),
  mockUpdateCraftCache: vi.fn(),
  mockInvalidateProfileReadModels: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockMaterializeOrchestratedProfile: vi.fn(),
  mockPersistOrchestratedSnapshot: vi.fn(),
}));

vi.mock("@/lib/auth/resolve-request-auth", () => ({
  resolveRequestAuth: (...args: unknown[]) => mockResolveRequestAuth(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  updateCraftCache: (...args: unknown[]) => mockUpdateCraftCache(...args),
}));

vi.mock("@/lib/profile/post-write-invalidation", () => ({
  invalidateProfileReadModels: (...args: unknown[]) =>
    mockInvalidateProfileReadModels(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock("@/lib/profile/orchestrated-profile", () => ({
  materializeOrchestratedProfile: (...args: unknown[]) =>
    mockMaterializeOrchestratedProfile(...args),
  persistOrchestratedSnapshot: (...args: unknown[]) =>
    mockPersistOrchestratedSnapshot(...args),
}));

const AUTH = { handle: "TestUser", token: "cli-token" };

const FAKE_MATERIALIZED = {
  stats: { handle: "testuser" },
  craftResult: { craftScore: 69, tier: "Expert" },
  rawImpact: {
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
    confidencePenalties: [],
    computedAt: "2026-04-17T12:00:00.000Z",
  },
  displayImpact: {
    adjustedComposite: 58,
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
    confidencePenalties: [],
    computedAt: "2026-04-17T12:00:00.000Z",
  },
  snapshot: { date: "2026-04-17", adjustedComposite: 58, tier: "Solid" },
};

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/recalculate",
    { method: "POST" },
  );
}

describe("POST /api/recalculate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveRequestAuth.mockResolvedValue(AUTH);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 20 });
    mockMaterializeOrchestratedProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockInvalidateProfileReadModels.mockResolvedValue(undefined);
    mockRevalidatePath.mockImplementation(() => undefined);
    mockPersistOrchestratedSnapshot.mockResolvedValue(true);
    mockUpdateCraftCache.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockResolveRequestAuth.mockResolvedValue(null);

    const resp = await POST(makeRequest());
    expect(resp.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 21, limit: 20 });

    const resp = await POST(makeRequest());
    expect(resp.status).toBe(429);
  });

  it("materializes the public profile, persists a replace snapshot, and returns raw plus display scores", async () => {
    const resp = await POST(makeRequest());
    const body = await resp.json();

    expect(resp.status).toBe(200);
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("testuser", {
      token: "cli-token",
    });
    expect(mockPersistOrchestratedSnapshot).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED,
      { mode: "replace" },
    );
    expect(mockInvalidateProfileReadModels).toHaveBeenCalledWith("testuser", {
      history: true,
    });
    expect(body.success).toBe(true);
    expect(body.adjustedComposite).toBe(58);
    expect(body.displayAdjustedComposite).toBe(58);
    expect(body.rawAdjustedComposite).toBe(61);
    expect(body.craftScore).toBe(69);
    expect(body.craftTier).toBe("Expert");
  });

  it("persists before invalidating history-backed read models", async () => {
    await POST(makeRequest());

    const persistOrder = mockPersistOrchestratedSnapshot.mock.invocationCallOrder[0];
    const invalidateOrder =
      mockInvalidateProfileReadModels.mock.invocationCallOrder[0];

    expect(persistOrder).toBeDefined();
    expect(invalidateOrder).toBeDefined();
    expect(persistOrder!).toBeLessThan(invalidateOrder!);
  });

  it("updates craft cache when materialized profile carries craft data", async () => {
    await POST(makeRequest());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockUpdateCraftCache).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED.craftResult,
    );
  });

  it("swallows errors from updateCraftCache via fire-and-forget without affecting the response", async () => {
    mockUpdateCraftCache.mockRejectedValue(new Error("redis unavailable"));

    const resp = await POST(makeRequest());
    expect(resp.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockUpdateCraftCache).toHaveBeenCalledWith(
        "testuser",
        FAKE_MATERIALIZED.craftResult,
      );
    });
  });

  it("does not update craft cache when no craft score exists", async () => {
    mockMaterializeOrchestratedProfile.mockResolvedValue({
      ...FAKE_MATERIALIZED,
      craftResult: null,
    });

    await POST(makeRequest());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockUpdateCraftCache).not.toHaveBeenCalled();
  });

  it("returns 502 when stats cannot be materialized", async () => {
    mockMaterializeOrchestratedProfile.mockResolvedValue(null);

    const resp = await POST(makeRequest());
    expect(resp.status).toBe(502);
  });

  it("revalidates the share page after a successful recalculation", async () => {
    const resp = await POST(makeRequest());

    expect(resp.status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/u/testuser");
  });

  it("returns 500 when the recalculated snapshot cannot be persisted", async () => {
    mockPersistOrchestratedSnapshot.mockResolvedValue(false);

    const resp = await POST(makeRequest());

    expect(resp.status).toBe(500);
    expect(mockInvalidateProfileReadModels).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
