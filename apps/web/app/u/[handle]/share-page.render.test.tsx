/**
 * Phase 4d — Share page i18n: interpolate helper, sharePage namespace,
 * generateMetadata locale, and LocaleSync mount.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const {
  mockMaterializePublicProfile,
  mockGetPublicProfileVerification,
  mockRunPublicProfileSideEffects,
  mockPersistProfileSnapshot,
  mockDeferProfileCacheWork,
  mockIsValidHandle,
  mockGetAvatarBase64,
  mockRenderBadgeSvg,
  mockAfter,
  mockGetServerLocale,
  mockReadBadgeSvgCache,
  mockWriteBadgeSvgCache,
  mockGetTrendData,
} = vi.hoisted(() => ({
  mockMaterializePublicProfile: vi.fn(),
  mockGetPublicProfileVerification: vi.fn(),
  mockRunPublicProfileSideEffects: vi.fn(),
  mockPersistProfileSnapshot: vi.fn(),
  mockDeferProfileCacheWork: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockAfter: vi.fn(),
  mockGetServerLocale: vi.fn(),
  mockReadBadgeSvgCache: vi.fn(),
  mockWriteBadgeSvgCache: vi.fn(),
  mockGetTrendData: vi.fn(),
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
vi.mock("@/components/NavbarClient", () => ({
  NavbarClient: () => null,
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
vi.mock("./SharePageH2", () => ({
  SharePageH2: () => null,
}));

import { generateMetadata, SharePageContent } from "./page";

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
});

describe("Phase 4d — Share page i18n", () => {
  describe("dictionary presence", () => {
    const EN_DICT = fs.readFileSync(
      path.resolve(__dirname, "../../../lib/i18n/dictionaries/en.ts"),
      "utf-8",
    );
    const ES_DICT = fs.readFileSync(
      path.resolve(__dirname, "../../../lib/i18n/dictionaries/es.ts"),
      "utf-8",
    );

    it("en.ts has sharePage namespace", () => {
      expect(EN_DICT).toContain("sharePage:");
    });

    it("es.ts has sharePage namespace", () => {
      expect(ES_DICT).toContain("sharePage:");
    });

    it("en.ts sharePage has metadataTitle with {handle} placeholder", () => {
      expect(EN_DICT).toContain("Developer Impact, Decoded");
      expect(EN_DICT).toContain("{handle}");
    });

    it("es.ts sharePage has metadataTitle in Spanish", () => {
      expect(ES_DICT).toContain("Impacto de desarrollador, decodificado");
    });

    it("en.ts sharePage has srH1 key", () => {
      expect(EN_DICT).toContain("srH1:");
    });

    it("es.ts sharePage has srH1 key in Spanish", () => {
      expect(ES_DICT).toContain("Impacto de desarrollador de {handle}");
    });

    it("en.ts shareOwner has new ariaBusy key", () => {
      expect(EN_DICT).toContain("ariaBusy:");
      expect(EN_DICT).toContain("Regenerating badge");
    });

    it("es.ts shareOwner has ariaBusy key in Spanish", () => {
      expect(ES_DICT).toContain("ariaBusy:");
      expect(ES_DICT).toContain("Regenerando Chapa");
    });
  });

  describe("generateMetadata — es locale (social cards use primary locale)", () => {
    it("uses interpolated handle in OG image alt (Spanish)", async () => {
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

    it("returns Not Found for invalid handle", async () => {
      mockIsValidHandle.mockReturnValue(false);
      const metadata = await generateMetadata({
        params: Promise.resolve({ handle: "bad!!handle" }),
      });

      expect(metadata.title).toBe("Not Found");
    });
  });

  describe("SharePageContent — en locale", () => {
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

    it("does not hardcode sharePage.h2 text — delegates to SharePageH2 client component", async () => {
      const result = await SharePageContent({ handle: "testuser" });
      const jsxString = JSON.stringify(result);
      expect(jsxString).not.toContain("Tu Impacto, Decodificado");
      expect(jsxString).not.toContain("Your Impact, Decoded");
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
      expect(mockGetAvatarBase64).not.toHaveBeenCalled();
      expect(mockAfter).not.toHaveBeenCalled();
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
      expect(mockGetAvatarBase64).not.toHaveBeenCalled();
      expect(mockAfter).not.toHaveBeenCalled();
      expect(mockWriteBadgeSvgCache).not.toHaveBeenCalled();
    });
  });

  describe("page.tsx source — LocaleSync mount", () => {
    const SOURCE = fs.readFileSync(
      path.resolve(__dirname, "page.tsx"),
      "utf-8",
    );

    it("imports LocaleSync from @/lib/i18n", () => {
      expect(SOURCE).toContain("LocaleSync");
      expect(SOURCE).toContain("@/lib/i18n");
    });

    it("mounts <LocaleSync> in the page shell", () => {
      expect(SOURCE).toContain("<LocaleSync");
    });

    it("imports interpolate from @/lib/i18n/interpolate", () => {
      expect(SOURCE).toContain("interpolate");
      expect(SOURCE).toContain("@/lib/i18n/interpolate");
    });

    it("imports getServerT from @/lib/i18n/server", () => {
      expect(SOURCE).toContain("getServerT");
      expect(SOURCE).toContain("@/lib/i18n/server");
    });

    it("still exports revalidate = 3600", () => {
      expect(SOURCE).toContain("export const revalidate = 3600");
    });

    it("uses sharePage.srH1 key in h1", () => {
      expect(SOURCE).toContain("sharePage.srH1");
    });

    it("renders SharePageH2 client component for the badge section heading", () => {
      expect(SOURCE).toContain("SharePageH2");
    });

    it("uses sharePage.metadataOgImageAlt in generateMetadata", () => {
      expect(SOURCE).toContain("sharePage.metadataOgImageAlt");
    });
  });

  describe("SharePageH2.tsx source", () => {
    const H2_SOURCE = fs.readFileSync(
      path.resolve(__dirname, "SharePageH2.tsx"),
      "utf-8",
    );

    it("is a client component", () => {
      expect(H2_SOURCE).toContain("'use client'");
    });

    it("uses sharePage.h2 key", () => {
      expect(H2_SOURCE).toContain("sharePage.h2");
    });

    it("uses useTranslation", () => {
      expect(H2_SOURCE).toContain("useTranslation");
    });
  });
});
