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
  mockCaptureServerError,
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
  mockCaptureServerError: vi.fn(),
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

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
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
  lang?: string,
): [NextRequest, { params: Promise<{ handle: string }> }] {
  const query = lang ? `?lang=${lang}` : "";
  return [
    new NextRequest(
      `https://chapa.thecreativetoken.com/u/${handle}/og-image${query}`,
    ),
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
    expect(mockCacheGet).toHaveBeenCalledWith("og-image:v3:testuser:2026-02-14:en");
  });

  it("PE-L1: warm-cache hit skips the rate-limit round-trip entirely", async () => {
    // Cache hit — rate limiter must NOT be called (deferred to miss branch only)
    mockCacheGet.mockResolvedValue(FAKE_PNG_BASE64);

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(mockRateLimit).not.toHaveBeenCalled();
  });

  it("PE-L1: rate limiter is still called on a cache miss", async () => {
    mockCacheGet.mockResolvedValue(null);

    const [req, ctx] = makeRequest("testuser");
    await GET(req, ctx);

    expect(mockRateLimit).toHaveBeenCalledOnce();
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
        disableAnimation: true,
        // #1191 — the owner's Studio configuration, resolved through the
        // shared helper so every render site agrees on the same cache slot.
        config: expect.objectContaining({ border: expect.any(String) }),
        // #1190 — the badge strings for the request's locale, from the same
        // resolved bundle that keyed the cache entry.
        strings: expect.objectContaining({ metricsVerified: expect.any(String) }),
      },
    );
    expect(mockCacheSet).toHaveBeenCalledWith(
      "og-image:v3:testuser:2026-02-14:en",
      FAKE_PNG_BASE64,
      172800,
    );
  });

  // #760 — the SVG is rasterized to PNG, where SMIL <animate> does not run.
  // Request static (non-animated) cells so the heatmap is not invisible.
  it("requests static (non-animated) rendering before rasterization", async () => {
    const [req, ctx] = makeRequest("testuser");
    await GET(req, ctx);

    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      FAKE_MATERIALIZED.displayImpact,
      expect.objectContaining({ disableAnimation: true }),
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

  // #1094 (PE-L3): cacheSet never throws — it swallows Redis errors internally
  // and resolves `false` on failure (e.g. an oversized base64 PNG rejected by
  // Upstash's per-value size limit). That resolved-false outcome was
  // previously discarded silently, permanently degrading the handle to an
  // OG-image cache miss with zero observability. It must now be surfaced via
  // captureServerError, and the write failure must never break the response.
  it("surfaces a resolved-false cacheSet failure via captureServerError without breaking the response", async () => {
    mockCacheSet.mockResolvedValue(false);

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");

    // let the fire-and-forget cacheSet + observability call settle
    await vi.advanceTimersByTimeAsync(0);

    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/u/testuser/og-image",
        error: expect.any(Error),
      }),
    );
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

// #1190 — the OG image is one of the badge's three distribution surfaces, and
// it was the only one still rendering the default locale unconditionally.
// Worse than the issue described: its cache key carried no locale either, so
// whichever locale rendered first won the slot for the day and every other
// locale was served that PNG.
describe("GET /u/[handle]/og-image — locale (#1190)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T12:00:00Z"));
    mockIsValidHandle.mockReturnValue(true);
    mockMaterializePublicProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockGetPublicProfileVerification.mockReturnValue(null);
    mockGetAvatarBase64.mockResolvedValue(undefined);
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

  it("keys the cache per locale so one locale cannot serve another's image", async () => {
    const [en, enCtx] = makeRequest("testuser", "en");
    await GET(en, enCtx);
    const enKey = mockCacheGet.mock.calls[0]![0];

    vi.clearAllMocks();
    mockIsValidHandle.mockReturnValue(true);
    mockMaterializePublicProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockGetPublicProfileVerification.mockReturnValue(null);
    mockGetAvatarBase64.mockResolvedValue(undefined);
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockSvgToPng.mockReturnValue(FAKE_PNG);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 30 });
    mockGetClientIp.mockReturnValue("127.0.0.1");

    const [es, esCtx] = makeRequest("testuser", "es");
    await GET(es, esCtx);
    const esKey = mockCacheGet.mock.calls[0]![0];

    expect(enKey).not.toBe(esKey);
    expect(enKey).toContain("en");
    expect(esKey).toContain("es");
  });

  it("renders the badge with the requested locale's strings", async () => {
    const [req, ctx] = makeRequest("testuser", "es");
    await GET(req, ctx);

    const options = mockRenderBadgeSvg.mock.calls[0]![2] as {
      strings?: { metricsVerified?: string };
    };
    expect(options.strings).toBeDefined();
    expect(options.strings!.metricsVerified).toBe("Métricas verificadas");
  });

  it("falls back to the default locale for an unknown lang", async () => {
    const [req, ctx] = makeRequest("testuser", "klingon");
    await GET(req, ctx);

    const key = mockCacheGet.mock.calls[0]![0] as string;
    expect(key).toContain("en");
  });
});

