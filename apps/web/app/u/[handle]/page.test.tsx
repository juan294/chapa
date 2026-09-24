import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockMaterializePublicProfile,
  mockResolveBadgeVerification,
  mockRunPublicProfileSideEffects,
  mockIsValidHandle,
  mockGetAvatarBase64,
  mockRenderBadgeSvg,
  mockAfter,
  mockGetServerLocale,
  mockHeaders,
  mockGetOptionalServerSessionFromHeaders,
  mockWriteBadgeSvgCache,
  mockCaptureServerError,
  mockCacheGet,
  mockResolveBadgeConfigSnapshot,
  mockReadStoredBadgeProfile,
  mockCaptureServerEvent,
  mockDbGetLinkedPlatforms,
} = vi.hoisted(() => ({
  mockMaterializePublicProfile: vi.fn(),
  mockResolveBadgeVerification: vi.fn(),
  mockRunPublicProfileSideEffects: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockAfter: vi.fn(),
  mockGetServerLocale: vi.fn(),
  mockHeaders: vi.fn(),
  mockGetOptionalServerSessionFromHeaders: vi.fn(),
  mockWriteBadgeSvgCache: vi.fn(),
  mockCaptureServerError: vi.fn(),
  mockCacheGet: vi.fn(),
  mockResolveBadgeConfigSnapshot: vi.fn(),
  // #1331 — readStoredBadgeProfile is the only export of
  // lib/profile/stored-badge-profile mocked out; storedBadgeRenderInputs and
  // storedBadgeActivityUnavailable stay real (pure projections) via
  // importOriginal below, so tests exercise the same projection logic the
  // badge route uses rather than a duplicate.
  mockReadStoredBadgeProfile: vi.fn(),
  mockCaptureServerEvent: vi.fn(),
  mockDbGetLinkedPlatforms: vi.fn(),
}));

vi.mock("@/lib/render/badge-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/render/badge-config")>();
  return {
    ...actual,
    resolveBadgeConfigSnapshot: (...args: unknown[]) =>
      mockResolveBadgeConfigSnapshot(...args),
  };
});

vi.mock("@/lib/profile/public-profile", () => ({
  materializePublicProfile: (...args: unknown[]) => mockMaterializePublicProfile(...args),
  runPublicProfileSideEffects: (...args: unknown[]) =>
    mockRunPublicProfileSideEffects(...args),
}));

vi.mock("@/lib/profile/badge-verification", () => ({
  resolveBadgeVerification: (...args: unknown[]) =>
    mockResolveBadgeVerification(...args),
}));

vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => mockHeaders(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalServerSessionFromHeaders: (...args: unknown[]) =>
    mockGetOptionalServerSessionFromHeaders(...args),
}));

vi.mock("@/lib/feature-flags", () => ({
  isWebmcpEnabled: vi.fn().mockResolvedValue(true),
}));

// #1091 — the after()-deferred snapshot write must escalate a genuine
// failure via captureServerError, mirroring the badge route's #1013 pattern.
vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...args),
}));

// #1331 — only readStoredBadgeProfile (the durable-store read) is mocked;
// storedBadgeRenderInputs/storedBadgeActivityUnavailable stay the real, pure
// projections so a test failure here reflects page.tsx wiring, not a
// hand-rolled duplicate of the projection logic.
vi.mock("@/lib/profile/stored-badge-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profile/stored-badge-profile")>();
  return {
    ...actual,
    readStoredBadgeProfile: (...args: unknown[]) => mockReadStoredBadgeProfile(...args),
  };
});

vi.mock("@/lib/validation", () => ({
  isValidHandle: (...args: unknown[]) => mockIsValidHandle(...args),
}));

