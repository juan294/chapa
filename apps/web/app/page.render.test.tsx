// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

// page.tsx computes the demo badge SVG at module scope and passes it to
// LandingPageClient. LandingPageClient translates via useTranslation, which
// falls back to English when no LanguageProvider is present (test default).

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

vi.mock("./LandingTerminal", () => ({
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

async function renderHome() {
  const { default: Home } = await import("./page");
  return render(Home());
}

describe("Home page render", () => {
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
