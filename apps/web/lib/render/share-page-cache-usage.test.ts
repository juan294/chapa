import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
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
 *
 * #1335 phase 5 ("delete v6") — the retired `readScoringRenderSelection()`
 * flag mock is gone: `SharePageContent` always takes the v7.2 status-gating
 * branch now, so `hasDrawableCurrentReceipt` is mocked to resolve `true`
 * (a drawable receipt) so the test exercises the normal materialize/render
 * path this suite is actually about, not the collecting/unregistered
 * placeholder.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbGetStudioConfig } = vi.hoisted(() => ({ mockDbGetStudioConfig: vi.fn() }));
vi.mock("@/lib/db/studio", () => ({ dbGetStudioConfig: (...args: unknown[]) => mockDbGetStudioConfig(...args) }));

const { mockHasDrawableCurrentReceipt, mockReadScoringStatus } = vi.hoisted(() => ({
  mockHasDrawableCurrentReceipt: vi.fn(),
  mockReadScoringStatus: vi.fn(),
}));
vi.mock("@/lib/collection/read-scoring-status", () => ({
  hasDrawableCurrentReceipt: (...args: unknown[]) => mockHasDrawableCurrentReceipt(...args),
  readScoringStatus: (...args: unknown[]) => mockReadScoringStatus(...args),
}));

// #1335 phase 5 — `resolveBadgeVerification` is a real, unmocked function
// elsewhere in this file's fixture (`FAKE_MATERIALIZED.scoring.identity` is
// `null` specifically so it short-circuits without a receipt-store read).
// But `cacheEligible` in page.tsx requires `!!verification`, so leaving the
// real function wired up meant every SVG cache write this suite asserts on
// was silently skipped. This suite is about SVG cache behavior, not
// verification content, so mock the resolver directly instead of fabricating
// a full receipt-store round trip.
const { mockResolveBadgeVerification } = vi.hoisted(() => ({
  mockResolveBadgeVerification: vi.fn(),
}));
vi.mock("@/lib/profile/badge-verification", () => ({
  resolveBadgeVerification: (...args: unknown[]) => mockResolveBadgeVerification(...args),
}));

const {
  mockMaterializePublicProfile,
  mockRunPublicProfileSideEffects,
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
  mockRunPublicProfileSideEffects: vi.fn(),
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
  runPublicProfileSideEffects: (...args: unknown[]) =>
    mockRunPublicProfileSideEffects(...args),
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
  constantScoringSelection: (capturedAt: number) => ({ enabled: true, machinePolicy: "v7.2" as const, cacheable: true, capturedAt }),
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

vi.mock("@/lib/feature-flags", () => ({
  isWebmcpEnabled: vi.fn().mockResolvedValue(true),
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
  craftResult: null,
  statsComplete: true,
  statsFreshness: "current",
  statsCapturedAt: "2026-05-03T00:00:00Z",
  // #1331 — configCacheable now requires exactly freshness === "current"
  // (was `!== "unavailable"`, which `undefined` also satisfied).
  // #1335 phase 5 — no more v6 aggregate; `identity: null` keeps
  // `resolveBadgeVerification` (a real, unmocked function here) from
  // attempting a real receipt-store read, since this suite is about SVG
  // cache behavior, not verification content.
  scoring: {
    policyVersion: "v7.2",
    identity: null,
    window: null,
    freshness: "current",
    tier: "Solid",
    archetype: "Builder",
    composite: { kind: "point", value: 65, display: 65 },
    dimensions: {
      delivery: { kind: "point", value: 70, display: 70 },
      quality: { kind: "point", value: 60, display: 60 },
      consistency: { kind: "point", value: 65, display: 65 },
      breadth: { kind: "point", value: 55, display: 55 },
    },
    craft: null,
    reportCraft: null,
    coverage: [],
    exclusions: [],
    limitations: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDbGetStudioConfig.mockResolvedValue({ status: "not_found" });
  mockHasDrawableCurrentReceipt.mockResolvedValue(true);
  mockReadScoringStatus.mockResolvedValue(null);
  mockResolveBadgeVerification.mockResolvedValue({ hash: "fixture-hash", date: "2026-05-03" });
  mockMaterializePublicProfile.mockResolvedValue(FAKE_MATERIALIZED);
  mockRunPublicProfileSideEffects.mockResolvedValue(undefined);
  mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
  mockRenderBadgeSvg.mockReturnValue(
    '<svg xmlns="http://www.w3.org/2000/svg">FRESH</svg>',
  );
  mockReadBadgeSvgCache.mockResolvedValue(null);
  mockWriteBadgeSvgCache.mockResolvedValue(undefined);
  mockGetTrendData.mockResolvedValue({ trend: null, diff: null });
  mockHeaders.mockResolvedValue({ get: () => null });
  mockGetOptionalServerSessionFromHeaders.mockReturnValue(null);
});

describe("share page (#720) cache-first SVG — real behavior", () => {
  it("#1289 leaves unknown config uncached then heals on recovery", async () => {
    mockDbGetStudioConfig.mockResolvedValueOnce({status: "unavailable"});
    await SharePageContent({handle: "testuser"});
    await flushAfterCallbacks();
    expect(mockRenderBadgeSvg).toHaveBeenCalled();
    expect(mockWriteBadgeSvgCache).not.toHaveBeenCalled();
    mockAfter.mockClear();
    mockDbGetStudioConfig.mockResolvedValue({status: "found", config: DEFAULT_BADGE_CONFIG, revision: 2});
    await SharePageContent({handle: "testuser"});
    await flushAfterCallbacks();
    expect(mockWriteBadgeSvgCache).toHaveBeenCalledTimes(1);
  });

  it("skips renderBadgeSvg entirely on a cache hit", async () => {
    mockReadBadgeSvgCache.mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg">CACHED</svg>',
    );

    await SharePageContent({ handle: "testuser" });

    expect(mockReadBadgeSvgCache).toHaveBeenCalled();
    expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
    expect(mockDbGetStudioConfig).not.toHaveBeenCalled();

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
      expect.objectContaining({ receiptIdentity: null }),
    );
  });
});
