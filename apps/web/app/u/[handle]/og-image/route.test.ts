// #1335 phase 4 — defaults to `ready` so pre-existing tests keep rendering
// through the normal pipeline below, unaffected by this phase.
// #1335 phase 4 perf fix — `mockHasDrawableCurrentReceipt` defaults to
// `false` so pre-existing tests keep calling `readScoringStatus` exactly as
// before; tests proving the perf fix override it to `true`.
const { mockReadScoringStatus, mockHasDrawableCurrentReceipt } = vi.hoisted(() => ({
  mockReadScoringStatus: vi.fn(),
  mockHasDrawableCurrentReceipt: vi.fn(),
}));
vi.mock("@/lib/collection/read-scoring-status", () => ({
  readScoringStatus: (...args: unknown[]) => mockReadScoringStatus(...args),
  hasDrawableCurrentReceipt: (...args: unknown[]) => mockHasDrawableCurrentReceipt(...args),
}));
beforeEach(() => {
  mockReadScoringStatus.mockResolvedValue({ kind: "ready", receiptDate: "2026-04-17", updating: false });
  mockHasDrawableCurrentReceipt.mockResolvedValue(false);
});
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockMaterializePublicProfile,
  mockResolveBadgeVerification,
  mockRenderBadgeSvg,
  mockIsValidHandle,
  mockGetAvatarBase64,
  mockSvgToPng,
  mockCacheGet,
  mockCacheSet,
  mockCacheDel,
  mockRateLimit,
  mockGetClientIp,
  mockCaptureServerError,
  mockResolveBadgeConfigSnapshot,
  mockIsScoringImageReceiptCurrent,
} = vi.hoisted(() => ({
  mockMaterializePublicProfile: vi.fn(),
  mockResolveBadgeVerification: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockSvgToPng: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockCacheDel: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockCaptureServerError: vi.fn(),
  mockResolveBadgeConfigSnapshot: vi.fn(),
  mockIsScoringImageReceiptCurrent: vi.fn(),
}));

// The image-receipt fence (`isScoringImageReceiptCurrent`) hits a real
// Supabase read; the rest of this module (cache key/version builders) stays
// real since it's pure. Default to "current" so the happy-path publish gate
// isn't short-circuited in tests that don't care about the fence itself.
vi.mock("@/lib/render/badge-svg-cache", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/render/badge-svg-cache")>(),
  isScoringImageReceiptCurrent: (...args: unknown[]) => mockIsScoringImageReceiptCurrent(...args),
}));

vi.mock("@/lib/profile/public-profile", () => ({
  materializePublicProfile: (...args: unknown[]) => mockMaterializePublicProfile(...args),
}));

// #1335 phase 5 — the v6 HMAC verification record and its
// `getPublicProfileVerification` reader are retired; the badge's attestation
// is resolved per render via `resolveBadgeVerification`.
vi.mock("@/lib/profile/badge-verification", () => ({
  resolveBadgeVerification: (...args: unknown[]) => mockResolveBadgeVerification(...args),
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
  cacheDel: (...args: unknown[]) => mockCacheDel(...args),
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}));

vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
}));

vi.mock("@/lib/render/badge-config", () => ({
  resolveBadgeConfigSnapshot: (...args: unknown[]) =>
    mockResolveBadgeConfigSnapshot(...args),
}));

import { GET } from "./route";
import { githubUserNotFound } from "@/lib/github/not-found";

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
  craftResult: null,
  statsComplete: true,
  statsFreshness: "current" as const,
  statsCapturedAt: "2026-02-14T12:00:00.000Z",
  scoring: {
    policyVersion: "v7.2" as const,
    handle: "testuser",
    identity: { receiptId: "r1", revisionId: "rev1", revision: 1, recordedAt: "2026-02-14T00:00:00.000Z", action: "create" as const, supersedesRevisionId: null, contentHash: "hash1" },
    window: null,
    dimensions: {
      delivery: { kind: "point" as const, value: 70, display: 70 },
      quality: { kind: "point" as const, value: 60, display: 60 },
      consistency: { kind: "point" as const, value: 65, display: 65 },
      breadth: { kind: "point" as const, value: 55, display: 55 },
    },
    composite: { kind: "point" as const, value: 65, display: 65 },
    tier: "Solid" as const,
    archetype: "Builder" as const,
    craft: null,
    reportCraft: { status: "no_report" as const, unlocked: false, report: null },
    freshness: "current" as const,
    coverage: [],
    exclusions: [],
    limitations: [],
  },
};

