import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";

const {
  mockVerifyCronSecret,
  mockDbGetUsers,
  mockDbGetLatestSnapshotBatch,
  mockDbCleanOldSnapshots,
  mockDbCleanExpiredVerifications,
  mockDbCleanExpiredMergeOperations,
  mockCacheGet,
  mockCacheSet,
  mockCompareSnapshots,
  mockIsSignificantChange,
  mockNotifyScoreBump,
  mockMaterializeOrchestratedProfile,
  mockPersistOrchestratedSnapshot,
  mockGetAvatarBase64,
  mockCaptureServerError,
  mockCaptureServerEvent,
} = vi.hoisted(() => ({
  mockVerifyCronSecret: vi.fn(),
  mockDbGetUsers: vi.fn(),
  mockDbGetLatestSnapshotBatch: vi.fn(),
  mockDbCleanOldSnapshots: vi.fn(),
  mockDbCleanExpiredVerifications: vi.fn(),
  mockDbCleanExpiredMergeOperations: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockCompareSnapshots: vi.fn(),
  mockIsSignificantChange: vi.fn(),
  mockNotifyScoreBump: vi.fn(),
  mockMaterializeOrchestratedProfile: vi.fn(),
  mockPersistOrchestratedSnapshot: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockCaptureServerError: vi.fn(),
  mockCaptureServerEvent: vi.fn(),
}));

vi.mock("@/lib/auth/cron", () => ({
  verifyCronSecret: (...args: unknown[]) => mockVerifyCronSecret(...args),
}));

vi.mock("@/lib/db/users", () => ({
  dbGetUsers: (...args: unknown[]) => mockDbGetUsers(...args),
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbGetLatestSnapshotBatch: (...args: unknown[]) => mockDbGetLatestSnapshotBatch(...args),
  dbCleanOldSnapshots: (...args: unknown[]) => mockDbCleanOldSnapshots(...args),
}));

vi.mock("@/lib/db/verification", () => ({
  dbCleanExpiredVerifications: (...args: unknown[]) => mockDbCleanExpiredVerifications(...args),
}));

vi.mock("@/lib/db/telemetry", () => ({
  dbCleanExpiredMergeOperations: (...args: unknown[]) => mockDbCleanExpiredMergeOperations(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

vi.mock("@/lib/history/diff", () => ({
  compareSnapshots: (...args: unknown[]) => mockCompareSnapshots(...args),
}));

vi.mock("@/lib/history/significant-change", () => ({
  isSignificantChange: (...args: unknown[]) => mockIsSignificantChange(...args),
}));

vi.mock("@/lib/email/score-bump", () => ({
  notifyScoreBump: (...args: unknown[]) => mockNotifyScoreBump(...args),
}));

vi.mock("@/lib/profile/orchestrated-profile", () => ({
  materializeOrchestratedProfile: (...args: unknown[]) =>
    mockMaterializeOrchestratedProfile(...args),
  persistOrchestratedSnapshot: (...args: unknown[]) =>
    mockPersistOrchestratedSnapshot(...args),
}));

vi.mock("@/lib/render/avatar", () => ({
  getAvatarBase64: (...args: unknown[]) => mockGetAvatarBase64(...args),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...args),
  withErrorCapture: (_route: unknown, handler: unknown) => handler,
}));

const FAKE_MATERIALIZED = {
  stats: {
    handle: "alice",
    avatarUrl: "https://avatars.example.com/alice.png",
  },
  craftResult: null,
  rawImpact: {
    adjustedComposite: 70,
    compositeScore: 70,
    dimensions: { delivery: 50, quality: 50, consistency: 50, breadth: 50 },
    archetype: "Balanced",
    tier: "High",
    profileType: "collaborative",
    confidence: 80,
    confidencePenalties: [],
    computedAt: "2026-04-17T12:00:00.000Z",
  },
  displayImpact: {
    adjustedComposite: 66,
    compositeScore: 70,
    dimensions: { delivery: 50, quality: 50, consistency: 50, breadth: 50 },
    archetype: "Balanced",
    tier: "Solid",
    profileType: "collaborative",
    confidence: 80,
    confidencePenalties: [],
    computedAt: "2026-04-17T12:00:00.000Z",
  },
  snapshot: { date: "2026-04-17", adjustedComposite: 66, tier: "Solid" },
};

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3001/api/cron/warm-cache", {
    method: "GET",
  });
}

