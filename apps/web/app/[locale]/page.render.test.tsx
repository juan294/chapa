// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

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
  DEMO_IMPACT: { compositeScore: 70 },
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
  NavbarClient: () => <nav data-testid="navbar" />,
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
});
afterEach(cleanup);

async function renderHome(locale: "en" | "es" = "en") {
  const { default: Home } = await import("./page");
  const jsx = await Home({ params: Promise.resolve({ locale }) });
  return render(jsx);
}

describe("Home page render (en)", () => {
  it("renders the page with heading", async () => {
    await renderHome();
    // English key: landing.hero.highlight = 'decoded'
    expect(screen.getByText("decoded")).toBeDefined();
  });

  it("renders the navbar", async () => {
    await renderHome();
    expect(screen.getByTestId("navbar")).toBeDefined();
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
    expect(screen.getByTestId("navbar")).toBeDefined();
  });
});
