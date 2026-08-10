// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/lib/verification/store", () => ({
  getVerificationRecord: vi.fn(),
}));

vi.mock("@/components/Navbar", () => ({
  Navbar: ({ locale }: { locale?: string }) => (
    <nav data-testid="navbar" data-locale={locale}>Navbar</nav>
  ),
}));

vi.mock("@/lib/i18n", () => ({
  LanguageProvider: ({
    children,
    initialLocale,
  }: {
    children: React.ReactNode;
    initialLocale: string;
  }) => (
    <div data-testid="language-provider" data-initial-locale={initialLocale}>
      {children}
    </div>
  ),
  LangSync: () => <span data-testid="lang-sync" />,
  LocaleSync: ({ queryLang }: { queryLang?: string }) => (
    <span data-testid="locale-sync" data-query-lang={queryLang} />
  ),
}));

// Mock getServerLocale + getServerT to return English without needing Next.js headers()
vi.mock("@/lib/i18n/server", async () => {
  const { en } = await import("@/lib/i18n/dictionaries/en");
  function deepGet(obj: Record<string, unknown>, key: string): unknown {
    const parts = key.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || typeof current !== "object" || Array.isArray(current)) return key;
      current = (current as Record<string, unknown>)[part];
      if (current === undefined) return key;
    }
    return current;
  }
  return {
    getServerLocale: vi.fn().mockImplementation(async (lang?: string) =>
      lang === "es" || lang === "en" ? lang : "en"
    ),
    getServerT: vi.fn().mockImplementation(() => (key: string) =>
      deepGet(en as unknown as Record<string, unknown>, key)
    ),
  };
});

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { getVerificationRecord } from "@/lib/verification/store";
import { getServerLocale } from "@/lib/i18n/server";
import VerifyPage, { generateMetadata } from "./page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const MOCK_RECORD = {
  handle: "testuser",
  displayName: "Test User",
  adjustedComposite: 72,
  confidence: 85,
  tier: "Gold",
  archetype: "Builder",
  dimensions: {
    delivery: 80,
    quality: 70,
    consistency: 65,
    breadth: 55,
  },
  commitsTotal: 420,
  prsMergedCount: 38,
  reviewsSubmittedCount: 15,
  generatedAt: "2026-03-22",
  profileType: "verified",
};

// ---------------------------------------------------------------------------
// generateMetadata — covers HASH_PATTERN true/false branches
// ---------------------------------------------------------------------------

describe("generateMetadata", () => {
  it("returns verified title for a valid 8-char hex hash", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ hash: "a1b2c3d4" }),
      searchParams: Promise.resolve({}),
    });
    // English: verify.title = 'Verify a badge'
    expect(meta.title).toBe("Verify a badge a1b2c3d4");
  });

  it("returns invalid hash title for a non-hex hash", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ hash: "not-valid!" }),
      searchParams: Promise.resolve({}),
    });
    // English: verifyDetail.invalidHashTitle = 'Invalid hash'
    expect(meta.title).toBe("Invalid hash");
  });

  it("disables robots indexing for all verify pages", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ hash: "a1b2c3d4" }),
      searchParams: Promise.resolve({}),
    });
    expect((meta.robots as { index: boolean }).index).toBe(false);
  });

  it("ignores an ambiguous repeated locale parameter", async () => {
    await generateMetadata({
      params: Promise.resolve({ hash: "not-valid!" }),
      searchParams: Promise.resolve({ lang: ["en", "es"] }),
    });

    expect(getServerLocale).toHaveBeenLastCalledWith(undefined);
  });
});

