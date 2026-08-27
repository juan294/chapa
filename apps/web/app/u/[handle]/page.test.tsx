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
  mockCacheGet,
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
  mockCacheGet: vi.fn(),
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

// #1180 (PE-L1) — readBadgeSvgCache (kept real above) calls through to this
// module's cacheGet. Mocked here (rather than left to the real no-credentials
// no-op) so tests can control exactly when the read resolves and assert it is
// kicked off concurrently with materialize/trend/flags, not strictly after.
vi.mock("@/lib/cache/redis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cache/redis")>();
  return {
    ...actual,
    cacheGet: (...args: unknown[]) => mockCacheGet(...args),
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
vi.mock("@/components/Navbar", () => ({
  Navbar: () => "<nav />",
}));
vi.mock("@/components/SharePageShortcuts", () => ({
  SharePageShortcuts: () => null,
}));
vi.mock("@/components/BadgeToolbar", () => ({
  BadgeToolbar: () => "<div>toolbar</div>",
}));
vi.mock("@/components/SiteFooter", () => ({
  SiteFooter: () => "<footer>site-footer</footer>",
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
import { SharePageShortcuts } from "@/components/SharePageShortcuts";
import { BadgeToolbar } from "@/components/BadgeToolbar";
import { Navbar } from "@/components/Navbar";
import { SiteFooter } from "@/components/SiteFooter";
import { DocumentLocaleScript } from "@/lib/i18n/document-locale-script";

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
    mockCacheGet.mockResolvedValue(null);
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
    // #1181 — the call now always also carries a locale-resolved `strings`
    // bundle; see the "badge content and cache key never diverge by locale"
    // describe block below for that coverage. This test only cares about
    // the pre-existing avatar/verification contract.
    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
      FAKE_MATERIALIZED.displayImpact,
      expect.objectContaining({
        avatarDataUri: "data:image/png;base64,abc123",
        verificationHash: "abc12345",
        verificationDate: "2026-04-17",
      }),
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

  // #1180 (PE-L1) — the shared badge SVG cache read depends on nothing in
  // the session/materialize/trend/flags wave (only `handle` and today's
  // date, both known at entry). It must be kicked off concurrently with
  // that wave, not strictly after it resolves.
  describe("SVG cache read parallelized with materialize/trend/flags (#1180 PE-L1)", () => {
    it("starts the badge SVG cache read without waiting for materializePublicProfile to resolve", async () => {
      let resolveMaterialize!: (value: typeof FAKE_MATERIALIZED) => void;
      mockMaterializePublicProfile.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveMaterialize = resolve;
          }),
      );

      const contentPromise = SharePageContent({ handle: "testuser" });

      // Flush pending microtasks WITHOUT resolving materializePublicProfile.
      // If the cache read were still gated behind `await Promise.all([...])`
      // (the pre-fix ordering), it could not have been invoked yet because
      // that Promise.all can't settle until materialize does.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockCacheGet).toHaveBeenCalled();
      expect(mockMaterializePublicProfile).toHaveBeenCalled();

      resolveMaterialize(FAKE_MATERIALIZED);
      await contentPromise;
    });

    it("still uses the resolved cached SVG (or falls through to a fresh render) once both settle", async () => {
      mockCacheGet.mockResolvedValue(FAKE_SVG);

      await renderPage();

      // A cache hit means no fresh render/avatar work was needed.
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
      expect(mockGetAvatarBase64).not.toHaveBeenCalled();
    });

    it("computes one `today` value reused for both the cache read key and the later cache write key", async () => {
      await renderPage();

      expect(mockAfter).toHaveBeenCalledTimes(1);
      const callback = mockAfter.mock.calls[0][0];
      await callback();

      const readKey = mockCacheGet.mock.calls[0]![0] as string;
      const writeKey = mockWriteBadgeSvgCache.mock.calls[0]![0] as string;
      expect(writeKey).toBe(readKey);
    });
  });

  // #1181 (UX-H3) regression — SharePageContent used to build the SVG cache
  // key (buildBadgeSvgCacheKey, no locale arg → defaults to DEFAULT_LOCALE,
  // 'es') and the rendered content (renderBadgeSvg, no `strings` → defaults
  // to English) from two INDEPENDENT defaults instead of the page's own
  // resolved `locale` prop. Both wrote an English-rendered badge into the
  // Spanish-keyed cache slot — content and key silently disagreed, and since
  // the default locale is the majority of real traffic, this defeated the
  // whole feature. Fixed via the shared `resolveBadgeLocale` helper, which
  // derives strings AND the cache key from the same locale value.
  describe("badge content and cache key never diverge by locale (#1181 regression)", () => {
    it("renders Spanish content into the :es-keyed cache slot for the default (es) locale", async () => {
      await SharePageContent({ handle: "testuser", locale: "es" });

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_MATERIALIZED.stats,
        FAKE_MATERIALIZED.displayImpact,
        expect.objectContaining({
          strings: expect.objectContaining({
            metricsVerified: "Métricas verificadas",
            tierLabel: "Sólido", // tiers.solid (displayImpact.tier === "Solid")
            radarLabels: expect.objectContaining({ delivery: "Entrega" }),
          }),
        }),
      );
      const readKey = mockCacheGet.mock.calls[0]![0] as string;
      expect(readKey.endsWith(":es")).toBe(true);
    });

    it("renders English content into the :en-keyed cache slot for locale=en", async () => {
      await SharePageContent({ handle: "testuser", locale: "en" });

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_MATERIALIZED.stats,
        FAKE_MATERIALIZED.displayImpact,
        expect.objectContaining({
          strings: expect.objectContaining({
            metricsVerified: "Verified metrics",
            tierLabel: "Solid",
            radarLabels: expect.objectContaining({ delivery: "Delivery" }),
          }),
        }),
      );
      const readKey = mockCacheGet.mock.calls[0]![0] as string;
      expect(readKey.endsWith(":en")).toBe(true);
    });

    it("writes a fresh render to the exact same locale-tagged key it read from, for a non-default locale", async () => {
      await SharePageContent({ handle: "testuser", locale: "en" });

      const callback = mockAfter.mock.calls[0][0];
      await callback();

      const readKey = mockCacheGet.mock.calls[0]![0] as string;
      const writeKey = mockWriteBadgeSvgCache.mock.calls[0]![0] as string;
      expect(writeKey).toBe(readKey);
      expect(writeKey.endsWith(":en")).toBe(true);
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

  // #1165 (FE-H2) — the route is dynamic (not ISR, see the page.test.ts
  // source-text assertions), so it must use the server Navbar variant and
  // thread the already-resolved isOwner down as a prop to the client
  // components that used to re-derive it over a network round trip to
  // /api/auth/session. isOwner stays a DISPLAY gate only — the redaction
  // tests above are the actual security boundary and must be unaffected.
  describe("server Navbar + isOwner prop threading (#1165 / FE-H2)", () => {
    it("renders the server Navbar, not NavbarClient", async () => {
      const result = await renderPage("testuser");

      const navbarEl = findElement(result, (el) => el.type === Navbar);
      expect(navbarEl).not.toBeNull();
    });

    it("threads isOwner=true to SharePageOwnerContentLazy, SharePageShortcuts, and BadgeToolbar when the session matches the handle", async () => {
      mockGetOptionalServerSessionFromHeaders.mockReturnValue({ login: "testuser" });

      const result = await renderPage("testuser");

      const ownerEl = findElement(result, (el) => el.type === SharePageOwnerContentLazy);
      const shortcutsEl = findElement(result, (el) => el.type === SharePageShortcuts);
      const toolbarEl = findElement(result, (el) => el.type === BadgeToolbar);

      expect(ownerEl!.props.isOwner).toBe(true);
      expect(shortcutsEl!.props.isOwner).toBe(true);
      expect(toolbarEl!.props.isOwner).toBe(true);
    });

    it("threads isOwner=false when there is no session (anonymous visitor)", async () => {
      mockGetOptionalServerSessionFromHeaders.mockReturnValue(null);

      const result = await renderPage("testuser");

      const ownerEl = findElement(result, (el) => el.type === SharePageOwnerContentLazy);
      const shortcutsEl = findElement(result, (el) => el.type === SharePageShortcuts);
      const toolbarEl = findElement(result, (el) => el.type === BadgeToolbar);

      expect(ownerEl!.props.isOwner).toBe(false);
      expect(shortcutsEl!.props.isOwner).toBe(false);
      expect(toolbarEl!.props.isOwner).toBe(false);
    });

    it("threads isOwner=false when a different user's session is present", async () => {
      mockGetOptionalServerSessionFromHeaders.mockReturnValue({ login: "someone-else" });

      const result = await renderPage("testuser");

      const ownerEl = findElement(result, (el) => el.type === SharePageOwnerContentLazy);
      expect(ownerEl!.props.isOwner).toBe(false);
    });
  });

  // #1167 (UX-B1, launch blocker) — the share page is the single most
  // important surface in the finding's exact reproduction: a visitor
  // arrives from a README badge, signs in, generates their own badge, and
  // never sees a link to Privacy or Terms anywhere in that flow. Landing
  // and the 7 [locale] content pages already got SiteFooter in a prior
  // remediation unit; this closes the gap on /u/[handle] itself.
  describe("SiteFooter + real-route nav links (#1167 / UX-B1)", () => {
    it("renders SiteFooter with the resolved locale-aware t function", async () => {
      const result = await renderPage("testuser");

      const footerEl = findElement(result, (el) => el.type === SiteFooter);
      expect(footerEl).not.toBeNull();
      expect(typeof footerEl!.props.t).toBe("function");
      // renderPage() calls SharePageContent without an explicit `locale`, so
      // it falls back to DEFAULT_LOCALE — mocked to "es" in this file.
      const t = footerEl!.props.t as (key: string) => unknown;
      expect(t("landing.footer.privacy")).toBe("Privacidad");
    });

    it("passes real-route inner nav links to the server Navbar, not the landing page's hash anchors", async () => {
      const result = await renderPage("testuser");

      const navbarEl = findElement(result, (el) => el.type === Navbar);
      expect(navbarEl!.props.navLinks).toEqual([
        { label: "Acerca de", href: "/about" },
        { label: "Puntuación", href: "/about/scoring" },
        { label: "Verificar", href: "/verify" },
      ]);
    });
  });

  // #1165 (FE-M1) — an early <html lang> assignment must be emitted for the
  // page's own resolved locale (query > cookie > Accept-Language > default),
  // matching the pattern already used on the landing page and /verify pages.
  describe("DocumentLocaleScript (#1165 / FE-M1)", () => {
    it("emits an early document-language assignment for the resolved locale", async () => {
      mockGetServerLocale.mockResolvedValue("en");

      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({ lang: "en" }),
      });

      const scriptEl = findElement(result, (el) => el.type === DocumentLocaleScript);
      expect(scriptEl).not.toBeNull();
      expect(scriptEl!.props.locale).toBe("en");
    });

    it("resolves the same locale as the LanguageProvider body (no disagreement)", async () => {
      mockGetServerLocale.mockResolvedValue("es");

      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({}),
      });

      const scriptEl = findElement(result, (el) => el.type === DocumentLocaleScript);
      expect(scriptEl!.props.locale).toBe("es");
    });
  });

  // #1165 (UX-M5) — the "e" keyboard shortcut and the visible Markdown Copy
  // button must produce byte-identical clipboard content: a single,
  // localized, handle-bearing string built once, server-side, and threaded
  // to both consumers.
  describe("canonical embed markdown (#1165 / UX-M5)", () => {
    it("passes a handle-bearing, non-hardcoded-English embed markdown to SharePageShortcuts", async () => {
      const result = await renderPage("testuser");

      const shortcutsEl = findElement(result, (el) => el.type === SharePageShortcuts);
      const embedMarkdown = shortcutsEl!.props.embedMarkdown as string;
      expect(embedMarkdown).toContain("testuser");
      expect(embedMarkdown).toContain("testuser/badge.svg");
      // Regression guard: this used to be the hardcoded literal "Chapa Badge"
      // with no handle in the alt text at all.
      expect(embedMarkdown).not.toBe(
        "![Chapa Badge](https://chapa.thecreativetoken.com/u/testuser/badge.svg)",
      );
    });

    it("passes the IDENTICAL embed markdown string to both SharePageShortcuts and SharePageOwnerContentLazy", async () => {
      const result = await renderPage("testuser");

      const shortcutsEl = findElement(result, (el) => el.type === SharePageShortcuts);
      const ownerEl = findElement(result, (el) => el.type === SharePageOwnerContentLazy);

      expect(ownerEl!.props.embedMarkdown).toBe(shortcutsEl!.props.embedMarkdown);
    });

    it("localizes the embed markdown alt text to the resolved locale", async () => {
      const esResult = await SharePageContent({ handle: "testuser", locale: "es" });
      const enResult = await SharePageContent({ handle: "testuser", locale: "en" });

      const esShortcuts = findElement(esResult, (el) => el.type === SharePageShortcuts);
      const enShortcuts = findElement(enResult, (el) => el.type === SharePageShortcuts);

      // Spanish dict: shareOwner.badgeAltOf = 'Chapa de'
      expect(esShortcuts!.props.embedMarkdown).toContain("![Chapa de testuser](");
      // English dict: shareOwner.badgeAltOf = 'Chapa Badge of'
      expect(enShortcuts!.props.embedMarkdown).toContain("![Chapa Badge of testuser](");
    });
  });
});
