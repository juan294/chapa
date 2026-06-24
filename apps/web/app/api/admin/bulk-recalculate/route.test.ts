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
  mockInvalidateProfileReadModels,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockDbGetUsers: vi.fn(),
  mockMaterializeOrchestratedProfile: vi.fn(),
  mockPersistOrchestratedSnapshot: vi.fn(),
  mockVerifyAdminSecret: vi.fn(),
  mockInvalidateProfileReadModels: vi.fn(),
  mockRevalidatePath: vi.fn(),
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

vi.mock("@/lib/profile/post-write-invalidation", () => ({
  invalidateProfileReadModels: (...args: unknown[]) =>
    mockInvalidateProfileReadModels(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
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
    mockInvalidateProfileReadModels.mockResolvedValue(undefined);
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
      ignoreSnapshot: true,
    });
    expect(mockPersistOrchestratedSnapshot).toHaveBeenCalledWith(
      "alice",
      FAKE_MATERIALIZED,
      { mode: "replace" },
    );
  });

  it("invalidates public read models and the share page after a successful replace", async () => {
    const res = await POST(makeRequest(VALID_SECRET, { handles: ["alice"] }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recalculated).toBe(1);
    expect(mockInvalidateProfileReadModels).toHaveBeenCalledWith("alice", {
      stats: true,
      badgeSvg: true,
      snapshot: true,
      history: true,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/u/alice");
  });

  it("sorts handles before applying the alphabetical resume cursor", async () => {
    mockDbGetUsers.mockResolvedValue([
      { handle: "zara" },
      { handle: "alice" },
      { handle: "mona" },
      { handle: "bob" },
    ]);
    const request = new NextRequest(
      "https://chapa.thecreativetoken.com/api/admin/bulk-recalculate?after=bob",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VALID_SECRET}`,
          "Content-Type": "application/json",
        },
      },
    );

    const res = await POST(request);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.completed).toEqual(["mona", "zara"]);
    expect(mockMaterializeOrchestratedProfile).toHaveBeenNthCalledWith(
      1,
      "mona",
      { token: "ghp-server-token", ignoreSnapshot: true },
    );
    expect(mockMaterializeOrchestratedProfile).toHaveBeenNthCalledWith(
      2,
      "zara",
      { token: "ghp-server-token", ignoreSnapshot: true },
    );
  });

  it("recalculates only explicitly provided handles", async () => {
    const res = await POST(makeRequest(VALID_SECRET, { handles: ["alice"] }));
    const body = await res.json();

    expect(body.recalculated).toBe(1);
    expect(body.partial).toBe(false);
    expect(body.completed).toEqual(["alice"]);
    expect(body.total).toBe(1);
    expect(mockDbGetUsers).not.toHaveBeenCalled();
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledTimes(1);
  });

  it("strips non-string and invalid-format handles before processing", async () => {
    const res = await POST(
      makeRequest(VALID_SECRET, {
        // Mix of: valid handle, non-string, blank string, handle that fails isValidHandle (starts with hyphen)
        handles: ["alice", 42, null, "", "-invalid", "bob"],
      }),
    );
    const body = await res.json();

    // Only "alice" and "bob" pass the filter; the rest are silently dropped.
    expect(body.recalculated).toBe(2);
    expect(body.total).toBe(2);
    expect(body.completed).toEqual(["alice", "bob"]);
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledTimes(2);
  });

  it("rejects payloads with more than 100 handles", async () => {
    const handles = Array.from({ length: 101 }, (_, index) => `user${index}`);

    const res = await POST(makeRequest(VALID_SECRET, { handles }));
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body.error).toMatch(/max 100 handles/i);
    expect(mockMaterializeOrchestratedProfile).not.toHaveBeenCalled();
  });

  it("returns completed handles for successful inline runs", async () => {
    const res = await POST(
      makeRequest(VALID_SECRET, { handles: ["alice", "bob"] }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.partial).toBe(false);
    expect(body.completed).toEqual(["alice", "bob"]);
    expect(body.pending).toBeUndefined();
  });

  it("aborts cleanly with partial progress when the inline deadline is exceeded", async () => {
    vi.useFakeTimers();
    const handles = Array.from({ length: 100 }, (_, index) => `user${index}`);
    const sortedHandles = [...handles].sort((a, b) => a.localeCompare(b));
    mockMaterializeOrchestratedProfile.mockImplementation(async (handle: string) => {
      await new Promise((resolve) => setTimeout(resolve, 251_000));
      return {
        ...FAKE_MATERIALIZED,
        stats: { ...FAKE_MATERIALIZED.stats, handle },
      };
    });

    try {
      const promise = POST(makeRequest(VALID_SECRET, { handles }));
      await vi.advanceTimersByTimeAsync(251_000);

      const res = await promise;
      const body = await res.json();

      expect(res.status).toBe(202);
      expect(body.partial).toBe(true);
      expect(body.completed).toEqual(sortedHandles.slice(0, 5));
      expect(body.pending).toEqual(sortedHandles.slice(5));
      expect(body.total).toBe(100);
      expect(mockPersistOrchestratedSnapshot).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
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

  describe("BE-H9: auth ordering — auth must run before rate limit", () => {
    it("checks auth before rate limit (unauthenticated request never touches rate limiter)", async () => {
      mockVerifyAdminSecret.mockReturnValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      // Rate limit is allowed — if auth runs first, the rate limit bucket
      // should NOT be consumed for an unauthed caller.
      mockRateLimit.mockResolvedValue({ allowed: true, current: 0, limit: 5 });

      const res = await POST(makeRequest("wrong-secret"));
      expect(res.status).toBe(401);
      // rateLimit must NOT have been called — auth rejected before we got there
      expect(mockRateLimit).not.toHaveBeenCalled();
    });
  });

  describe("BE-H7: ?after= cursor — resumes from alphabetic position", () => {
    beforeEach(() => {
      mockDbGetUsers.mockResolvedValue([
        { handle: "alice" },
        { handle: "bob" },
        { handle: "carol" },
        { handle: "dave" },
      ]);
    });

    it("processes all handles when no after cursor is provided", async () => {
      const res = await POST(makeRequest());
      const body = await res.json();
      expect(body.total).toBe(4);
      expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledTimes(4);
    });

    it("skips handles up to and including the cursor value", async () => {
      const url = new URL(
        "https://chapa.thecreativetoken.com/api/admin/bulk-recalculate?after=bob",
      );
      const req = new NextRequest(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VALID_SECRET}`,
          "Content-Type": "application/json",
        },
      });
      const res = await POST(req);
      const body = await res.json();
      // Only "carol" and "dave" are after "bob" alphabetically
      expect(body.total).toBe(2);
      expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith(
        "carol",
        expect.any(Object),
      );
      expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith(
        "dave",
        expect.any(Object),
      );
      expect(mockMaterializeOrchestratedProfile).not.toHaveBeenCalledWith(
        "alice",
        expect.any(Object),
      );
      expect(mockMaterializeOrchestratedProfile).not.toHaveBeenCalledWith(
        "bob",
        expect.any(Object),
      );
    });

    it("returns cursor info in the response when after param is used", async () => {
      const url = new URL(
        "https://chapa.thecreativetoken.com/api/admin/bulk-recalculate?after=alice",
      );
      const req = new NextRequest(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VALID_SECRET}`,
          "Content-Type": "application/json",
        },
      });
      const res = await POST(req);
      const body = await res.json();
      expect(body.cursor).toBe("alice");
      // "bob", "carol", "dave" are after "alice"
      expect(body.total).toBe(3);
    });

    it("returns zero results when cursor is past all handles", async () => {
      const url = new URL(
        "https://chapa.thecreativetoken.com/api/admin/bulk-recalculate?after=zzz",
      );
      const req = new NextRequest(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VALID_SECRET}`,
          "Content-Type": "application/json",
        },
      });
      const res = await POST(req);
      const body = await res.json();
      expect(body.total).toBe(0);
      expect(body.recalculated).toBe(0);
    });
  });
});
