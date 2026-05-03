// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ImpactV6Result, StatsData, DimensionScores } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";
import * as fs from "node:fs";
import * as path from "node:path";
import { DimensionCardsRow } from "./DimensionCardsRow";

const DIMENSION_CARDS_ROW_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "DimensionCardsRow.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Mock DimensionCard to isolate this component's behavior
// ---------------------------------------------------------------------------
vi.mock("./DimensionCard", () => ({
  DimensionCard: (props: Record<string, unknown>) => (
    <div
      data-testid={`dimension-card-${props.dimension}`}
      data-score={props.score}
      data-delta={props.delta ?? "none"}
      data-trend-avg-delta={
        props.trend && typeof props.trend === "object" && "avgDelta" in (props.trend as Record<string, unknown>)
          ? (props.trend as Record<string, unknown>).avgDelta
          : "none"
      }
      data-animation-delay={props.animationDelay}
      className={typeof props.className === "string" ? props.className : ""}
    >
      {String(props.dimension)}
    </div>
  ),
}));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockDimensions: DimensionScores = {
  delivery: 85,
  quality: 72,
  consistency: 91,
  breadth: 68,
};

const mockImpact = {
  dimensions: mockDimensions,
} as ImpactV6Result;

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

const mockTrend: TrendSummary = {
  direction: "improving",
  avgDelta: 2.5,
  compositeValues: [{ date: "2026-02-21", value: 80 }],
  dimensions: {
    delivery: { avgDelta: 3, values: [{ date: "2026-02-21", value: 82 }] },
    quality: { avgDelta: -1, values: [{ date: "2026-02-21", value: 73 }] },
    consistency: { avgDelta: 1, values: [{ date: "2026-02-21", value: 90 }] },
    breadth: { avgDelta: 2, values: [{ date: "2026-02-21", value: 66 }] },
  },
};

