// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { StatsData } from "@chapa/shared";
import { StatsGrid } from "./StatsGrid";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StatsGrid", () => {
  // 1. Renders 8 stat cards with correct values
  it("renders 8 stat cards with correct values", () => {
    render(<StatsGrid stats={mockStats} />);

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

  // 2. Renders section header
  it("renders section header", () => {
    render(<StatsGrid stats={mockStats} />);

    expect(screen.getByText("Key Numbers")).toBeTruthy();
  });
});
