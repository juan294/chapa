import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockMaterializePublicProfile,
  mockGetPublicProfileVerification,
  mockRenderBadgeSvg,
  mockIsValidHandle,
  mockGetAvatarBase64,
  mockSvgToPng,
  mockCacheGet,
  mockCacheSet,
  mockRateLimit,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockMaterializePublicProfile: vi.fn(),
  mockGetPublicProfileVerification: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockSvgToPng: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

vi.mock("@/lib/profile/public-profile", () => ({
  materializePublicProfile: (...args: unknown[]) => mockMaterializePublicProfile(...args),
  getPublicProfileVerification: (...args: unknown[]) =>
    mockGetPublicProfileVerification(...args),
}));

vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: (...args: unknown[]) => mockRenderBadgeSvg(...args),
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: (...args: unknown[]) => mockIsValidHandle(...args),
}));

vi.mock("@/lib/render/avatar", () => ({
  getAvatarBase64: (...args: unknown[]) => mockGetAvatarBase64(...args),
}));

vi.mock("@/lib/render/svg-to-png", () => ({
  svgToPng: (...args: unknown[]) => mockSvgToPng(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}));

import { GET } from "./route";

const FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg">BADGE</svg>';
const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FAKE_PNG_BASE64 = Buffer.from(FAKE_PNG).toString("base64");

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
  snapshot: { date: "2026-02-14", adjustedComposite: 65, tier: "Solid" },
};

function makeRequest(
  handle: string,
): [NextRequest, { params: Promise<{ handle: string }> }] {
  return [
    new NextRequest(`https://chapa.thecreativetoken.com/u/${handle}/og-image`),
    { params: Promise.resolve({ handle }) },
  ];
}

describe("GET /u/[handle]/og-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T12:00:00Z"));

    mockIsValidHandle.mockReturnValue(true);
    mockMaterializePublicProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockGetPublicProfileVerification.mockReturnValue({ hash: "abc12345", date: "2026-02-14" });
    mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockSvgToPng.mockReturnValue(FAKE_PNG);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 30 });
    mockGetClientIp.mockReturnValue("127.0.0.1");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the cached png when Redis already has the image", async () => {
    mockCacheGet.mockResolvedValue(FAKE_PNG_BASE64);

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(mockMaterializePublicProfile).not.toHaveBeenCalled();
    expect(mockCacheGet).toHaveBeenCalledWith("og-image:v2:testuser:2026-02-14");
  });

  it("renders the OG image from displayImpact, not rawImpact", async () => {
    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      FAKE_MATERIALIZED.displayImpact,
      {
        avatarDataUri: "data:image/png;base64,abc123",
        verificationHash: "abc12345",
        verificationDate: "2026-02-14",
      },
    );
    expect(mockCacheSet).toHaveBeenCalledWith(
      "og-image:v2:testuser:2026-02-14",
      FAKE_PNG_BASE64,
      172800,
    );
  });

  it("returns 400 for an invalid handle", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const [req, ctx] = makeRequest("bad!!handle");
    const res = await GET(req, ctx);

    expect(res.status).toBe(400);
  });

  it("returns 404 when public materialization returns null", async () => {
    mockMaterializePublicProfile.mockResolvedValue(null);

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(404);
  });

  it("returns 504 when svgToPng exceeds the timeout", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSvgToPng.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 30_000)),
    );

    const [req, ctx] = makeRequest("testuser");
    const responsePromise = GET(req, ctx);
    await vi.advanceTimersByTimeAsync(10_001);
    const res = await responsePromise;

    expect(res.status).toBe(504);
    consoleSpy.mockRestore();
  });

  it("returns 500 when badge rendering fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRenderBadgeSvg.mockImplementation(() => {
      throw new Error("render failed");
    });

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it("renders without an avatar when the avatar fetch rejects", async () => {
    mockGetAvatarBase64.mockRejectedValue(new Error("avatar timeout"));

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      FAKE_MATERIALIZED.displayImpact,
      expect.objectContaining({ avatarDataUri: undefined }),
    );
  });

  it("renders without an avatar when stats has no avatarUrl", async () => {
    mockMaterializePublicProfile.mockResolvedValue({
      ...FAKE_MATERIALIZED,
      stats: { ...FAKE_MATERIALIZED.stats, avatarUrl: undefined },
    });

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(mockGetAvatarBase64).not.toHaveBeenCalled();
    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ avatarDataUri: undefined }),
    );
  });

  it("returns the rendered PNG even when caching it rejects (fire-and-forget)", async () => {
    mockCacheSet.mockRejectedValue(new Error("redis down"));

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    // give the fire-and-forget rejection a tick to settle so the onError
    // handler runs and is observed by coverage instrumentation
    await vi.advanceTimersByTimeAsync(0);
  });

  it("rate-limits to 30 requests per IP per 60 seconds", async () => {
    const counts = new Map<string, number>();
    mockRateLimit.mockImplementation(async (key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return { allowed: next <= 30, current: next, limit: 30 };
    });

    for (let i = 0; i < 30; i++) {
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      expect(res.status).toBe(200);
    }

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});