describe("VerifyPage", () => {
  it("synchronizes the shared language provider with the query locale", async () => {
    const jsx = await VerifyPage({
      params: Promise.resolve({ hash: "not-valid!" }),
      searchParams: Promise.resolve({ lang: "es" }),
    });
    render(jsx);

    expect(screen.getByTestId("locale-sync").getAttribute("data-query-lang")).toBe(
      "es",
    );
    expect(
      screen.getByTestId("language-provider").getAttribute("data-initial-locale"),
    ).toBe("es");
    expect(screen.getByTestId("navbar").getAttribute("data-locale")).toBe("es");
    expect(screen.getByTestId("lang-sync")).toBeDefined();
  });

  describe("invalid hash", () => {
    it("renders InvalidHashCard for non-hex characters", async () => {
      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "zzzzzzzz" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      // English: verifyDetail.invalidHashTitle = 'Invalid hash'
      expect(screen.getByText("Invalid hash")).toBeDefined();
      // English: verifyDetail.invalidHashDescription
      expect(
        screen.getByText(
          "The verification hash must be 8, 16, or 32 hexadecimal characters.",
        ),
      ).toBeDefined();
      expect(screen.getByText("zzzzzzzz")).toBeDefined();
    });

    it("renders InvalidHashCard for wrong-length hash", async () => {
      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "abc" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      // English: verifyDetail.invalidHashTitle = 'Invalid hash'
      expect(screen.getByText("Invalid hash")).toBeDefined();
    });
  });

  describe("valid hash, no record", () => {
    it("renders NotFoundCard when record is null", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(null);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      // English: verifyDetail.notFoundTitle = 'Not found'
      expect(screen.getByText("Not found")).toBeDefined();
      // English: verifyDetail.notFoundDescription
      expect(
        screen.getByText("No verification record found for this hash."),
      ).toBeDefined();
      expect(screen.getByText("a1b2c3d4")).toBeDefined();
    });
  });

  describe("valid hash with record", () => {
    it("renders VerifiedCard with developer info", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      // English: verifyDetail.verifiedTitle = 'Badge verified'
      expect(screen.getByText("Badge verified")).toBeDefined();
      expect(screen.getByText("@testuser")).toBeDefined();
      expect(screen.getByText("Test User")).toBeDefined();
    });

    it("displays impact score and tier", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.getByText("72")).toBeDefined();
      expect(screen.getByText("Gold")).toBeDefined();
      expect(screen.getByText("Builder")).toBeDefined();
    });

    it("displays all four dimensions", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.getByText("delivery")).toBeDefined();
      expect(screen.getByText("80")).toBeDefined();
      expect(screen.getByText("quality")).toBeDefined();
      expect(screen.getByText("70")).toBeDefined();
      expect(screen.getByText("consistency")).toBeDefined();
      expect(screen.getByText("65")).toBeDefined();
      expect(screen.getByText("breadth")).toBeDefined();
      expect(screen.getByText("55")).toBeDefined();
    });

    it("displays key metrics", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.getByText("420")).toBeDefined();
      expect(screen.getByText("Commits")).toBeDefined();
      expect(screen.getByText("38")).toBeDefined();
      // English: verifyDetail.prsMerged = 'PRs merged'
      expect(screen.getByText("PRs merged")).toBeDefined();
      expect(screen.getByText("15")).toBeDefined();
      // English: verifyDetail.reviews = 'Reviews'
      expect(screen.getByText("Reviews")).toBeDefined();
    });

    it("shows generated date and View Badge link", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      // English: verifyDetail.generatedOn = 'Generated on'
      expect(screen.getByText("Generated on 2026-03-22")).toBeDefined();
      // English: verifyDetail.viewBadge = 'View badge'
      const viewBadge = screen.getByText("View badge");
      expect(viewBadge.closest("a")?.getAttribute("href")).toBe(
        "/u/testuser/badge.svg",
      );
    });

    it("links developer handle to share page", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      const handleLink = screen.getByText("@testuser");
      expect(handleLink.closest("a")?.getAttribute("href")).toBe(
        "/u/testuser",
      );
    });

    it("omits display name row when not provided", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue({
        ...MOCK_RECORD,
        displayName: undefined,
      });

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      // English: verifyDetail.name = 'Name'
      expect(screen.queryByText("Name")).toBeNull();
    });
  });
});
