import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockMaterializePublicProfile,
  mockGetPublicProfileVerification,
  mockRunPublicProfileSideEffects,
  mockPersistProfileSnapshot,
  mockDeferProfileCacheWork,
  mockRedactImpactForVisitor,
  mockIsValidHandle,
  mockGetAvatarBase64,
  mockRenderBadgeSvg,
  mockAfter,
  mockGetServerLocale,
  mockGetTrendData,
  mockHeaders,
  mockGetOptionalServerSessionFromHeaders,
  mockWriteBadgeSvgCache,
  mockCaptureServerError,
} = vi.hoisted(() => ({
  mockMaterializePublicProfile: vi.fn(),
  mockGetPublicProfileVerification: vi.fn(),
  mockRunPublicProfileSideEffects: vi.fn(),
  mockPersistProfileSnapshot: vi.fn(),
  mockDeferProfileCacheWork: vi.fn(),
  mockRedactImpactForVisitor: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockAfter: vi.fn(),
  mockGetServerLocale: vi.fn(),
  mockGetTrendData: vi.fn(),
  mockHeaders: vi.fn(),
  mockGetOptionalServerSessionFromHeaders: vi.fn(),
  mockWriteBadgeSvgCache: vi.fn(),
  mockCaptureServerError: vi.fn(),
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
  redactImpactForVisitor: (...args: unknown[]) =>
    mockRedactImpactForVisitor(...args),
}));

vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => mockHeaders(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalServerSessionFromHeaders: (...args: unknown[]) =>
    mockGetOptionalServerSessionFromHeaders(...args),
}));

vi.mock("@/lib/history/get-trend-data", () => ({
  getTrendData: (...args: unknown[]) => mockGetTrendData(...args),
}));

vi.mock("@/lib/feature-flags", () => ({
  isWebmcpEnabled: vi.fn().mockResolvedValue(true),
}));

// #1091 — the after()-deferred snapshot write must escalate a genuine
// failure via captureServerError, mirroring the badge route's #1013 pattern.
vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: (...args: unknown[]) => mockIsValidHandle(...args),
}));

vi.mock("@/lib/render/avatar", () => ({
  getAvatarBase64: (...args: unknown[]) => mockGetAvatarBase64(...args),
}));

vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: (...args: unknown[]) => mockRenderBadgeSvg(...args),
}));

// #1088 — writeBadgeSvgCache is mocked so tests can assert on its TTL
// argument directly; buildBadgeSvgCacheKey/readBadgeSvgCache stay real
// (readBadgeSvgCache falls through to the real, unmocked `@/lib/cache/redis`
// module, which no-ops without Redis credentials in the test env — matching
// this file's existing always-cache-miss behavior).
vi.mock("@/lib/render/badge-svg-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/render/badge-svg-cache")>();
  return {
    ...actual,
    writeBadgeSvgCache: (...args: unknown[]) => mockWriteBadgeSvgCache(...args),
  };
});

vi.mock("@/lib/env", () => ({
  getBaseUrl: () => "https://chapa.thecreativetoken.com",
}));

vi.mock("@/lib/utils/date", () => ({
  toDateString: () => "2026-04-17",
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: mockAfter,
  };
});

const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    mockNotFound();
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("@/lib/i18n/server", async () => {
  const { getServerT } = await import("@/lib/i18n/server");
  return {
    getServerLocale: (...args: unknown[]) => mockGetServerLocale(...args),
    getServerT,
  };
});

vi.mock("@/lib/i18n", () => ({
  DEFAULT_LOCALE: "es",
  LocaleSync: () => null,
  LanguageProvider: (props: { children?: unknown }) => props.children,
}));

vi.mock("@/components/ErrorBanner", () => ({
  ErrorBanner: () => null,
}));

vi.mock("@/components/CommandBarHint", () => ({
  CommandBarHint: () => null,
}));
vi.mock("@/components/NavbarClient", () => ({
  NavbarClient: () => "<nav />",
}));
vi.mock("@/components/SharePageShortcuts", () => ({
  SharePageShortcuts: () => null,
}));
vi.mock("@/components/BadgeToolbar", () => ({
  BadgeToolbar: () => "<div>toolbar</div>",
}));
vi.mock("@/components/SharePageOwnerContent", () => ({
  SharePageOwnerContent: () => "<div>owner-content</div>",
}));
vi.mock("@/components/BadgeSkeleton", () => ({
  BadgeSkeleton: () => null,
}));

