import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";

const {
  mockVerifyCronSecret,
  mockDbGetUsers,
  mockDbGetAllUserHandles,
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
  mockCaptureOperationalAlert,
  mockRenderBadgeSvg,
  mockGetPublicProfileVerification,
  mockBuildBadgeSvgCacheKey,
  mockWriteBadgeSvgCache,
} = vi.hoisted(() => ({
  mockVerifyCronSecret: vi.fn(),
  mockDbGetUsers: vi.fn(),
  mockDbGetAllUserHandles: vi.fn(),
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
  mockCaptureOperationalAlert: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockGetPublicProfileVerification: vi.fn(),
  mockBuildBadgeSvgCacheKey: vi.fn(),
  mockWriteBadgeSvgCache: vi.fn(),
}));

vi.mock("@/lib/auth/cron", () => ({
  verifyCronSecret: (...args: unknown[]) => mockVerifyCronSecret(...args),
}));

vi.mock("@/lib/db/users", () => ({
  dbGetUsers: (...args: unknown[]) => mockDbGetUsers(...args),
  dbGetAllUserHandles: (...args: unknown[]) =>
    mockDbGetAllUserHandles(...args),
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

vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: (...args: unknown[]) => mockRenderBadgeSvg(...args),
}));

vi.mock("@/lib/profile/public-profile", () => ({
  getPublicProfileVerification: (...args: unknown[]) =>
    mockGetPublicProfileVerification(...args),
}));

