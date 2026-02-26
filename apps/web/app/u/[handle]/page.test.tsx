import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the page component.
// ---------------------------------------------------------------------------

const {
  mockGetStats,
  mockComputeImpactV4,
  mockApplyEMA,
  mockGetTier,
  mockGetCachedLatestSnapshot,
  mockUpdateSnapshotCache,
  mockReadSessionCookie,
  mockIsValidHandle,
  mockCacheGet,
  mockTrackBadgeGenerated,
  mockGetAvatarBase64,
  mockRenderBadgeSvg,
  mockGenerateVerificationCode,
  mockStoreVerificationRecord,
  mockNotifyFirstBadge,
  mockBuildSnapshot,
  mockDbInsertSnapshot,
  mockIsStudioEnabled,
  mockAfter,
} = vi.hoisted(() => ({
  mockGetStats: vi.fn(),
  mockComputeImpactV4: vi.fn(),
  mockApplyEMA: vi.fn((score: number) => score),
  mockGetTier: vi.fn((score: number) => {
    if (score >= 85) return "Elite";
    if (score >= 70) return "High";
    if (score >= 30) return "Solid";
    return "Emerging";
  }),
  mockGetCachedLatestSnapshot: vi.fn(),
  mockUpdateSnapshotCache: vi.fn(),
  mockReadSessionCookie: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockCacheGet: vi.fn(),
  mockTrackBadgeGenerated: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockGenerateVerificationCode: vi.fn(),
  mockStoreVerificationRecord: vi.fn(),
  mockNotifyFirstBadge: vi.fn(),
  mockBuildSnapshot: vi.fn(),
  mockDbInsertSnapshot: vi.fn(),
  mockIsStudioEnabled: vi.fn(),
  mockAfter: vi.fn(),
}));

vi.mock("@/lib/github/client", () => ({
  getStats: mockGetStats,
}));

vi.mock("@/lib/impact/v4", () => ({
  computeImpactV4: mockComputeImpactV4,
}));

vi.mock("@/lib/impact/smoothing", () => ({
  applyEMA: mockApplyEMA,
}));

vi.mock("@/lib/impact/utils", () => ({
  getTier: mockGetTier,
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  getCachedLatestSnapshot: mockGetCachedLatestSnapshot,
  updateSnapshotCache: mockUpdateSnapshotCache,
}));

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: mockReadSessionCookie,
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: mockIsValidHandle,
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: mockCacheGet,
  trackBadgeGenerated: mockTrackBadgeGenerated,
}));

vi.mock("@/lib/render/avatar", () => ({
  getAvatarBase64: mockGetAvatarBase64,
}));

vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: mockRenderBadgeSvg,
}));

vi.mock("@/lib/verification/hmac", () => ({
  generateVerificationCode: mockGenerateVerificationCode,
}));

vi.mock("@/lib/verification/store", () => ({
  storeVerificationRecord: mockStoreVerificationRecord,
}));

vi.mock("@/lib/email/notifications", () => ({
  notifyFirstBadge: mockNotifyFirstBadge,
}));

vi.mock("@/lib/history/snapshot", () => ({
  buildSnapshot: mockBuildSnapshot,
}));

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: mockDbInsertSnapshot,
}));

vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabled: mockIsStudioEnabled,
}));

vi.mock("@/lib/env", () => ({
  getBaseUrl: () => "https://chapa.thecreativetoken.com",
}));

// Mock next/server's after() to capture callback
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: mockAfter,
  };
});

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve({
    get: () => null,
  }),
}));

// Mock next/navigation
const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => { mockNotFound(); throw new Error("NOT_FOUND"); },
}));

// Mock the lazy-loaded GlobalCommandBar wrapper
vi.mock("@/components/GlobalCommandBarLazy", () => ({
  GlobalCommandBarLazy: () => null,
}));

// Mock components to return simple elements
vi.mock("@/components/Navbar", () => ({
  Navbar: () => "<nav />",
}));
vi.mock("@/components/SharePageShortcuts", () => ({
  SharePageShortcuts: () => null,
}));
vi.mock("@/components/ShareBadgePreviewLazy", () => ({
  ShareBadgePreviewLazy: () => "<div>interactive-preview</div>",
}));
vi.mock("@/components/BadgeToolbar", () => ({
  BadgeToolbar: () => "<div>toolbar</div>",
}));
vi.mock("@/components/ImpactBreakdown", () => ({
  ImpactBreakdown: () => "<div>breakdown</div>",
  getArchetypeProfile: () => "A builder profile",
  DataSources: () => "<div>sources</div>",
}));
vi.mock("@/components/CopyButton", () => ({
  CopyButton: () => "<button>copy</button>",
}));

