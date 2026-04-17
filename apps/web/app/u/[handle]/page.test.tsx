import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockMaterializePublicProfile,
  mockGetPublicProfileVerification,
  mockRunPublicProfileSideEffects,
  mockCacheGet,
  mockIsValidHandle,
  mockGetAvatarBase64,
  mockRenderBadgeSvg,
  mockAfter,
} = vi.hoisted(() => ({
  mockMaterializePublicProfile: vi.fn(),
  mockGetPublicProfileVerification: vi.fn(),
  mockRunPublicProfileSideEffects: vi.fn(),
  mockCacheGet: vi.fn(),
  mockIsValidHandle: vi.fn(),
  mockGetAvatarBase64: vi.fn(),
  mockRenderBadgeSvg: vi.fn(),
  mockAfter: vi.fn(),
}));

vi.mock("@/lib/profile/public-profile", () => ({
  materializePublicProfile: (...args: unknown[]) => mockMaterializePublicProfile(...args),
  getPublicProfileVerification: (...args: unknown[]) =>
    mockGetPublicProfileVerification(...args),
  runPublicProfileSideEffects: (...args: unknown[]) =>
    mockRunPublicProfileSideEffects(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
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

vi.mock("@/components/GlobalCommandBarLazy", () => ({
  GlobalCommandBarLazy: () => null,
}));
vi.mock("@/components/NavbarClient", () => ({
  NavbarClient: () => "<nav />",
}));
vi.mock("@/components/SharePageShortcuts", () => ({
  SharePageShortcuts: () => null,
}));
vi.mock("@/components/ShareBadgePreviewLazy", () => ({
  ShareBadgePreviewLazy: () => "<div>interactive-preview</div>",
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
    mockCacheGet.mockResolvedValue(null);
    mockGetAvatarBase64.mockResolvedValue("data:image/png;base64,abc123");
    mockRenderBadgeSvg.mockReturnValue(FAKE_SVG);
  });

  it("generates metadata with the daily OG cache buster", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ handle: "testuser" }),
    });

    expect(metadata.openGraph?.images).toEqual([
      {
        url: "https://chapa.thecreativetoken.com/u/testuser/og-image?v=2026-04-17",
        width: 1200,
        height: 630,
        alt: "Chapa badge for testuser",
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

  it("renders the inline badge from displayImpact, not rawImpact", async () => {
    await renderPage();

    expect(mockMaterializePublicProfile).toHaveBeenCalledWith("testuser");
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

    expect(mockRunPublicProfileSideEffects).toHaveBeenCalledWith(
      "testuser",
      FAKE_MATERIALIZED,
      { verification: { hash: "abc12345", date: "2026-04-17" } },
    );
  });

  it("does not register side effects when materialization returns null", async () => {
    mockMaterializePublicProfile.mockResolvedValue(null);

    await renderPage();

    expect(mockAfter).not.toHaveBeenCalled();
    expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
  });

  it("does not register side effects for the interactive preview path", async () => {
    mockCacheGet.mockResolvedValue({
      background: "aurora",
      cardStyle: "flat",
      border: "solid-amber",
      scoreEffect: "standard",
      heatmapAnimation: "fade-in",
      interaction: "static",
      statsDisplay: "static",
      tierTreatment: "standard",
      celebration: "none",
    });

    await renderPage();

    expect(mockRenderBadgeSvg).not.toHaveBeenCalled();
    expect(mockAfter).not.toHaveBeenCalled();
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
});
