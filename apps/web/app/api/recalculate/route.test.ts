import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const {
  mockResolveRequestAuth,
  mockRateLimit,
  mockGetClientIp,
  mockUpdateCraftCache,
  mockInvalidateProfileReadModels,
  mockRevalidatePath,
  mockMaterializeOrchestratedProfile,
  mockEnqueueAndReportScoringStatus,
} = vi.hoisted(() => ({
  mockResolveRequestAuth: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockUpdateCraftCache: vi.fn(),
  mockInvalidateProfileReadModels: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockMaterializeOrchestratedProfile: vi.fn(),
  mockEnqueueAndReportScoringStatus: vi.fn(),
}));

vi.mock("@/lib/auth/resolve-request-auth", () => ({
  resolveRequestAuth: (...args: unknown[]) => mockResolveRequestAuth(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/http/client-ip", () => ({
  NO_TRUSTED_IP: "unknown",
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
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
}));

vi.mock("@/lib/profile/post-write-score", () => ({
  enqueueAndReportScoringStatus: (...args: unknown[]) => mockEnqueueAndReportScoringStatus(...args),
}));

const AUTH = { handle: "TestUser", token: "cli-token" };

const FAKE_MATERIALIZED = {
  stats: { handle: "testuser" },
  craftResult: { craftScore: 69, tier: "Expert" },
  statsComplete: true,
};

const SCORING_STATUS = { kind: "collecting" as const, percent: 40, sources: [], hasPriorReceipt: false };

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
    mockGetClientIp.mockReturnValue("1.2.3.4");
    mockMaterializeOrchestratedProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockInvalidateProfileReadModels.mockResolvedValue(undefined);
    mockRevalidatePath.mockImplementation(() => undefined);
    mockUpdateCraftCache.mockResolvedValue(undefined);
    mockEnqueueAndReportScoringStatus.mockResolvedValue(SCORING_STATUS);
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

  it("materializes fresh stats, enqueues collection, and reports the resulting scoring status", async () => {
    const resp = await POST(makeRequest());
    const body = await resp.json();

    expect(resp.status).toBe(200);
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("testuser", {
      token: "cli-token",
      ignoreSnapshot: true,
    });
    expect(mockInvalidateProfileReadModels).toHaveBeenCalledWith("testuser", { badgeSvg: true });
    expect(mockEnqueueAndReportScoringStatus).toHaveBeenCalledWith(
      "testuser",
      "refresh",
    );
    expect(body).toEqual({ success: true, scoringStatus: SCORING_STATUS });
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

  it("returns 503 when the scoring status authority read itself fails", async () => {
    mockEnqueueAndReportScoringStatus.mockResolvedValue(null);

    const resp = await POST(makeRequest());

    expect(resp.status).toBe(503);
  });

  // ---------------------------------------------------------------------------
  // #1076 — the route checks materialized.statsComplete up front so an
  // intentional skip is distinguishable from a genuine failure, and no
  // collection is enqueued for incomplete stats.
  // ---------------------------------------------------------------------------

  it("#1076: returns 422 with reason stats_incomplete without enqueueing collection", async () => {
    mockMaterializeOrchestratedProfile.mockResolvedValue({
      ...FAKE_MATERIALIZED,
      statsComplete: false,
    });

    const resp = await POST(makeRequest());
    const body = await resp.json();

    expect(resp.status).toBe(422);
    expect(body.reason).toBe("stats_incomplete");
    expect(mockEnqueueAndReportScoringStatus).not.toHaveBeenCalled();
    expect(mockInvalidateProfileReadModels).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // BE-H2 (#860): IP rate-limit must fire BEFORE resolveRequestAuth
  // -------------------------------------------------------------------------

  it("applies IP rate-limit before resolveRequestAuth to prevent resource amplification (BE-H2)", async () => {
    // IP rate-limit first, then auth — bogus tokens never reach GitHub API
    const ipRlCallOrder: number[] = [];
    const authCallOrder: number[] = [];
    let callCounter = 0;

    mockRateLimit.mockImplementation((key: string) => {
      if (key.startsWith("ratelimit:recalculate-ip:")) {
        ipRlCallOrder.push(++callCounter);
      }
      return Promise.resolve({ allowed: true, current: 1, limit: 10 });
    });

    mockResolveRequestAuth.mockImplementation(() => {
      authCallOrder.push(++callCounter);
      return Promise.resolve(AUTH);
    });

    await POST(makeRequest());

    expect(ipRlCallOrder.length).toBeGreaterThan(0);
    expect(authCallOrder.length).toBeGreaterThan(0);
    // IP rate-limit must have been called before auth
    expect(ipRlCallOrder[0]).toBeLessThan(authCallOrder[0]!);
  });

  it("returns 429 on IP rate-limit exceeded without calling resolveRequestAuth", async () => {
    mockRateLimit.mockImplementation((key: string) => {
      if (key.startsWith("ratelimit:recalculate-ip:")) {
        return Promise.resolve({ allowed: false, current: 11, limit: 10 });
      }
      return Promise.resolve({ allowed: true, current: 1, limit: 20 });
    });

    const resp = await POST(makeRequest());

    expect(resp.status).toBe(429);
    expect(mockResolveRequestAuth).not.toHaveBeenCalled();
  });
});