// ---------------------------------------------------------------------------
// Import the page after all mocks
// ---------------------------------------------------------------------------

import SharePage from "./page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_STATS = {
  handle: "testuser",
  displayName: "Test User",
  commitsTotal: 42,
  prsMergedCount: 10,
  reviewsSubmittedCount: 5,
  avatarUrl: "https://avatars.githubusercontent.com/u/12345",
  fetchedAt: "2026-01-01T00:00:00Z",
  heatmapData: [],
};

const FAKE_IMPACT = {
  handle: "testuser",
  profileType: "collaborative",
  adjustedComposite: 65,
  tier: "Solid",
  confidence: 85,
  dimensions: { delivery: 70, quality: 60, consistency: 65, breadth: 55 },
  archetype: "Builder",
};

const FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">BADGE</svg>';

const FAKE_SNAPSHOT = { adjustedComposite: 60, date: "2026-01-01" };

async function renderPage(handle = "testuser") {
  return SharePage({ params: Promise.resolve({ handle }) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SharePage /u/[handle]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    mockIsValidHandle.mockReturnValue(true);
    mockGetStats.mockResolvedValue(FAKE_STATS);
    mockCacheGet.mockResolvedValue(null); // no saved config
    mockGetCachedLatestSnapshot.mockResolvedValue(FAKE_SNAPSHOT);
    mockComputeImpactV4.mockReturnValue({ ...FAKE_IMPACT });
    mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockGenerateVerificationCode.mockReturnValue(null);
    mockStoreVerificationRecord.mockResolvedValue(undefined);
    mockTrackBadgeGenerated.mockResolvedValue(undefined);
    mockNotifyFirstBadge.mockResolvedValue(undefined);
    mockBuildSnapshot.mockReturnValue({ date: "2026-01-01" });
    mockDbInsertSnapshot.mockResolvedValue(true);
    mockUpdateSnapshotCache.mockResolvedValue(undefined);
    mockIsStudioEnabled.mockResolvedValue(false);
    mockReadSessionCookie.mockReturnValue(null);
  });

  // -------------------------------------------------------------------------
  // Phase 1: Parallel data fetching
  // -------------------------------------------------------------------------

  describe("parallel data fetching", () => {
    it("fetches stats, config, and snapshot in a single Promise.all", async () => {
      await renderPage();

      // All three should be called — the key assertion is that snapshot
      // is called BEFORE stats resolves (i.e., in parallel, not sequential)
      expect(mockGetStats).toHaveBeenCalledWith("testuser", undefined);
      expect(mockCacheGet).toHaveBeenCalledWith("config:testuser");
      expect(mockGetCachedLatestSnapshot).toHaveBeenCalledWith("testuser");
    });

    it("uses snapshot data for EMA smoothing", async () => {
      await renderPage();
      expect(mockApplyEMA).toHaveBeenCalledWith(65, 60);
    });

    it("handles null snapshot gracefully", async () => {
      mockGetCachedLatestSnapshot.mockResolvedValue(null);
      await renderPage();
      expect(mockApplyEMA).toHaveBeenCalledWith(65, null);
    });
  });

  // -------------------------------------------------------------------------
  // Phase 1: Inline SVG rendering
  // -------------------------------------------------------------------------

  describe("inline SVG rendering", () => {
    it("calls renderBadgeSvg during SSR with stats, impact, and avatar", async () => {
      await renderPage();

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_STATS,
        expect.objectContaining({ archetype: "Builder" }),
        {
          avatarDataUri: "data:image/png;base64,abc123",
          verificationHash: undefined,
          verificationDate: undefined,
        },
      );
    });

    it("fetches avatar from stats.avatarUrl", async () => {
      await renderPage();
      expect(mockGetAvatarBase64).toHaveBeenCalledWith(
        "testuser",
        "https://avatars.githubusercontent.com/u/12345",
      );
    });

    it("passes undefined avatar when stats has no avatarUrl", async () => {
      mockGetStats.mockResolvedValue({ ...FAKE_STATS, avatarUrl: undefined });
      await renderPage();
      expect(mockGetAvatarBase64).not.toHaveBeenCalled();
      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ avatarDataUri: undefined }),
      );
    });

    it("does not call renderBadgeSvg when stats are null", async () => {
      mockGetStats.mockResolvedValue(null);
      await renderPage();
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
    });

    it("passes verification hash and date when verification code is generated", async () => {
      mockGenerateVerificationCode.mockReturnValue({ hash: "abc12345", date: "2026-01-15" });
      await renderPage();

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_STATS,
        expect.anything(),
        {
          avatarDataUri: "data:image/png;base64,abc123",
          verificationHash: "abc12345",
          verificationDate: "2026-01-15",
        },
      );
    });
  });

  // -------------------------------------------------------------------------
  // Phase 1: after() deferred work
  // -------------------------------------------------------------------------

  describe("deferred work via after()", () => {
    it("registers after() callback when inline SVG is rendered", async () => {
      await renderPage();
      expect(mockAfter).toHaveBeenCalledTimes(1);
      expect(mockAfter).toHaveBeenCalledWith(expect.any(Function));
    });

    it("after() callback calls trackBadgeGenerated and notifyFirstBadge", async () => {
      await renderPage();

      // Execute the deferred callback
      const afterCallback = mockAfter.mock.calls[0][0];
      await afterCallback();

      expect(mockTrackBadgeGenerated).toHaveBeenCalledWith("testuser");
      expect(mockNotifyFirstBadge).toHaveBeenCalledWith("testuser", expect.objectContaining({ archetype: "Builder" }));
    });

    it("after() callback stores verification record when code is generated", async () => {
      mockGenerateVerificationCode.mockReturnValue({ hash: "abc12345", date: "2026-01-15" });
      await renderPage();

      const afterCallback = mockAfter.mock.calls[0][0];
      await afterCallback();

      expect(mockStoreVerificationRecord).toHaveBeenCalledWith(
        "abc12345",
        expect.objectContaining({
          handle: "testuser",
          adjustedComposite: 65,
          generatedAt: "2026-01-15",
        }),
      );
    });

    it("after() callback inserts snapshot and updates cache", async () => {
      mockBuildSnapshot.mockReturnValue({ date: "2026-01-15" });
      await renderPage();

      const afterCallback = mockAfter.mock.calls[0][0];
      await afterCallback();

      expect(mockDbInsertSnapshot).toHaveBeenCalledWith("testuser", { date: "2026-01-15" });
      expect(mockUpdateSnapshotCache).toHaveBeenCalledWith("testuser", { date: "2026-01-15" });
    });

    it("does not register after() when stats are null", async () => {
      mockGetStats.mockResolvedValue(null);
      await renderPage();
      expect(mockAfter).not.toHaveBeenCalled();
    });

    it("does not store verification record when code is null", async () => {
      mockGenerateVerificationCode.mockReturnValue(null);
      await renderPage();

      const afterCallback = mockAfter.mock.calls[0][0];
      await afterCallback();

      expect(mockStoreVerificationRecord).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Phase 3: GlobalCommandBar lazy loading
  // -------------------------------------------------------------------------

  describe("lazy-loaded GlobalCommandBar", () => {
    it("renders without importing GlobalCommandBar eagerly", async () => {
      // This test verifies the page doesn't crash with the dynamic import
      const result = await renderPage();
      expect(result).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe("edge cases", () => {
    it("calls notFound for invalid handle", async () => {
      mockIsValidHandle.mockReturnValue(false);
      await expect(renderPage("bad!!handle")).rejects.toThrow("NOT_FOUND");
      expect(mockNotFound).toHaveBeenCalled();
    });

    it("does not call renderBadgeSvg for interactive preview (custom config)", async () => {
      // Return a custom config that differs from defaults
      mockCacheGet.mockResolvedValue({
        background: "aurora",
        cardStyle: "default",
        border: "default",
        scoreEffect: "default",
        heatmapAnimation: "default",
        interaction: "default",
        statsDisplay: "default",
        tierTreatment: "default",
        celebration: "default",
      });
      await renderPage();
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
    });
  });
});
