// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { vi } from "vitest";
import { ImpactDashboard } from "./ImpactDashboard";

// ---------------------------------------------------------------------------
// Mocks
//
// #1034 — ImpactDashboard no longer fetches its own trend data via a client
// `useTrendData()` hook (that caused a post-hydration fetch waterfall). It
// now receives `trend`/`diff` as props, seeded server-side by the share
// page. Tests below pass them directly instead of mocking a hook.
// ---------------------------------------------------------------------------

vi.mock("@/components/ImpactBreakdown", () => ({
  getArchetypeProfile: () => "Mock archetype profile text",
}));

vi.mock("./DimensionCardsRow", () => ({
  DimensionCardsRow: (props: {
    trend?: unknown;
    diff?: unknown;
  }) => (
    <div
      data-testid="dimension-cards-row"
      data-trend={props.trend === null ? "null" : props.trend === undefined ? "undefined" : "present"}
      data-diff={props.diff === null ? "null" : props.diff === undefined ? "undefined" : "present"}
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

import type { ImpactV6Result, StatsData } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";

const mockImpact: ImpactV6Result = {
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
  // 1. Renders all sections including archetype header
  // ----------------------------------------------------------------
  it("renders all sections including archetype header", () => {
    render(
      <ImpactDashboard
        impact={mockImpact}
        stats={mockStats}
        handle="testuser"
      />,
    );

    // Archetype header
    expect(screen.getByText("Builder")).toBeTruthy();
    expect(screen.getByText("Mock archetype profile text")).toBeTruthy();

    // Dashboard sections
    expect(screen.getByTestId("dimension-cards-row")).toBeTruthy();

    expect(screen.getByTestId("coaching-insights")).toBeTruthy();
    expect(screen.getByTestId("activity-heatmap")).toBeTruthy();
    expect(screen.getByTestId("stats-grid")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 2. Passes trend/diff data to child components when provided as props
  // ----------------------------------------------------------------
  it("passes trend/diff data to child components when provided as props", () => {
    render(
      <ImpactDashboard
        impact={mockImpact}
        stats={mockStats}
        handle="testuser"
        trend={mockTrend}
        diff={mockDiff}
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
  // 3. Defaults to null trend/diff when not provided (no history yet)
  // ----------------------------------------------------------------
  it("defaults to null trend/diff when not provided (no history yet)", () => {
    render(
      <ImpactDashboard
        impact={mockImpact}
        stats={mockStats}
        handle="testuser"
      />,
    );

    // All sections should still render
    expect(screen.getByTestId("dimension-cards-row")).toBeTruthy();

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
  // 4. Renders gracefully when trend/diff are explicitly null (history
  //    unavailable/degraded upstream)
  // ----------------------------------------------------------------
  it("renders gracefully when trend/diff are explicitly null", () => {
    render(
      <ImpactDashboard
        impact={mockImpact}
        stats={mockStats}
        handle="testuser"
        trend={null}
        diff={null}
      />,
    );

    // All sections should still render despite missing history
    expect(screen.getByTestId("dimension-cards-row")).toBeTruthy();

    expect(screen.getByTestId("coaching-insights")).toBeTruthy();
    expect(screen.getByTestId("activity-heatmap")).toBeTruthy();
    expect(screen.getByTestId("stats-grid")).toBeTruthy();
  });
});