import SharePage, { SharePageContent, generateMetadata } from "./page";
import { SharePageOwnerContentLazy } from "@/components/SharePageOwnerContentLazy";
import { ErrorBanner } from "@/components/ErrorBanner";

/**
 * Recursively walk a rendered React element tree (as returned by an async
 * server component, not yet actually rendered to DOM) to find the first
 * element matching `predicate`. Used to inspect props passed to a specific
 * descendant without needing a full DOM render.
 */
function findElement(
  node: unknown,
  predicate: (el: { type: unknown; props: Record<string, unknown> }) => boolean,
): { type: unknown; props: Record<string, unknown> } | null {
  if (node == null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  const el = node as { type?: unknown; props?: Record<string, unknown> };
  if ("type" in el && "props" in el) {
    if (predicate(el as { type: unknown; props: Record<string, unknown> })) {
      return el as { type: unknown; props: Record<string, unknown> };
    }
    return findElement(el.props?.children, predicate);
  }
  return null;
}

const FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg">BADGE</svg>';

const FAKE_MATERIALIZED = {
  stats: {
    handle: "testuser",
    displayName: "Test User",
    avatarUrl: "https://avatars.githubusercontent.com/u/12345",
    fetchedAt: "2026-04-17T00:00:00Z",
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
  snapshot: { date: "2026-04-17", adjustedComposite: 65, tier: "Solid" },
};

async function renderPage(handle = "testuser") {
  return SharePageContent({ handle });
}

describe("SharePage /u/[handle]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidHandle.mockReturnValue(true);
    mockMaterializePublicProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockGetPublicProfileVerification.mockReturnValue({ hash: "abc12345", date: "2026-04-17" });
    mockRunPublicProfileSideEffects.mockResolvedValue(undefined);
    mockPersistProfileSnapshot.mockResolvedValue(true);
    mockDeferProfileCacheWork.mockResolvedValue(undefined);
    mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockWriteBadgeSvgCache.mockResolvedValue(true);
    mockGetServerLocale.mockResolvedValue("en");
    mockGetTrendData.mockResolvedValue({ trend: null, diff: null });
    mockHeaders.mockResolvedValue({ get: () => null });
    mockCaptureServerError.mockResolvedValue(undefined);
    // No session by default — most tests exercise the visitor path. Tests
    // that need owner behavior override this per-test.
    mockGetOptionalServerSessionFromHeaders.mockReturnValue(null);
    mockRedactImpactForVisitor.mockImplementation((impact: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { confidence: _confidence, confidencePenalties: _confidencePenalties, ...rest } = impact;
      return rest;
    });
  });

  it("generates metadata with the daily OG cache buster", async () => {
    // #1066 — locale now resolves via getServerLocale (mocked here to the
    // "es" cookie/header-fallback default) rather than a hardcoded literal;
    // this test is about the OG cache-buster URL, not locale resolution
    // itself (see the "locale resolution (#1066)" describe block for that).
    mockGetServerLocale.mockResolvedValue("es");

    const metadata = await generateMetadata({
      params: Promise.resolve({ handle: "testuser" }),
    });

    expect(metadata.openGraph?.images).toEqual([
      {
        url: "https://chapa.thecreativetoken.com/u/testuser/og-image?v=2026-04-17",
        width: 1200,
        height: 630,
        alt: "Chapa de testuser",
      },
    ]);
  });

  it("calls notFound for an invalid handle", async () => {
    mockIsValidHandle.mockReturnValue(false);

    await expect(
      SharePage({ params: Promise.resolve({ handle: "bad!!handle" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  // #1066 (FE-H2) — the route now commits to dynamic rendering and resolves
  // locale via getServerLocale (query override > chapa-locale cookie >
  // Accept-Language > DEFAULT_LOCALE — see lib/i18n/server.ts, already
  // covered by its own unit tests). These tests assert page.tsx wires the
  // query param through correctly and that generateMetadata/body agree.
  describe("locale resolution (#1066)", () => {
    it("generateMetadata resolves locale via getServerLocale using the ?lang= override", async () => {
      mockGetServerLocale.mockResolvedValue("en");

      await generateMetadata({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({ lang: "en" }),
      });

      // #1020 contract: an explicit ?lang= must win over any cookie —
      // asserting the literal value is forwarded (not dropped) is what
      // guarantees that precedence downstream in getServerLocale.
      expect(mockGetServerLocale).toHaveBeenCalledWith("en");
    });

    it("generateMetadata falls through to cookie/header resolution when ?lang= is absent", async () => {
      mockGetServerLocale.mockResolvedValue("es");

      await generateMetadata({
        params: Promise.resolve({ handle: "testuser" }),
      });

      expect(mockGetServerLocale).toHaveBeenCalledWith(null);
    });

    it("SharePage's LanguageProvider uses the ?lang= override for the body locale", async () => {
      mockGetServerLocale.mockResolvedValue("en");

      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({ lang: "en" }),
      });

      expect(mockGetServerLocale).toHaveBeenCalledWith("en");
      const provider = findElement(
        result,
        (el) => !!el.props && "initialLocale" in el.props,
      );
      expect(provider).not.toBeNull();
      expect(provider!.props.initialLocale).toBe("en");
    });

    it("SharePage's LanguageProvider falls back to the cookie-resolved locale when ?lang= is absent", async () => {
      // getServerLocale is mocked here to stand in for a real cookie read
      // (its own precedence order is covered by lib/i18n/server.test.ts) —
      // this test only asserts page.tsx defers to it rather than
      // hardcoding "es".
      mockGetServerLocale.mockResolvedValue("es");

      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({}),
      });

      expect(mockGetServerLocale).toHaveBeenCalledWith(null);
      const provider = findElement(
        result,
        (el) => !!el.props && "initialLocale" in el.props,
      );
      expect(provider!.props.initialLocale).toBe("es");
    });

    it("generateMetadata and the body resolve to the same locale for an identical request", async () => {
      mockGetServerLocale.mockResolvedValue("en");

      await generateMetadata({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({ lang: "en" }),
      });
      const bodyResult = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({ lang: "en" }),
      });

      const forwardedValues = mockGetServerLocale.mock.calls.map((args) => args[0]);
      expect(forwardedValues.every((value) => value === "en")).toBe(true);
      const provider = findElement(
        bodyResult,
        (el) => !!el.props && "initialLocale" in el.props,
      );
      expect(provider!.props.initialLocale).toBe("en");
    });
  });

  // #1107 (UX-H1) — every platform OAuth (Bitbucket/Codeberg/GitLab)
  // connect/callback failure branch in lib/auth/platform-oauth.ts redirects
  // back to this exact page as `?error=<platform>_<code>`. Read server-side
  // (the route is already dynamic per #1066), not via the client
  // useSyncExternalStore leaf the landing page uses — that pattern exists
  // solely to avoid opting a static page out of ISR, which is moot here.
  describe("platform OAuth error banner (#1107)", () => {
    it("renders an ErrorBanner with a platform-aware message when ?error=<platform>_<code> is present", async () => {
      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({ error: "gitlab_token_exchange" }),
      });

      const banner = findElement(result, (el) => el.type === ErrorBanner);
      expect(banner).not.toBeNull();
      expect(banner!.props.message as string).toContain("GitLab");
    });

    it("renders the OAuth error in the resolved Spanish locale", async () => {
      mockGetServerLocale.mockResolvedValue("es");

      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({ error: "gitlab_token_exchange", lang: "es" }),
      });

      const banner = findElement(result, (el) => el.type === ErrorBanner);
      expect(banner!.props.message).toBe(
        "No pudimos conectar tu cuenta de GitLab. Inténtalo de nuevo.",
      );
    });

    it("renders no ErrorBanner when there is no error query param", async () => {
      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({}),
      });

      const banner = findElement(result, (el) => el.type === ErrorBanner);
      expect(banner).toBeNull();
    });

    it("renders no ErrorBanner for an unrelated query string", async () => {
      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({ lang: "en" }),
      });

      const banner = findElement(result, (el) => el.type === ErrorBanner);
      expect(banner).toBeNull();
    });

    it("recognizes the base GitHub session_storage code too (#1107 gap fix)", async () => {
      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({ error: "session_storage" }),
      });

      const banner = findElement(result, (el) => el.type === ErrorBanner);
      expect(banner).not.toBeNull();
      expect(typeof banner!.props.message).toBe("string");
    });
  });

  // #1067 (FE-M1) — confidence/confidencePenalties must never reach the
  // client-serialized props for a non-owner request. Ownership is resolved
  // server-side (via the session cookie), not client-side, so it can gate
  // what data is SENT, not just what is displayed.
  describe("owner-only confidence redaction (#1067)", () => {
    it("resolves the session via headers() + getOptionalServerSessionFromHeaders", async () => {
      const fakeHeaderStore = { get: () => null };
      mockHeaders.mockResolvedValue(fakeHeaderStore);

      await renderPage("testuser");

      expect(mockGetOptionalServerSessionFromHeaders).toHaveBeenCalledWith(fakeHeaderStore);
    });

    it("passes the redacted impact when there is no session (anonymous visitor)", async () => {
      mockGetOptionalServerSessionFromHeaders.mockReturnValue(null);

      const result = await renderPage("testuser");

      expect(mockRedactImpactForVisitor).toHaveBeenCalledWith(FAKE_MATERIALIZED.displayImpact);
      const ownerEl = findElement(result, (el) => el.type === SharePageOwnerContentLazy);
      const impactProp = ownerEl!.props.impact as Record<string, unknown>;
      expect("confidence" in impactProp).toBe(false);
      expect("confidencePenalties" in impactProp).toBe(false);
    });

    it("passes the redacted impact when a different user's session is present", async () => {
      mockGetOptionalServerSessionFromHeaders.mockReturnValue({ login: "someone-else" });

      const result = await renderPage("testuser");

      expect(mockRedactImpactForVisitor).toHaveBeenCalledWith(FAKE_MATERIALIZED.displayImpact);
      const ownerEl = findElement(result, (el) => el.type === SharePageOwnerContentLazy);
      const impactProp = ownerEl!.props.impact as Record<string, unknown>;
      expect("confidence" in impactProp).toBe(false);
    });

    it("passes the FULL impact (including confidence) when the session matches the handle", async () => {
      mockGetOptionalServerSessionFromHeaders.mockReturnValue({ login: "testuser" });

      const result = await renderPage("testuser");

      expect(mockRedactImpactForVisitor).not.toHaveBeenCalled();
      const ownerEl = findElement(result, (el) => el.type === SharePageOwnerContentLazy);
      expect(ownerEl!.props.impact).toEqual(FAKE_MATERIALIZED.displayImpact);
    });

    it("never redacts the impact used to render the inline badge SVG (server-only, not client-serialized)", async () => {
      mockGetOptionalServerSessionFromHeaders.mockReturnValue(null);

      await renderPage("testuser");

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_MATERIALIZED.stats,
        FAKE_MATERIALIZED.displayImpact,
        expect.anything(),
      );
    });
  });

  it("renders the inline badge from displayImpact, not rawImpact", async () => {
    await renderPage();

    expect(mockMaterializePublicProfile).toHaveBeenCalledWith("testuser", {
      readOnly: false,
    });
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

  it("registers centralized public side effects when inline svg is rendered", async () => {
    await renderPage();

    expect(mockAfter).toHaveBeenCalledTimes(1);
    const callback = mockAfter.mock.calls[0][0];
    await callback();

    expect(mockPersistProfileSnapshot).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED,
      { readOnly: false },
    );
    expect(mockDeferProfileCacheWork).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED,
      { verification: { hash: "abc12345", date: "2026-04-17" } },
    );
  });

  // #1091 (PE-M6) — persistProfileSnapshot is a durable Supabase write with
  // nothing in the rendered HTML depending on its result. It must not hold
  // TTFB open, mirroring the badge route's #1013 fix.
  describe("durable snapshot write deferred to after() (#1091)", () => {
    it("does not await the durable snapshot write on the render path — only after() invokes it", async () => {
      await renderPage();

      // The render call itself must return without having invoked the
      // durable write directly.
      expect(mockPersistProfileSnapshot).not.toHaveBeenCalled();
      expect(mockAfter).toHaveBeenCalledTimes(1);

      const callback = mockAfter.mock.calls[0][0];
      await callback();

      expect(mockPersistProfileSnapshot).toHaveBeenCalledWith(
        "testuser",
        FAKE_MATERIALIZED,
        { readOnly: false },
      );
      expect(mockDeferProfileCacheWork).toHaveBeenCalledWith(
        "testuser",
        FAKE_MATERIALIZED,
        { verification: { hash: "abc12345", date: "2026-04-17" } },
      );
    });

    it("skips deferProfileCacheWork when persistProfileSnapshot resolves false", async () => {
      mockPersistProfileSnapshot.mockResolvedValue(false);

      await renderPage();
      const callback = mockAfter.mock.calls[0][0];
      await callback();

      expect(mockDeferProfileCacheWork).not.toHaveBeenCalled();
    });

    it("escalates a deferred snapshot-write failure via captureServerError instead of swallowing it", async () => {
      const writeError = new Error("supabase write failed");
      mockPersistProfileSnapshot.mockRejectedValue(writeError);

      await renderPage();
      const callback = mockAfter.mock.calls[0][0];

      // The after() callback itself must never throw/reject — a durable
      // write failure must be observable, not surfaced as an unhandled
      // rejection in the after() runtime.
      await expect(callback()).resolves.not.toThrow();

      expect(mockCaptureServerError).toHaveBeenCalledWith(
        expect.objectContaining({ error: writeError }),
      );
    });
  });

  it("does not register side effects in read-only smoke mode", async () => {
    await SharePageContent({ handle: "testuser", readOnly: true });

    expect(mockMaterializePublicProfile).toHaveBeenCalledWith("testuser", {
      readOnly: true,
    });
    expect(mockRenderBadgeSvg).toHaveBeenCalled();
    expect(mockGetAvatarBase64).not.toHaveBeenCalled();
    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockRunPublicProfileSideEffects).not.toHaveBeenCalled();
    expect(mockPersistProfileSnapshot).not.toHaveBeenCalled();
    expect(mockDeferProfileCacheWork).not.toHaveBeenCalled();
  });

  it("does not register side effects when materialization returns null", async () => {
    mockMaterializePublicProfile.mockResolvedValue(null);

    await renderPage();

    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
  });

  it("tolerates avatar fetch failure for inline rendering", async () => {
    mockGetAvatarBase64.mockRejectedValue(new Error("avatar down"));

    await renderPage();

    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      FAKE_MATERIALIZED.displayImpact,
      expect.objectContaining({ avatarDataUri: undefined }),
    );
  });

  // #1088 (PE-M1) — same root cause as the badge.svg route: a handle whose
  // stats carry no avatarUrl at all is a PERMANENT condition, distinct from
  // a genuine race-timeout on a real fetch. The share page's own SVG-cache
  // write must not stay silent for it forever either.
  describe("permanent avatar absence caching (#1088)", () => {
    const NO_AVATAR_MATERIALIZED = {
      ...FAKE_MATERIALIZED,
      stats: { ...FAKE_MATERIALIZED.stats, avatarUrl: undefined },
    };

    it("writes a short-TTL cache entry when stats.avatarUrl is absent", async () => {
      mockMaterializePublicProfile.mockResolvedValue(NO_AVATAR_MATERIALIZED);

      await renderPage();

      expect(mockAfter).toHaveBeenCalledTimes(1);
      const callback = mockAfter.mock.calls[0][0];
      await callback();

      expect(mockGetAvatarBase64).not.toHaveBeenCalled();
      expect(mockWriteBadgeSvgCache).toHaveBeenCalledWith(
        expect.any(String),
        FAKE_SVG,
        "testuser",
        expect.objectContaining({ ttlSeconds: expect.any(Number) }),
      );
      const ttlArg = mockWriteBadgeSvgCache.mock.calls[0]![3] as { ttlSeconds: number };
      expect(ttlArg.ttlSeconds).toBeGreaterThanOrEqual(900);
      expect(ttlArg.ttlSeconds).toBeLessThanOrEqual(1800);
    });

    it("does not write the cache for a genuine avatar fetch failure (transient, avatarUrl present)", async () => {
      mockGetAvatarBase64.mockRejectedValue(new Error("avatar down"));

      await renderPage();

      expect(mockAfter).toHaveBeenCalledTimes(1);
      const callback = mockAfter.mock.calls[0][0];
      await callback();

      expect(mockWriteBadgeSvgCache).not.toHaveBeenCalled();
    });

    it("writes the standard cache entry for a definitive remote avatar absence", async () => {
      mockGetAvatarBase64.mockResolvedValue(undefined);

      await renderPage();
      await mockAfter.mock.calls[0][0]();

      expect(mockWriteBadgeSvgCache).toHaveBeenCalledWith(
        expect.any(String),
        FAKE_SVG,
        "testuser",
        undefined,
      );
    });
  });

  // ----------------------------------------------------------------
  // #1034 — server-side trend/diff fetch (no client fetch waterfall)
  // ----------------------------------------------------------------
  describe("server-side trend data (#1034)", () => {
    const FAKE_TREND = {
      direction: "improving" as const,
      avgDelta: 3,
      compositeValues: [{ date: "2026-04-10", value: 55 }, { date: "2026-04-17", value: 65 }],
      dimensions: {
        delivery: { avgDelta: 2, values: [] },
        quality: { avgDelta: 1, values: [] },
        consistency: { avgDelta: 0, values: [] },
        breadth: { avgDelta: -1, values: [] },
      },
    };

    const FAKE_DIFF = {
      direction: "improving" as const,
      daysBetween: 7,
      compositeScore: 8,
      adjustedComposite: 10,
      confidence: 0,
      dimensions: { delivery: 5, quality: 2, consistency: 1, breadth: 0 },
      stats: {
        commitsTotal: 10,
        prsMergedCount: 2,
        prsMergedWeight: 2,
        reviewsSubmittedCount: 1,
        issuesClosedCount: 0,
        reposContributed: 0,
        activeDays: 3,
        linesAdded: 100,
        linesDeleted: 20,
        totalStars: 0,
        totalForks: 0,
        totalWatchers: 0,
        topRepoShare: 0,
      },
      archetype: null,
      tier: null,
      profileType: null,
      penaltyChanges: null,
    };

    it("redacts confidence fields from anonymous trend diff props", async () => {
      mockGetTrendData.mockResolvedValue({ trend: FAKE_TREND, diff: FAKE_DIFF });

      const result = await renderPage();

      expect(mockGetTrendData).toHaveBeenCalledWith("testuser");

      const ownerEl = findElement(
        result,
        (el) => el.type === SharePageOwnerContentLazy,
      );
      expect(ownerEl).not.toBeNull();
      expect(ownerEl!.props.trend).toEqual(FAKE_TREND);
      expect(ownerEl!.props.diff).not.toHaveProperty("confidence");
      expect(ownerEl!.props.diff).not.toHaveProperty("penaltyChanges");
    });

    it("preserves confidence fields in an owner's trend diff props", async () => {
      mockGetOptionalServerSessionFromHeaders.mockReturnValue({ login: "testuser" });
      mockGetTrendData.mockResolvedValue({ trend: FAKE_TREND, diff: FAKE_DIFF });

      const result = await renderPage();
      const ownerEl = findElement(
        result,
        (el) => el.type === SharePageOwnerContentLazy,
      );

      expect(ownerEl!.props.diff).toEqual(FAKE_DIFF);
    });

    it("renders successfully with a graceful empty state when trend history is unavailable", async () => {
      mockGetTrendData.mockResolvedValue({ trend: null, diff: null });

      const result = await renderPage();

      const ownerEl = findElement(
        result,
        (el) => el.type === SharePageOwnerContentLazy,
      );
      expect(ownerEl).not.toBeNull();
      expect(ownerEl!.props.trend).toBeNull();
      expect(ownerEl!.props.diff).toBeNull();
      // Impact/stats sections are still present — the page doesn't omit the
      // dashboard just because history is missing.
      expect(ownerEl!.props.stats).toEqual(FAKE_MATERIALIZED.stats);
      // #1067 — the default test session is a visitor (no session), so the
      // page redacts confidence/confidencePenalties before this crosses
      // into the client component tree. See "owner-only confidence
      // redaction (#1067)" below for dedicated coverage of that behavior.
      expect(ownerEl!.props.impact).toEqual({
        adjustedComposite: 65,
        tier: "Solid",
        archetype: "Builder",
        dimensions: { delivery: 70, quality: 60, consistency: 65, breadth: 55 },
        profileType: "collaborative",
      });
    });

    it("degrades gracefully (renders, does not throw) when getTrendData itself rejects", async () => {
      // getTrendData is documented to fail-open internally and never reject,
      // but this test guards the page-level integration in case that
      // contract is ever violated in the future — the page must never 500
      // just because history lookup failed (CLAUDE.md: "A 500 on legal user
      // input is always a bug").
      mockGetTrendData.mockRejectedValue(new Error("history store down"));

      const result = await renderPage();

      const ownerEl = findElement(
        result,
        (el) => el.type === SharePageOwnerContentLazy,
      );
      expect(ownerEl).not.toBeNull();
      expect(ownerEl!.props.trend).toBeNull();
      expect(ownerEl!.props.diff).toBeNull();
    });
  });
});
