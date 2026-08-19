// @vitest-environment jsdom
/**
 * Render tests for simple page components that were previously only tested
 * via source-reading (contract tests). These tests actually import and render
 * the component functions to get function coverage.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Translations } from "@/lib/i18n/types";

// Mock shared dependencies
vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/NavbarClient", () => ({
  NavbarClient: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/GlobalCommandBar", () => ({
  GlobalCommandBar: () => <div data-testid="command-bar" />,
}));

vi.mock("@/components/GlobalCommandBarLazy", () => ({
  GlobalCommandBarLazy: () => null,
}));

vi.mock("@/components/LiteYouTubeEmbed", () => ({
  LiteYouTubeEmbed: () => <div data-testid="youtube-embed" />,
}));

vi.mock("./verify/VerifyForm", () => ({
  VerifyForm: () => <div data-testid="verify-form" />,
}));

vi.mock("@/lib/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n")>();
  return {
    ...actual,
    LocaleSync: () => null,
  };
});

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
    // Still needed by non-migrated pages exercised in this file
    // (coming-soon/*) that read locale via getServerLocale() — only the 9
    // #1023-migrated pages (privacy, terms, about*, archetypes/*) now take
    // locale from the route's [locale] segment param instead.
    getServerLocale: vi.fn().mockResolvedValue("en"),
    getServerT: vi.fn().mockImplementation(() => (key: string) =>
      deepGet(en as unknown as Record<string, unknown>, key)
    ),
  };
});

vi.mock("./verify/VerifyForm", () => ({
  VerifyForm: () => <div data-testid="verify-form" />,
}));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Privacy page (async server component)
// ---------------------------------------------------------------------------
describe("PrivacyPage render", () => {
  it("renders with navbar", async () => {
    const { default: PrivacyPage } = await import("./[locale]/privacy/page");
    render(await PrivacyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByTestId("navbar")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Terms page (async server component)
// ---------------------------------------------------------------------------
describe("TermsPage render", () => {
  it("renders with navbar", async () => {
    const { default: TermsPage } = await import("./[locale]/terms/page");
    render(await TermsPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByTestId("navbar")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Coming Soon page
// ---------------------------------------------------------------------------
describe("ComingSoonPage render", () => {
  it("renders with Chapa heading", async () => {
    const { default: ComingSoonPage } = await import("./coming-soon/page");
    const jsx = await ComingSoonPage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByText(/Coming soon/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Verify input page (server component — must await the async function)
// ---------------------------------------------------------------------------
describe("VerifyInputPage render", () => {
  it("renders with verify heading, main landmark, complement-token styling, and the verify form", async () => {
    const { default: VerifyInputPage } = await import("./verify/page");
    const jsx = await VerifyInputPage();
    render(jsx);
    expect(screen.getByTestId("navbar")).toBeDefined();
    expect(document.getElementById("main-content")).not.toBeNull();
    expect(screen.getByTestId("verify-form")).toBeDefined();

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.querySelector(".text-complement")).not.toBeNull();

    expect(screen.getByText("chapa verify")).toBeDefined();
  });

  it("generateMetadata returns the real verify title/description with noindex robots", async () => {
    const { generateMetadata } = await import("./verify/page");
    const meta = await generateMetadata();
    const { en } = await import("@/lib/i18n/dictionaries/en");
    const enVerify = en.verify as Translations;
    expect(meta.title).toBe(enVerify.title as string);
    expect(meta.description).toBe(enVerify.description as string);
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("dictionary copy explains hash format, where to find it, and the verified-vs-public claim limit (EN and ES)", async () => {
    const { en } = await import("@/lib/i18n/dictionaries/en");
    const { es } = await import("@/lib/i18n/dictionaries/es");
    const enContent = JSON.stringify(en.verify);
    const esContent = JSON.stringify(es.verify);

    expect(enContent).toContain("8, 16, or 32-character");
    expect(enContent).toContain("right edge");
    expect(enContent).toContain("badge marked Verified metrics");
    expect(enContent).toContain(
      "Badges marked Public metrics do not claim cryptographic verification",
    );
    expect(enContent).not.toContain("from any Chapa badge");

    expect(esContent).toContain("Métricas verificadas");
    expect(esContent).toContain(
      "Métricas públicas» no afirman tener verificación criptográfica",
    );
  });
});

// ---------------------------------------------------------------------------
// Loading pages (various routes)
// ---------------------------------------------------------------------------
describe("Loading page renders", () => {
  it("renders PrivacyLoading", async () => {
    // Async server component (#884): await the call before rendering.
    const { default: PrivacyLoading } = await import("./[locale]/privacy/loading");
    render(await PrivacyLoading());
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders TermsLoading", async () => {
    const { default: TermsLoading } = await import("./[locale]/terms/loading");
    render(await TermsLoading());
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders ComingSoonLoading", async () => {
    const { default: ComingSoonLoading } = await import("./coming-soon/loading");
    render(await ComingSoonLoading());
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders CliAuthorizeLoading", async () => {
    const { default: CliAuthorizeLoading } = await import("./cli/authorize/loading");
    render(await CliAuthorizeLoading());
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders StudioLoading", async () => {
    const { default: StudioLoading } = await import("./studio/loading");
    render(await StudioLoading());
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders ArchetypesLoading", async () => {
    const { default: ArchetypesLoading } = await import("./[locale]/archetypes/loading");
    render(await ArchetypesLoading());
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders SharePageLoading", async () => {
    const { default: SharePageLoading } = await import("./u/[handle]/loading");
    render(<SharePageLoading />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders VerifyLoading", async () => {
    const { default: VerifyLoading } = await import("./verify/loading");
    render(<VerifyLoading />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders GeneratingLoading", async () => {
    const { default: GeneratingLoading } = await import("./generating/[handle]/loading");
    render(await GeneratingLoading());
    expect(screen.getByRole("status")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Error pages (various routes)
// ---------------------------------------------------------------------------
describe("Error page renders", () => {
  const makeError = () => new Error("test") as Error & { digest?: string };
  const noop = vi.fn();

  it("renders PrivacyError", async () => {
    const { default: PrivacyError } = await import("./[locale]/privacy/error");
    render(<PrivacyError error={makeError()} reset={noop} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders TermsError", async () => {
    const { default: TermsError } = await import("./[locale]/terms/error");
    render(<TermsError error={makeError()} reset={noop} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders ComingSoonError", async () => {
    const { default: ComingSoonError } = await import("./coming-soon/error");
    render(<ComingSoonError error={makeError()} reset={noop} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders StudioError", async () => {
    const { default: StudioError } = await import("./studio/error");
    render(<StudioError error={makeError()} reset={noop} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders ArchetypesError", async () => {
    const { default: ArchetypesError } = await import("./[locale]/archetypes/error");
    render(<ArchetypesError error={makeError()} reset={noop} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders SharePageError", async () => {
    const { default: SharePageError } = await import("./u/[handle]/error");
    render(<SharePageError error={makeError()} reset={noop} />);
    // useTranslation falls back to English without LanguageProvider
    // English: errors.sharePage.title = 'Something went wrong'
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders VerifyError", async () => {
    const { default: VerifyError } = await import("./verify/error");
    render(<VerifyError error={makeError()} reset={noop} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders GeneratingError", async () => {
    const { default: GeneratingError } = await import("./generating/error");
    render(<GeneratingError error={makeError()} reset={noop} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders AdminError", async () => {
    const { default: AdminError } = await import("./admin/error");
    render(<AdminError error={makeError()} reset={noop} />);
    expect(screen.getByText("Admin Dashboard Error")).toBeDefined();
  });
});
