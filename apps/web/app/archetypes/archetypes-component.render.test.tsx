// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock heavy dependencies before importing page components
vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: vi.fn(() => "<svg data-testid='mock-badge'></svg>"),
}));

vi.mock("@/lib/render/archetypeDemoData", () => ({
  BUILDER_STATS: { handle: "builder" },
  BUILDER_IMPACT: { compositeScore: 80 },
  GUARDIAN_STATS: { handle: "guardian" },
  GUARDIAN_IMPACT: { compositeScore: 75 },
  MARATHONER_STATS: { handle: "marathoner" },
  MARATHONER_IMPACT: { compositeScore: 70 },
  POLYMATH_STATS: { handle: "polymath" },
  POLYMATH_IMPACT: { compositeScore: 65 },
  BALANCED_STATS: { handle: "balanced" },
  BALANCED_IMPACT: { compositeScore: 60 },
  EMERGING_STATS: { handle: "emerging" },
  EMERGING_IMPACT: { compositeScore: 30 },
  ARTIFICER_STATS: { handle: "artificer" },
  ARTIFICER_IMPACT: { compositeScore: 72 },
}));

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/GlobalCommandBar", () => ({
  GlobalCommandBar: () => <div data-testid="command-bar" />,
}));

afterEach(cleanup);

describe("Archetype pages — component render", () => {
  it("renders BuilderPage", async () => {
    const { default: BuilderPage } = await import("./builder/page");
    render(<BuilderPage />);
    expect(screen.getByText("Builder")).toBeDefined();
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders GuardianPage", async () => {
    const { default: GuardianPage } = await import("./guardian/page");
    render(<GuardianPage />);
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders MarathonerPage", async () => {
    const { default: MarathonerPage } = await import("./marathoner/page");
    render(<MarathonerPage />);
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders PolymathPage", async () => {
    const { default: PolymathPage } = await import("./polymath/page");
    render(<PolymathPage />);
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders BalancedPage", async () => {
    const { default: BalancedPage } = await import("./balanced/page");
    render(<BalancedPage />);
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders EmergingPage", async () => {
    const { default: EmergingPage } = await import("./emerging/page");
    render(<EmergingPage />);
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders ArtificerPage", async () => {
    const { default: ArtificerPage } = await import("./artificer/page");
    render(<ArtificerPage />);
    expect(screen.getByTestId("navbar")).toBeDefined();
  });
});
