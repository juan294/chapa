import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockMaterializePublicProfile,
  mockGetPublicProfileVerification,
  mockRunPublicProfileSideEffects,
  mockPersistProfileSnapshot,
  mockDeferProfileCacheWork,
  mockRenderBadgeSvg,
  mockGetAvatarBase64,
  mockGetOptionalRequestSession,
  mockIsValidHandle,
  mockRateLimit,
  mockCaptureServerError,
  mockCacheGet,
  mockCacheSet,
  mockCacheSetNx,
  mockCacheDel,
} = vi.hoisted(() => ({
  mockMaterializePublicProfile: vi.fn(),
  mockGetPublicProfileVerification: vi.fn(),
  mockRunPublicProfileSideEffects: vi.fn(),
  mockPersistProfileSnapshot: vi.fn(),
  mockDeferProfileCacheWork: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockGetOptionalRequestSession: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockRateLimit: vi.fn(),
  mockCaptureServerError: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockCacheSetNx: vi.fn(),
  mockCacheDel: vi.fn(),
}));

vi.mock("@/lib/profile/public-profile", () => ({
  materializePublicProfile: (...args: unknown[]) => mockMaterializePublicProfile(...args),
  getPublicProfileVerification: (...args: unknown[]) =>
    mockGetPublicProfileVerification(...args),
  runPublicProfileSideEffects: (...args: unknown[]) =>
    mockRunPublicProfileSideEffects(...args),
  persistProfileSnapshot: (...args: unknown[]) =>
    mockPersistProfileSnapshot(...args),
  deferProfileCacheWork: (...args: unknown[]) =>
    mockDeferProfileCacheWork(...args),
}));

vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: (...args: unknown[]) => mockRenderBadgeSvg(...args),
}));

vi.mock("@/lib/render/avatar", () => ({
  getAvatarBase64: (...args: unknown[]) => mockGetAvatarBase64(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalRequestSession: (...args: unknown[]) =>
    mockGetOptionalRequestSession(...args),
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: (...args: unknown[]) => mockIsValidHandle(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheSetNx: (...args: unknown[]) => mockCacheSetNx(...args),
  cacheDel: (...args: unknown[]) => mockCacheDel(...args),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: () => "1.2.3.4",
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
}));

vi.mock("@/lib/render/escape", () => ({
  escapeXml: (s: string) => s,
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (cb: () => void | Promise<void>) => { void cb(); },
  };
});

import { GET } from "./route";

const FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg">BADGE</svg>';

const FAKE_MATERIALIZED = {
  stats: {
    handle: "testuser",
    displayName: "Test User",
    avatarUrl: "https://avatars.githubusercontent.com/u/12345",
    commitsTotal: 42,
    prsMergedCount: 10,
    reviewsSubmittedCount: 5,
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
  snapshot: { date: "2026-04-17", adjustedComposite: 65, tier: "Solid" },
};

function makeRequest(
  handle: string,
): [NextRequest, { params: Promise<{ handle: string }> }] {
  return [
    new NextRequest(`https://chapa.thecreativetoken.com/u/${handle}/badge.svg`),
    { params: Promise.resolve({ handle }) },
  ];
}

describe("GET /u/[handle]/badge.svg — cold-cache concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidHandle.mockReturnValue(true);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 100 });
    mockGetOptionalRequestSession.mockReturnValue(null);
    mockGetPublicProfileVerification.mockReturnValue({ hash: "abc12345", date: "2026-04-17" });
    mockRunPublicProfileSideEffects.mockResolvedValue(undefined);
    mockPersistProfileSnapshot.mockResolvedValue(true);
    mockDeferProfileCacheWork.mockResolvedValue(undefined);
    mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
    mockCaptureServerError.mockResolvedValue(undefined);
    mockCacheSetNx.mockResolvedValue(true);
    mockCacheSet.mockImplementation(async () => true);
    mockCacheDel.mockResolvedValue(undefined);
  });

  it("renders SVG exactly once when two simultaneous cold-cache requests arrive", async () => {
    let cachedSvg: string | null = null;
    let resolveMaterialized!: () => void;
    const materializedGate = new Promise<void>((resolve) => {
      resolveMaterialized = resolve;
    });

    mockMaterializePublicProfile.mockImplementation(async () => {
      await materializedGate;
      return FAKE_MATERIALIZED;
    });
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockCacheGet.mockImplementation(async () => cachedSvg);
    mockCacheSet.mockImplementation(async (_key: string, value: string) => {
      cachedSvg = value;
      return true;
    });

    const [req1, ctx1] = makeRequest("testuser");
    const [req2, ctx2] = makeRequest("testuser");

    const first = GET(req1, ctx1);
    const second = GET(req2, ctx2);

    await Promise.resolve();
    resolveMaterialized();

    const [res1, res2] = await Promise.all([first, second]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(await res1.text()).toBe(FAKE_SVG);
    expect(await res2.text()).toBe(FAKE_SVG);
    expect(mockRenderBadgeSvg).toHaveBeenCalledTimes(1);
  });
});
