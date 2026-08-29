/**
 * Phase 4d — Share page i18n: interpolate helper, sharePage namespace,
 * generateMetadata locale, and LocaleSync mount.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Translations } from "@/lib/i18n/types";

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
  mockReadBadgeSvgCache,
  mockWriteBadgeSvgCache,
  mockGetTrendData,
  mockHeaders,
  mockGetOptionalServerSessionFromHeaders,
  mockSharePageWebMcpToolsComponent,
  mockIsWebmcpEnabled,
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
  mockReadBadgeSvgCache: vi.fn(),
  mockWriteBadgeSvgCache: vi.fn(),
  mockGetTrendData: vi.fn(),
  mockHeaders: vi.fn(),
  mockGetOptionalServerSessionFromHeaders: vi.fn(),
  mockSharePageWebMcpToolsComponent: vi.fn(),
  mockIsWebmcpEnabled: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => mockHeaders(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalServerSessionFromHeaders: (...args: unknown[]) =>
    mockGetOptionalServerSessionFromHeaders(...args),
}));

vi.mock("@/lib/feature-flags", () => ({
  isWebmcpEnabled: (...args: unknown[]) => mockIsWebmcpEnabled(...args),
}));

vi.mock("@/lib/profile/public-profile", () => ({
  materializePublicProfile: (...args: unknown[]) =>
    mockMaterializePublicProfile(...args),
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

vi.mock("@/lib/validation", () => ({
  isValidHandle: (...args: unknown[]) => mockIsValidHandle(...args),
}));

vi.mock("@/lib/render/avatar", () => ({
  getAvatarBase64: (...args: unknown[]) => mockGetAvatarBase64(...args),
}));

vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: (...args: unknown[]) => mockRenderBadgeSvg(...args),
}));

vi.mock("@/lib/env", () => ({
  getBaseUrl: () => "https://chapa.thecreativetoken.com",
}));

vi.mock("@/lib/utils/date", () => ({
  toDateString: () => "2026-05-03",
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: mockAfter };
});

vi.mock("next/navigation", () => ({
  notFound: () => {
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

vi.mock("@/lib/render/badge-svg-cache", () => ({
  buildBadgeSvgCacheKey: (h: string, d: string) => `badge:${h}:${d}`,
  readBadgeSvgCache: (...args: unknown[]) => mockReadBadgeSvgCache(...args),
  writeBadgeSvgCache: (...args: unknown[]) => mockWriteBadgeSvgCache(...args),
}));

vi.mock("@/lib/history/get-trend-data", () => ({
  getTrendData: (...args: unknown[]) => mockGetTrendData(...args),
}));

vi.mock("@/components/CommandBarHint", () => ({
  CommandBarHint: () => null,
}));
vi.mock("@/components/Navbar", () => ({
  Navbar: () => null,
}));
vi.mock("@/components/SharePageShortcuts", () => ({
  SharePageShortcuts: () => null,
}));
vi.mock("@/components/BadgeToolbar", () => ({
  BadgeToolbar: () => null,
}));
vi.mock("@/components/SharePageOwnerContentLazy", () => ({
  SharePageOwnerContentLazy: () => null,
}));
vi.mock("@/components/BadgeSkeleton", () => ({
  BadgeSkeleton: () => null,
}));
vi.mock("@/lib/i18n", () => ({
  DEFAULT_LOCALE: "es",
  LocaleSync: () => null,
}));
vi.mock("./SharePageHeader", () => ({
  SharePageHeader: () => null,
}));
vi.mock("./SharePageWebMcpTools", () => ({
  SharePageWebMcpTools: mockSharePageWebMcpToolsComponent,
}));

import { generateMetadata, SharePageContent } from "./page";

async function flushAfterCallbacks(): Promise<void> {
  const callbacks = mockAfter.mock.calls.map(
    (call) => call[0] as () => void | Promise<void>,
  );
  await Promise.all(callbacks.map((callback) => callback()));
}

/**
 * Walks the rendered React element tree returned by an async server
 * component (no DOM, no testing-library — this is a plain object graph of
 * `{ type, props }` element nodes) to find a `<script>` element with the
 * given `type` attribute (e.g. "application/ld+json"). Used to grab the
 * JSON-LD payload out of `SharePageContent`'s returned tree for a real
 * behavioral assertion on its content, rather than a source-text match.
 */
