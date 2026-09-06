// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { LanguageContext, LanguageProvider } from "@/lib/i18n/provider";
import { LangSync } from "@/lib/i18n/lang-sync";
import { es } from "@/lib/i18n/dictionaries/es";
import { en } from "@/lib/i18n/dictionaries/en";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";
import { LANDING_SECTIONS } from "@/components/landing/landing-commands";

// page.tsx computes the demo badge SVG per locale, resolves the
// [locale] route param, and calls the REAL getServerT(locale) — this is the
// #1023 (FE-H1) fix: the landing page is now a genuine per-locale RSC, so
// this test exercises the actual English dictionary rather than mocking
// translation. Only heavy/interactive dependencies are mocked below.

vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: vi.fn(() => "<svg data-testid='demo-badge'></svg>"),
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
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("GOOD WORKLEAVES AMARK_");
  });

  it("renders the navbar", async () => {
    await renderHome();
    const navbar = screen.getByTestId("navbar");
    expect(navbar.dataset.locale).toBe("en");
    expect(navbar.textContent).toBe("Features");
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  });

  it("renders all seven archetypes as an accessible explorer", async () => {
    await renderHome();
    expect(screen.getByRole("tablist", { name: "Developer archetypes" })).toBeDefined();
    expect(screen.getAllByRole("tab")).toHaveLength(7);
  });

  it("renders the requested explanation, identity line and real Studio CTA", async () => {
    const { container } = await renderHome();
    expect(screen.getByText("Turn your development activity across platforms into a profile and badge you can share.")).toBeDefined();
    expect(screen.getByText("Your work is more than a commit count.")).toBeDefined();
    for (const link of screen.getAllByRole("link", { name: /Open the Creator Studio/ })) {
      expect(link.getAttribute("href")).toBe("/studio");
    }
    expect(container.textContent).not.toContain("**");
  });

  it("renders every command section target and the compatible badge anchor", async () => {
    const { container } = await renderHome();
    for (const id of new Set([...Object.values(LANDING_SECTIONS), "badge-preview"])) {
      expect(container.querySelector(`#${id}`), id).not.toBeNull();
    }
  });

  it("keeps the README SVG in its own image document with the same 92/Elite accessible description", async () => {
    const { container } = await renderHome();
    const readme = container.querySelector<HTMLImageElement>('#how-it-works img');
    expect(readme?.getAttribute("src")).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent("<svg data-testid='demo-badge'></svg>")}`);
    expect(readme?.alt).toBe("Sample Chapa badge: score 92, Elite, simulated metrics.");
    expect(screen.getAllByRole("img", { name: readme!.alt })).toHaveLength(2);
    expect(container.querySelectorAll("svg[data-testid='demo-badge']")).toHaveLength(1);
    // The sample claim now lives on the artifact itself (the badge's own
    // "SAMPLE · NOT A REAL BADGE" strip), not in a paragraph beside it.
    expect(screen.getByText("FIG. 01 — THE WORK BECOMES THE SIGNATURE")).toBeDefined();
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

  it("renders the static WebMCP tool catalog", async () => {
    const { container } = await renderHome();
    const section = container.querySelector("#agent-tools");

    expect(section).not.toBeNull();
    expect(section?.textContent).toContain("WebMCP");
    for (const entry of SITE_TOOL_MAP) {
      for (const tool of entry.tools) {
        expect(section?.textContent).toContain(tool);
      }
    }
  });

  // #1261 — the catalog is a claim; the transcript is the proof. The landing
  // page links the production run of an agent driving the tools end to end.
  it("links the agent-tested production transcript from the tool catalog", async () => {
    const { container } = await renderHome();
    const link = container.querySelector(
      '#agent-tools a[href$="/docs/webmcp-demo-transcript.md"]',
    );

    expect(link).not.toBeNull();
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
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

  // Keep the verification CTA readable in its distinct trust color family.
  it("links the Verify a Badge CTA to /verify in the verification family", async () => {
    await renderHome();
    const verifyLink = screen.getByRole("link", { name: /verify a badge/i });
    expect(verifyLink.getAttribute("href")).toBe("/verify");
    const classes = verifyLink.className.split(/\s+/);
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
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("EL BUEN TRABAJODEJAHUELLA_");
    expect(screen.getByText("Convierte tu actividad de desarrollo en distintas plataformas en un perfil y una chapa que puedes compartir.")).toBeDefined();
    expect(screen.getByText("Tu trabajo es más que un recuento de commits.")).toBeDefined();
    expect(screen.getByText("hola, agente_")).toBeDefined();
  });

  it("renders the navbar for the es render too", async () => {
    await renderHome("es");
    const navbar = screen.getByTestId("navbar");
    expect(navbar.dataset.locale).toBe("es");
    expect(navbar.textContent).toBe("Funciones");
    await waitFor(() => expect(document.documentElement.lang).toBe("es"));
  });
});


describe("landing badge locale", () => {
  it.each([
    ["en", "01 / ACTIVITY", "02 / IMPACT", "13 WEEKS × 7 DAYS"],
    ["es", "01 / ACTIVIDAD", "02 / IMPACTO", "13 SEMANAS × 7 DÍAS"],
  ] as const)("passes real %s translations into the landing SVG", async (locale, activityHeading, impactHeading, heatmapCaption) => {
    const { renderBadgeSvg } = await import("@/lib/render/BadgeSvg");
    vi.mocked(renderBadgeSvg).mockClear();
    await renderHome(locale);
    expect(renderBadgeSvg).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      demoMode: true,
      strings: expect.objectContaining({ activityHeading, impactHeading, heatmapCaption }),
    }));
  });

  it.each(["en", "es"] as const)("renders animated and static %s samples from the same 92/Elite inputs", async (locale) => {
    const { renderBadgeSvg } = await import("@/lib/render/BadgeSvg");
    vi.mocked(renderBadgeSvg).mockClear();
    const { default: Home } = await import("./page");
    await Home({ params: Promise.resolve({ locale }) });
    const calls = vi.mocked(renderBadgeSvg).mock.calls;
    expect(calls).toHaveLength(2);
    const [hero, readme] = calls;
    expect(hero![1]).toMatchObject({ adjustedComposite: 92, tier: "Elite", archetype: "Balanced" });
    expect(readme![0]).toBe(hero![0]);
    expect(readme![1]).toBe(hero![1]);
    expect(readme![2]?.strings).toBe(hero![2]?.strings);
    expect(hero![2]).toMatchObject({ demoMode: true, includeBranding: true });
    expect(hero![2]?.disableAnimation).not.toBe(true);
    expect(readme![2]).toMatchObject({ demoMode: true, includeBranding: true, disableAnimation: true });
    expect(hero![2]).not.toHaveProperty("verificationHash");
    expect(readme![2]).not.toHaveProperty("verificationHash");
  });
});
