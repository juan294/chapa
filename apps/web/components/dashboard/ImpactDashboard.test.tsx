// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ImpactDashboard } from "./ImpactDashboard";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/hooks/use-trend-data", () => ({
  useTrendData: vi.fn(),
}));

vi.mock("./HeroScoreZone", () => ({
  HeroScoreZone: () => <div data-testid="hero-score-zone" />,
}));

vi.mock("./DimensionCardsRow", () => ({
  DimensionCardsRow: (props: {
    trend?: unknown;
    diff?: unknown;
    activeDimension?: unknown;
  }) => (
    <div
      data-testid="dimension-cards-row"
      data-trend={props.trend === null ? "null" : props.trend === undefined ? "undefined" : "present"}
      data-diff={props.diff === null ? "null" : props.diff === undefined ? "undefined" : "present"}
      data-active-dimension={String(props.activeDimension ?? "null")}
    />
  ),
}));

vi.mock("./RadarChartInteractive", () => ({
  RadarChartInteractive: (props: {
    activeDimension?: unknown;
    onDimensionHover?: unknown;
  }) => (
    <div
      data-testid="radar-chart-interactive"
      data-active-dimension={String(props.activeDimension ?? "null")}
      data-has-hover-handler={typeof props.onDimensionHover === "function" ? "true" : "false"}
    />
  ),
}));

vi.mock("./CoachingInsights", () => ({
  CoachingInsights: (props: { trend?: unknown; diff?: unknown }) => (
    <div
      data-testid="coaching-insights"
      data-trend={props.trend === null ? "null" : props.trend === undefined ? "undefined" : "present"}
      data-diff={props.diff === null ? "null" : props.diff === undefined ? "undefined" : "present"}
    />
  ),
}));

vi.mock("./ActivityHeatmap", () => ({
  ActivityHeatmap: () => <div data-testid="activity-heatmap" />,
}));

vi.mock("./StatsGrid", () => ({
  StatsGrid: (props: { diff?: unknown }) => (
    <div
      data-testid="stats-grid"
      data-diff={props.diff === null ? "null" : props.diff === undefined ? "undefined" : "present"}
    />
  ),
}));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

import type { ImpactV4Result, StatsData } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";
import { useTrendData } from "@/lib/hooks/use-trend-data";

const mockUseTrendData = vi.mocked(useTrendData);

const mockImpact: ImpactV4Result = {
  handle: "testuser",
  profileType: "collaborative",
  dimensions: { delivery: 85, quality: 60, consistency: 70, breadth: 50 },
  archetype: "Builder",
  compositeScore: 66,
  confidence: 80,
  confidencePenalties: [],
  adjustedComposite: 53,
  tier: "Solid",
  computedAt: "2026-02-28T00:00:00Z",
};

const mockStats = {
  handle: "testuser",
  displayName: "Test User",
  commitsTotal: 3500,
  activeDays: 200,
  prsMergedCount: 150,
  prsMergedWeight: 100,
  reviewsSubmittedCount: 80,
  issuesClosedCount: 30,
  reposContributed: 12,
  totalStars: 1500,
  totalForks: 200,
  totalWatchers: 50,
  heatmapData: [],
  fetchedAt: "2026-02-28",
  linesAdded: 50000,
  linesDeleted: 15000,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 5,
  docsOnlyPrRatio: 0.05,
  microCommitRatio: 0.1,
} as StatsData;

const mockTrend: TrendSummary = {
  direction: "improving",
  avgDelta: 3,
  compositeValues: [
    { date: "2026-02-25", value: 50 },
    { date: "2026-02-28", value: 53 },
  ],
  dimensions: {
    delivery: { avgDelta: 2, values: [] },
    quality: { avgDelta: 0, values: [] },
    consistency: { avgDelta: 1, values: [] },
    breadth: { avgDelta: -1, values: [] },
  },
};