vi.mock("@/lib/render/badge-svg-cache", () => ({
  AVATAR_ABSENT_CACHE_TTL_SECONDS: 900,
  buildBadgeSvgCacheKey: (...args: unknown[]) => mockBuildBadgeSvgCacheKey(...args),
  writeBadgeSvgCache: (...args: unknown[]) => mockWriteBadgeSvgCache(...args),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...args),
  captureOperationalAlert: (...args: unknown[]) => mockCaptureOperationalAlert(...args),
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
  statsComplete: true,
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
    mockDbGetAllUserHandles.mockImplementation(async () =>
      (await mockDbGetUsers()).map((entry: { handle: string }) => entry.handle),
    );
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
    mockCaptureOperationalAlert.mockResolvedValue(undefined);
    mockRenderBadgeSvg.mockReturnValue("<svg>rendered</svg>");
    mockGetPublicProfileVerification.mockReturnValue({
      hash: "verified-hash",
      date: "2026-04-17",
    });
    mockBuildBadgeSvgCacheKey.mockImplementation(
      (handle: string, date: string) => `badge:v1:${handle}:warm-amber-v3:${date}`,
    );
    mockWriteBadgeSvgCache.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.stubEnv("GITHUB_TOKEN", undefined);
    vi.stubEnv("WARM_CACHE_PRIORITY_HANDLES", undefined);
  });

  it("returns the denied response when cron auth fails", async () => {
    mockVerifyCronSecret.mockReturnValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("warms discovered handles through the shared orchestrated materializer", async () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp-server-token");

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockDbGetAllUserHandles).toHaveBeenCalledOnce();
    expect(body.warmed).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.processedCount).toBe(2);
    expect(body.processedSample).toEqual(["alice", "bob"]);
    expect(body.handles).toBeUndefined();
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledWith("alice");
    expect(mockPersistOrchestratedSnapshot).toHaveBeenCalledWith(
      "alice",
      FAKE_MATERIALIZED,
      { mode: "insert" },
    );
    expect(mockGetAvatarBase64).toHaveBeenCalledWith(
      "alice",
      "https://avatars.example.com/alice.png",
    );
    expect(mockCacheSet).toHaveBeenCalledWith(
      "cron:lastrun:warm-cache",
      expect.any(Number),
      172800,
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

  describe("cleanup failure paths (#764)", () => {
    it("returns 200 and zero deletions when dbCleanExpiredVerifications rejects", async () => {
      mockDbCleanExpiredVerifications.mockRejectedValue(
        new Error("verification cleanup boom"),
      );

      const res = await GET(makeRequest());
      const body = await res.json();

      // Cleanup is non-critical — the route still completes successfully.
      expect(res.status).toBe(200);
      expect(body.expiredVerificationsDeleted).toBe(0);
      expect(body.warmed).toBe(2);
    });

    it("returns 200 and zero deletions when dbCleanExpiredMergeOperations rejects", async () => {
      mockDbCleanExpiredMergeOperations.mockRejectedValue(
        new Error("merge-ops cleanup boom"),
      );

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.expiredMergeOpsDeleted).toBe(0);
      expect(body.warmed).toBe(2);
    });

    it("returns 200 and zero deletions when dbCleanOldSnapshots rejects", async () => {
      mockDbCleanOldSnapshots.mockRejectedValue(
        new Error("snapshot cleanup boom"),
      );

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.expiredSnapshotsDeleted).toBe(0);
      expect(body.warmed).toBe(2);
    });

    it("isolates each cleanup failure — a rejecting cleanup does not prevent the others from running", async () => {
      mockDbCleanExpiredVerifications.mockRejectedValue(new Error("boom-1"));
      mockDbCleanExpiredMergeOperations.mockResolvedValue(4);
      mockDbCleanOldSnapshots.mockResolvedValue(9);

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.expiredVerificationsDeleted).toBe(0);
      // The cleanups that did NOT reject still report their deletions.
      expect(body.expiredMergeOpsDeleted).toBe(4);
      expect(body.expiredSnapshotsDeleted).toBe(9);
    });

    it("still emits the cron_warm_cache_complete event when a cleanup rejects", async () => {
      mockDbCleanOldSnapshots.mockRejectedValue(new Error("snapshot cleanup boom"));

      await GET(makeRequest());

      expect(mockCaptureServerEvent).toHaveBeenCalledWith(
        "cron_warm_cache_complete",
        expect.objectContaining({ warmed: 2, failed: 0 }),
      );
    });
  });

  describe("per-handle failure resilience (#764)", () => {
    it("continues processing remaining handles when one handle's materialization throws", async () => {
      mockDbGetUsers.mockResolvedValue([
        user("alice"),
        user("bob"),
        user("charlie"),
      ]);
      // bob throws (unhandled), alice and charlie succeed.
      mockMaterializeOrchestratedProfile.mockImplementation((handle: string) => {
        if (handle === "bob") {
          return Promise.reject(new Error("bob exploded"));
        }
        return Promise.resolve(FAKE_MATERIALIZED);
      });

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      // alice + charlie warmed despite bob failing.
      expect(body.warmed).toBe(2);
      expect(body.failed).toBeGreaterThanOrEqual(1);
      // Rotation still advances since at least one handle was processed.
      expect(mockCacheSet).toHaveBeenCalled();
    });

    it("records a snapshot failure gracefully and still counts the handle as warmed", async () => {
      // Stats fetch succeeds but snapshot persistence throws — warm should survive.
      mockPersistOrchestratedSnapshot.mockRejectedValue(
        new Error("snapshot insert failed"),
      );

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.warmed).toBe(2);
      // Snapshot failures are swallowed — none recorded.
      expect(body.snapshots).toBe(0);
      expect(body.failed).toBe(0);
    });

    it("swallows a notifyScoreBump rejection without failing the warm", async () => {
      mockDbGetLatestSnapshotBatch.mockResolvedValue(
        new Map([["alice", { date: "2026-04-16", adjustedComposite: 55 }]]),
      );
      mockIsSignificantChange.mockReturnValue({
        significant: true,
        reason: "score_bump",
        allReasons: ["score_bump"],
      });
      mockNotifyScoreBump.mockRejectedValue(new Error("email send failed"));

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      // alice's notification failed but the warm itself succeeded; no crash.
      expect(body.warmed).toBe(2);
      expect(body.notifications).toBe(0);
    });
  });

  it("includes WARM_CACHE_PRIORITY_HANDLES in the warm list even when outside the rotation slice", async () => {
    vi.stubEnv("WARM_CACHE_PRIORITY_HANDLES", "user0,user1,unknown-user");
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

  it("keeps total processed handles within MAX_HANDLES even when priority handles fall outside the rotation slice", async () => {
    // 200 users, offset=0 → natural rotation slice is user0..user49 (50 handles,
    // already at the ceiling). Priority handles sit entirely outside that slice,
    // so appending them on top would push per-run work to 55 — the #1052-era
    // bug: priority handles were merged AFTER the MAX_HANDLES slice instead of
    // being reserved a seat within it.
    vi.stubEnv("WARM_CACHE_PRIORITY_HANDLES", "user100,user101,user102,user103,user104");
    mockDbGetUsers.mockResolvedValue(
      Array.from({ length: 200 }, (_, index) => user(`user${index}`)),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processedCount).toBeLessThanOrEqual(50);
    expect(mockMaterializeOrchestratedProfile.mock.calls.length).toBeLessThanOrEqual(50);

    const warmedHandles = mockMaterializeOrchestratedProfile.mock.calls.map(
      ([handle]) => handle,
    );
    expect(warmedHandles).toContain("user100");
    expect(warmedHandles).toContain("user101");
    expect(warmedHandles).toContain("user102");
    expect(warmedHandles).toContain("user103");
    expect(warmedHandles).toContain("user104");
  });

  it("deduplicates repeated priority handles before reserving warm-cache seats", async () => {
    vi.stubEnv("WARM_CACHE_PRIORITY_HANDLES", "user100,user100,user101");
    mockDbGetUsers.mockResolvedValue(
      Array.from({ length: 200 }, (_, index) => user(`user${index}`)),
    );

    const res = await GET(makeRequest());
    const body = await res.json();
    const warmedHandles = mockMaterializeOrchestratedProfile.mock.calls.map(
      ([handle]) => handle,
    );

    expect(res.status).toBe(200);
    expect(body.processedCount).toBe(50);
    expect(warmedHandles).toHaveLength(50);
    expect(new Set(warmedHandles)).toHaveLength(50);
    expect(warmedHandles.filter((handle) => handle === "user100")).toHaveLength(1);
  });

  it("does not underfill a full run when a priority handle overlaps the rotation", async () => {
    vi.stubEnv("WARM_CACHE_PRIORITY_HANDLES", "user0");
    mockDbGetUsers.mockResolvedValue(
      Array.from({ length: 50 }, (_, index) => user(`user${index}`)),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processedCount).toBe(50);
    expect(body.rotation.coversAll).toBe(true);
    expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledTimes(50);
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

    // Warm still succeeds — avatar warming is opportunistic and contained.
    expect(body.warmed).toBe(2);
    expect(body.failed).toBe(0);
  });

  // #1089 (PE-M2): the cron previously never rendered/wrote the badge SVG
  // cache, guaranteeing a cold miss for every handle at the UTC date
  // rollover. warmHandle must now render and write the SVG, gated by the
  // exact same quality gates that protect the request-path write in
  // finalizeMaterializedBadge (apps/web/app/u/[handle]/badge.svg/route.ts):
  // the avatar outcome must be cache-safe AND a verification record must
  // exist (which itself requires materialized.statsComplete).
  describe("badge SVG cache warming (#1089)", () => {
    it("renders and writes the badge SVG cache when the avatar resolves and stats look complete", async () => {
      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.warmed).toBe(2);

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_MATERIALIZED.stats,
        FAKE_MATERIALIZED.displayImpact,
        expect.objectContaining({
          avatarDataUri: "data:image/png;base64,abc",
          verificationHash: "verified-hash",
          verificationDate: "2026-04-17",
          disableAnimation: true,
        }),
      );
      expect(mockWriteBadgeSvgCache).toHaveBeenCalledWith(
        expect.stringContaining("alice"),
        "<svg>rendered</svg>",
        "alice",
      );
      expect(mockWriteBadgeSvgCache).toHaveBeenCalledWith(
        expect.stringContaining("bob"),
        "<svg>rendered</svg>",
        "bob",
      );
    });

    it("withholds the SVG cache write when verification is null (degraded/incomplete stats)", async () => {
      mockGetPublicProfileVerification.mockReturnValue(null);

      const res = await GET(makeRequest());
      const body = await res.json();

      // The warm itself still succeeds — only the SVG publish is gated.
      expect(res.status).toBe(200);
      expect(body.warmed).toBe(2);
      expect(mockWriteBadgeSvgCache).not.toHaveBeenCalled();
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
    });

    it("withholds the SVG cache write when the avatar fails to resolve", async () => {
      mockGetAvatarBase64.mockRejectedValue(new Error("avatar fetch timeout"));

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.warmed).toBe(2);
      expect(mockWriteBadgeSvgCache).not.toHaveBeenCalled();
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
    });

    it("writes the standard cache entry when remote avatar absence is definitive", async () => {
      mockGetAvatarBase64.mockResolvedValue(undefined);

      await GET(makeRequest());

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ avatarDataUri: undefined }),
      );
      expect(mockWriteBadgeSvgCache).toHaveBeenCalledWith(
        expect.any(String),
        "<svg>rendered</svg>",
        expect.any(String),
      );
    });

    it("writes a short-TTL SVG cache entry when the handle has no avatarUrl", async () => {
      mockMaterializeOrchestratedProfile.mockResolvedValue({
        ...FAKE_MATERIALIZED,
        stats: { ...FAKE_MATERIALIZED.stats, avatarUrl: null },
      });

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.warmed).toBe(2);
      expect(mockGetAvatarBase64).not.toHaveBeenCalled();
      expect(mockWriteBadgeSvgCache).toHaveBeenCalledWith(
        expect.any(String),
        "<svg>rendered</svg>",
        expect.any(String),
        expect.objectContaining({ ttlSeconds: expect.any(Number) }),
      );
    });

    it("does not let a badge SVG render/write failure fail the warm", async () => {
      mockWriteBadgeSvgCache.mockRejectedValue(new Error("redis write boom"));

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.warmed).toBe(2);
      expect(body.failed).toBe(0);
    });
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

  // #702: failures[] surface in response
  it("includes failures[] with handle and reason for each failed warm", async () => {
    mockDbGetUsers.mockResolvedValue([user("alice"), user("bob"), user("charlie")]);
    mockMaterializeOrchestratedProfile
      .mockResolvedValueOnce(FAKE_MATERIALIZED) // alice succeeds
      .mockResolvedValueOnce(FAKE_MATERIALIZED) // bob succeeds
      .mockResolvedValueOnce(null);             // charlie fails (soft — returns false)

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.failures).toHaveLength(1);
    expect(body.failures[0]).toEqual({ handle: "charlie", reason: "warm returned false" });
  });

  // #750: rotation offset only advances after processInBatches completes
  it("does not advance the rotation offset when no handles were processed", async () => {
    mockDbGetUsers.mockResolvedValue([]);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(mockCacheSet).not.toHaveBeenCalledWith(
      "cron:warm-cache:offset",
      expect.anything(),
      expect.anything(),
    );
  });

  // DO-L1 (#751): P2 alert when all handles fail
  describe("DO-L1: failure-rate operational alert", () => {
    it("emits a P2 operational alert when all processed handles fail", async () => {
      // Both alice and bob fail (materialize returns null)
      mockMaterializeOrchestratedProfile.mockResolvedValue(null);

      await GET(makeRequest());

      expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: "warm_cache_high_failure_rate",
          severity: "P2",
          route: "/api/cron/warm-cache",
        }),
      );
    });

    it("emits a P2 operational alert when more than 50% of handles fail", async () => {
      // 3 users: alice and bob fail, charlie succeeds — 66% failure rate
      mockDbGetUsers.mockResolvedValue([user("alice"), user("bob"), user("charlie")]);
      mockMaterializeOrchestratedProfile
        .mockResolvedValueOnce(null)           // alice fails
        .mockResolvedValueOnce(null)           // bob fails
        .mockResolvedValueOnce(FAKE_MATERIALIZED); // charlie succeeds

      await GET(makeRequest());

      expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: "warm_cache_high_failure_rate",
          severity: "P2",
        }),
      );
    });

    it("does NOT emit a failure-rate alert when fewer than 50% of handles fail", async () => {
      // 1 out of 2 fails = exactly 50% — threshold is >50%, so no alert
      mockMaterializeOrchestratedProfile
        .mockResolvedValueOnce(null)           // alice fails
        .mockResolvedValueOnce(FAKE_MATERIALIZED); // bob succeeds

      await GET(makeRequest());

      const alertCalls = (mockCaptureOperationalAlert.mock.calls as Array<[{ signal: string }]>).filter(
        ([opts]) => opts.signal === "warm_cache_high_failure_rate",
      );
      expect(alertCalls).toHaveLength(0);
    });

    it("does NOT emit a failure-rate alert when all handles succeed", async () => {
      // Default mock: both alice and bob succeed
      await GET(makeRequest());

      const alertCalls = (mockCaptureOperationalAlert.mock.calls as Array<[{ signal: string }]>).filter(
        ([opts]) => opts.signal === "warm_cache_high_failure_rate",
      );
      expect(alertCalls).toHaveLength(0);
    });

    it("includes failure count and processedCount in alert properties", async () => {
      mockMaterializeOrchestratedProfile.mockResolvedValue(null);

      await GET(makeRequest());

      expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            failed: 2,
            processedCount: 2,
          }),
        }),
      );
    });
  });

  // #1010: cron frequency was bumped from daily to hourly to shrink the
  // per-handle staleness gap, WITHOUT raising MAX_HANDLES — this test guards
  // that decision by asserting the per-run processed count (and therefore the
  // batch count / worst-case duration against maxDuration=300s) stays capped
  // regardless of how large the active-user population grows.
  describe("timeout-safety: per-run ceiling stays bounded as population grows (#1010)", () => {
    it("caps processedCount at MAX_HANDLES (50) even with a 500-user population", async () => {
      mockDbGetUsers.mockResolvedValue(
        Array.from({ length: 500 }, (_, index) => user(`user${index}`)),
      );

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.processedCount).toBe(50);
      // Batch count is processedCount / BATCH_SIZE (5) = 10 batches regardless
      // of total population — this is what keeps worst-case duration bounded
      // under the 300s maxDuration budget as the user base scales.
      expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledTimes(50);
    });

    it("caps processedCount at MAX_HANDLES (50) even with a 5000-user population", async () => {
      mockDbGetUsers.mockResolvedValue(
        Array.from({ length: 5000 }, (_, index) => user(`user${index}`)),
      );

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.processedCount).toBe(50);
    });
  });

  // DO-S1 (#773): P2 alert when active handles approach or exceed the per-run ceiling
  describe("DO-S1: warm-cache ceiling operational alert", () => {
    it("emits a P2 ceiling alert when active handle count exceeds MAX_HANDLES", async () => {
      // 60 users > MAX_HANDLES (50) — ceiling alert should fire
      mockDbGetUsers.mockResolvedValue(
        Array.from({ length: 60 }, (_, index) => user(`user${index}`)),
      );

      await GET(makeRequest());

      expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: "warm_cache_ceiling_approached",
          severity: "P2",
          route: "/api/cron/warm-cache",
        }),
      );
    });

    it("emits a ceiling alert when handle count equals MAX_HANDLES (at-limit boundary)", async () => {
      // Exactly 50 users = at the ceiling — should alert
      mockDbGetUsers.mockResolvedValue(
        Array.from({ length: 50 }, (_, index) => user(`user${index}`)),
      );

      await GET(makeRequest());

      expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: "warm_cache_ceiling_approached",
          severity: "P2",
        }),
      );
    });

    it("does NOT emit a ceiling alert when active handles are well below MAX_HANDLES", async () => {
      // Default: 2 users (alice, bob) — well below the ceiling
      await GET(makeRequest());

      const ceilingAlerts = (mockCaptureOperationalAlert.mock.calls as Array<[{ signal: string }]>).filter(
        ([opts]) => opts.signal === "warm_cache_ceiling_approached",
      );
      expect(ceilingAlerts).toHaveLength(0);
    });

    it("includes totalUsers and ceiling in ceiling alert properties", async () => {
      mockDbGetUsers.mockResolvedValue(
        Array.from({ length: 60 }, (_, index) => user(`user${index}`)),
      );

      await GET(makeRequest());

      expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: "warm_cache_ceiling_approached",
          properties: expect.objectContaining({
            totalUsers: 60,
            ceiling: 50,
          }),
        }),
      );
    });

    // #1010: the alert predates the hourly cadence bump — rotationHours makes
    // the actual (now much smaller) staleness bound explicit for on-call,
    // instead of leaving them to assume the old once-daily blast radius.
    it("includes rotationHours reflecting the hourly cadence, not the old daily one", async () => {
      mockDbGetUsers.mockResolvedValue(
        Array.from({ length: 125 }, (_, index) => user(`user${index}`)),
      );

      await GET(makeRequest());

      expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: "warm_cache_ceiling_approached",
          summary: expect.stringContaining("~3h"),
          properties: expect.objectContaining({
            totalUsers: 125,
            ceiling: 50,
            rotationHours: 3, // ceil(125 / 50)
          }),
        }),
      );
    });
  });

  // #1095: warm-cache had no wall-clock budget check, unlike process-campaigns'
  // 30s-reserved-buffer pattern. A hard platform timeout mid-run meant the
  // rotation offset and heartbeat never got written, and — since it's not a
  // thrown error — no cron_failure alert fired either.
  describe("time budget (#1095)", () => {
    const BUDGET_MS = (300 - 30) * 1000; // maxDuration=300, mirrors process-campaigns' 30s buffer

    it("stops processing further handles once the time budget is exhausted, defers the rest, writes the heartbeat, and does not throw", async () => {
      mockDbGetUsers.mockResolvedValue(
        Array.from({ length: 80 }, (_, index) => user(`user${index}`)),
      );
      mockCacheGet.mockResolvedValue(10); // offset=10, no priority handles -> toWarm = user10..user59 (50)

      const T0 = 1_000_000;
      const nowSpy = vi.spyOn(Date, "now");
      nowSpy
        .mockReturnValueOnce(T0) // start
        .mockReturnValueOnce(T0) // time-budget check before batch 0 (elapsed 0) -> proceed
        .mockReturnValueOnce(T0 + BUDGET_MS) // check before batch 1 -> exceeded -> stop
        .mockReturnValue(T0 + BUDGET_MS); // durationMs / heartbeat / any further calls

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.timedOut).toBe(true);
      // Only the first batch (5 handles) was actually processed before the budget check tripped.
      expect(body.processedCount).toBe(5);
      expect(body.warmed).toBe(5);
      expect(body.deferredCount).toBe(45);
      expect(mockMaterializeOrchestratedProfile).toHaveBeenCalledTimes(5);
      // Heartbeat still written despite the early stop — graceful degradation, not a crash.
      expect(mockCacheSet).toHaveBeenCalledWith(
        "cron:lastrun:warm-cache",
        expect.any(Number),
        172800,
      );

      nowSpy.mockRestore();
    });

    it("advances the rotation offset only past the genuinely-completed handles, not the full intended slice (#750)", async () => {
      mockDbGetUsers.mockResolvedValue(
        Array.from({ length: 80 }, (_, index) => user(`user${index}`)),
      );
      mockCacheGet.mockResolvedValue(10);

      const T0 = 1_000_000;
      const nowSpy = vi.spyOn(Date, "now");
      nowSpy
        .mockReturnValueOnce(T0)
        .mockReturnValueOnce(T0)
        .mockReturnValueOnce(T0 + BUDGET_MS)
        .mockReturnValue(T0 + BUDGET_MS);

      const res = await GET(makeRequest());
      const body = await res.json();

      // Only 5 of the intended 50 rotation handles (offset 10..59) actually completed
      // (user10..user14) -> next offset must be 15, NOT 60 (the full intended slice).
      expect(body.rotation.nextOffset).toBe(15);
      expect(mockCacheSet).toHaveBeenCalledWith("cron:warm-cache:offset", 15, 0);

      nowSpy.mockRestore();
    });

    it("does not advance the offset at all when the budget is exhausted before any rotation handle completes", async () => {
      // Priority handles fill the first batch; the budget runs out before any
      // rotation-scanned handle is processed.
      vi.stubEnv("WARM_CACHE_PRIORITY_HANDLES", "user70,user71,user72,user73,user74");
      mockDbGetUsers.mockResolvedValue(
        Array.from({ length: 80 }, (_, index) => user(`user${index}`)),
      );
      mockCacheGet.mockResolvedValue(10);

      const T0 = 1_000_000;
      const nowSpy = vi.spyOn(Date, "now");
      nowSpy
        .mockReturnValueOnce(T0)
        .mockReturnValueOnce(T0) // check before batch 0 (priority handles) -> proceed
        .mockReturnValueOnce(T0 + BUDGET_MS) // check before batch 1 (first rotation batch) -> exceeded
        .mockReturnValue(T0 + BUDGET_MS);

      const res = await GET(makeRequest());
      const body = await res.json();

      expect(body.processedCount).toBe(5);
      expect(body.rotation.nextOffset).toBe(10); // unchanged from stored offset
      expect(mockCacheSet).toHaveBeenCalledWith("cron:warm-cache:offset", 10, 0);

      nowSpy.mockRestore();
    });

    it("emits a P2 operational alert when the time budget is exhausted, without throwing", async () => {
      mockDbGetUsers.mockResolvedValue(
        Array.from({ length: 80 }, (_, index) => user(`user${index}`)),
      );
      mockCacheGet.mockResolvedValue(10);

      const T0 = 1_000_000;
      const nowSpy = vi.spyOn(Date, "now");
      nowSpy
        .mockReturnValueOnce(T0)
        .mockReturnValueOnce(T0)
        .mockReturnValueOnce(T0 + BUDGET_MS)
        .mockReturnValue(T0 + BUDGET_MS);

      const res = await GET(makeRequest());

      expect(res.status).toBe(200);
      expect(mockCaptureOperationalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: "warm_cache_time_budget_exceeded",
          severity: "P2",
          route: "/api/cron/warm-cache",
        }),
      );

      nowSpy.mockRestore();
    });

    it("reports timedOut: false and zero deferrals when the run completes within budget", async () => {
      const res = await GET(makeRequest());
      const body = await res.json();

      expect(body.timedOut).toBe(false);
      expect(body.deferredCount).toBe(0);
    });
  });
});