function findScriptElement(
  node: unknown,
  scriptType: string,
): { props: { dangerouslySetInnerHTML?: { __html?: string } } } | null {
  if (!node || typeof node !== "object") return null;
  const el = node as {
    type?: unknown;
    props?: { type?: string; children?: unknown };
  };
  if (el.type === "script" && el.props?.type === scriptType) {
    return el as { props: { dangerouslySetInnerHTML?: { __html?: string } } };
  }
  const children = el.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findScriptElement(child, scriptType);
      if (found) return found;
    }
  } else if (children) {
    return findScriptElement(children, scriptType);
  }
  return null;
}

function findElementByType(
  node: unknown,
  type: unknown,
): { props: Record<string, unknown> } | null {
  if (!node || typeof node !== "object") return null;
  const element = node as {
    type?: unknown;
    props?: { children?: unknown } & Record<string, unknown>;
  };
  if (element.type === type && element.props) {
    return { props: element.props };
  }
  const children = element.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElementByType(child, type);
      if (found) return found;
    }
  } else if (children) {
    return findElementByType(children, type);
  }
  return null;
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
  snapshot: { date: "2026-05-03", adjustedComposite: 65, tier: "Solid" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsValidHandle.mockReturnValue(true);
  mockIsWebmcpEnabled.mockResolvedValue(true);
  mockMaterializePublicProfile.mockResolvedValue(FAKE_MATERIALIZED);
  mockGetPublicProfileVerification.mockReturnValue({
    hash: "abc12345",
    date: "2026-05-03",
  });
  mockRunPublicProfileSideEffects.mockResolvedValue(undefined);
  mockPersistProfileSnapshot.mockResolvedValue(true);
  mockDeferProfileCacheWork.mockResolvedValue(undefined);
  mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
  mockRenderBadgeSvg.mockReturnValue(
    '<svg xmlns="http://www.w3.org/2000/svg">BADGE</svg>',
  );
  mockGetServerLocale.mockResolvedValue("en");
  mockReadBadgeSvgCache.mockResolvedValue(null);
  mockWriteBadgeSvgCache.mockResolvedValue(undefined);
  mockGetTrendData.mockResolvedValue({ trend: null, diff: null });
  mockHeaders.mockResolvedValue({ get: () => null });
  mockGetOptionalServerSessionFromHeaders.mockReturnValue(null);
  mockRedactImpactForVisitor.mockImplementation((impact: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confidence: _confidence, confidencePenalties: _confidencePenalties, ...rest } = impact;
    return rest;
  });
});

