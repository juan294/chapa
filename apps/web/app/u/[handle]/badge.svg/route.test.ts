import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CACHE_VERSION } from "@/lib/cache/version";

const {
  mockMaterializePublicProfile,
  mockGetPublicProfileVerification,
  mockRunPublicProfileSideEffects,
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
  getClientIp: (req: Request) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
}));

vi.mock("@/lib/render/escape", () => ({
  escapeXml: (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&apos;")
      .replace(/"/g, "&quot;"),
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
  headers: Record<string, string> = {},
): [NextRequest, { params: Promise<{ handle: string }> }] {
  return [
    new NextRequest(`https://chapa.thecreativetoken.com/u/${handle}/badge.svg`, { headers }),
    { params: Promise.resolve({ handle }) },
  ];
}

describe("GET /u/[handle]/badge.svg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidHandle.mockReturnValue(true);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 100 });
    mockGetOptionalRequestSession.mockReturnValue(null);
    mockMaterializePublicProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockGetPublicProfileVerification.mockReturnValue({ hash: "abc12345", date: "2026-04-17" });
    mockRunPublicProfileSideEffects.mockResolvedValue(undefined);
    mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockCaptureServerError.mockResolvedValue(undefined);
    // SVG cache: miss by default
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);
    mockCacheSetNx.mockResolvedValue(true);
    mockCacheDel.mockResolvedValue(undefined);
  });

  it("returns 429 when the badge route is rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, current: 100, limit: 100 });

    const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
    const res = await GET(req, ctx);

    expect(res.status).toBe(429);
  });

  it("returns a 400 fallback svg for an invalid handle", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const [req, ctx] = makeRequest("bad!!handle");
    const res = await GET(req, ctx);

    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  });

  it("passes the session token into public materialization when available", async () => {
    mockGetOptionalRequestSession.mockReturnValue({ token: "oauth-token" });

    const [req, ctx] = makeRequest("testuser", {
      "x-forwarded-for": "1.2.3.4",
      cookie: "session=value",
    });
    await GET(req, ctx);

    expect(mockMaterializePublicProfile).toHaveBeenCalledWith("testuser", {
      token: "oauth-token",
    });
  });

  it("renders the badge from displayImpact, not rawImpact", async () => {
    const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      FAKE_MATERIALIZED.displayImpact,
      {
        avatarDataUri: "data:image/png;base64,abc123",
        verificationHash: "abc12345",
        verificationDate: "2026-04-17",
      },
    );
  });

  it("runs centralized public side effects with the same verification payload", async () => {
    const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
    await GET(req, ctx);

    expect(mockRunPublicProfileSideEffects).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED,
      { verification: { hash: "abc12345", date: "2026-04-17" } },
    );
  });

  it("falls back to an undefined avatar when avatar fetch fails", async () => {
    mockGetAvatarBase64.mockRejectedValue(new Error("avatar down"));

    const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
    await GET(req, ctx);

    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      FAKE_MATERIALIZED.displayImpact,
      expect.objectContaining({ avatarDataUri: undefined }),
    );
  });

  it("returns a cacheable fallback when public materialization returns null", async () => {
    mockMaterializePublicProfile.mockResolvedValue(null);

    const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=600",
    );
  });

  it("captures and returns a 500 fallback when rendering throws", async () => {
    mockRenderBadgeSvg.mockImplementation(() => {
      throw new Error("render failed");
    });

    const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
    const res = await GET(req, ctx);

    expect(res.status).toBe(500);
    expect(mockCaptureServerError).toHaveBeenCalled();
  });

  describe("SVG full-response cache (#717)", () => {
    it("returns cached SVG on cache hit without calling materialize or render", async () => {
      const CACHED_SVG = '<svg xmlns="http://www.w3.org/2000/svg">CACHED</svg>';
      mockCacheGet.mockResolvedValue(CACHED_SVG);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe(CACHED_SVG);
      expect(mockMaterializePublicProfile).not.toHaveBeenCalled();
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
    });

    it("writes the rendered SVG to cache on cache miss", async () => {
      mockCacheGet.mockResolvedValue(null);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge:${CACHE_VERSION}:testuser:warm-amber:`)),
        FAKE_SVG,
        86400,
      );
    });

    it("acquires and releases a versioned render lock on cold-cache renders", async () => {
      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      expect(mockCacheSetNx).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge-lock:${CACHE_VERSION}:testuser:warm-amber:`)),
        30,
      );
      expect(mockCacheDel).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge-lock:${CACHE_VERSION}:testuser:warm-amber:`)),
      );
    });

    it("checks the cache with the correct key prefix and handle", async () => {
      mockCacheGet.mockResolvedValue(null);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      expect(mockCacheGet).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge:${CACHE_VERSION}:testuser:warm-amber:`)),
      );
    });

    it("reuses cached SVG after another request already holds the render lock", async () => {
      mockCacheSetNx.mockResolvedValue(false);
      mockCacheGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(FAKE_SVG);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      expect(await res.text()).toBe(FAKE_SVG);
      expect(mockMaterializePublicProfile).not.toHaveBeenCalled();
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
    });

    it("keeps polling long enough to reuse SVG produced by another renderer", async () => {
      vi.useFakeTimers();
      let cacheReads = 0;
      mockCacheSetNx.mockResolvedValue(false);
      mockCacheGet.mockImplementation(async () => {
        cacheReads += 1;
        return cacheReads >= 8 ? FAKE_SVG : null;
      });

      try {
        const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
        const responsePromise = GET(req, ctx);

        await vi.advanceTimersByTimeAsync(1200);
        const res = await responsePromise;

        expect(await res.text()).toBe(FAKE_SVG);
        expect(mockMaterializePublicProfile).not.toHaveBeenCalled();
        expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("fails open when the initial cache read stalls", async () => {
      vi.useFakeTimers();
      mockCacheGet.mockImplementationOnce(
        () => new Promise<string | null>(() => undefined),
      );

      try {
        const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
        const responsePromise = GET(req, ctx);

        await vi.advanceTimersByTimeAsync(400);
        const res = await responsePromise;

        expect(res.status).toBe(200);
        expect(mockMaterializePublicProfile).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("skips rendering on cache hit but still returns correct Content-Type header", async () => {
      mockCacheGet.mockResolvedValue(FAKE_SVG);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    });
  });

  describe("rate limit key uses (ip, handle) not just ip (#693)", () => {
    it("rate-limits on combined ip+handle key", async () => {
      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.stringContaining("testuser"),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it("uses different rate limit buckets for different handles from same IP", async () => {
      const [req1, ctx1] = makeRequest("alice", { "x-forwarded-for": "1.2.3.4" });
      const [req2, ctx2] = makeRequest("bob", { "x-forwarded-for": "1.2.3.4" });

      await GET(req1, ctx1);
      await GET(req2, ctx2);

      const keys = mockRateLimit.mock.calls.map((call: unknown[]) => call[0] as string);
      expect(keys[0]).not.toBe(keys[1]);
      expect(keys[0]).toContain("alice");
      expect(keys[1]).toContain("bob");
    });

    it("fails open when the rate limiter stalls", async () => {
      vi.useFakeTimers();
      mockRateLimit.mockImplementation(
        () => new Promise(() => undefined),
      );

      try {
        const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
        const responsePromise = GET(req, ctx);

        await vi.advanceTimersByTimeAsync(300);
        const res = await responsePromise;

        expect(res.status).toBe(200);
        expect(mockMaterializePublicProfile).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
