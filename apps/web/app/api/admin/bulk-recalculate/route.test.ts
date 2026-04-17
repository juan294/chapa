import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";

const {
  mockRateLimit,
  mockGetClientIp,
  mockDbGetUsers,
  mockMaterializeOrchestratedProfile,
  mockPersistOrchestratedSnapshot,
  mockVerifyAdminSecret,
} = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockDbGetUsers: vi.fn(),
  mockMaterializeOrchestratedProfile: vi.fn(),
  mockPersistOrchestratedSnapshot: vi.fn(),
  mockVerifyAdminSecret: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}));

vi.mock("@/lib/db/users", () => ({
  dbGetUsers: (...args: unknown[]) => mockDbGetUsers(...args),
}));

vi.mock("@/lib/profile/orchestrated-profile", () => ({
  materializeOrchestratedProfile: (...args: unknown[]) =>
    mockMaterializeOrchestratedProfile(...args),
  persistOrchestratedSnapshot: (...args: unknown[]) =>
    mockPersistOrchestratedSnapshot(...args),
}));

vi.mock("@/lib/auth/admin", () => ({
  verifyAdminSecret: (...args: unknown[]) => mockVerifyAdminSecret(...args),
}));

const FAKE_MATERIALIZED = {
  stats: { handle: "testuser" },
  craftResult: null,
  rawImpact: {
    adjustedComposite: 50,
    compositeScore: 50,
    dimensions: { delivery: 50, quality: 30, consistency: 40, breadth: 35 },
    archetype: "Emerging",
    tier: "Solid",
    profileType: "solo",
    confidence: 100,
    confidencePenalties: [],
    computedAt: "2026-04-17T12:00:00.000Z",
  },
  displayImpact: {
    adjustedComposite: 42,
    compositeScore: 50,
    dimensions: { delivery: 50, quality: 30, consistency: 40, breadth: 35 },
    archetype: "Emerging",
    tier: "Solid",
    profileType: "solo",
    confidence: 100,
    confidencePenalties: [],
    computedAt: "2026-04-17T12:00:00.000Z",
  },
  snapshot: { date: "2026-04-17", adjustedComposite: 42, tier: "Solid" },
};

const VALID_SECRET = "test-admin-secret";

function makeRequest(secret = VALID_SECRET, body?: object): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/admin/bulk-recalculate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}

describe("POST /api/admin/bulk-recalculate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GITHUB_TOKEN", "ghp-server-token");
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 5 });
    mockGetClientIp.mockReturnValue("127.0.0.1");
    mockVerifyAdminSecret.mockReturnValue(null);
    mockDbGetUsers.mockResolvedValue([{ handle: "alice" }, { handle: "bob" }]);
    mockMaterializeOrchestratedProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockPersistOrchestratedSnapshot.mockResolvedValue(true);
  });

  it("returns 401 when admin auth fails", async () => {
    mockVerifyAdminSecret.mockReturnValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 6, limit: 5 });

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
  });

  it("recalculates all users when no handles are provided", async () => {
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recalculated).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.total).toBe(2);
    expect(mockDbGetUsers).toHaveBeenCalled();
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("alice", {
      token: "ghp-server-token",
      craftMode: "cached",
    });
    expect(mockPersistOrchestratedSnapshot).toHaveBeenCalledWith(
      "alice",
      FAKE_MATERIALIZED,
      { mode: "replace" },
    );
  });

  it("recalculates only explicitly provided handles", async () => {
    const res = await POST(makeRequest(VALID_SECRET, { handles: ["alice"] }));
    const body = await res.json();

    expect(body.recalculated).toBe(1);
    expect(body.total).toBe(1);
    expect(mockDbGetUsers).not.toHaveBeenCalled();
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledTimes(1);
  });

  it("reports stats fetch failures without aborting the batch", async () => {
    mockMaterializeOrchestratedProfile
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(FAKE_MATERIALIZED);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.recalculated).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.errors[0]).toEqual({
      handle: "alice",
      error: "Stats fetch returned null",
    });
  });

  it("reports snapshot replace failures explicitly", async () => {
    mockPersistOrchestratedSnapshot.mockResolvedValue(false);

    const res = await POST(makeRequest(VALID_SECRET, { handles: ["alice"] }));
    const body = await res.json();

    expect(body.recalculated).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.errors[0]).toEqual({
      handle: "alice",
      error: "Snapshot replace failed",
    });
  });

  it("reports thrown batch errors without aborting other handles", async () => {
    mockMaterializeOrchestratedProfile
      .mockRejectedValueOnce(new Error("API timeout"))
      .mockResolvedValueOnce(FAKE_MATERIALIZED);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.recalculated).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.errors[0]).toEqual({
      handle: "alice",
      error: "API timeout",
    });
  });
});