const mockDiff: SnapshotDiff = {
  direction: "improving",
  daysBetween: 7,
  compositeScore: 3,
  adjustedComposite: 2,
  confidence: 1,
  dimensions: { delivery: 5, quality: -2, consistency: 3, breadth: 4 },
  stats: {
    commitsTotal: 20,
    prsMergedCount: 5,
    prsMergedWeight: 5,
    reviewsSubmittedCount: 3,
    issuesClosedCount: 2,
    reposContributed: 1,
    activeDays: 7,
    linesAdded: 500,
    linesDeleted: 200,
    totalStars: 2,
    totalForks: 1,
    totalWatchers: 3,
    topRepoShare: -0.05,
  },
  archetype: null,
  tier: null,
  profileType: null,
  penaltyChanges: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DimensionCardsRow", () => {
  // 1. Renders 4 DimensionCards (one per dimension)
  it("renders 4 DimensionCards, one per dimension", () => {
    render(<DimensionCardsRow impact={mockImpact} stats={mockStats} />);

    expect(screen.getByTestId("dimension-card-delivery")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-quality")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-consistency")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-breadth")).toBeTruthy();
  });

  // 2. Passes correct dimension data to each card
  it("passes correct score to each DimensionCard", () => {
    render(<DimensionCardsRow impact={mockImpact} stats={mockStats} />);

    expect(screen.getByTestId("dimension-card-delivery").getAttribute("data-score")).toBe("85");
    expect(screen.getByTestId("dimension-card-quality").getAttribute("data-score")).toBe("72");
    expect(screen.getByTestId("dimension-card-consistency").getAttribute("data-score")).toBe("91");
    expect(screen.getByTestId("dimension-card-breadth").getAttribute("data-score")).toBe("68");
  });

  // 3. Passes trend/diff data when available
  it("passes trend and diff data to each DimensionCard when provided", () => {
    render(
      <DimensionCardsRow
        impact={mockImpact}
        stats={mockStats}
        trend={mockTrend}
        diff={mockDiff}
      />,
    );

    // Check trend data is forwarded (avgDelta per dimension)
    expect(screen.getByTestId("dimension-card-delivery").getAttribute("data-trend-avg-delta")).toBe("3");
    expect(screen.getByTestId("dimension-card-quality").getAttribute("data-trend-avg-delta")).toBe("-1");
    expect(screen.getByTestId("dimension-card-consistency").getAttribute("data-trend-avg-delta")).toBe("1");
    expect(screen.getByTestId("dimension-card-breadth").getAttribute("data-trend-avg-delta")).toBe("2");

    // Check diff data is forwarded (delta per dimension)
    expect(screen.getByTestId("dimension-card-delivery").getAttribute("data-delta")).toBe("5");
    expect(screen.getByTestId("dimension-card-quality").getAttribute("data-delta")).toBe("-2");
    expect(screen.getByTestId("dimension-card-consistency").getAttribute("data-delta")).toBe("3");
    expect(screen.getByTestId("dimension-card-breadth").getAttribute("data-delta")).toBe("4");
  });

  // 4. Handles null trend/diff gracefully
  it("handles null trend and diff gracefully", () => {
    render(
      <DimensionCardsRow
        impact={mockImpact}
        stats={mockStats}
        trend={null}
        diff={null}
      />,
    );

    // All 4 cards render
    expect(screen.getByTestId("dimension-card-delivery")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-quality")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-consistency")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-breadth")).toBeTruthy();

    // Delta and trend fall back to "none"
    expect(screen.getByTestId("dimension-card-delivery").getAttribute("data-delta")).toBe("none");
    expect(screen.getByTestId("dimension-card-delivery").getAttribute("data-trend-avg-delta")).toBe("none");
  });

  // 5. Renders section header "Performance Dimensions"
  it('renders section header "Performance Dimensions"', () => {
    render(<DimensionCardsRow impact={mockImpact} stats={mockStats} />);

    const header = screen.getByText("Performance Dimensions");
    expect(header).toBeTruthy();
    expect(header.tagName).toBe("H3");
  });

  // 6. Has responsive grid classes
  it("has responsive grid classes on the grid container", () => {
    const { container } = render(
      <DimensionCardsRow impact={mockImpact} stats={mockStats} />,
    );

    const grid = container.querySelector(".grid");
    expect(grid).toBeTruthy();
    expect(grid!.classList.contains("grid-cols-1")).toBe(true);
    expect(grid!.classList.contains("sm:grid-cols-2")).toBe(true);
    expect(grid!.classList.contains("lg:grid-cols-4")).toBe(true);
    expect(grid!.classList.contains("gap-3")).toBe(true);
  });

  // 7. Passes staggered animationDelay to each card
  it("passes staggered animationDelay to each card (400, 500, 600, 700)", () => {
    render(<DimensionCardsRow impact={mockImpact} stats={mockStats} />);

    expect(screen.getByTestId("dimension-card-delivery").getAttribute("data-animation-delay")).toBe("400");
    expect(screen.getByTestId("dimension-card-quality").getAttribute("data-animation-delay")).toBe("500");
    expect(screen.getByTestId("dimension-card-consistency").getAttribute("data-animation-delay")).toBe("600");
    expect(screen.getByTestId("dimension-card-breadth").getAttribute("data-animation-delay")).toBe("700");
  });

  // 8. Applies opacity to non-active cards when activeDimension is set
  it("applies opacity-70 to non-active cards when activeDimension is set", () => {
    render(
      <DimensionCardsRow
        impact={mockImpact}
        stats={mockStats}
        activeDimension="delivery"
      />,
    );

    // Active card: no opacity class
    const deliveryCard = screen.getByTestId("dimension-card-delivery");
    expect(deliveryCard.className).not.toContain("opacity-70");

    // Non-active cards: have opacity-70
    const qualityCard = screen.getByTestId("dimension-card-quality");
    expect(qualityCard.className).toContain("opacity-70");

    const consistencyCard = screen.getByTestId("dimension-card-consistency");
    expect(consistencyCard.className).toContain("opacity-70");

    const breadthCard = screen.getByTestId("dimension-card-breadth");
    expect(breadthCard.className).toContain("opacity-70");
  });

  // 9. No opacity classes when activeDimension is null
  it("does not apply opacity classes when activeDimension is null", () => {
    render(
      <DimensionCardsRow
        impact={mockImpact}
        stats={mockStats}
        activeDimension={null}
      />,
    );

    expect(screen.getByTestId("dimension-card-delivery").className).not.toContain("opacity-70");
    expect(screen.getByTestId("dimension-card-quality").className).not.toContain("opacity-70");
    expect(screen.getByTestId("dimension-card-consistency").className).not.toContain("opacity-70");
    expect(screen.getByTestId("dimension-card-breadth").className).not.toContain("opacity-70");
  });

  // 10. Applies custom className to section wrapper
  it("applies custom className to the section wrapper", () => {
    const { container } = render(
      <DimensionCardsRow
        impact={mockImpact}
        stats={mockStats}
        className="mt-8"
      />,
    );

    const section = container.firstElementChild as HTMLElement;
    expect(section.classList.contains("mt-8")).toBe(true);
  });

  // 11. Handles undefined trend/diff (not passed at all)
  it("handles undefined trend and diff (omitted props)", () => {
    render(<DimensionCardsRow impact={mockImpact} stats={mockStats} />);

    // All 4 cards render with delta="none"
    expect(screen.getByTestId("dimension-card-delivery").getAttribute("data-delta")).toBe("none");
    expect(screen.getByTestId("dimension-card-quality").getAttribute("data-delta")).toBe("none");
    expect(screen.getByTestId("dimension-card-consistency").getAttribute("data-delta")).toBe("none");
    expect(screen.getByTestId("dimension-card-breadth").getAttribute("data-delta")).toBe("none");
  });

  // 12. Renders only 4 cards when craft is absent
  it("renders 4 cards when craft dimension is absent", () => {
    const impactWithoutCraft = {
      ...mockImpact,
      dimensions: { delivery: 85, quality: 72, consistency: 91, breadth: 68 },
    } as ImpactV6Result;

    render(<DimensionCardsRow impact={impactWithoutCraft} stats={mockStats} />);

    expect(screen.getByTestId("dimension-card-delivery")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-quality")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-consistency")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-breadth")).toBeTruthy();
    expect(screen.queryByTestId("dimension-card-craft")).toBeNull();
  });

  // 13. Renders 5 cards when craft is present
  it("renders 5 cards when craft dimension is present", () => {
    const impactWithCraft = {
      ...mockImpact,
      dimensions: { delivery: 85, quality: 72, consistency: 91, breadth: 68, craft: 45 },
    } as ImpactV6Result;

    render(<DimensionCardsRow impact={impactWithCraft} stats={mockStats} />);

    expect(screen.getByTestId("dimension-card-delivery")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-quality")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-consistency")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-breadth")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-craft")).toBeTruthy();
  });

  // 14. Uses responsive 5-column grid when craft is present
  it("uses 5-column grid when craft is present", () => {
    const impactWithCraft = {
      ...mockImpact,
      dimensions: { delivery: 85, quality: 72, consistency: 91, breadth: 68, craft: 45 },
    } as ImpactV6Result;

    const { container } = render(
      <DimensionCardsRow impact={impactWithCraft} stats={mockStats} />,
    );

    const grid = container.querySelector(".grid");
    expect(grid).toBeTruthy();
    expect(grid!.classList.contains("grid-cols-2")).toBe(true);
    expect(grid!.classList.contains("sm:grid-cols-3")).toBe(true);
    expect(grid!.classList.contains("lg:grid-cols-5")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FE-H2: DimensionCardsRow is now a client component (uses useTranslation hook)
// ---------------------------------------------------------------------------
describe("DimensionCardsRow — client boundary (#728)", () => {
  it("has 'use client' directive for useTranslation hook", () => {
    expect(DIMENSION_CARDS_ROW_SOURCE).toMatch(/^["']use client["']/m);
  });
});