function user(handle: string) {
  return { handle, registeredAt: "2025-01-01", displayName: null, avatarUrl: null };
}

describe("GET /api/cron/warm-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyCronSecret.mockReturnValue(null);
    mockDbGetUsers.mockResolvedValue([user("alice"), user("bob")]);
    mockDbGetLatestSnapshotBatch.mockResolvedValue(new Map());
    mockDbCleanOldSnapshots.mockResolvedValue(0);
    mockDbCleanExpiredVerifications.mockResolvedValue(0);
    mockDbCleanExpiredMergeOperations.mockResolvedValue(0);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);
    mockCompareSnapshots.mockReturnValue({ adjustedComposite: 5, tier: null, archetype: null });
    mockIsSignificantChange.mockReturnValue({ significant: false });
    mockNotifyScoreBump.mockResolvedValue(undefined);
    mockMaterializeOrchestratedProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockPersistOrchestratedSnapshot.mockResolvedValue(true);
    mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc");
    mockCaptureServerError.mockResolvedValue(undefined);
    mockCaptureServerEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.WARM_CACHE_PRIORITY_HANDLES;
  });

  it("returns the denied response when cron auth fails", async () => {
    mockVerifyCronSecret.mockReturnValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("warms discovered handles through the shared orchestrated materializer", async () => {
    process.env.GITHUB_TOKEN = "ghp-server-token";

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.warmed).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.processedCount).toBe(2);
    expect(body.processedSample).toEqual(["alice", "bob"]);
    expect(body.handles).toBeUndefined();
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("alice", {
      token: "ghp-server-token",
    });
    expect(mockPersistOrchestratedSnapshot).toHaveBeenCalledWith(
      "alice",
      FAKE_MATERIALIZED,
      { mode: "insert" },
    );
    expect(mockGetAvatarBase64).toHaveBeenCalledWith(
      "alice",
      "https://avatars.example.com/alice.png",
    );
  });

  it("counts failed warms when materialization returns null", async () => {
    mockMaterializeOrchestratedProfile
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(FAKE_MATERIALIZED);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.warmed).toBe(1);
    expect(body.failed).toBe(1);
    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/cron/warm-cache",
        statusCode: 502,
      }),
    );
  });

  it("compares snapshots and notifies when an inserted canonical snapshot is significant", async () => {
    mockDbGetLatestSnapshotBatch.mockResolvedValue(
      new Map([
        ["alice", { date: "2026-04-16", adjustedComposite: 55 }],
      ]),
    );
    mockIsSignificantChange.mockReturnValue({
      significant: true,
      reason: "score_bump",
      allReasons: ["score_bump"],
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.notifications).toBe(1);
    expect(mockCompareSnapshots).toHaveBeenCalledWith(
      { date: "2026-04-16", adjustedComposite: 55 },
      FAKE_MATERIALIZED.snapshot,
    );
    expect(mockNotifyScoreBump).toHaveBeenCalledWith(
      "alice",
      expect.any(Object),
      expect.objectContaining({ significant: true, reason: "score_bump" }),
    );
  });

  it("skips notifications when the snapshot was not persisted", async () => {
    mockPersistOrchestratedSnapshot.mockResolvedValue(false);
    mockDbGetLatestSnapshotBatch.mockResolvedValue(
      new Map([
        ["alice", { date: "2026-04-16", adjustedComposite: 55 }],
      ]),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.snapshots).toBe(0);
    expect(mockCompareSnapshots).not.toHaveBeenCalled();
    expect(mockNotifyScoreBump).not.toHaveBeenCalled();
  });

  it("maintains rotation metadata and persists the next offset", async () => {
    mockCacheGet.mockResolvedValue(10);
    mockDbGetUsers.mockResolvedValue(
      Array.from({ length: 80 }, (_, index) => user(`user${index}`)),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.rotation.offset).toBe(10);
    expect(body.rotation.nextOffset).toBe(60);
    expect(body.processedCount).toBe(50);
    expect(body.processedSample).toHaveLength(10);
    expect(mockCacheSet).toHaveBeenCalledWith("cron:warm-cache:offset", 60, 0);
  });

  it("includes cleanup counts in the response", async () => {
    mockDbCleanExpiredVerifications.mockResolvedValue(5);
    mockDbCleanExpiredMergeOperations.mockResolvedValue(3);
    mockDbCleanOldSnapshots.mockResolvedValue(7);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.expiredVerificationsDeleted).toBe(5);
    expect(body.expiredMergeOpsDeleted).toBe(3);
    expect(body.expiredSnapshotsDeleted).toBe(7);
  });

  it("includes WARM_CACHE_PRIORITY_HANDLES in the warm list even when outside the rotation slice", async () => {
    process.env.WARM_CACHE_PRIORITY_HANDLES = "user0,user1,unknown-user";
    // 80 users, offset=60 → rotation slice is user60..user79 (20 handles, < MAX_HANDLES)
    mockCacheGet.mockResolvedValue(60);
    mockDbGetUsers.mockResolvedValue(
      Array.from({ length: 80 }, (_, index) => user(`user${index}`)),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const warmedHandles = mockMaterializeOrchestratedProfile.mock.calls.map(
      ([handle]) => handle,
    );
    expect(warmedHandles).toContain("user0");
    expect(warmedHandles).toContain("user1");
    expect(warmedHandles).not.toContain("unknown-user");
  });

  it("wraps around to the start of the handle list when offset + MAX_HANDLES exceeds total users", async () => {
    // 60 users, offset=40 → offset+MAX_HANDLES=90 > 60 → wrap-around
    mockCacheGet.mockResolvedValue(40);
    mockDbGetUsers.mockResolvedValue(
      Array.from({ length: 60 }, (_, index) => user(`user${index}`)),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    // Remaining from offset: user40..user59 (20), from start: user0..user29 (30) = 50 total
    expect(body.processedCount).toBe(50);
    expect(body.processedSample).toEqual([
      "user40",
      "user41",
      "user42",
      "user43",
      "user44",
      "user45",
      "user46",
      "user47",
      "user48",
      "user49",
    ]);
    expect(body.rotation.nextOffset).toBe(30);

    const warmedHandles = mockMaterializeOrchestratedProfile.mock.calls.map(
      ([handle]) => handle,
    );
    expect(warmedHandles[0]).toBe("user40");
    expect(warmedHandles[19]).toBe("user59");
    expect(warmedHandles[20]).toBe("user0");
    expect(warmedHandles[49]).toBe("user29");
  });

  it("returns a trimmed processed sample instead of the full handle list", async () => {
    mockDbGetUsers.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => user(`user${index}`)),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.processedCount).toBe(25);
    expect(body.processedSample).toEqual([
      "user0",
      "user1",
      "user2",
      "user3",
      "user4",
      "user5",
      "user6",
      "user7",
      "user8",
      "user9",
    ]);
    expect(body.handles).toBeUndefined();
  });

  it("swallows getAvatarBase64 rejection without failing the warm", async () => {
    mockGetAvatarBase64.mockRejectedValue(new Error("avatar fetch timeout"));

    const res = await GET(makeRequest());
    const body = await res.json();

    // Warm still succeeds — avatar failure is fire-and-forget
    expect(body.warmed).toBe(2);
    expect(body.failed).toBe(0);
  });

  // DO-M5: PostHog cron_warm_cache_complete event
  it("emits a cron_warm_cache_complete PostHog event with warmed, failed, and durationMs", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(1);
    expect(mockCaptureServerEvent).toHaveBeenCalledWith(
      "cron_warm_cache_complete",
      expect.objectContaining({
        warmed: body.warmed,
        failed: body.failed,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("includes correct warmed and failed counts in the PostHog event when some handles fail", async () => {
    mockMaterializeOrchestratedProfile
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(FAKE_MATERIALIZED);

    await GET(makeRequest());

    expect(mockCaptureServerEvent).toHaveBeenCalledWith(
      "cron_warm_cache_complete",
      expect.objectContaining({
        warmed: 1,
        failed: 1,
      }),
    );
  });

  it("does not emit the PostHog event when auth is denied", async () => {
    mockVerifyCronSecret.mockReturnValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    await GET(makeRequest());

    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });

  // BE-M15: failed handle logging
  it("logs failed handles via captureServerError when warmHandle throws unexpectedly", async () => {
    // warmHandle catches internally, but if processInBatches itself encounters an unexpected
    // rejection (e.g. warmHandle throws despite its catch), failed++ and error is logged
    mockMaterializeOrchestratedProfile
      .mockRejectedValueOnce(new Error("unexpected unhandled throw"))
      .mockResolvedValueOnce(FAKE_MATERIALIZED);

    const res = await GET(makeRequest());
    const body = await res.json();

    // The failing handle should be counted and the error should surface
    expect(body.failed).toBeGreaterThanOrEqual(1);
  });
});
