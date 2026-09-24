// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { StatsData } from "@chapa/shared";
import { DimensionCard } from "./DimensionCard";

// ---------------------------------------------------------------------------
// Mocks — hooks and child components
// ---------------------------------------------------------------------------

vi.mock("@/lib/effects/counters/use-in-view", () => ({
  useInView: () => true,
}));

vi.mock("@/lib/effects/counters/use-animated-counter", () => ({
  useAnimatedCounter: (target: number) => ({
    value: target,
    isAnimating: false,
    animate: vi.fn(),
  }),
}));

vi.mock("./SubMetricPanel", () => ({
  SubMetricPanel: (props: { isOpen: boolean; dimension: string }) => (
    <div data-testid="sub-metric-panel" data-open={props.isOpen}>
      {props.dimension} panel
    </div>
  ),
}));

vi.mock("@/components/InfoTooltip", () => ({
  InfoTooltip: (props: { id: string; content: string }) => (
    <span data-testid="info-tooltip" data-id={props.id}>
      {props.content}
    </span>
  ),
}));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockStats: StatsData = {
  handle: "testuser",
  commitsTotal: 312,
  activeDays: 180,
  prsMergedCount: 47,
  prsMergedWeight: 47,
  reviewsSubmittedCount: 30,
  issuesClosedCount: 12,
  linesAdded: 15000,
  linesDeleted: 5000,
  reposContributed: 8,
  topRepoShare: 0.35,
  maxCommitsIn10Min: 5,
  totalStars: 120,
  totalForks: 40,
  totalWatchers: 60,
  heatmapData: [],
  fetchedAt: "2026-02-28T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DimensionCard", () => {
  // ----------------------------------------------------------------
  // 1. Renders dimension label and score
  // ----------------------------------------------------------------
  it("renders dimension label and score", () => {
    render(
      <DimensionCard dimension="delivery" score={85} stats={mockStats} />,
    );

    expect(screen.getByText("Delivery")).toBeTruthy();
    expect(screen.getByText("85")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 2. Renders progress bar with correct width percentage
  // ----------------------------------------------------------------
  it("renders progress bar with correct width percentage", () => {
    render(
      <DimensionCard dimension="quality" score={72} stats={mockStats} />,
    );

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeTruthy();
    expect(progressbar.getAttribute("aria-valuenow")).toBe("72");
    expect(progressbar.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("100");

    // The fill element inside the progressbar should have width: 72%
    const fill = progressbar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("72%");
  });

  // ----------------------------------------------------------------
  // 7. Expand/collapse toggles SubMetricPanel visibility
  // ----------------------------------------------------------------
  it("expand/collapse toggles SubMetricPanel visibility", () => {
    const { container } = render(
      <DimensionCard dimension="delivery" score={85} stats={mockStats} />,
    );

    // Initially collapsed — SubMetricPanel should have data-open="false"
    const panel = screen.getByTestId("sub-metric-panel");
    expect(panel.getAttribute("data-open")).toBe("false");

    // Click the expand button (the footer row)
    const expandButton = container.querySelector(
      "[aria-expanded]",
    ) as HTMLElement;
    fireEvent.click(expandButton);

    // After click — SubMetricPanel should have data-open="true"
    expect(
      screen.getByTestId("sub-metric-panel").getAttribute("data-open"),
    ).toBe("true");

    // Click again to collapse
    fireEvent.click(expandButton);
    expect(
      screen.getByTestId("sub-metric-panel").getAttribute("data-open"),
    ).toBe("false");
  });

  // ----------------------------------------------------------------
  // 8. Chevron rotates on expand (check class changes)
  // ----------------------------------------------------------------
  it("chevron rotates on expand", () => {
    const { container } = render(
      <DimensionCard dimension="delivery" score={85} stats={mockStats} />,
    );

    const chevron = container.querySelector(
      "[data-testid='chevron-icon']",
    ) as HTMLElement;
    expect(chevron).toBeTruthy();

    // Initially should NOT have rotate-180
    const initialClass = chevron.getAttribute("class") ?? "";
    expect(initialClass).not.toContain("rotate-180");

    // Click expand
    const expandButton = container.querySelector(
      "[aria-expanded]",
    ) as HTMLElement;
    fireEvent.click(expandButton);

    // Now chevron should have rotate-180
    const expandedClass = chevron.getAttribute("class") ?? "";
    expect(expandedClass).toContain("rotate-180");
  });

  // ----------------------------------------------------------------
  // 9. Keyboard Enter toggles expand
  // ----------------------------------------------------------------
  it("keyboard Enter toggles expand", () => {
    const { container } = render(
      <DimensionCard dimension="delivery" score={85} stats={mockStats} />,
    );

    const expandButton = container.querySelector(
      "[aria-expanded]",
    ) as HTMLElement;

    // Initially collapsed
    expect(expandButton.getAttribute("aria-expanded")).toBe("false");

    // Press Enter
    fireEvent.keyDown(expandButton, { key: "Enter" });
    expect(expandButton.getAttribute("aria-expanded")).toBe("true");

    // Press Enter again
    fireEvent.keyDown(expandButton, { key: "Enter" });
    expect(expandButton.getAttribute("aria-expanded")).toBe("false");
  });

  // ----------------------------------------------------------------
  // 10. Has correct ARIA attributes
  // ----------------------------------------------------------------
  it("has correct ARIA attributes", () => {
    const { container } = render(
      <DimensionCard dimension="consistency" score={91} stats={mockStats} />,
    );

    // Container has role="article" with aria-label
    const article = screen.getByRole("article");
    expect(article).toBeTruthy();
    expect(article.getAttribute("aria-label")).toBe(
      "Consistency dimension score: 91",
    );

    // Expand button has aria-expanded and aria-controls
    const expandButton = container.querySelector(
      "[aria-expanded]",
    ) as HTMLElement;
    expect(expandButton.getAttribute("aria-expanded")).toBe("false");
    expect(expandButton.getAttribute("aria-controls")).toBe(
      "dim-panel-consistency",
    );

    // The panel wrapper has the matching id
    const panelWrapper = container.querySelector("#dim-panel-consistency");
    expect(panelWrapper).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 11. Animated counter shows score value
  // ----------------------------------------------------------------
  it("animated counter shows score value", () => {
    render(
      <DimensionCard dimension="breadth" score={68} stats={mockStats} />,
    );

    // The mocked useAnimatedCounter returns target directly
    expect(screen.getByText("68")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // Bonus: InfoTooltip is rendered with correct dimension tooltip
  // ----------------------------------------------------------------
  it("renders InfoTooltip with correct dimension content", () => {
    render(
      <DimensionCard dimension="delivery" score={85} stats={mockStats} />,
    );

    const tooltip = screen.getByTestId("info-tooltip");
    expect(tooltip).toBeTruthy();
    expect(tooltip.getAttribute("data-id")).toBe("dim-delivery");
  });

  // ----------------------------------------------------------------
  // Bonus: subtitle text renders correctly
  // ----------------------------------------------------------------
  it("renders dimension subtitle text", () => {
    render(
      <DimensionCard dimension="delivery" score={85} stats={mockStats} />,
    );

    expect(
      screen.getByText("PRs merged \u00B7 issues closed \u00B7 commits"),
    ).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // Phase 1 — tabular-nums for stable counter animation
  // ----------------------------------------------------------------
  it("score display uses tabular-nums for stable counter animation", () => {
    render(<DimensionCard dimension="delivery" score={85} stats={mockStats} />);
    const scoreDisplay = screen.getByText("85");
    expect(scoreDisplay.className).toContain("tabular-nums");
  });

  // ----------------------------------------------------------------
  // Redesign — neutral rules distinguish dense dashboard cards
  // ----------------------------------------------------------------
  it("uses a neutral boundary for the dimension card", () => {
    render(<DimensionCard dimension="delivery" score={85} stats={mockStats} />);
    const article = screen.getByRole("article");
    expect(article.className).toContain("border-stroke");
  });

  // ----------------------------------------------------------------
  // WCAG #667 — B1: expand toggle must be a native button element
  // ----------------------------------------------------------------
  it("expand toggle is a native button element, not a div", () => {
    const { container } = render(
      <DimensionCard dimension="delivery" score={85} stats={mockStats} />,
    );

    // Must NOT use div[role="button"]
    const divButton = container.querySelector("div[role='button']");
    expect(divButton).toBeNull();

    // Must use a native <button>
    const nativeButton = container.querySelector("button[aria-expanded]");
    expect(nativeButton).not.toBeNull();
    expect(nativeButton!.tagName.toLowerCase()).toBe("button");
  });

  // ----------------------------------------------------------------
  // WCAG #667 — W14: toggle button has descriptive aria-label
  // ----------------------------------------------------------------
  it("toggle button has descriptive aria-label including dimension name", () => {
    const { container } = render(
      <DimensionCard dimension="delivery" score={85} stats={mockStats} />,
    );

    const toggleButton = container.querySelector("button[aria-expanded]") as HTMLButtonElement;
    expect(toggleButton).not.toBeNull();
    expect(toggleButton!.getAttribute("aria-label")).toMatch(/^Toggle Delivery breakdown: /);
  });

  it("toggle button aria-label uses correct dimension name for quality", () => {
    const { container } = render(
      <DimensionCard dimension="quality" score={72} stats={mockStats} />,
    );

    const toggleButton = container.querySelector("button[aria-expanded]") as HTMLButtonElement;
    expect(toggleButton!.getAttribute("aria-label")).toMatch(/^Toggle Quality breakdown: /);
  });

  // ----------------------------------------------------------------
  // WCAG #667 — B2: progressbar container has aria-label
  // ----------------------------------------------------------------
  it("progressbar container has aria-label with dimension name", () => {
    render(
      <DimensionCard dimension="delivery" score={85} stats={mockStats} />,
    );

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.getAttribute("aria-label")).toBe("Delivery score");
  });

  it("progressbar container aria-label uses correct dimension for consistency", () => {
    render(
      <DimensionCard dimension="consistency" score={70} stats={mockStats} />,
    );

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.getAttribute("aria-label")).toBe("Consistency score");
  });
});
