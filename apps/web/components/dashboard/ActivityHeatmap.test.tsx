// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ActivityHeatmap } from "./ActivityHeatmap";

vi.mock("@/lib/effects/heatmap/HeatmapGrid", () => ({
  HeatmapGrid: (props: { data: { date: string; count: number }[]; animation: string }) => (
    <div data-testid="heatmap-grid" data-animation={props.animation} data-count={props.data.length}>
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
});