// #1332 — dbGetLinkedPlatforms backs the owner-only reconnect notice.
vi.mock("@/lib/db/user-platforms", () => ({
  dbGetLinkedPlatforms: (...args: unknown[]) => mockDbGetLinkedPlatforms(...args),
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
import { BadgeSkeleton } from "@/components/BadgeSkeleton";
import { githubUserNotFound } from "@/lib/github/not-found";
import { SharePageOwnerContentLazy } from "@/components/SharePageOwnerContentLazy";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SharePageShortcuts } from "@/components/SharePageShortcuts";
import { BadgeToolbar } from "@/components/BadgeToolbar";
import { Navbar } from "@/components/Navbar";
import { SiteFooter } from "@/components/SiteFooter";
import { DynamicRouteShell } from "@/components/DynamicRouteShell";

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

// #1335 phase 5 — v7.2 is the one scoring policy this surface renders; no
// `rawImpact`/`displayImpact`/`snapshot` legacy fields left on
// `MaterializedProfile`.
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
  craftResult: null,
  statsComplete: true,
  statsFreshness: "current",
  statsCapturedAt: "2026-04-17T00:00:00Z",
  // #1331 — a real materialized profile always carries a scoring view model;
  // `freshness: "current"` is what configCacheable now requires (previously
  // `!== "unavailable"`, which undefined also satisfied — this fixture used
  // to omit `scoring` entirely and still passed the pre-#1331 gate).
  scoring: {
    policyVersion: "v7.2",
    handle: "testuser",
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
    reportCraft: { status: "no_report", unlocked: false, report: null },
    coverage: [],
    exclusions: [],
    limitations: [],
  },
};

// #1331/#1335 phase 5 — a durable stored-badge fallback: what
// `readStoredBadgeProfile` returns when live materialization is null but a
// committed current v7.2 receipt exists. `stats` is `null` here (the
// exact-bound stale envelope was itself unavailable) — storedBadgeRenderInputs
// (the real, unmocked projection) then renders every count as unavailable,
// never a fabricated zero.
const FAKE_STORED_PROFILE = {
  kind: "stored" as const,
  handle: "testuser",
  observedAt: "2026-04-16T00:00:00.000Z",
  scoring: {
    policyVersion: "v7.2" as const,
    handle: "testuser",
    identity: null,
    window: null,
    dimensions: {
      delivery: { kind: "point" as const, value: 70, display: 70 },
      quality: { kind: "point" as const, value: 60, display: 60 },
      consistency: { kind: "point" as const, value: 65, display: 65 },
      breadth: { kind: "point" as const, value: 55, display: 55 },
    },
    composite: { kind: "point" as const, value: 62, display: 62 },
    tier: "Solid" as const,
    archetype: "Builder" as const,
    craft: null,
    reportCraft: { status: "no_report" as const, unlocked: false, report: null },
    coverage: [],
    exclusions: [],
    limitations: [],
    freshness: "stale" as const,
  },
  stats: {
    handle: "testuser",
    commitsTotal: 42,
    activeDays: 40,
    prsMergedCount: 10,
    prsMergedWeight: 12,
    reviewsSubmittedCount: 5,
    issuesClosedCount: 2,
    linesAdded: 100,
    linesDeleted: 50,
    reposContributed: 3,
    topRepoShare: 0.2,
    maxCommitsIn10Min: 2,
    totalStars: 5,
    totalForks: 1,
    totalWatchers: 1,
    heatmapData: [],
    fetchedAt: "2026-04-16T00:00:00.000Z",
  },
};

async function renderPage(handle = "testuser") {
  return SharePageContent({ handle });
}

describe("SharePage /u/[handle]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidHandle.mockReturnValue(true);
    mockMaterializePublicProfile.mockResolvedValue(FAKE_MATERIALIZED);
    mockResolveBadgeVerification.mockResolvedValue({ hash: "abc12345", date: "2026-04-17" });
    mockRunPublicProfileSideEffects.mockResolvedValue(undefined);
    mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
    mockWriteBadgeSvgCache.mockResolvedValue(true);
    mockCacheGet.mockResolvedValue(null);
    mockResolveBadgeConfigSnapshot.mockResolvedValue({
      config: { border: "solid" },
      revision: 7,
      cacheable: true,
    });
    mockGetServerLocale.mockResolvedValue("en");
    mockHeaders.mockResolvedValue({ get: () => null });
    mockCaptureServerError.mockResolvedValue(undefined);
    mockCaptureServerEvent.mockResolvedValue(undefined);
    // #1331 — no durable stored profile by default; tests that exercise the
    // fallback override this per-test.
    mockReadStoredBadgeProfile.mockResolvedValue(null);
    // No session by default — most tests exercise the visitor path. Tests
    // that need owner behavior override this per-test.
    mockGetOptionalServerSessionFromHeaders.mockReturnValue(null);
    mockDbGetLinkedPlatforms.mockResolvedValue([]);
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
        url: "https://chapa.thecreativetoken.com/u/testuser/og-image?v=ice-terminal-v2-v7.2-2026-04-17-r7&lang=es",
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
        (el) => el.type === DynamicRouteShell,
      );
      expect(provider).not.toBeNull();
      expect(provider!.props.locale).toBe("en");
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
        (el) => el.type === DynamicRouteShell,
      );
      expect(provider!.props.locale).toBe("es");
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
        (el) => el.type === DynamicRouteShell,
      );
      expect(provider!.props.locale).toBe("en");
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

  // #1067's owner-only confidence redaction is retired along with
  // `ImpactV6Result` (#1335 phase 5 — "delete v6"): `ScoreViewModel` carries
  // no `confidence`/`confidencePenalties` field at all, so there is nothing
  // left for `redactImpactForVisitor` to strip — the receipt explanation
  // panel renders identically for an owner and a visitor (CLAUDE.md: "current
  // v7.2 explains recorded evidence/coverage without confidence deductions").

  it("resolves the session via headers() + getOptionalServerSessionFromHeaders", async () => {
    const fakeHeaderStore = { get: () => null };
    mockHeaders.mockResolvedValue(fakeHeaderStore);

    await renderPage("testuser");

    expect(mockGetOptionalServerSessionFromHeaders).toHaveBeenCalledWith(fakeHeaderStore);
  });

  it("renders the inline badge from the current scoring model", async () => {
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

    // #1335 phase 5 — snapshot persistence and the v6 HMAC verification
    // record are gone; `runPublicProfileSideEffects` now takes only the
    // handle and the materialized profile.
    expect(mockRunPublicProfileSideEffects).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED,
    );
  });

  // #1091 (PE-M6) — the durable side effects (badge-generated telemetry,
  // owner profile refresh) have nothing in the rendered HTML depending on
  // their result. They must not hold TTFB open, mirroring the badge route's
  // #1013 fix.
  describe("durable snapshot write deferred to after() (#1091)", () => {
    it("does not await the durable side effects on the render path — only after() invokes them", async () => {
      await renderPage();

      // The render call itself must return without having invoked the
      // durable write directly.
      expect(mockRunPublicProfileSideEffects).not.toHaveBeenCalled();
      expect(mockAfter).toHaveBeenCalledTimes(1);

      const callback = mockAfter.mock.calls[0][0];
      await callback();

      expect(mockRunPublicProfileSideEffects).toHaveBeenCalledWith(
        "testuser",
        FAKE_MATERIALIZED,
      );
    });

    // LE-6-1 — the strip on the inline SVG is minted from the same
    // `resolveBadgeVerification` read the cache write below gates on.
    it("hands the exact verification the inline SVG printed to the deferred sequence", async () => {
      await renderPage();
      const callback = mockAfter.mock.calls[0][0];
      await callback();

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_MATERIALIZED.stats,
        expect.objectContaining({ verificationHash: "abc12345", verificationDate: "2026-04-17" }),
      );
      expect(mockResolveBadgeVerification.mock.results[0].value).resolves.toEqual({ hash: "abc12345", date: "2026-04-17" });
    });

    it("escalates a deferred snapshot-write failure via captureServerError instead of swallowing it", async () => {
      const writeError = new Error("supabase write failed");
      mockRunPublicProfileSideEffects.mockRejectedValue(writeError);

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
      // that Promise.all can't settle until materialize does. #1335 phase
      // 4/5 added a sequential `hasDrawableCurrentReceipt` gate ahead of this
      // wave (its own real, unmocked DB read fails fast in this test env but
      // still costs a few extra microtask hops), so this flushes more ticks
      // than the single Promise.all this test originally guarded.
      for (let i = 0; i < 10; i++) await Promise.resolve();

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
        expect.objectContaining({
          strings: expect.objectContaining({
            metricsVerified: "Métricas verificadas",
            tierLabel: "Sólido", // tiers.solid (scoring.tier === "Solid")
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


  // LE-8-2 — GitHub answered that nobody owns the handle. The route's loading
  // boundary has already committed the response to 200 by the time the
  // streamed content learns this, so the honest outcome here is Next's own
  // mid-stream not-found: the not-found UI plus an injected
  // `<meta name="robots" content="noindex">`. An outage stays `null` and
  // keeps the try-later state; a real user must never 404 for that.
  describe("a handle GitHub does not know (LE-8-2)", () => {
    it("calls notFound() from the streamed content instead of rendering the empty state", async () => {
      mockMaterializePublicProfile.mockResolvedValue(githubUserNotFound("ghost"));

      await expect(renderPage("ghost")).rejects.toThrow("NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalled();
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
      expect(mockAfter).not.toHaveBeenCalled();
    });

    it("treats the owner exactly like a visitor: a session for the handle still gets notFound()", async () => {
      mockGetOptionalServerSessionFromHeaders.mockReturnValue({ login: "ghost", token: "gho_x" });
      mockMaterializePublicProfile.mockResolvedValue(githubUserNotFound("ghost"));

      await expect(renderPage("ghost")).rejects.toThrow("NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalled();
      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
    });

    it("keeps the try-later state, never notFound(), when materialization is merely unavailable", async () => {
      mockMaterializePublicProfile.mockResolvedValue(null);

      await renderPage();

      expect(mockNotFound).not.toHaveBeenCalled();
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
  });

  it("does not register side effects when materialization returns null", async () => {
    mockMaterializePublicProfile.mockResolvedValue(null);

    await renderPage();

    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
  });

  // badge-source-outage-resilience (2026-09-22) / #1331 — when live
  // materialization is null (not the GitHub not-found sentinel, covered
  // separately below) but a durable stored profile exists, the share page
  // renders it instead of the generic empty state: the same degraded
  // disclosure the badge route's own `!materialized` branch draws, and never
  // the normal SVG cache, verification, or profile side effects.
  describe("stored-badge fallback (#1331)", () => {
    beforeEach(() => {
      mockMaterializePublicProfile.mockResolvedValue(null);
      mockReadStoredBadgeProfile.mockResolvedValue(FAKE_STORED_PROFILE);
    });

    it("reads the durable stored profile for the handle", async () => {
      await renderPage();

      expect(mockReadStoredBadgeProfile).toHaveBeenCalledWith("testuser");
    });

    it("renders the inline SVG from the stored score/dimensions with the badge route's degraded disclosure", async () => {
      await renderPage();

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        expect.objectContaining({ handle: "testuser", commitsTotal: 42, heatmapData: [] }),
        expect.objectContaining({
          scoring: FAKE_STORED_PROFILE.scoring,
          degraded: {
            reason: "live_sources_unavailable",
            observedAt: FAKE_STORED_PROFILE.observedAt,
            activityAvailable: false,
            countsAvailable: true,
          },
          strings: expect.objectContaining({
            activityUnavailable: expect.stringContaining("2026-04-16"),
          }),
        }),
      );
    });

    it("passes the stored date and scoring model to SharePageOwnerContentLazy as staleFallback", async () => {
      const result = await renderPage();

      const ownerEl = findElement(result, (el) => el.type === SharePageOwnerContentLazy);
      expect(ownerEl!.props.staleFallback).toEqual({ observedAt: FAKE_STORED_PROFILE.observedAt });
      expect(ownerEl!.props.scoring).toEqual(FAKE_STORED_PROFILE.scoring);
    });

    it("never calls resolveBadgeVerification, runs no after() side effects, and writes no normal SVG cache", async () => {
      await renderPage();

      // resolveBadgeVerification stays gated on `materialized`, which is
      // null for a stored fallback — it is never invoked at all here.
      expect(mockResolveBadgeVerification).not.toHaveBeenCalled();
      expect(mockAfter).not.toHaveBeenCalled();
      expect(mockRunPublicProfileSideEffects).not.toHaveBeenCalled();
      expect(mockWriteBadgeSvgCache).not.toHaveBeenCalled();
    });

    it("reports the bounded stored-fallback telemetry event (policy + date only)", async () => {
      await renderPage();

      expect(mockCaptureServerEvent).toHaveBeenCalledWith("badge_stored_fallback", {
        policyVersion: "v7.2",
        observedDate: "2026-04-16",
      });
    });

    it("behaves consistently with the badge route in read-only smoke mode: still renders the stored fallback with no side effects", async () => {
      await SharePageContent({ handle: "testuser", readOnly: true });

      expect(mockReadStoredBadgeProfile).toHaveBeenCalled();
      expect(mockRenderBadgeSvg).toHaveBeenCalled();
      expect(mockAfter).not.toHaveBeenCalled();
      expect(mockRunPublicProfileSideEffects).not.toHaveBeenCalled();
    });

    it("keeps today's empty state when materialization is null and no stored profile exists (cold handle)", async () => {
      mockReadStoredBadgeProfile.mockResolvedValue(null);

      await renderPage();

      expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
      expect(mockAfter).not.toHaveBeenCalled();
    });

    it("keeps the 404 behavior for an unknown GitHub handle and never consults the stored fallback", async () => {
      mockMaterializePublicProfile.mockResolvedValue(githubUserNotFound("ghost"));

      await expect(renderPage("ghost")).rejects.toThrow("NOT_FOUND");

      expect(mockReadStoredBadgeProfile).not.toHaveBeenCalled();
    });
  });

  // badge-source-outage-resilience (2026-09-22) / #1331 — the normal SVG
  // cache is only ever written for a `"current"` read, mirroring the badge
  // route's own `freshnessCacheable` gate. A `"stale"` exact-bound aggregate
  // (or any freshness other than `"current"`) must never publish into the
  // shared cache the badge route and future share-page visits both read.
  describe("cache eligibility requires freshness === 'current' (#1331)", () => {
    it("writes the normal SVG cache for a current live render", async () => {
      await renderPage();

      const callback = mockAfter.mock.calls[0][0];
      await callback();

      expect(mockWriteBadgeSvgCache).toHaveBeenCalled();
    });

    it("does not write the normal SVG cache when scoring freshness is 'stale'", async () => {
      mockMaterializePublicProfile.mockResolvedValue({
        ...FAKE_MATERIALIZED,
        scoring: { ...FAKE_MATERIALIZED.scoring, freshness: "stale" },
      });

      await renderPage();

      // materialized is non-null here, so after() still fires (durable side
      // effects still run for an exact-bound stale aggregate) but the cache
      // write itself must be skipped.
      expect(mockAfter).toHaveBeenCalledTimes(1);
      const callback = mockAfter.mock.calls[0][0];
      await callback();

      expect(mockWriteBadgeSvgCache).not.toHaveBeenCalled();
    });
  });

  it("tolerates avatar fetch failure for inline rendering", async () => {
    mockGetAvatarBase64.mockRejectedValue(new Error("avatar down"));

    await renderPage();

    expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
      FAKE_MATERIALIZED.stats,
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
        expect.objectContaining({ configRevision: 7 }),
      );
    });
  });

  // #1034's server-side trend/diff fetch is retired along with
  // `metrics_snapshots` (#1335 phase 5 — "delete v6"): `SharePageOwnerContent`
  // draws solely from `scoring`/`receiptExplanation` now, and the page no
  // longer fetches `getTrendData` at all (CLAUDE.md's non-goals: "No
  // long-term history charts").

  // #1165 (FE-H2) — the route is dynamic (not ISR, see the page.test.ts
  // source-text assertions), so it must use the server Navbar variant and
  // thread the already-resolved isOwner down as a prop to the client
  // components that used to re-derive it over a network round trip to
  // /api/auth/session. isOwner stays a DISPLAY gate only — the redaction
  // tests above are the actual security boundary and must be unaffected.
  describe("server Navbar + isOwner prop threading (#1165 / FE-H2)", () => {
    // #1194 — the server-vs-client Navbar choice is no longer made here. The
    // page hands its locale and links to DynamicRouteShell, which renders the
    // server variant; DynamicRouteShell.render.test.tsx asserts that half.
    // #1194 — the shell lives on the OUTER page, not inside SharePageContent:
    // the navbar moved out of the Suspense boundary with it, so it no longer
    // waits behind the badge skeleton.
    it("delegates the navbar to the dynamic-route shell", async () => {
      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({}),
      });

      expect(findElement(result, (el) => el.type === DynamicRouteShell)).not.toBeNull();
      expect(findElement(result, (el) => el.type === Navbar)).toBeNull();
    });

    it("no longer renders a navbar inside the streamed content", async () => {
      const inner = await renderPage("testuser");
      expect(findElement(inner, (el) => el.type === Navbar)).toBeNull();
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

    // #1332 — dbGetLinkedPlatforms is a real Supabase read; must never run
    // for a non-owner viewer, and must only ever forward platforms whose
    // refresh grant actually needs reconnecting.
    it("threads a filtered reconnectNeeded to SharePageOwnerContentLazy for the owner", async () => {
      mockGetOptionalServerSessionFromHeaders.mockReturnValue({ login: "testuser" });
      mockDbGetLinkedPlatforms.mockResolvedValue([
        { platform: "bitbucket", remoteLogin: "bb-user", connectedAt: "2026-02-20T12:00:00Z", needsReconnect: true },
        { platform: "gitlab", remoteLogin: "gl-user", connectedAt: "2026-02-20T12:00:00Z", needsReconnect: false },
      ]);

      const result = await renderPage("testuser");

      expect(mockDbGetLinkedPlatforms).toHaveBeenCalledWith("testuser");
      const ownerEl = findElement(result, (el) => el.type === SharePageOwnerContentLazy);
      expect(ownerEl!.props.reconnectNeeded).toEqual(["bitbucket"]);
    });

    it("never calls dbGetLinkedPlatforms and passes an empty reconnectNeeded for a visitor", async () => {
      mockGetOptionalServerSessionFromHeaders.mockReturnValue(null);

      const result = await renderPage("testuser");

      expect(mockDbGetLinkedPlatforms).not.toHaveBeenCalled();
      const ownerEl = findElement(result, (el) => el.type === SharePageOwnerContentLazy);
      expect(ownerEl!.props.reconnectNeeded).toEqual([]);
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
      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({}),
      });

      const navbarEl = findElement(result, (el) => el.type === DynamicRouteShell);
      // Real routes, not the landing page's hash anchors — the point of #1167.
      expect(
        (navbarEl!.props.navLinks as { href: string }[]).map((l) => l.href),
      ).toEqual(["/about", "/about/scoring", "/verify"]);
    });

    // #1194 — the links are built from the route's RESOLVED locale now, not
    // from DEFAULT_LOCALE. Before the shell they were computed inside
    // SharePageContent, which had no resolved locale to work from.
    it("labels the nav links in the request's resolved locale", async () => {
      mockGetServerLocale.mockResolvedValue("es");

      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({}),
      });

      const shell = findElement(result, (el) => el.type === DynamicRouteShell);
      expect(shell!.props.locale).toBe("es");
      expect(
        (shell!.props.navLinks as { label: string }[]).map((l) => l.label),
      ).toEqual(["Acerca de", "Puntuación", "Verificar"]);
    });
  });

  // #1165 (FE-M1) — an early <html lang> marker must be emitted for the
  // page's own resolved locale (query > cookie > Accept-Language > default),
  // matching the pattern already used on the landing page and /verify pages.
  describe("DocumentLocaleMarker (#1165 / FE-M1)", () => {
    it("emits an early document-language marker for the resolved locale", async () => {
      mockGetServerLocale.mockResolvedValue("en");

      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({ lang: "en" }),
      });

      const shell = findElement(result, (el) => el.type === DynamicRouteShell);
      expect(shell).not.toBeNull();
      expect(shell!.props.locale).toBe("en");
    });

    it("resolves the same locale as the LanguageProvider body (no disagreement)", async () => {
      mockGetServerLocale.mockResolvedValue("es");

      const result = await SharePage({
        params: Promise.resolve({ handle: "testuser" }),
        searchParams: Promise.resolve({}),
      });

      const shell = findElement(result, (el) => el.type === DynamicRouteShell);
      expect(shell!.props.locale).toBe("es");
    });
  });

  // #1165 (UX-M5) — the "e" keyboard shortcut and the visible Markdown Copy
  // button must produce byte-identical clipboard content: a single,
  // localized, handle-bearing string built once, server-side, and threaded
  // to both consumers.
  describe("canonical embed snippets (#1165 / UX-M5)", () => {
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

    it("passes the canonical embed HTML string to SharePageOwnerContentLazy", async () => {
      const result = await SharePageContent({ handle: "testuser", locale: "en" });

      const ownerEl = findElement(result, (el) => el.type === SharePageOwnerContentLazy);

      expect(ownerEl!.props.embedHtml).toBe(
        '<img src="https://chapa.thecreativetoken.com/u/testuser/badge.svg" alt="Chapa Badge of testuser" width="600" height="315" />',
      );
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

  // LE-5-1 — when the inline render is unavailable the page falls back to a
  // loading plate plus a `<img>` of the badge route. Both used to sit in
  // normal flow inside the frame, so the plate rendered ABOVE the image (two
  // badge-shaped boxes stacked) instead of underneath it. The plate has to be
  // taken out of flow and layered behind, so the image covers it once loaded.
  describe("img fallback layers the loading plate behind the image (LE-5-1)", () => {
    it("positions the plate absolutely inside the frame and the image relatively on top", async () => {
      mockCacheGet.mockResolvedValue(null);
      mockRenderBadgeSvg.mockReturnValue(null);

      const tree = await renderPage();

      const img = findElement(
        tree,
        (el) => el.type === "img" && String(el.props.src).includes("/u/testuser/badge.svg"),
      );
      expect(img).not.toBeNull();

      const frame = findElement(tree, (el) => {
        const children = el.props.children;
        return Array.isArray(children) && children.some((c) => c === img);
      });
      expect(frame).not.toBeNull();
      expect(String(frame!.props.className).split(/\s+/)).toContain("relative");

      const plateWrapper = findElement(
        frame,
        (el) => el.type === "div" && findElement(el.props.children, (c) => c.type === BadgeSkeleton) !== null && el !== frame,
      );
      expect(plateWrapper).not.toBeNull();
      const plateClasses = String(plateWrapper!.props.className).split(/\s+/);
      expect(plateClasses).toContain("absolute");
      expect(plateClasses).toContain("inset-0");

      const imgClasses = String(img!.props.className).split(/\s+/);
      expect(imgClasses).toContain("relative");
      expect(imgClasses).not.toContain("absolute");

      // The plate precedes the image in DOM order, so with both positioned and
      // no explicit z-index the image paints on top.
      const siblings = frame!.props.children as unknown[];
      expect(siblings.indexOf(plateWrapper)).toBeLessThan(siblings.indexOf(img));
    });
  });
});