const mockDiff: SnapshotDiff = {
  direction: "improving",
  daysBetween: 7,
  compositeScore: 4,
  adjustedComposite: 5,
  confidence: 2,
  dimensions: {
    delivery: 3,
    quality: -2,
    consistency: 1,
    breadth: 0,
  },
  stats: {
    commitsTotal: 50,
    prsMergedCount: 5,
    prsMergedWeight: 3,
    reviewsSubmittedCount: 3,
    issuesClosedCount: 1,
    reposContributed: 1,
    activeDays: 10,
    linesAdded: 500,
    linesDeleted: 100,
    totalStars: 20,
    totalForks: 2,
    totalWatchers: 5,
    topRepoShare: 0,
  },
  archetype: null,
  tier: null,
  profileType: null,
  penaltyChanges: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ImpactDashboard", () => {
  // ----------------------------------------------------------------
  // 1. Renders all 6 sections
  // ----------------------------------------------------------------
  it("renders all 6 sections", () => {
    mockUseTrendData.mockReturnValue({
      trend: null,
      diff: null,
      isLoading: false,
      error: null,
    });

    render(
      <ImpactDashboard
        impact={mockImpact}
        stats={mockStats}
        handle="testuser"
      />,
    );

    expect(screen.getByTestId("hero-score-zone")).toBeTruthy();
    expect(screen.getByTestId("dimension-cards-row")).toBeTruthy();
    expect(screen.getByTestId("radar-chart-interactive")).toBeTruthy();
    expect(screen.getByTestId("coaching-insights")).toBeTruthy();
    expect(screen.getByTestId("activity-heatmap")).toBeTruthy();
    expect(screen.getByTestId("stats-grid")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 2. Passes trend/diff data to child components when available
  // ----------------------------------------------------------------
  it("passes trend/diff data to child components when available", () => {
    mockUseTrendData.mockReturnValue({
      trend: mockTrend,
      diff: mockDiff,
      isLoading: false,
      error: null,
    });

    render(
      <ImpactDashboard
        impact={mockImpact}
        stats={mockStats}
        handle="testuser"
      />,
    );

    // DimensionCardsRow receives trend and diff
    const cardsRow = screen.getByTestId("dimension-cards-row");
    expect(cardsRow.getAttribute("data-trend")).toBe("present");
    expect(cardsRow.getAttribute("data-diff")).toBe("present");

    // CoachingInsights receives trend and diff
    const coaching = screen.getByTestId("coaching-insights");
    expect(coaching.getAttribute("data-trend")).toBe("present");
    expect(coaching.getAttribute("data-diff")).toBe("present");

    // StatsGrid receives diff
    const statsGrid = screen.getByTestId("stats-grid");
    expect(statsGrid.getAttribute("data-diff")).toBe("present");
  });

  // ----------------------------------------------------------------
  // 3. Handles loading state (no trend data yet)
  // ----------------------------------------------------------------
  it("handles loading state (no trend data yet)", () => {
    mockUseTrendData.mockReturnValue({
      trend: null,
      diff: null,
      isLoading: true,
      error: null,
    });

    render(
      <ImpactDashboard
        impact={mockImpact}
        stats={mockStats}
        handle="testuser"
      />,
    );

    // All sections should still render
    expect(screen.getByTestId("hero-score-zone")).toBeTruthy();
    expect(screen.getByTestId("dimension-cards-row")).toBeTruthy();
    expect(screen.getByTestId("radar-chart-interactive")).toBeTruthy();
    expect(screen.getByTestId("coaching-insights")).toBeTruthy();
    expect(screen.getByTestId("activity-heatmap")).toBeTruthy();
    expect(screen.getByTestId("stats-grid")).toBeTruthy();

    // Components receive null trend/diff
    const cardsRow = screen.getByTestId("dimension-cards-row");
    expect(cardsRow.getAttribute("data-trend")).toBe("null");
    expect(cardsRow.getAttribute("data-diff")).toBe("null");

    const coaching = screen.getByTestId("coaching-insights");
    expect(coaching.getAttribute("data-trend")).toBe("null");
    expect(coaching.getAttribute("data-diff")).toBe("null");

    const statsGrid = screen.getByTestId("stats-grid");
    expect(statsGrid.getAttribute("data-diff")).toBe("null");
  });

  // ----------------------------------------------------------------
  // 4. Handles error state (trend fetch failed)
  // ----------------------------------------------------------------
  it("handles error state (trend fetch failed)", () => {
    mockUseTrendData.mockReturnValue({
      trend: null,
      diff: null,
      isLoading: false,
      error: "Failed to load trend data",
    });

    render(
      <ImpactDashboard
        impact={mockImpact}
        stats={mockStats}
        handle="testuser"
      />,
    );

    // All sections should still render despite error
    expect(screen.getByTestId("hero-score-zone")).toBeTruthy();
    expect(screen.getByTestId("dimension-cards-row")).toBeTruthy();
    expect(screen.getByTestId("radar-chart-interactive")).toBeTruthy();
    expect(screen.getByTestId("coaching-insights")).toBeTruthy();
    expect(screen.getByTestId("activity-heatmap")).toBeTruthy();
    expect(screen.getByTestId("stats-grid")).toBeTruthy();
  });

});