function makeRequest(
  handle: string,
  lang?: string,
  version: string | null = "ice-terminal-v2-v7.2-2026-02-14-r7",
): [NextRequest, { params: Promise<{ handle: string }> }] {
  const query = new URLSearchParams();
  if (lang) query.set("lang", lang);
  if (version) query.set("v", version);
  const queryString = query.size > 0 ? `?${query.toString()}` : "";
  return [
    new NextRequest(
      `https://chapa.thecreativetoken.com/u/${handle}/og-image${queryString}`,
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
    mockResolveBadgeVerification.mockResolvedValue({ hash: "abc12345", date: "2026-02-14" });
    mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockSvgToPng.mockReturnValue(FAKE_PNG);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);
    mockCacheDel.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 30 });
    mockGetClientIp.mockReturnValue("127.0.0.1");
    mockResolveBadgeConfigSnapshot.mockResolvedValue({
      config: { border: "solid" },
      revision: 7,
      cacheable: true,
    });
    // The image-receipt fence hits a real Supabase read; default to
    // "current" so the happy-path publish gate isn't short-circuited in
    // tests that don't care about the fence itself.
    mockIsScoringImageReceiptCurrent.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // #1335 phase 5 — the dual v6/v7.2 selector-driven cache-version switching
  // this used to test (and the "flag changes mid-request" races it exploited
  // via an awaited, propagated `capturedAt`) is retired: v7.2 is the one
  // policy, embedded as a compile-time constant in the cache version/key
  // builders, and `capturedAt` is now `Date.now()` captured synchronously up
  // front with no intervening await for a concurrent write to race against.

  it("returns the cached png when Redis already has the image", async () => {
    mockCacheGet.mockResolvedValue({
      version: "ice-terminal-v2-v7.2-2026-02-14-r7",
      pngBase64: FAKE_PNG_BASE64,
    });

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(mockMaterializePublicProfile).not.toHaveBeenCalled();
    expect(mockCacheGet).toHaveBeenCalledWith("og-image:v5:testuser:ice-terminal-v2:v7.2:2026-02-14:en");
    expect(res.headers.get("Vercel-Cache-Tag")).toBe("og-testuser,scoring-images");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe(
      "public, s-maxage=300",
    );
  });

  it("PE-L1: warm-cache hit skips the rate-limit round-trip entirely", async () => {
    // Cache hit — rate limiter must NOT be called (deferred to miss branch only)
    mockCacheGet.mockResolvedValue({
      version: "ice-terminal-v2-v7.2-2026-02-14-r7",
      pngBase64: FAKE_PNG_BASE64,
    });

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

  it("renders the OG image with the resolved v7.2 scoring model", async () => {
    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      {
        scoring: FAKE_MATERIALIZED.scoring,
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
      "og-image:v5:testuser:ice-terminal-v2:v7.2:2026-02-14:en",
      {
        version: "ice-terminal-v2-v7.2-2026-02-14-r7",
        pngBase64: FAKE_PNG_BASE64,
      },
      172800,
    );
    expect(res.headers.get("Vercel-Cache-Tag")).toBe("og-testuser,scoring-images");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe(
      "public, s-maxage=300",
    );
  });

  it("normalizes the handle in the Redis key and edge tag", async () => {
    const [req, ctx] = makeRequest("MixedCase");
    const res = await GET(req, ctx);

    expect(mockCacheGet).toHaveBeenCalledWith(
      "og-image:v5:mixedcase:ice-terminal-v2:v7.2:2026-02-14:en",
    );
    expect(res.headers.get("Vercel-Cache-Tag")).toBe("og-mixedcase,scoring-images");
  });

  // #760 — the SVG is rasterized to PNG, where SMIL <animate> does not run.
  // Request static (non-animated) cells so the heatmap is not invisible.
  it("requests static (non-animated) rendering before rasterization", async () => {
    const [req, ctx] = makeRequest("testuser");
    await GET(req, ctx);

    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      expect.objectContaining({ disableAnimation: true }),
    );
  });

  it("returns 400 for an invalid handle", async () => {
    mockIsValidHandle.mockReturnValue(false);

    const [req, ctx] = makeRequest("bad!!handle");
    const res = await GET(req, ctx);

    expect(res.status).toBe(400);
  });

  it("LE-8-2: returns 404 without rendering when GitHub does not know the handle", async () => {
    mockMaterializePublicProfile.mockResolvedValue(githubUserNotFound("ghost"));

    const [req, ctx] = makeRequest("ghost");
    const res = await GET(req, ctx);

    expect(res.status).toBe(404);
    expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
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
      expect.objectContaining({ avatarDataUri: undefined }),
    );
  });

  it("returns the rendered PNG even when caching it rejects", async () => {
    mockCacheSet.mockRejectedValue(new Error("redis down"));

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
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

    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/u/testuser/og-image",
        error: expect.any(Error),
      }),
    );
  });

  it("deletes and does not edge-publish a PNG when the Studio config changes after its Redis write", async () => {
    mockResolveBadgeConfigSnapshot
      .mockResolvedValueOnce({
        config: { border: "solid" },
        revision: 7,
        cacheable: true,
      })
      .mockResolvedValueOnce({ config: { border: "solid" }, revision: 7, cacheable: true })
      .mockResolvedValueOnce({
        config: { border: "none" },
        revision: 8,
        cacheable: true,
      });

    const [req, ctx] = makeRequest("testuser");
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    expect(mockCacheSet).toHaveBeenCalledOnce();
    expect(mockCacheDel).toHaveBeenCalledWith(
      "og-image:v5:testuser:ice-terminal-v2:v7.2:2026-02-14:en",
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe("no-store");
    expect(res.headers.get("Vercel-Cache-Tag")).toBeNull();
  });

  it("does not use or publish cache entries without the revisioned metadata URL", async () => {
    mockCacheGet.mockResolvedValue({
      version: "ice-terminal-v2-v7.2-2026-02-14-r7",
      pngBase64: FAKE_PNG_BASE64,
    });

    const [req, ctx] = makeRequest("testuser", undefined, null);
    const res = await GET(req, ctx);

    expect(mockMaterializePublicProfile).toHaveBeenCalledOnce();
    expect(mockCacheSet).not.toHaveBeenCalled();
    expect(res.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
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
    mockResolveBadgeVerification.mockResolvedValue(null);
    mockGetAvatarBase64.mockResolvedValue(undefined);
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockSvgToPng.mockReturnValue(FAKE_PNG);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);
    mockCacheDel.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 30 });
    mockGetClientIp.mockReturnValue("127.0.0.1");
    mockResolveBadgeConfigSnapshot.mockResolvedValue({
      config: { border: "solid" },
      revision: 7,
      cacheable: true,
    });
    // The image-receipt fence hits a real Supabase read; default to
    // "current" so the happy-path publish gate isn't short-circuited in
    // tests that don't care about the fence itself.
    mockIsScoringImageReceiptCurrent.mockResolvedValue(true);
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
    mockResolveBadgeVerification.mockResolvedValue(null);
    mockGetAvatarBase64.mockResolvedValue(undefined);
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockSvgToPng.mockReturnValue(FAKE_PNG);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);
    mockCacheDel.mockResolvedValue(true);
    mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 30 });
    mockGetClientIp.mockReturnValue("127.0.0.1");
    mockResolveBadgeConfigSnapshot.mockResolvedValue({
      config: { border: "solid" },
      revision: 7,
      cacheable: true,
    });

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

    const options = mockRenderBadgeSvg.mock.calls[0]![1] as {
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

  // #1335 phase 4/5 — status placeholder states. v7.2 is the one rendered
  // policy now; the selector this used to also gate on is retired.
  describe("scoring status placeholder (#1335 phase 4)", () => {
    beforeEach(() => {
      mockSvgToPng.mockImplementation(async (svg: string) => new TextEncoder().encode(svg));
    });

    it("rasterizes the collecting state with no-store and skips materialize", async () => {
      mockReadScoringStatus.mockResolvedValue({ kind: "collecting", percent: 42, sources: [], hasPriorReceipt: false });
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      const body = new TextDecoder().decode(await res.arrayBuffer());
      expect(body).toContain('data-chapa-state="collecting"');
      expect(body).toContain("Scoring in progress, 42%");
      expect(res.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
      expect(mockMaterializePublicProfile).not.toHaveBeenCalled();
    });

    // #1342 -- a still-discovering job reports percent: null; the OG image
    // must draw the discovering heading, not a percentage.
    it("rasterizes the collecting state with a discovering heading when percent is null", async () => {
      mockReadScoringStatus.mockResolvedValue({ kind: "collecting", percent: null, sources: [], hasPriorReceipt: false });
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      const body = new TextDecoder().decode(await res.arrayBuffer());
      expect(body).toContain('data-chapa-state="collecting"');
      expect(body).toContain("Scoring in progress, discovering activity");
      expect(body).not.toMatch(/Scoring in progress, \d+%/);
    });

    it("rasterizes the action_needed state", async () => {
      mockReadScoringStatus.mockResolvedValue({ kind: "action_needed", sources: [], hasPriorReceipt: false });
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      const body = new TextDecoder().decode(await res.arrayBuffer());
      expect(body).toContain('data-chapa-state="action_needed"');
      expect(res.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    });

    it("rasterizes the unregistered state", async () => {
      mockReadScoringStatus.mockResolvedValue({ kind: "unregistered" });
      const [req, ctx] = makeRequest("testuser");
      const res = await GET(req, ctx);
      const body = new TextDecoder().decode(await res.arrayBuffer());
      expect(body).toContain('data-chapa-state="unregistered"');
      expect(body).toContain("Not on Chapa yet");
    });

    it("renders in Spanish when requested", async () => {
      mockReadScoringStatus.mockResolvedValue({ kind: "action_needed", sources: [], hasPriorReceipt: false });
      const [req, ctx] = makeRequest("testuser", "es");
      const res = await GET(req, ctx);
      const body = new TextDecoder().decode(await res.arrayBuffer());
      expect(body).toContain("Puntuación en pausa: se necesita una acción");
    });

    it("falls back to the normal pipeline when collecting WITH a prior receipt", async () => {
      mockReadScoringStatus.mockResolvedValue({ kind: "collecting", percent: 80, sources: [], hasPriorReceipt: true });
      const [req, ctx] = makeRequest("testuser");
      await GET(req, ctx);
      expect(mockMaterializePublicProfile).toHaveBeenCalled();
    });

    // #1335 phase 4 perf fix.
    describe("readScoringStatus skipped for a drawable current receipt", () => {
      it("never calls readScoringStatus on a cache MISS when a drawable receipt exists", async () => {
        mockHasDrawableCurrentReceipt.mockResolvedValue(true);
        const [req, ctx] = makeRequest("testuser");
        await GET(req, ctx);
        expect(mockHasDrawableCurrentReceipt).toHaveBeenCalledWith("testuser");
        expect(mockReadScoringStatus).not.toHaveBeenCalled();
        expect(mockMaterializePublicProfile).toHaveBeenCalled();
      });

      it("never calls readScoringStatus, and never runs materialize, on a warm cache HIT for a ready receipt", async () => {
        mockHasDrawableCurrentReceipt.mockResolvedValue(true);
        const version = "ice-terminal-v2-v7.2-2026-02-14-r7";
        mockCacheGet.mockResolvedValue({ version, pngBase64: FAKE_PNG_BASE64 });
        const [req, ctx] = makeRequest("testuser", "en", version);
        const res = await GET(req, ctx);
        expect(mockReadScoringStatus).not.toHaveBeenCalled();
        expect(mockMaterializePublicProfile).not.toHaveBeenCalled();
        expect(res.headers.get("Cache-Control")).not.toContain("no-store");
      });
    });

    // #1335 phase 4 fix — a failed authority read must never fall through
    // to whatever the normal materialize pipeline's OWN receipt lookup
    // produces when THAT also has no v7.2 receipt. See badge.svg's
    // equivalent describe block for the full rationale.
    describe("authority read failure (scoringStatus === null)", () => {
      it("still runs materialize and reports the read failure", async () => {
        mockReadScoringStatus.mockRejectedValue(new Error("boom"));
        const [req, ctx] = makeRequest("testuser");
        await GET(req, ctx);
        expect(mockMaterializePublicProfile).toHaveBeenCalled();
      });

      it("rasterizes the unavailable placeholder when materialize also has no drawable receipt", async () => {
        mockReadScoringStatus.mockRejectedValue(new Error("boom"));
        mockMaterializePublicProfile.mockResolvedValue({
          ...FAKE_MATERIALIZED,
          scoring: undefined,
        });
        const [req, ctx] = makeRequest("testuser");
        const res = await GET(req, ctx);
        const body = new TextDecoder().decode(await res.arrayBuffer());
        expect(body).toContain('data-chapa-state="unavailable"');
        expect(body).toContain("Scoring status unavailable");
        expect(res.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
        expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
        expect(body).not.toBe(FAKE_SVG);
      });

      it("rasterizes that receipt normally when materialize independently finds a real v7.2 receipt", async () => {
        mockReadScoringStatus.mockResolvedValue(null);
        const [req, ctx] = makeRequest("testuser");
        const res = await GET(req, ctx);
        const body = new TextDecoder().decode(await res.arrayBuffer());
        expect(body).not.toContain('data-chapa-state="unavailable"');
        expect(mockRenderBadgeSvg).toHaveBeenCalled();
        expect(body).toBe(FAKE_SVG);
      });

      it("renders in Spanish when requested", async () => {
        mockReadScoringStatus.mockResolvedValue(null);
        mockMaterializePublicProfile.mockResolvedValue({
          ...FAKE_MATERIALIZED,
          scoring: undefined,
        });
        const [req, ctx] = makeRequest("testuser", "es");
        const res = await GET(req, ctx);
        const body = new TextDecoder().decode(await res.arrayBuffer());
        expect(body).toContain("Estado de la puntuación no disponible");
      });
    });
  });
});