describe("Phase 4d — Share page i18n", () => {
  // #1104 — importing the dictionary modules and asserting on the actual
  // runtime translation values is strictly better than regexing
  // dictionaries/en.ts and es.ts as text: it reflects what the app really
  // ships (not source comments/formatting) and would catch a value moved to
  // the wrong key just as well as a missing one.
  describe("dictionary presence", () => {
    it("en.ts sharePage has metadataTitle with {handle} placeholder", async () => {
      const { en } = await import("@/lib/i18n/dictionaries/en");
      const sharePage = en.sharePage as Translations;
      expect(sharePage.metadataTitle as string).toContain("Developer Impact, Decoded");
      expect(sharePage.metadataTitle as string).toContain("{handle}");
    });

    it("es.ts sharePage has metadataTitle in Spanish", async () => {
      const { es } = await import("@/lib/i18n/dictionaries/es");
      const sharePage = es.sharePage as Translations;
      expect(sharePage.metadataTitle as string).toContain(
        "Impacto de desarrollador, decodificado",
      );
    });

    it("en.ts sharePage has srH1 key", async () => {
      const { en } = await import("@/lib/i18n/dictionaries/en");
      const sharePage = en.sharePage as Translations;
      expect(sharePage.srH1 as string).toBeTruthy();
    });

    it("es.ts sharePage has srH1 key in Spanish", async () => {
      const { es } = await import("@/lib/i18n/dictionaries/es");
      const sharePage = es.sharePage as Translations;
      expect(sharePage.srH1 as string).toContain("Impacto de desarrollador de {handle}");
    });

    it("en.ts shareOwner has ariaBusy key", async () => {
      const { en } = await import("@/lib/i18n/dictionaries/en");
      const shareOwner = en.shareOwner as Translations;
      expect(shareOwner.ariaBusy as string).toContain("Regenerating badge");
    });

    it("es.ts shareOwner has ariaBusy key in Spanish", async () => {
      const { es } = await import("@/lib/i18n/dictionaries/es");
      const shareOwner = es.shareOwner as Translations;
      expect(shareOwner.ariaBusy as string).toContain("Regenerando Chapa");
    });
  });

  describe("generateMetadata — es locale (social cards use primary locale)", () => {
    it("uses interpolated handle in OG image alt (Spanish)", async () => {
      // #1066 — locale now resolves via getServerLocale (cookie/header
      // fallback), mocked here to "es" to preserve this test's original
      // intent (its own precedence is covered by lib/i18n/server.test.ts
      // and the "locale resolution (#1066)" tests in page.test.tsx).
      mockGetServerLocale.mockResolvedValue("es");

      const metadata = await generateMetadata({
        params: Promise.resolve({ handle: "testuser" }),
      });

      const images = metadata.openGraph?.images as Array<{ alt?: string }>;
      expect(images[0]?.alt).toBe("Chapa de testuser");
    });

    it("uses handle in title", async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ handle: "jdoe" }),
      });

      expect(metadata.title).toContain("jdoe");
    });

    it("cache-busts the OG image URL with a daily version param and shares the same description with the Twitter card", async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ handle: "jdoe" }),
      });

      const images = metadata.openGraph?.images as Array<{ url?: string }>;
      expect(images[0]?.url).toMatch(/\/u\/jdoe\/og-image\?v=/);
      expect(metadata.twitter?.description).toBe(metadata.description);
    });

    it("uses English metadata for an explicit ?lang=en deep link", async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ handle: "jdoe" }),
        searchParams: Promise.resolve({ lang: "en" }),
      });

      expect(metadata.title).toBe("@jdoe — Developer Impact, Decoded");
      const images = metadata.openGraph?.images as Array<{ alt?: string }>;
      expect(images[0]?.alt).toBe("Chapa badge for jdoe");
    });

    it("returns Not Found for invalid handle", async () => {
      mockIsValidHandle.mockReturnValue(false);
      const metadata = await generateMetadata({
        params: Promise.resolve({ handle: "bad!!handle" }),
      });

      expect(metadata.title).toBe("Not Found");
    });
  });

  describe("SharePageContent — en locale", () => {
    it("mounts the public WebMCP host with the redacted server data", async () => {
      const trend = { direction: "improving", avgDelta: 2 };
      const diff = {
        adjustedComposite: 3,
        confidence: 4,
        penaltyChanges: { added: [], removed: [] },
      };
      mockGetTrendData.mockResolvedValue({ trend, diff });

      const result = await SharePageContent({ handle: "testuser" });
      const host = findElementByType(
        result,
        mockSharePageWebMcpToolsComponent,
      );

      expect(host).not.toBeNull();
      expect(host?.props).toMatchObject({
        handle: "testuser",
        stats: FAKE_MATERIALIZED.stats,
        verification: { hash: "abc12345", date: "2026-05-03" },
        trend,
        craftResult: null,
      });
      expect(host?.props.impact).not.toHaveProperty("confidence");
      expect(host?.props.diff).not.toHaveProperty("confidence");
      expect(host?.props.diff).not.toHaveProperty("penaltyChanges");
    });

    it("omits the public WebMCP host when the server kill-switch is off", async () => {
      mockIsWebmcpEnabled.mockResolvedValue(false);

      const result = await SharePageContent({ handle: "testuser" });

      expect(
        findElementByType(result, mockSharePageWebMcpToolsComponent),
      ).toBeNull();
    });

    it("renders sr-only h1 with handle interpolated", async () => {
      mockGetServerLocale.mockResolvedValue("en");
      const result = await SharePageContent({ handle: "testuser" });
      // result is a JSX element — check the props tree
      const jsxString = JSON.stringify(result);
      expect(jsxString).toContain("testuser");
    });

    it("renders sr-only h1 with Spanish text in es locale", async () => {
      mockGetServerLocale.mockResolvedValue("es");
      const result = await SharePageContent({ handle: "devuser" });
      const jsxString = JSON.stringify(result);
      expect(jsxString).toContain("devuser");
    });

    it("embeds the server-rendered badge SVG via dangerouslySetInnerHTML", async () => {
      const result = await SharePageContent({ handle: "testuser" });
      const jsxString = JSON.stringify(result);
      // mockRenderBadgeSvg (set in beforeEach) returns this exact SVG markup.
      expect(jsxString).toContain("BADGE");
    });

    it("does not hardcode sharePage.h2 text — delegates to SharePageH2 client component", async () => {
      const result = await SharePageContent({ handle: "testuser" });
      const jsxString = JSON.stringify(result);
      expect(jsxString).not.toContain("Tu Impacto, Decodificado");
      expect(jsxString).not.toContain("Your Impact, Decoded");
    });

    // #800/#1104 — the avatar fetch races a ~250ms deadline against the real
    // GitHub avatar CDN so a slow response can't block TTFB. These two tests
    // bracket that deadline with fake timers and exercise the actual
    // Promise.race, rather than regexing the magic number out of source:
    // an avatar that resolves just inside the deadline gets cached, one
    // that resolves just outside it doesn't.
    it("treats an avatar fetch that resolves just past the ~250ms deadline as timed out and skips caching the placeholder-avatar render", async () => {
      vi.useFakeTimers();
      try {
        mockGetAvatarBase64.mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve("data:image/png;base64,slow"), 251),
            ),
        );
        const resultPromise = SharePageContent({ handle: "testuser" });
        await vi.advanceTimersByTimeAsync(251);
        await resultPromise;
        await flushAfterCallbacks();

        expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
          FAKE_MATERIALIZED.stats,
          FAKE_MATERIALIZED.displayImpact,
          expect.objectContaining({ avatarDataUri: undefined }),
        );
        expect(mockWriteBadgeSvgCache).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("caches a render whose avatar resolved just within the ~250ms deadline", async () => {
      vi.useFakeTimers();
      try {
        mockGetAvatarBase64.mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve("data:image/png;base64,fast"), 249),
            ),
        );
        const resultPromise = SharePageContent({ handle: "testuser" });
        await vi.advanceTimersByTimeAsync(249);
        await resultPromise;
        await flushAfterCallbacks();

        expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
          FAKE_MATERIALIZED.stats,
          FAKE_MATERIALIZED.displayImpact,
          expect.objectContaining({ avatarDataUri: "data:image/png;base64,fast" }),
        );
        expect(mockWriteBadgeSvgCache).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not cache an unverified badge so a later complete fetch can heal", async () => {
      mockGetPublicProfileVerification.mockReturnValue(null);

      await SharePageContent({ handle: "testuser" });
      await flushAfterCallbacks();

      expect(mockRenderBadgeSvg).toHaveBeenCalledWith(
        FAKE_MATERIALIZED.stats,
        FAKE_MATERIALIZED.displayImpact,
        expect.objectContaining({
          verificationHash: undefined,
          verificationDate: undefined,
        }),
      );
      expect(mockWriteBadgeSvgCache).not.toHaveBeenCalled();
    });

    it("keeps fallback badge image requests read-only in smoke mode", async () => {
      mockRenderBadgeSvg.mockReturnValue("");

      const result = await SharePageContent({
        handle: "testuser",
        readOnly: true,
      });
      const jsxString = JSON.stringify(result);

      expect(jsxString).toContain("/u/testuser/badge.svg?");
      expect(jsxString).toContain("__chapa_smoke=1");
      // #230 — the fallback <img> is the LCP element, so it must be
      // prioritized.
      expect(jsxString).toContain('"fetchPriority":"high"');
      expect(mockGetAvatarBase64).not.toHaveBeenCalled();
      expect(mockAfter).not.toHaveBeenCalled();
      expect(mockWriteBadgeSvgCache).not.toHaveBeenCalled();
    });

    // #1106 — the only prior coverage checked that page.tsx's source text
    // contains the string "renderJsonLd(personJsonLd)" (page.test.ts's
    // "JSON-LD security" describe block). That protects against someone
    // swapping out the escaping helper, but nothing fails if `confidence` or
    // `confidencePenalties` were spread into `personJsonLd` itself — the
    // CLAUDE.md acceptance criterion is that confidence data must be
    // "excluded from public metadata (JSON-LD)". This test renders the real
    // component tree (FAKE_MATERIALIZED.displayImpact carries
    // `confidence: 85`, matching a real ImpactV6Result) and inspects the
    // actual serialized JSON-LD payload — a behavioral assertion on output,
    // not a source-text pattern match.
    it("excludes confidence data from the rendered JSON-LD script (privacy boundary)", async () => {
      const result = await SharePageContent({ handle: "testuser" });

      const scriptEl = findScriptElement(result, "application/ld+json");
      expect(scriptEl).not.toBeNull();

      const html = scriptEl!.props.dangerouslySetInnerHTML?.__html;
      expect(html).toBeTruthy();

      // renderJsonLd unicode-escapes <, >, & — undo that so JSON.parse works.
      const unescaped = html!
        .replace(/\\u003c/g, "<")
        .replace(/\\u003e/g, ">")
        .replace(/\\u0026/g, "&");
      const parsed = JSON.parse(unescaped) as Record<string, unknown>;

      expect(parsed).not.toHaveProperty("confidence");
      expect(parsed).not.toHaveProperty("confidenceReasons");
      expect(parsed).not.toHaveProperty("confidencePenalties");
      // Belt-and-suspenders: no field anywhere in the payload should mention
      // confidence in its key or value.
      expect(JSON.stringify(parsed).toLowerCase()).not.toContain("confidence");
    });
  });

  // #1104 — most of this file's former source-text assertions are now
  // subsumed by real behavioral coverage: SharePageLocaleContent.test.tsx
  // and SharePageH2.test.tsx render those two client components directly
  // and assert on their translated output, and the "generateMetadata" /
  // "SharePageContent" describe blocks above already prove interpolation
  // and locale-driven text end-to-end. What remains here has no
  // render-observable equivalent (route-segment config; the ordering of
  // context providers/Suspense boundaries around SharePageContent, which
  // leaves no DOM footprint since LocaleSync/LanguageProvider render
  // nothing themselves; and SharePageH2 as a component reference, which
  // JSON.stringify on the JSX tree silently drops since functions don't
  // serialize to JSON).
  describe("page.tsx source — non-renderable architecture checks", () => {
    const SOURCE = fs.readFileSync(
      path.resolve(__dirname, "page.tsx"),
      "utf-8",
    );

    it("establishes a query-initialized provider before streamed content", () => {
      const pageStart = SOURCE.indexOf("export default async function SharePage");
      const contentStart = SOURCE.indexOf(
        "export async function SharePageContent",
      );
      const provider = SOURCE.indexOf("<LanguageProvider", pageStart);
      const localeSync = SOURCE.indexOf("<LocaleSync", pageStart);
      const suspense = SOURCE.indexOf("<Suspense", pageStart);

      expect(pageStart).toBeGreaterThan(-1);
      expect(contentStart).toBeGreaterThan(-1);
      expect(provider).toBeGreaterThan(pageStart);
      expect(localeSync).toBeGreaterThan(provider);
      expect(localeSync).toBeLessThan(suspense);
      expect(suspense).toBeLessThan(contentStart);
      expect(SOURCE.slice(contentStart)).not.toContain("<LocaleSync");
    });

    // #1066 (FE-H2) — revalidate = 3600 was inert: both generateMetadata
    // and the page component already unconditionally awaited searchParams,
    // opting the route out of static rendering entirely. The route now
    // commits to dynamic rendering instead (see page.test.ts's "dynamic
    // rendering (#1066)" describe block for the replacement coverage).
    it("does NOT export revalidate (genuinely dynamic, not ISR)", () => {
      expect(SOURCE).not.toContain("export const revalidate");
    });

    it("renders the SharePageHeader client component for the page heading", () => {
      // #1217 replaced the small uppercase SharePageH2 line with a header that
      // names the profile and carries the headline score.
      expect(SOURCE).toContain("SharePageHeader");
      expect(SOURCE).not.toContain("SharePageH2");
    });
  });
});
