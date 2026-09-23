// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/lib/verification/store", () => ({
  getReceiptVerificationV7: vi.fn(),
}));

const featureFlagMocks = vi.hoisted(() => ({
  isWebmcpEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/feature-flags", () => ({
  isWebmcpEnabled: featureFlagMocks.isWebmcpEnabled,
}));

vi.mock("./VerifyPageWebMcpTools", () => ({
  VerifyPageWebMcpTools: ({
    hash,
    isV7,
  }: {
    hash: string;
    isV7: boolean;
  }) => (
    <span
      data-testid="verify-page-webmcp-tools"
      data-hash={hash}
      data-is-v7={String(isV7)}
    />
  ),
}));

vi.mock("@/components/Navbar", () => ({
  Navbar: ({
    locale,
    navLinks,
  }: {
    locale?: string;
    navLinks?: Array<{ label: string; href: string }>;
  }) => (
    <nav data-testid="navbar" data-locale={locale}>
      Navbar
      {navLinks?.map((l) => (
        <a key={l.href} href={l.href} data-testid={`navbar-link-${l.href}`}>
          {l.label}
        </a>
      ))}
    </nav>
  ),
}));

vi.mock("@/components/SiteFooter", () => ({
  SiteFooter: ({ t }: { t: (key: string) => unknown }) => (
    <footer data-testid="site-footer">{t("landing.footer.privacy") as string}</footer>
  ),
}));

vi.mock("@/lib/i18n", () => ({
  DEFAULT_LOCALE: "es",
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

import { getReceiptVerificationV7 } from "@/lib/verification/store";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { getServerLocale } from "@/lib/i18n/server";
import VerifyPage, { generateMetadata } from "./page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  featureFlagMocks.isWebmcpEnabled.mockResolvedValue(true);
});

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
          "Use a complete v7 receipt token or an 8, 16, or 32-character legacy hexadecimal code.",
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

  // #1335 phase 5 — `verification_records` is retired. Any well-formed
  // non-v7 hash reaching this branch is a retired v6 code, not a lookup.
  describe("retired v6 code", () => {
    it("renders the retired-code explanation for a valid 8-char legacy hash", async () => {
      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.getByText("Retired verification code")).toBeDefined();
      expect(
        screen.getByText(
          "This is a retired v6 verification code. Current badges use v7.2 receipt codes.",
        ),
      ).toBeDefined();
      expect(screen.getByText("a1b2c3d4")).toBeDefined();
      const webMcpHost = screen.getByTestId("verify-page-webmcp-tools");
      expect(webMcpHost.getAttribute("data-hash")).toBe("a1b2c3d4");
      expect(webMcpHost.getAttribute("data-is-v7")).toBe("false");
    });

    it("wraps a supported 32-character hash on narrow viewports", async () => {
      const hash = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.getByText(hash).className).toContain("break-all");
      expect(
        document.querySelector('template[data-chapa-document-locale="en"]'),
      ).not.toBeNull();
    });

    it("omits the WebMCP host when the server kill-switch is off", async () => {
      featureFlagMocks.isWebmcpEnabled.mockResolvedValue(false);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.queryByTestId("verify-page-webmcp-tools")).toBeNull();
      expect(screen.getByText("Retired verification code")).toBeDefined();
    });
  });

  // #1167 (UX-B1, launch blocker) — /verify/[hash] had no footer at all, so
  // a visitor landing here (e.g. scanning a QR code on a badge) had no way
  // to reach Privacy or Terms.
  describe("SiteFooter + real-route nav links (#1167 / UX-B1)", () => {
    it("renders SiteFooter on the invalid-hash branch", async () => {
      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "not-valid!" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      // English: landing.footer.privacy = 'Privacy'
      expect(screen.getByTestId("site-footer").textContent).toBe("Privacy");
    });

    it("renders SiteFooter on the retired-v6-code branch", async () => {
      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.getByTestId("site-footer").textContent).toBe("Privacy");
    });

    it("gives the Navbar real-route inner nav links, not landing hash anchors", async () => {
      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "not-valid!" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.getByTestId("navbar-link-/about").textContent).toBe("About");
      expect(screen.getByTestId("navbar-link-/about/scoring").textContent).toBe(
        "Scoring",
      );
      expect(screen.getByTestId("navbar-link-/verify").textContent).toBe("Verify");
    });
  });
});


describe("v7 receipt verification page", () => {
  const token = `v7.11111111-1111-4111-8111-111111111111.${"a".repeat(64)}`;
  const props = { params: Promise.resolve({ hash: token }), searchParams: Promise.resolve({}) };
  it("shows separate issuance, signature and arithmetic claims with the actual reference", async () => {
    const envelope = await receiptFixtureV7();
    vi.mocked(getReceiptVerificationV7).mockResolvedValue({ version: "v7", status: "current", revisionId: envelope.receipt.revisionId, issuanceRecorded: true, signatureAuthenticated: true, keyVersion: "v7-1", arithmetic: "offline_replay_available", sourceEvidence: "not_verified", envelope });
    render(await VerifyPage(props));
    expect(screen.getByRole("heading", { name: "Score receipt" })).toBeDefined();
    expect(screen.getByText("Signature authenticated")).toBeDefined();
    expect(screen.getByText("2026-09-01T12:00:00.000Z")).toBeDefined();
    expect(screen.getByText("Craft was not included")).toBeDefined();
    expect(screen.getByText(/does not inspect an SVG/i)).toBeDefined();
    expect(screen.queryByText("Badge verified")).toBeNull();
    expect(screen.getByRole("link", { name: "Open receipt JSON" }).getAttribute("href")).toBe(`/api/verify/${token}`);
  });
  it("does not show score content or verification success for a revoked receipt", async () => {
    vi.mocked(getReceiptVerificationV7).mockResolvedValue({ version: "v7", status: "revoked", revisionId: "11111111-1111-4111-8111-111111111111", signatureAuthenticated: false });
    render(await VerifyPage(props));
    expect(screen.getByRole("heading", { name: "Receipt revoked" })).toBeDefined();
    expect(screen.queryByText("Signature authenticated")).toBeNull();
    expect(screen.queryByText("Core score")).toBeNull();
    expect(screen.queryByText("Open receipt JSON")).toBeNull();
  });
  it("distinguishes unavailable storage from a missing receipt without exposing the error", async () => {
    vi.mocked(getReceiptVerificationV7).mockRejectedValue(new Error("private evidence body"));
    render(await VerifyPage(props));
    expect(screen.getByRole("heading", { name: "Verification unavailable" })).toBeDefined();
    expect(screen.queryByText(/private evidence body/)).toBeNull();
  });
});
