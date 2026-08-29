// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { LanguageContext, LanguageProvider } from "@/lib/i18n/provider";
import { LangSync } from "@/lib/i18n/lang-sync";
import { es } from "@/lib/i18n/dictionaries/es";
import { en } from "@/lib/i18n/dictionaries/en";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

// page.tsx computes the demo badge SVG at module scope, resolves the
// [locale] route param, and calls the REAL getServerT(locale) — this is the
// #1023 (FE-H1) fix: the landing page is now a genuine per-locale RSC, so
// this test exercises the actual English dictionary rather than mocking
// translation. Only heavy/interactive dependencies are mocked below.

vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: vi.fn(() => "<svg data-testid='demo-badge'></svg>"),
}));

vi.mock("@/lib/render/demoData", () => ({
  DEMO_STATS: { handle: "demo" },
  // #1215 — the landing scoring section reads the demo dimensions, composite
  // and tier, so the stub has to carry them.
  DEMO_IMPACT: {
    compositeScore: 70,
    adjustedComposite: 82,
    tier: "High",
    dimensions: {
      delivery: 88,
      quality: 72,
      consistency: 80,
      breadth: 65,
      craft: 72,
    },
  },
}));

vi.mock("@/components/BadgeOverlay", () => ({
  BadgeOverlay: () => <div data-testid="badge-overlay" />,
}));

vi.mock("@/components/CopyButton", () => ({
  CopyButton: () => <button data-testid="copy-button">Copy</button>,
}));

vi.mock("@/components/ErrorBanner", () => ({
  ErrorBanner: ({ message }: { message: string }) => (
    <div data-testid="error-banner">{message}</div>
  ),
}));

vi.mock("@/components/NavbarClient", () => ({
  NavbarClient: () => {
    const language = useContext(LanguageContext);
    const links = language?.t("landing.navLinks") as
      | { label: string; href: string }[]
      | undefined;
    return (
      <nav data-testid="navbar" data-locale={language?.locale}>
        {links?.[0]?.label}
      </nav>
    );
  },
}));

vi.mock("@/lib/auth/error-messages", () => ({
  getOAuthErrorMessage: vi.fn((err?: string) => (err ? `Error: ${err}` : null)),
}));

// LandingTerminal lives at apps/web/app/LandingTerminal.tsx; LandingContent
// (which imports it) also lives at apps/web/app/, so from this test file
// (one level deeper, under [locale]/) the path is "../LandingTerminal".
vi.mock("../LandingTerminal", () => ({
  LandingTerminal: () => <div data-testid="landing-terminal" />,
}));

// LocaleSync issues a server action; stub it out in the render environment.
vi.mock("@/lib/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n")>();
  return { ...actual, LocaleSync: () => null };
});

beforeEach(() => {
  window.history.pushState({}, "", "/");
  document.cookie = "chapa-locale=; Max-Age=0; path=/";
});
afterEach(cleanup);

async function renderHome(locale: "en" | "es" = "en") {
  const { default: Home } = await import("./page");
  const jsx = await Home({ params: Promise.resolve({ locale }) });
  // Match production: the static root layout owns the DEFAULT_LOCALE provider
  // (app/layout.tsx resolves its dictionary the same way), while the
  // locale-segmented page overrides it for the other locale. Derived from
  // DEFAULT_LOCALE rather than hardcoded so this keeps mirroring the real
  // layout if the default moves (#1201).
  const rootDictionary = DEFAULT_LOCALE === "es" ? es : en;
  return render(
    <LanguageProvider initialLocale={DEFAULT_LOCALE} dictionary={rootDictionary}>
      <LangSync />
      {jsx}
    </LanguageProvider>,
  );
}

describe("Home page metadata", () => {
  it.each([
    ["en", "Chapa — Developer Impact, Decoded", "Your developer impact"],
    ["es", "Chapa — Impacto de desarrollador, decodificado", "Tu impacto como desarrollador"],
  ] as const)("renders %s metadata from the selected route", async (locale, title, descriptionStart) => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale }),
    });

    expect(metadata.title).toEqual({ absolute: title });
    expect(metadata.description).toContain(descriptionStart);
  });
});

