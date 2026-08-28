import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CACHE_VERSION } from "@/lib/cache/version";
import {
  BADGE_RENDER_VARIANT,
  buildBadgeSvgCacheKey,
  buildBadgeSvgRenderLockKey,
} from "@/lib/render/badge-svg-cache";
import { toDateString } from "@/lib/utils/date";

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
  mockAfter,
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
  mockAfter: vi.fn(),
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

// #1013 — `after()` callbacks are captured (not auto-invoked) so tests can
// assert the route's response resolves without waiting on them, and can
// deterministically flush them via `flushAfterCallbacks()` below to assert
// on their effects (e.g. persistProfileSnapshot / deferProfileCacheWork).
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (cb: () => void | Promise<void>) => { mockAfter(cb); },
  };
});

import { GET } from "./route";

/** Invoke and await every `after()` callback registered so far by the route. */
async function flushAfterCallbacks(): Promise<void> {
  const callbacks = mockAfter.mock.calls.map(
    (call) => call[0] as () => void | Promise<void>,
  );
  await Promise.all(callbacks.map((cb) => cb()));
}

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
  search = "",
): [NextRequest, { params: Promise<{ handle: string }> }] {
  return [
    new NextRequest(`https://chapa.thecreativetoken.com/u/${handle}/badge.svg${search}`, { headers }),
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
    mockPersistProfileSnapshot.mockResolvedValue(true);
    mockDeferProfileCacheWork.mockResolvedValue(undefined);
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
      readOnly: false,
    });
  });

  it("renders the badge from displayImpact, not rawImpact", async () => {
    const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    // #1181 — the route now always threads a resolved `strings` bundle
    // through; see the "locale (#1181)" describe block below for coverage
    // of its exact shape. This test only cares about the pre-existing
    // avatar/verification/disableAnimation contract.
    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      FAKE_MATERIALIZED.displayImpact,
      expect.objectContaining({
        avatarDataUri: "data:image/png;base64,abc123",
        verificationHash: "abc12345",
        verificationDate: "2026-04-17",
        disableAnimation: true,
      }),
    );
  });

  // #760 — badge.svg is always consumed via <img> embeds, where SMIL <animate>
  // does not run. The route must request static (non-animated) heatmap cells.
  it("requests static (non-animated) rendering for img embeds", async () => {
    const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
    await GET(req, ctx);

    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      FAKE_MATERIALIZED.displayImpact,
      expect.objectContaining({ disableAnimation: true }),
    );
  });

  it("runs centralized public side effects with the same verification payload", async () => {
    const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
    await GET(req, ctx);
    // #1013 — persist + deferred cache work now run inside after(), so they
    // must be explicitly flushed before asserting on them.
    await flushAfterCallbacks();

    expect(mockPersistProfileSnapshot).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED,
      { readOnly: false },
    );
    expect(mockDeferProfileCacheWork).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED,
      {
        verification: { hash: "abc12345", date: "2026-04-17" },
        readOnly: false,
      },
    );
  });

  it("does not cache an unverified badge so a later complete fetch can heal", async () => {
    mockGetPublicProfileVerification.mockReturnValue(null);

    const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
    await GET(req, ctx);
    await flushAfterCallbacks();

    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      FAKE_MATERIALIZED.displayImpact,
      expect.objectContaining({
        verificationHash: undefined,
        verificationDate: undefined,
      }),
    );
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("passes read-only mode and skips SVG cache writes for smoke requests", async () => {
    mockPersistProfileSnapshot.mockResolvedValue(false);
    const [req, ctx] = makeRequest(
      "testuser",
      { "x-forwarded-for": "1.2.3.4" },
      "?__chapa_smoke=1",
    );
    await GET(req, ctx);
    await flushAfterCallbacks();

    expect(mockMaterializePublicProfile).toHaveBeenCalledWith("testuser", {
      token: undefined,
      readOnly: true,
    });
    expect(mockPersistProfileSnapshot).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED,
      { readOnly: true },
    );
    expect(mockDeferProfileCacheWork).not.toHaveBeenCalled();
    expect(mockRunPublicProfileSideEffects).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
    expect(mockGetAvatarBase64).not.toHaveBeenCalled();
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

  // #1013 — persistProfileSnapshot is a durable Supabase write with nothing in
  // the response depending on its result. It must run in after() so it can
  // never block (or, hypothetically, fail and destroy) an otherwise-successful
  // render.
  describe("deferred durable persistence (#1013)", () => {
    it("returns the response without waiting for persistProfileSnapshot to resolve", async () => {
      // Never resolves — if the route still awaited this inline on the
      // critical path (the pre-fix behavior), `await GET(...)` below would
      // hang forever and this test would time out.
      mockPersistProfileSnapshot.mockImplementation(
        () => new Promise<boolean>(() => undefined),
      );

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe(FAKE_SVG);
      // Not called on the synchronous path — only after() has scheduled it.
      expect(mockPersistProfileSnapshot).not.toHaveBeenCalled();
    });

    it("schedules persistProfileSnapshot inside after(), not on the synchronous path", async () => {
      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      // Not called yet — only after() has been registered with the work.
      expect(mockPersistProfileSnapshot).not.toHaveBeenCalled();
      expect(mockAfter).toHaveBeenCalledWith(expect.any(Function));

      await flushAfterCallbacks();

      expect(mockPersistProfileSnapshot).toHaveBeenCalledWith(
        "testuser",
        FAKE_MATERIALIZED,
        { readOnly: false },
      );
    });

    it("still captures/alerts via the existing error-handling path when the deferred work rejects", async () => {
      const persistError = new Error("supabase write failed");
      mockPersistProfileSnapshot.mockRejectedValue(persistError);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      // The response already succeeded — a deferred-work failure must not
      // retroactively turn a good render into an error response.
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(FAKE_SVG);
      expect(mockCaptureServerError).not.toHaveBeenCalled();

      await flushAfterCallbacks();

      // The existing captureServerError path (already used elsewhere in this
      // route for failures) still fires once the deferred work is flushed.
      expect(mockCaptureServerError).toHaveBeenCalledWith(
        expect.objectContaining({
          route: "/u/testuser/badge.svg",
          error: persistError,
        }),
      );
    });
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

  // #1029 (PE-L1) — a slow avatar CDN response was previously awaited in full
  // (up to the underlying fetch's own 2s abort), which could consume most of
  // the 3000ms cache-miss budget. The route now races the avatar fetch against
  // a tight deadline and renders with the placeholder rather than block,
  // mirroring the share page's existing pattern (#800) — including skipping
  // the shared SVG cache write so a later request can still pick up the real
  // avatar instead of poisoning the cache with the placeholder for 24h.
  describe("avatar fetch race (#1029 / PE-L1)", () => {
    it("returns well within 1s and renders the placeholder when the avatar fetch stalls past the deadline", async () => {
      vi.useFakeTimers();
      mockGetAvatarBase64.mockImplementation(
        () => new Promise<string | undefined>(() => undefined),
      );

      try {
        const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
        const responsePromise = GET(req, ctx);

        await vi.advanceTimersByTimeAsync(1000);
        const res = await responsePromise;

        expect(res.status).toBe(200);
        expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
          FAKE_MATERIALIZED.stats,
          FAKE_MATERIALIZED.displayImpact,
          expect.objectContaining({ avatarDataUri: undefined }),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("skips the shared SVG cache write when the avatar fetch timed out (does not poison the cache with a placeholder)", async () => {
      vi.useFakeTimers();
      mockGetAvatarBase64.mockImplementation(
        () => new Promise<string | undefined>(() => undefined),
      );

      try {
        const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
        const responsePromise = GET(req, ctx);

        await vi.advanceTimersByTimeAsync(1000);
        await responsePromise;

        expect(mockCacheSet).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("still writes the SVG cache when the avatar resolves within the deadline", async () => {
      mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);
      await flushAfterCallbacks();

      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge:${CACHE_VERSION}:testuser:${BADGE_RENDER_VARIANT}:`)),
        FAKE_SVG,
        expect.any(Number),
      );
    });

    it("writes the standard SVG cache when remote avatar absence is definitive", async () => {
      mockGetAvatarBase64.mockResolvedValue(undefined);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);
      await flushAfterCallbacks();

      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge:${CACHE_VERSION}:testuser:${BADGE_RENDER_VARIANT}:`)),
        FAKE_SVG,
        expect.any(Number),
      );
      expect(mockCacheSet.mock.calls[0]![2]).toBeGreaterThanOrEqual(86400);
    });

    // A transient avatar failure that settles before the deadline can still
    // heal on retry. It must not make the avatar-less SVG the 24-hour value.
    it("#1080: writes the SVG cache when the handle has no avatarUrl at all (nothing to fetch)", async () => {
      mockMaterializePublicProfile.mockResolvedValue({
        ...FAKE_MATERIALIZED,
        stats: { ...FAKE_MATERIALIZED.stats, avatarUrl: undefined },
      });

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);
      await flushAfterCallbacks();

      expect(mockGetAvatarBase64).not.toHaveBeenCalled();
      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge:${CACHE_VERSION}:testuser:${BADGE_RENDER_VARIANT}:`)),
        FAKE_SVG,
        expect.any(Number),
      );
    });

    it("withholds the SVG cache when the avatar fetch fails transiently before the deadline", async () => {
      mockGetAvatarBase64.mockRejectedValue(new Error("503 from CDN"));

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it("#1080: still withholds the SVG cache write when the avatar fetch genuinely times out against the deadline", async () => {
      vi.useFakeTimers();
      mockGetAvatarBase64.mockImplementation(
        () => new Promise<string | undefined>(() => undefined),
      );

      try {
        const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
        const responsePromise = GET(req, ctx);

        await vi.advanceTimersByTimeAsync(1000);
        await responsePromise;

        expect(mockCacheSet).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // #1088 (PE-M1) — a handle whose stats carry NO avatarUrl at all (a
  // permanent condition, not a race-timeout) was previously gated by the
  // same `avatarResolved` check as a genuine in-flight race loss, so the
  // shared SVG cache was NEVER populated for it — every single request
  // forced a full materialize+render forever. This must be distinguished
  // from the genuine race-timeout case above (#1029), which still must NOT
  // write the cache.
  describe("permanent avatar absence caching (#1088)", () => {
    const NO_AVATAR_MATERIALIZED = {
      ...FAKE_MATERIALIZED,
      stats: { ...FAKE_MATERIALIZED.stats, avatarUrl: undefined },
    };

    it("writes a short-TTL cache entry when stats.avatarUrl is absent (not attempted, not a race-timeout)", async () => {
      mockMaterializePublicProfile.mockResolvedValue(NO_AVATAR_MATERIALIZED);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);
      await flushAfterCallbacks();

      expect(res.status).toBe(200);
      // No avatarUrl to fetch — getAvatarBase64 must never be called.
      expect(mockGetAvatarBase64).not.toHaveBeenCalled();
      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge:${CACHE_VERSION}:testuser:${BADGE_RENDER_VARIANT}:`)),
        FAKE_SVG,
        expect.any(Number),
      );
      const ttl = mockCacheSet.mock.calls[0]![2] as number;
      // Short-TTL placeholder (15-30 min), not the full 24h+jitter write a
      // resolved avatar gets, and not zero/no-write like a race-timeout.
      expect(ttl).toBeGreaterThanOrEqual(900);
      expect(ttl).toBeLessThanOrEqual(1800);
    });

    it("the short-TTL write does not exceed a normal full-day write's TTL floor", async () => {
      mockMaterializePublicProfile.mockResolvedValue(NO_AVATAR_MATERIALIZED);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);
      await flushAfterCallbacks();

      const ttl = mockCacheSet.mock.calls[0]![2] as number;
      expect(ttl).toBeLessThan(86400);
    });

    it("does not write the cache at all for a genuine race-timeout (avatarUrl present, fetch too slow) — unaffected by the permanent-absence path", async () => {
      vi.useFakeTimers();
      mockGetAvatarBase64.mockImplementation(
        () => new Promise<string | undefined>(() => undefined),
      );

      try {
        const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
        const responsePromise = GET(req, ctx);
        await vi.advanceTimersByTimeAsync(1000);
        await responsePromise;

        expect(mockCacheSet).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("skips the cache write entirely when unverified, even with a permanently-absent avatar", async () => {
      mockMaterializePublicProfile.mockResolvedValue(NO_AVATAR_MATERIALIZED);
      mockGetPublicProfileVerification.mockReturnValue(null);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);
      await flushAfterCallbacks();

      expect(mockCacheSet).not.toHaveBeenCalled();
    });
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

    it("PE-M1: warm-cache hit skips the rate-limit round-trip entirely", async () => {
      // SVG cache hit — rate limiter must NOT be called (it's deferred to the miss branch)
      const CACHED_SVG = '<svg xmlns="http://www.w3.org/2000/svg">CACHED</svg>';
      mockCacheGet.mockResolvedValue(CACHED_SVG);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      expect(res.status).toBe(200);
      expect(mockRateLimit).not.toHaveBeenCalled();
    });

    it("PE-M1: rate limiter is still called on a cache miss", async () => {
      mockCacheGet.mockResolvedValue(null);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      expect(mockRateLimit).toHaveBeenCalledOnce();
    });

    it("writes the rendered SVG to cache on cache miss", async () => {
      mockCacheGet.mockResolvedValue(null);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);
      await flushAfterCallbacks();

      // TTL is base 24h + per-handle jitter of 0-2h (PE-S1)
      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge:${CACHE_VERSION}:testuser:${BADGE_RENDER_VARIANT}:`)),
        FAKE_SVG,
        expect.toSatisfy((ttl: number) => ttl >= 86400 && ttl <= 86400 + 7200),
      );
    });

    it("acquires and releases a versioned render lock on cold-cache renders", async () => {
      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      expect(mockCacheSetNx).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge-lock:${CACHE_VERSION}:testuser:${BADGE_RENDER_VARIANT}:`)),
        30,
      );
      expect(mockCacheDel).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge-lock:${CACHE_VERSION}:testuser:${BADGE_RENDER_VARIANT}:`)),
      );
    });

    it("checks the cache with the correct key prefix and handle", async () => {
      mockCacheGet.mockResolvedValue(null);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      expect(mockCacheGet).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge:${CACHE_VERSION}:testuser:${BADGE_RENDER_VARIANT}:`)),
      );
    });

    it("reuses cached SVG after another request already holds the render lock", async () => {
      mockCacheSetNx.mockResolvedValue(false);
      mockCacheGet
        .mockResolvedValueOnce(null)   // today's SVG cache miss
        .mockResolvedValueOnce(FAKE_SVG); // stale (yesterday) or poll hit

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      expect(await res.text()).toBe(FAKE_SVG);
      expect(mockMaterializePublicProfile).not.toHaveBeenCalled();
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
    });

    it("PE-M2: lock-loser returns yesterday's stale SVG promptly without long polling", async () => {
      const STALE_SVG = '<svg xmlns="http://www.w3.org/2000/svg">STALE</svg>';
      // Lock is held by another instance
      mockCacheSetNx.mockResolvedValue(false);
      mockCacheGet
        .mockResolvedValueOnce(null)       // today's SVG cache miss
        .mockResolvedValueOnce(STALE_SVG); // yesterday's stale key — return promptly

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      // Should serve stale SVG immediately (no polling delay, no render)
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(STALE_SVG);
      expect(mockMaterializePublicProfile).not.toHaveBeenCalled();
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
    });

    // #1029 — a render-lock loser with no stale SVG to fall back on used to
    // poll for the full 2000ms schedule before falling through to a full
    // materialize+render of its own, risking the 3000ms cache-miss SLO budget
    // in the worst case (poll timeout + full render). The poll budget was
    // reduced so this worst case still comfortably fits under budget.
    it("loser falls through to its own render comfortably under the 3000ms budget when poll is exhausted and no stale SVG exists", async () => {
      vi.useFakeTimers();
      mockCacheSetNx.mockResolvedValue(false); // another instance holds the render lock
      // No stale (yesterday) SVG and no SVG produced by the winner during our
      // poll window — every cache read (primary, stale, and every poll tick)
      // misses, simulating a brand-new handle with a slow concurrent winner.
      mockCacheGet.mockResolvedValue(null);

      try {
        const [req, ctx] = makeRequest("brandnewhandle", { "x-forwarded-for": "9.9.9.9" });
        const startedAt = Date.now();
        const responsePromise = GET(req, ctx);

        // Advancing only 1000ms (comfortably less than the old 2000ms poll
        // schedule) is now enough for the loser to exhaust its poll budget
        // AND complete its own fallback materialize+render.
        await vi.advanceTimersByTimeAsync(1000);
        const res = await responsePromise;
        const elapsedMs = Date.now() - startedAt;

        expect(res.status).toBe(200);
        expect(await res.text()).toBe(FAKE_SVG);
        expect(mockMaterializePublicProfile).toHaveBeenCalled();
        expect(elapsedMs).toBeLessThan(3000);
      } finally {
        vi.useRealTimers();
      }
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

        // #1014 — the read deadline was raised from 250ms to 500ms, so the
        // fail-open must be observed past the new deadline.
        await vi.advanceTimersByTimeAsync(600);
        const res = await responsePromise;

        expect(res.status).toBe(200);
        expect(mockMaterializePublicProfile).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    // #1014 — a read that exceeds the deadline is a timeout, not a genuine
    // miss, and must be surfaced distinctly in Server-Timing so it doesn't
    // silently look like normal cache churn in production.
    it("emits a distinguishable cache-timeout marker (not a plain miss) when the read exceeds the deadline", async () => {
      vi.useFakeTimers();
      mockCacheGet.mockImplementationOnce(
        () => new Promise<string | null>(() => undefined),
      );

      try {
        const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
        const responsePromise = GET(req, ctx);

        await vi.advanceTimersByTimeAsync(600);
        const res = await responsePromise;

        const timing = res.headers.get("Server-Timing");
        expect(timing).toMatch(/cache-timeout;dur=\d+/);
        // Must NOT be misclassified as a cache-hit by the latency-check
        // synthetic monitor's serverTimingIndicatesCacheHit (/\bcache;/).
        expect(timing).not.toMatch(/\bcache;/);
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

  // #1166 (PE-H2) — the cache-miss winner path previously awaited the shared
  // SVG cache write synchronously before the response was built, adding up to
  // 500ms to the response-blocking critical path for zero benefit (nothing in
  // the response depends on the write succeeding). The write must move to the
  // route's existing after() block, exactly like the durable side effects
  // already do (#1013) — but ONLY on the foreground winner path. The
  // background continuation (`warmBadgeCacheInBackground`, covered further
  // below) has no response to race and must keep awaiting it inline.
  describe("SVG cache write deferred to after() on the foreground path (#1166 / PE-H2)", () => {
    it("does not write the shared SVG cache before the response is returned", async () => {
      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      expect(res.status).toBe(200);
      // Not called on the synchronous path — only after() has scheduled it.
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it("schedules the SVG cache write inside after(), not on the synchronous path", async () => {
      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      expect(mockCacheSet).not.toHaveBeenCalled();
      expect(mockAfter).toHaveBeenCalledWith(expect.any(Function));

      await flushAfterCallbacks();

      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^badge:${CACHE_VERSION}:testuser:${BADGE_RENDER_VARIANT}:`)),
        FAKE_SVG,
        expect.any(Number),
      );
    });

    it("still writes the cache and runs durable side effects exactly once each", async () => {
      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);
      await flushAfterCallbacks();

      expect(mockCacheSet).toHaveBeenCalledTimes(1);
      expect(mockPersistProfileSnapshot).toHaveBeenCalledTimes(1);
      expect(mockDeferProfileCacheWork).toHaveBeenCalledTimes(1);
    });

    // `writeBadgeSvgCache` itself fails open (`withCacheFallback` catches and
    // returns `false` — the SVG cache is deliberately best-effort, unlike the
    // durable Supabase snapshot write). A rejected underlying `cacheSet` call
    // must therefore never surface as a thrown error out of the deferred
    // after() write, and must not prevent the durable side effects that run
    // alongside it in the same after() registration.
    it("a failed deferred cache write does not affect the already-returned response or block durable side effects", async () => {
      mockCacheSet.mockRejectedValue(new Error("redis write failed"));

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe(FAKE_SVG);

      await flushAfterCallbacks();

      expect(mockCaptureServerError).not.toHaveBeenCalled();
      expect(mockPersistProfileSnapshot).toHaveBeenCalledWith(
        "testuser",
        FAKE_MATERIALIZED,
        { readOnly: false },
      );
    });
  });

  // #1166 (BE-M1) — `readOnly` (the public `__chapa_smoke=1` probe) must never
  // change the shared Redis SVG cache key or the render-lock key: both are
  // consumed by the share page too, and a smoke probe taking its own
  // independent render-lock would double GitHub fetches at date rollover.
  // Only the in-memory `inflightBadgeRenders` coalescing map (same-instance
  // dedup only) may distinguish readOnly from normal requests.
  describe("readOnly does not fork the shared cache/lock keys (#1166 / BE-M1)", () => {
    it("uses the exact shared cache key and render-lock key for a readOnly (smoke) request", async () => {
      const today = toDateString(new Date());
      const [req, ctx] = makeRequest(
        "testuser",
        { "x-forwarded-for": "1.2.3.4" },
        "?__chapa_smoke=1",
      );
      await GET(req, ctx);

      expect(mockCacheGet).toHaveBeenCalledWith(
        buildBadgeSvgCacheKey("testuser", today),
      );
      expect(mockCacheSetNx).toHaveBeenCalledWith(
        buildBadgeSvgRenderLockKey("testuser", today),
        30,
      );
    });
  });

  // #1086 (PE-H1) — nothing bounded the SUM of the cache-miss path's steps;
  // materializePublicProfile alone could take up to the 30s inflight cap, on
  // top of the route's own cache/lock/avatar ceilings. The route now races
  // materialize against a hard deadline, but ONLY when a stale (yesterday's)
  // SVG exists to fall back on — a brand-new handle with no stale key must
  // not be starved by a cutoff shorter than a legitimate cold GitHub fetch.
  describe("materialize deadline fallback (#1086 / PE-H1)", () => {
    const STALE_SVG = '<svg xmlns="http://www.w3.org/2000/svg">STALE</svg>';

    function deferredMaterialize() {
      let resolve!: (value: typeof FAKE_MATERIALIZED) => void;
      const promise = new Promise<typeof FAKE_MATERIALIZED>((res) => {
        resolve = res;
      });
      mockMaterializePublicProfile.mockReturnValue(promise);
      return { resolve };
    }

    it("serves yesterday's stale SVG once materialize exceeds the deadline, then finishes materializing (and warms the cache) in the background", async () => {
      vi.useFakeTimers();
      try {
        mockCacheGet
          .mockResolvedValueOnce(null) // today's SVG cache: miss
          .mockResolvedValueOnce(STALE_SVG); // yesterday's stale SVG: hit
        const { resolve } = deferredMaterialize();

        const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
        const responsePromise = GET(req, ctx);

        // Past the deadline — materialize still hasn't resolved.
        await vi.advanceTimersByTimeAsync(2300);
        const res = await responsePromise;

        expect(res.status).toBe(200);
        expect(await res.text()).toBe(STALE_SVG);
        // A short s-maxage — this is a degraded response, not the normal
        // 24h-cacheable badge.
        const cacheControl = res.headers.get("Cache-Control");
        expect(cacheControl).toMatch(/s-maxage=\d+/);
        expect(cacheControl).not.toBe(
          "public, s-maxage=21600, stale-while-revalidate=86400",
        );
        // The full render pipeline has not run yet — we returned before
        // materialize settled.
        expect(mockRenderBadgeSvg).not.toHaveBeenCalled();

        // Now let the original materialize call finish in the background.
        resolve(FAKE_MATERIALIZED);
        await flushAfterCallbacks();

        expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
          FAKE_MATERIALIZED.stats,
          FAKE_MATERIALIZED.displayImpact,
          expect.objectContaining({ disableAnimation: true }),
        );
        // The next request for this handle is warmed with the real render.
        expect(mockCacheSet).toHaveBeenCalledWith(
          expect.stringMatching(new RegExp(`^badge:${CACHE_VERSION}:testuser:${BADGE_RENDER_VARIANT}:`)),
          FAKE_SVG,
          expect.any(Number),
        );
        expect(mockPersistProfileSnapshot).toHaveBeenCalledWith(
          "testuser",
          FAKE_MATERIALIZED,
          { readOnly: false },
        );
        expect(mockDeferProfileCacheWork).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    // #1166 (PE-H2) — `warmBadgeCacheInBackground` is the ONE caller that must
    // keep AWAITING the SVG cache write: it runs entirely inside after(), has
    // no response to race, and cache warming is its whole purpose. Unlike the
    // foreground winner path (deferred above), its write must complete before
    // its durable side effects run — not merely be scheduled.
    it("warmBadgeCacheInBackground awaits the SVG cache write before running durable side effects", async () => {
      vi.useFakeTimers();
      try {
        const order: string[] = [];
        mockCacheSet.mockImplementation(async () => {
          order.push("cacheSet-start");
          await new Promise((resolve) => setTimeout(resolve, 50));
          order.push("cacheSet-end");
          return true;
        });
        mockPersistProfileSnapshot.mockImplementation(async () => {
          order.push("persist");
          return true;
        });

        mockCacheGet
          .mockResolvedValueOnce(null) // today's SVG cache: miss
          .mockResolvedValueOnce(STALE_SVG); // yesterday's stale SVG: hit
        const { resolve } = deferredMaterialize();

        const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
        const responsePromise = GET(req, ctx);

        await vi.advanceTimersByTimeAsync(2300);
        await responsePromise;

        resolve(FAKE_MATERIALIZED);
        const flushPromise = flushAfterCallbacks();
        await vi.advanceTimersByTimeAsync(50);
        await flushPromise;

        expect(order).toEqual(["cacheSet-start", "cacheSet-end", "persist"]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not apply the deadline when no stale SVG exists — first-time badge generation is not starved", async () => {
      vi.useFakeTimers();
      try {
        // Neither today's nor yesterday's key has anything cached.
        mockCacheGet.mockResolvedValue(null);
        mockMaterializePublicProfile.mockImplementation(
          () =>
            new Promise((resolve) => {
              // Resolves well past the deadline, but this is a legitimate
              // cold fetch — it must not be cut off early.
              setTimeout(() => resolve(FAKE_MATERIALIZED), 2500);
            }),
        );

        const [req, ctx] = makeRequest("brandnewhandle", { "x-forwarded-for": "9.9.9.9" });
        const responsePromise = GET(req, ctx);

        await vi.advanceTimersByTimeAsync(2500);
        const res = await responsePromise;

        expect(res.status).toBe(200);
        expect(await res.text()).toBe(FAKE_SVG);
        expect(mockRenderBadgeSvg).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not race a read-only (smoke) request against the deadline even when a stale SVG exists", async () => {
      vi.useFakeTimers();
      try {
        mockCacheGet
          .mockResolvedValueOnce(null) // today's SVG cache: miss
          .mockResolvedValueOnce(STALE_SVG); // yesterday's stale SVG: hit
        mockMaterializePublicProfile.mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(FAKE_MATERIALIZED), 2500);
            }),
        );

        const [req, ctx] = makeRequest(
          "testuser",
          { "x-forwarded-for": "1.2.3.4" },
          "?__chapa_smoke=1",
        );
        const responsePromise = GET(req, ctx);

        await vi.advanceTimersByTimeAsync(2500);
        const res = await responsePromise;

        // The smoke request waited for the real (slow) materialize result
        // rather than short-circuiting to the stale SVG.
        expect(await res.text()).toBe(FAKE_SVG);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("Server-Timing latency instrumentation (#974)", () => {
    it("emits a cache metric and total duration on a cache hit", async () => {
      mockCacheGet.mockResolvedValue(FAKE_SVG);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      const timing = res.headers.get("Server-Timing");
      expect(timing).toBeTruthy();
      expect(timing).toMatch(/cache;/);
      expect(timing).toMatch(/total;dur=\d+/);
    });

    it("emits a materialize + render breakdown with total on a cache miss", async () => {
      mockCacheGet.mockResolvedValue(null);

      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const res = await GET(req, ctx);

      const timing = res.headers.get("Server-Timing");
      expect(timing).toMatch(/materialize;dur=\d+/);
      expect(timing).toMatch(/render;dur=\d+/);
      expect(timing).toMatch(/total;dur=\d+/);
      // A cache-miss must NOT report a cache metric — the synthetic monitor
      // relies on its absence to select the cache-miss SLO budget.
      expect(timing).not.toMatch(/cache;/);
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

  // ---------------------------------------------------------------------------
  // Locale (#1181 UX-H3) — `renderBadgeSvg` stays pure; the route resolves a
  // `?lang=` query param (falling back to DEFAULT_LOCALE) via the real
  // `getServerT`/dictionaries (no mocking — this exercises the real wiring)
  // and threads the resolved strings + locale into the render call and the
  // shared SVG cache key.
  // ---------------------------------------------------------------------------

  describe("locale (#1181)", () => {
    it("resolves badge strings from the default locale (en) when no ?lang= is given", async () => {
      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_MATERIALIZED.stats,
        FAKE_MATERIALIZED.displayImpact,
        expect.objectContaining({
          strings: expect.objectContaining({
            metricsVerified: "Verified metrics",
            tierLabel: "Solid", // tiers.solid (displayImpact.tier === "Solid")
            radarLabels: expect.objectContaining({
              delivery: "Delivery",
              quality: "Quality",
              consistency: "Consistency",
              breadth: "Breadth",
            }),
            radarNoData: "no data yet",
            verifiedLabel: "VERIFIED",
          }),
        }),
      );
    });

    it("resolves badge strings from ?lang=es", async () => {
      const [req, ctx] = makeRequest(
        "testuser",
        { "x-forwarded-for": "1.2.3.4" },
        "?lang=es",
      );
      await GET(req, ctx);

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_MATERIALIZED.stats,
        FAKE_MATERIALIZED.displayImpact,
        expect.objectContaining({
          strings: expect.objectContaining({
            metricsVerified: "Métricas verificadas",
            tierLabel: "Sólido", // tiers.solid (displayImpact.tier === "Solid")
            radarLabels: expect.objectContaining({
              delivery: "Entrega",
              quality: "Calidad",
              consistency: "Constancia",
              breadth: "Alcance",
            }),
            radarNoData: "aún sin datos",
            verifiedLabel: "VERIFICADO",
          }),
        }),
      );
    });

    it("falls back to the default locale (en) for an unsupported ?lang= value", async () => {
      const [req, ctx] = makeRequest(
        "testuser",
        { "x-forwarded-for": "1.2.3.4" },
        "?lang=fr",
      );
      await GET(req, ctx);

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_MATERIALIZED.stats,
        FAKE_MATERIALIZED.displayImpact,
        expect.objectContaining({
          strings: expect.objectContaining({ metricsVerified: "Verified metrics" }),
        }),
      );
    });

    it("includes the locale in the shared SVG cache key so es/en never collide", async () => {
      const today = toDateString(new Date());

      const [reqEs, ctxEs] = makeRequest(
        "testuser",
        { "x-forwarded-for": "1.2.3.4" },
        "?lang=es",
      );
      await GET(reqEs, ctxEs);
      expect(mockCacheGet).toHaveBeenCalledWith(
        buildBadgeSvgCacheKey("testuser", today, "es"),
      );

      vi.clearAllMocks();
      mockIsValidHandle.mockReturnValue(true);
      mockRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 100 });
      mockMaterializePublicProfile.mockResolvedValue(FAKE_MATERIALIZED);
      mockGetPublicProfileVerification.mockReturnValue({ hash: "abc12345", date: "2026-04-17" });
      mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
      mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
      mockCacheGet.mockResolvedValue(null);
      mockCacheSetNx.mockResolvedValue(true);

      const [reqEn, ctxEn] = makeRequest(
        "testuser",
        { "x-forwarded-for": "1.2.3.4" },
        "?lang=en",
      );
      await GET(reqEn, ctxEn);
      expect(mockCacheGet).toHaveBeenCalledWith(
        buildBadgeSvgCacheKey("testuser", today, "en"),
      );
    });

    it("still produces the exact pre-#1181 key format for the default locale (en), buildBadgeSvgCacheKey's own 2-arg default", async () => {
      // buildBadgeSvgCacheKey/buildBadgeSvgRenderLockKey default their locale
      // param to DEFAULT_LOCALE, so out-of-scope callers that still pass
      // only (handle, date) — the share page, warm-cache cron, platform-oauth
      // invalidation, post-write-invalidation — land on the exact same slot
      // the route uses for an unqualified (no ?lang=) request.
      const today = toDateString(new Date());
      const [req, ctx] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      await GET(req, ctx);

      expect(mockCacheGet).toHaveBeenCalledWith(buildBadgeSvgCacheKey("testuser", today));
    });

    it("localizes the invalid-handle fallback SVG", async () => {
      mockIsValidHandle.mockReturnValue(false);

      const [reqEs, ctxEs] = makeRequest("bad!!handle", {}, "?lang=es");
      const resEs = await GET(reqEs, ctxEs);
      expect(await resEs.text()).toContain("Usuario de GitHub no válido.");

      // No ?lang= at all, the embed case, which must now be English (#1201).
      const [reqEn, ctxEn] = makeRequest("bad!!handle");
      const resEn = await GET(reqEn, ctxEn);
      expect(await resEn.text()).toContain("Invalid GitHub handle.");
    });

    it("localizes the 'could not load data' fallback SVG when materialize returns null", async () => {
      mockMaterializePublicProfile.mockResolvedValue(null);

      const [reqEs, ctxEs] = makeRequest(
        "testuser",
        { "x-forwarded-for": "1.2.3.4" },
        "?lang=es",
      );
      const resEs = await GET(reqEs, ctxEs);
      expect(await resEs.text()).toContain("No se pudieron cargar los datos.");

      // No ?lang= at all, the embed case, which must now be English (#1201).
      const [reqEn, ctxEn] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const resEn = await GET(reqEn, ctxEn);
      expect(await resEn.text()).toContain("Could not load data.");
    });

    it("localizes the catch-all error fallback SVG", async () => {
      mockMaterializePublicProfile.mockRejectedValue(new Error("boom"));

      const [reqEs, ctxEs] = makeRequest(
        "testuser",
        { "x-forwarded-for": "1.2.3.4" },
        "?lang=es",
      );
      const resEs = await GET(reqEs, ctxEs);
      expect(resEs.status).toBe(500);
      expect(await resEs.text()).toContain("Algo salió mal.");

      // No ?lang= at all, the embed case, which must now be English (#1201).
      const [reqEn, ctxEn] = makeRequest("testuser", { "x-forwarded-for": "1.2.3.4" });
      const resEn = await GET(reqEn, ctxEn);
      expect(await resEn.text()).toContain("Something went wrong.");
    });
  });
});
