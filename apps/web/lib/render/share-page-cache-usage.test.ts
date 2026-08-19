/**
 * #720 — share page must try the badge SVG cache before re-rendering.
 *
 * The badge.svg route writes to `badge:<version>:<handle>:warm-amber-<render-version>:<date>`
 * after every successful render. The share page must not ignore this cache
 * and call renderBadgeSvg() unconditionally during SSR, which would
 * duplicate render work on every ISR regeneration. This test locks in the
 * cache-first flow behaviorally: a cache hit skips renderBadgeSvg entirely,
 * and a cache miss renders fresh and writes the result back under the exact
 * key future requests (including badge.svg) will look up.
 *
 * #1104: previously this only regexed page.tsx's source for the presence of
 * these function names and their call-site ordering — a change that kept
 * the source-text shape intact but broke the real behavior (e.g. gating the
 * cache read behind a condition that never returns early) would not have
 * been caught. Converted to invoke the real SharePageContent with mocked
 * dependencies, modeled on the existing mock harness in
 * share-page.render.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockMaterializePublicProfile,
  mockGetPublicProfileVerification,
  mockPersistProfileSnapshot,
  mockDeferProfileCacheWork,
  mockRedactImpactForVisitor,
  mockGetAvatarBase64,
  mockRenderBadgeSvg,
  mockAfter,
  mockReadBadgeSvgCache,
  mockWriteBadgeSvgCache,
  mockGetTrendData,
  mockHeaders,
  mockGetOptionalServerSessionFromHeaders,
} = vi.hoisted(() => ({
  mockMaterializePublicProfile: vi.fn(),
  mockGetPublicProfileVerification: vi.fn(),
  mockPersistProfileSnapshot: vi.fn(),
  mockDeferProfileCacheWork: vi.fn(),
  mockRedactImpactForVisitor: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockAfter: vi.fn(),
  mockReadBadgeSvgCache: vi.fn(),
  mockWriteBadgeSvgCache: vi.fn(),
  mockGetTrendData: vi.fn(),
  mockHeaders: vi.fn(),
  mockGetOptionalServerSessionFromHeaders: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => mockHeaders(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalServerSessionFromHeaders: (...args: unknown[]) =>
    mockGetOptionalServerSessionFromHeaders(...args),
}));

vi.mock("@/lib/profile/public-profile", () => ({
  materializePublicProfile: (...args: unknown[]) =>
    mockMaterializePublicProfile(...args),
  getPublicProfileVerification: (...args: unknown[]) =>
    mockGetPublicProfileVerification(...args),
  persistProfileSnapshot: (...args: unknown[]) =>
    mockPersistProfileSnapshot(...args),
  deferProfileCacheWork: (...args: unknown[]) =>
    mockDeferProfileCacheWork(...args),
  redactImpactForVisitor: (...args: unknown[]) =>
    mockRedactImpactForVisitor(...args),
}));

vi.mock("@/lib/render/avatar", () => ({
  getAvatarBase64: (...args: unknown[]) => mockGetAvatarBase64(...args),
}));

vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: (...args: unknown[]) => mockRenderBadgeSvg(...args),
}));

vi.mock("@/lib/render/badge-svg-cache", () => ({
  AVATAR_ABSENT_CACHE_TTL_SECONDS: 3600,
  buildBadgeSvgCacheKey: (h: string, d: string) => `badge:${h}:${d}`,
  readBadgeSvgCache: (...args: unknown[]) => mockReadBadgeSvgCache(...args),
  writeBadgeSvgCache: (...args: unknown[]) => mockWriteBadgeSvgCache(...args),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: mockAfter };
});

vi.mock("@/lib/history/get-trend-data", () => ({
  getTrendData: (...args: unknown[]) => mockGetTrendData(...args),
}));

vi.mock("@/lib/utils/date", () => ({
  toDateString: () => "2026-05-03",
}));

import { SharePageContent } from "@/app/u/[handle]/page";

async function flushAfterCallbacks(): Promise<void> {
  const callbacks = mockAfter.mock.calls.map(
    (call) => call[0] as () => void | Promise<void>,
  );
  await Promise.all(callbacks.map((callback) => callback()));
}

const FAKE_MATERIALIZED = {
  stats: {
    handle: "testuser",
    displayName: "Test User",
    avatarUrl: "https://avatars.githubusercontent.com/u/12345",
    fetchedAt: "2026-05-03T00:00:00Z",
    commitsTotal: 42,
    prsMergedCount: 10,
    reviewsSubmittedCount: 5,
    heatmapData: [],
  },
  rawImpact: {
    adjustedComposite: 73,
    tier: "High",
    confidence: 85,
    archetype: "Builder",
    dimensions: { delivery: 70, quality: 60, consistency: 65, breadth: 55 },
    profileType: "collaborative",
  },
  displayImpact: {
    adjustedComposite: 65,
    tier: "Solid",
    confidence: 85,
    archetype: "Builder",
    dimensions: { delivery: 70, quality: 60, consistency: 65, breadth: 55 },
    profileType: "collaborative",
  },
  snapshot: { date: "2026-05-03", adjustedComposite: 65, tier: "Solid" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMaterializePublicProfile.mockResolvedValue(FAKE_MATERIALIZED);
  mockGetPublicProfileVerification.mockReturnValue({
    hash: "abc12345",
    date: "2026-05-03",
  });
  mockPersistProfileSnapshot.mockResolvedValue(true);
  mockDeferProfileCacheWork.mockResolvedValue(undefined);
  mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
  mockRenderBadgeSvg.mockReturnValue(
    '<svg xmlns="http://www.w3.org/2000/svg">FRESH</svg>',
  );
  mockReadBadgeSvgCache.mockResolvedValue(null);
  mockWriteBadgeSvgCache.mockResolvedValue(undefined);
  mockGetTrendData.mockResolvedValue({ trend: null, diff: null });
  mockHeaders.mockResolvedValue({ get: () => null });
  mockGetOptionalServerSessionFromHeaders.mockReturnValue(null);
  mockRedactImpactForVisitor.mockImplementation((impact: unknown) => impact);
});

describe("share page (#720) cache-first SVG — real behavior", () => {
  it("skips renderBadgeSvg entirely on a cache hit", async () => {
    mockReadBadgeSvgCache.mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg">CACHED</svg>',
    );

    await SharePageContent({ handle: "testuser" });

    expect(mockReadBadgeSvgCache).toHaveBeenCalled();
    expect(mockRenderBadgeSvg).not.toHaveBeenCalled();

    await flushAfterCallbacks();
    expect(mockWriteBadgeSvgCache).not.toHaveBeenCalled();
  });

  it("renders fresh and writes the result back under the cache-miss key on a cache miss", async () => {
    mockReadBadgeSvgCache.mockResolvedValue(null);

    await SharePageContent({ handle: "testuser" });

    expect(mockRenderBadgeSvg).toHaveBeenCalled();

    await flushAfterCallbacks();

    expect(mockWriteBadgeSvgCache).toHaveBeenCalledWith(
      "badge:testuser:2026-05-03",
      '<svg xmlns="http://www.w3.org/2000/svg">FRESH</svg>',
      "testuser",
      undefined,
    );
  });
});
