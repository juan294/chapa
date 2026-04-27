// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock heavy dependencies before import
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

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));

vi.mock("@/lib/auth/error-messages", () => ({
  getOAuthErrorMessage: vi.fn((err?: string) => (err ? `Error: ${err}` : undefined)),
}));

vi.mock("./LandingTerminal", () => ({
  LandingTerminal: () => <div data-testid="landing-terminal" />,
}));

afterEach(cleanup);

describe("Home page render", () => {
  it("renders the page with heading", async () => {
    const { default: Home } = await import("./page");
    const page = await Home({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByText("decodificado")).toBeDefined();
  });

  it("renders the navbar", async () => {
    const { default: Home } = await import("./page");
    const page = await Home({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders feature cards", async () => {
    const { default: Home } = await import("./page");
    const page = await Home({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByText("MULTIDIMENSIONAL")).toBeDefined();
    expect(screen.getByText("MÉTRICAS VERIFICADAS")).toBeDefined();
  });

  it("renders how-it-works steps", async () => {
    const { default: Home } = await import("./page");
    const page = await Home({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByText("Inicia sesión con GitHub")).toBeDefined();
    expect(screen.getByText("Construimos tu perfil")).toBeDefined();
    expect(screen.getByText("Comparte tu insignia")).toBeDefined();
  });

  it("renders stats section", async () => {
    const { default: Home } = await import("./page");
    const page = await Home({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByText("arquetipos")).toBeDefined();
    expect(screen.getByText("dimensiones")).toBeDefined();
  });

  it("renders error banner when error param present", async () => {
    const { default: Home } = await import("./page");
    const page = await Home({
      searchParams: Promise.resolve({ error: "access_denied" }),
    });
    render(page);
    expect(screen.getByTestId("error-banner")).toBeDefined();
  });

  it("renders icons (GitHubIcon, ArrowRightIcon, ShieldCheckIcon)", async () => {
    const { default: Home } = await import("./page");
    const page = await Home({ searchParams: Promise.resolve({}) });
    const { container } = render(page);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });
});
