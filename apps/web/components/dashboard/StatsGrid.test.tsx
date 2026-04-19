// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { StatsData } from "@chapa/shared";
import * as fs from "node:fs";
import * as path from "node:path";
import { StatsGrid } from "./StatsGrid";

const STATS_GRID_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "StatsGrid.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@chapa/shared", async () => {
  const actual = await vi.importActual<typeof import("@chapa/shared")>(
    "@chapa/shared",
  );
  return {
    ...actual,
    formatCompact: (n: number) => {
      if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
      if (n >= 1000) {
        const k = n / 1000;
        const rounded = Math.round(k * 10) / 10;
        return rounded % 1 === 0 ? `${Math.round(rounded)}k` : `${rounded}k`;
      }
      return String(n);
    },
  };
});

vi.mock("@/components/InfoTooltip", () => ({
  InfoTooltip: (props: { id: string; content: string }) => (
    <span data-testid="info-tooltip" data-id={props.id}>
      {props.content}
    </span>
  ),
}));

vi.mock("./DeltaIndicator", () => ({
  DeltaIndicator: (props: { delta: number; size?: string }) => (
    <span data-testid="delta-indicator" data-delta={props.delta}>
      delta:{props.delta}
    </span>
  ),
}));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockStats: StatsData = {
  handle: "testuser",
  displayName: "Test User",
  commitsTotal: 3500,
  activeDays: 212,
  prsMergedCount: 150,
  prsMergedWeight: 100,
  reviewsSubmittedCount: 83,
  issuesClosedCount: 30,
  linesAdded: 10000,
  linesDeleted: 4000,
  reposContributed: 14,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 3,
  totalStars: 1500,
  totalForks: 207,
  totalWatchers: 55,
  heatmapData: [],
  fetchedAt: "2026-02-28T00:00:00Z",
};

const mockDiff = {
  direction: "improving" as const,
  daysBetween: 7,
  compositeScore: 3,
  adjustedComposite: 2,
  confidence: 1,
  dimensions: {
    delivery: 5,
    quality: -2,
    consistency: 0,
    breadth: 1,
  },
  stats: {
    commitsTotal: 50,
    prsMergedCount: 10,
    prsMergedWeight: 8,
    reviewsSubmittedCount: 5,
    issuesClosedCount: 3,
    reposContributed: 2,
    activeDays: 15,
    linesAdded: 500,
    linesDeleted: 200,
    totalStars: 20,
    totalForks: 0,
    totalWatchers: 3,
    topRepoShare: 0.05,
  },
  archetype: null,
  tier: null,
  profileType: null,
  penaltyChanges: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StatsGrid", () => {
  // 1. Renders 8 stat cards with correct values
  it("renders 8 stat cards with correct values", () => {
    render(<StatsGrid stats={mockStats} diff={null} />);

    // Verify all 8 formatted values are present (all unique to avoid getByText ambiguity)
    // totalStars: 1500 -> "1.5k"
    expect(screen.getByText("1.5k")).toBeTruthy();
    // totalForks: 207 -> "207"
    expect(screen.getByText("207")).toBeTruthy();
    // totalWatchers: 55 -> "55"
    expect(screen.getByText("55")).toBeTruthy();
    // activeDays: 212 -> "212"
    expect(screen.getByText("212")).toBeTruthy();
    // commitsTotal: 3500 -> "3.5k"
    expect(screen.getByText("3.5k")).toBeTruthy();
    // prsMergedCount: 150 -> "150"
    expect(screen.getByText("150")).toBeTruthy();
    // reviewsSubmittedCount: 83 -> "83"
    expect(screen.getByText("83")).toBeTruthy();
    // reposContributed: 14 -> "14"
    expect(screen.getByText("14")).toBeTruthy();

    // Verify all 8 labels are present
    expect(screen.getByText("Stars")).toBeTruthy();
    expect(screen.getByText("Forks")).toBeTruthy();
    expect(screen.getByText("Watchers")).toBeTruthy();
    expect(screen.getByText("Active Days")).toBeTruthy();
    expect(screen.getByText("Commits")).toBeTruthy();
    expect(screen.getByText("PRs Merged")).toBeTruthy();
    expect(screen.getByText("Reviews")).toBeTruthy();
    expect(screen.getByText("Repos")).toBeTruthy();
  });

  // 2. Shows DeltaIndicator when diff data present and delta != 0
  it("shows DeltaIndicator when diff data present and delta != 0", () => {
    render(<StatsGrid stats={mockStats} diff={mockDiff} />);

    const deltas = screen.getAllByTestId("delta-indicator");

    // Non-zero deltas from mockDiff.stats:
    // totalStars: 20, totalForks: 0 (excluded), totalWatchers: 3,
    // activeDays: 15, commitsTotal: 50, prsMergedCount: 10,
    // reviewsSubmittedCount: 5, reposContributed: 2
    // totalForks is 0 so should be hidden -> 7 deltas
    expect(deltas).toHaveLength(7);

    // Verify one specific delta value
    const starsDeltas = deltas.filter(
      (el) => el.getAttribute("data-delta") === "20",
    );
    expect(starsDeltas).toHaveLength(1);
  });

  // 3. Hides DeltaIndicator when diff is null
  it("hides DeltaIndicator when diff is null", () => {
    render(<StatsGrid stats={mockStats} diff={null} />);

    expect(screen.queryAllByTestId("delta-indicator")).toHaveLength(0);
  });

  // 4. Renders section header
  it("renders section header", () => {
    render(<StatsGrid stats={mockStats} diff={null} />);

    expect(screen.getByText("Key Numbers")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// FE-H2: StatsGrid must NOT have "use client" (no hooks or browser APIs)
// ---------------------------------------------------------------------------
describe("StatsGrid — client boundary (#728)", () => {
  it("does not have 'use client' directive (pure presentational component)", () => {
    expect(STATS_GRID_SOURCE).not.toMatch(/^["']use client["']/m);
  });
});
