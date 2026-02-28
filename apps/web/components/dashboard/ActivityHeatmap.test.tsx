// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ActivityHeatmap } from "./ActivityHeatmap";

vi.mock("@/lib/effects/heatmap/HeatmapGrid", () => ({
  HeatmapGrid: (props: { data: { date: string; count: number }[]; animation: string; showLabels?: boolean }) => (
    <div data-testid="heatmap-grid" data-animation={props.animation} data-count={props.data.length} data-labels={props.showLabels}>
      mock-heatmap
    </div>
  ),
  HEATMAP_GRID_CSS: "/* mock css */",
}));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

import type { HeatmapDay } from "@chapa/shared";

const mockHeatmapData: HeatmapDay[] = [
  { date: "2025-03-01", count: 5 },
  { date: "2025-03-02", count: 3 },
  { date: "2025-03-03", count: 0 },
];

/** Generate consecutive days with specific counts for insight testing. */
function makeDays(startDate: string, counts: number[]): HeatmapDay[] {
  const start = new Date(startDate + "T12:00:00");
  return counts.map((count, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { date: d.toISOString().split("T")[0] ?? startDate, count };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ActivityHeatmap", () => {
  // ----------------------------------------------------------------
  // 1. Renders HeatmapGrid with provided data
  // ----------------------------------------------------------------
  it("renders HeatmapGrid with provided data", () => {
    render(<ActivityHeatmap heatmapData={mockHeatmapData} activeDays={42} />);

    const grid = screen.getByTestId("heatmap-grid");
    expect(grid).toBeTruthy();
    expect(grid.getAttribute("data-animation")).toBe("ripple");
    expect(grid.getAttribute("data-count")).toBe("3");
  });

  // ----------------------------------------------------------------
  // 2. Shows active days count in subheader
  // ----------------------------------------------------------------
  it("shows active days count in subheader", () => {
    render(<ActivityHeatmap heatmapData={mockHeatmapData} activeDays={42} />);

    expect(screen.getByText("42 active days in the last year")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 3. Has correct ARIA label
  // ----------------------------------------------------------------
  it("has correct ARIA label", () => {
    render(<ActivityHeatmap heatmapData={mockHeatmapData} activeDays={42} />);

    const section = screen.getByLabelText("Contribution activity heatmap");
    expect(section).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 4. Passes showLabels to HeatmapGrid
  // ----------------------------------------------------------------
  it("passes showLabels to HeatmapGrid", () => {
    render(<ActivityHeatmap heatmapData={mockHeatmapData} activeDays={42} />);

    const grid = screen.getByTestId("heatmap-grid");
    expect(grid.getAttribute("data-labels")).toBe("true");
  });

  // ----------------------------------------------------------------
  // 5. Shows insight stats when data is available
  // ----------------------------------------------------------------
  it("shows insight stats when there are active days", () => {
    const data = makeDays("2025-03-01", [3, 5, 2, 0, 4, 1]);
    render(<ActivityHeatmap heatmapData={data} activeDays={5} />);

    expect(screen.getByText("Current streak")).toBeTruthy();
    expect(screen.getByText("Longest streak")).toBeTruthy();
    expect(screen.getByText("Busiest day")).toBeTruthy();
    expect(screen.getByText("Avg / active day")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 6. Hides insight stats when no active days
  // ----------------------------------------------------------------
  it("hides insight stats when activeDays is 0", () => {
    const data = makeDays("2025-03-01", [0, 0, 0]);
    render(<ActivityHeatmap heatmapData={data} activeDays={0} />);

    expect(screen.queryByText("Current streak")).toBeNull();
    expect(screen.queryByText("Longest streak")).toBeNull();
  });

  // ----------------------------------------------------------------
  // 7. Shows peak day callout
  // ----------------------------------------------------------------
  it("shows peak day callout when peak count > 0", () => {
    const data = makeDays("2025-03-01", [3, 15, 2]);
    render(<ActivityHeatmap heatmapData={data} activeDays={3} />);

    expect(screen.getByText("15 contributions")).toBeTruthy();
    expect(screen.getByText(/Peak:/)).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 8. Hides peak day when empty data
  // ----------------------------------------------------------------
  it("hides peak callout when no data", () => {
    render(<ActivityHeatmap heatmapData={[]} activeDays={0} />);

    expect(screen.queryByText(/Peak:/)).toBeNull();
  });
});