describe("Home page render (en)", () => {
  it("renders the page with heading", async () => {
    await renderHome();
    // English key: landing.hero.highlight = 'decoded'
    expect(screen.getByText("decoded")).toBeDefined();
  });

  it("renders the navbar", async () => {
    await renderHome();
    const navbar = screen.getByTestId("navbar");
    expect(navbar.dataset.locale).toBe("en");
    expect(navbar.textContent).toBe("Features");
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  });

  it("emits an early document-language assignment for the selected route", async () => {
    const { container } = await renderHome();
    const script = container.querySelector(
      'script[data-chapa-document-locale="en"]',
    );
    expect(script?.textContent).toBe('document.documentElement.lang="en";');
  });

  it("renders feature cards", async () => {
    await renderHome();
    // English dict: landing.features[0].title = 'MULTI-DIMENSIONAL'
    expect(screen.getByText("MULTI-DIMENSIONAL")).toBeDefined();
    // English dict: landing.features[2].title = 'VERIFIED METRICS'
    expect(screen.getByText("VERIFIED METRICS")).toBeDefined();
  });

  it("renders how-it-works steps", async () => {
    await renderHome();
    // English dict: landing.steps[0,1,2].title
    expect(screen.getByText("Sign in with GitHub")).toBeDefined();
    expect(screen.getByText("We build your profile")).toBeDefined();
    expect(screen.getByText("Share your badge")).toBeDefined();
  });

  it("renders stats section", async () => {
    await renderHome();
    // English dict: landing.stats[*].label
    expect(screen.getByText("archetypes")).toBeDefined();
    expect(screen.getByText("dimensions")).toBeDefined();
  });

  it("renders error banner when error param present in the URL", async () => {
    window.history.pushState({}, "", "/?error=access_denied");
    await renderHome();
    // Read client-side from window.location in an effect, so wait for it.
    await waitFor(() =>
      expect(screen.getByTestId("error-banner")).toBeDefined(),
    );
  });

  it("does not render an error banner without an error param", async () => {
    await renderHome();
    expect(screen.queryByTestId("error-banner")).toBeNull();
  });

  it("renders icons (GitHubIcon, ArrowRightIcon, ShieldCheckIcon)", async () => {
    const { container } = await renderHome();
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  // #1104 — converted from LandingContent.test.ts source-text assertions:
  // these elements/links are now queried on the actual rendered page tree.
  it("renders the main content landmark, the demo badge, its overlay, and the terminal", async () => {
    const { container } = await renderHome();
    expect(document.getElementById("main-content")).not.toBeNull();
    expect(screen.getByTestId("demo-badge")).toBeDefined();
    expect(screen.getByTestId("badge-overlay")).toBeDefined();
    expect(screen.getByTestId("landing-terminal")).toBeDefined();
    expect(container.querySelector("footer")).not.toBeNull();
  });

  // #1167 / UX-H1 measured white text on a solid bg-complement fill at 2.54:1,
  // below AA. #1215 made this CTA an outline button instead of a solid one, so
  // the guard is now: it stays in the verification family, never jade, and
  // never a solid complement fill (which would bring the 2.54:1 pairing back).
  it("links the Verify a Badge CTA to /verify in the verification family", async () => {
    await renderHome();
    const verifyLink = screen.getByRole("link", { name: /verify a badge/i });
    expect(verifyLink.getAttribute("href")).toBe("/verify");
    const classes = verifyLink.className.split(/\s+/);
    expect(classes).toContain("border-complement");
    expect(classes).toContain("text-complement-text");
    expect(classes).not.toContain("bg-complement");
    expect(classes).not.toContain("text-amber");
  });

  // #1167 (UX-B1, launch blocker) — the footer is now the shared SiteFooter
  // component, so Privacy/Terms are reachable identically from every page,
  // not just this one.
  it("renders Privacy and Terms links in the footer", async () => {
    await renderHome();
    const privacyLink = screen.getByRole("link", { name: "Privacy" });
    expect(privacyLink.getAttribute("href")).toBe("/privacy");
    const termsLink = screen.getByRole("link", { name: "Terms" });
    expect(termsLink.getAttribute("href")).toBe("/terms");
  });
});

// #1023 (FE-H1) — this is the core flash-elimination proof: the [locale]
// route param drives real server-side translation, with no client re-render
// required to show the correct language on first paint.
describe("Home page render (es) — locale-segmented RSC, no client re-render", () => {
  it("renders Spanish hero content directly from the initial render", async () => {
    await renderHome("es");
    // Spanish dict: landing.hero.highlight = 'decodificado' (mirrors the
    // English 'decoded' key exercised above).
    expect(screen.getByText("decodificado")).toBeDefined();
  });

  it("renders the navbar for the es render too", async () => {
    await renderHome("es");
    const navbar = screen.getByTestId("navbar");
    expect(navbar.dataset.locale).toBe("es");
    expect(navbar.textContent).toBe("Funciones");
    await waitFor(() => expect(document.documentElement.lang).toBe("es"));
  });
});
