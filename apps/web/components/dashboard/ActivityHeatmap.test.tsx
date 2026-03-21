// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ActivityHeatmap } from "./ActivityHeatmap";
import fs from "fs";
import { resolve } from "path";

const SOURCE = fs.readFileSync(
  resolve(__dirname, "ActivityHeatmap.tsx"),
  "utf-8"
);

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

const mockDimensions = {
  delivery: 85,
  quality: 72,
  consistency: 91,
  breadth: 68,
};

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
  // 1. Renders dot timeline chart
  // ----------------------------------------------------------------
  it("renders dot timeline chart", () => {
    render(
      <ActivityHeatmap
        heatmapData={mockHeatmapData}
        activeDays={42}
        dimensions={mockDimensions}
      />
    );

    const grid = screen.getByRole("img", {
      name: "Activity dot timeline",
    });
    expect(grid).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 2. Shows contextual summary (not generic "active days" count)
  // ----------------------------------------------------------------
  it("shows contextual summary instead of generic active days count", () => {
    const data = makeDays("2025-03-01", [3, 5, 2, 0, 4, 1, 8]);
    render(<ActivityHeatmap heatmapData={data} activeDays={6} />);

    // Should NOT show the old generic paragraph
    expect(screen.queryByText(/active days in the last year/)).toBeNull();
  });

  // ----------------------------------------------------------------
  // 3. Has correct ARIA label
  // ----------------------------------------------------------------
  it("has correct ARIA label on section", () => {
    render(
      <ActivityHeatmap heatmapData={mockHeatmapData} activeDays={42} />
    );

    const section = screen.getByLabelText("Contribution activity");
    expect(section).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 4. Shows dimension legend
  // ----------------------------------------------------------------
  it("shows dimension color legend", () => {
    render(
      <ActivityHeatmap
        heatmapData={mockHeatmapData}
        activeDays={42}
        dimensions={mockDimensions}
      />
    );

    expect(screen.getByText("Delivery")).toBeTruthy();
    expect(screen.getByText("Quality")).toBeTruthy();
    expect(screen.getByText("Consistency")).toBeTruthy();
    expect(screen.getByText("Breadth")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 5. Shows insight cards when data is available
  // ----------------------------------------------------------------
  it("shows streak, rhythm, and this-week cards", () => {
    const data = makeDays("2025-03-01", [3, 5, 2, 0, 4, 1]);
    render(
      <ActivityHeatmap
        heatmapData={data}
        activeDays={5}
        dimensions={mockDimensions}
      />
    );

    expect(screen.getByText("Current streak")).toBeTruthy();
    expect(screen.getByText("Most active day")).toBeTruthy();
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText(/Best:/)).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 6. Hides insight cards when no active days
  // ----------------------------------------------------------------
  it("hides insight cards when activeDays is 0", () => {
    const data = makeDays("2025-03-01", [0, 0, 0]);
    render(<ActivityHeatmap heatmapData={data} activeDays={0} />);

    expect(screen.queryByText("Current streak")).toBeNull();
    expect(screen.queryByText("Most active day")).toBeNull();
  });

  // ----------------------------------------------------------------
  // 7. Shows day-of-week column headers
  // ----------------------------------------------------------------
  it("shows day-of-week column headers in dot grid", () => {
    const data = makeDays("2025-03-01", [3, 5, 2, 0, 4, 1, 8]);
    render(
      <ActivityHeatmap heatmapData={data} activeDays={6} dimensions={mockDimensions} />
    );

    // Headers M, T, W, T, F, S, S should be present
    const allMs = screen.getAllByText("M");
    expect(allMs.length).toBeGreaterThanOrEqual(1);
    const allFs = screen.getAllByText("F");
    expect(allFs.length).toBeGreaterThanOrEqual(1);
  });

  // ----------------------------------------------------------------
  // 8. Shows dot size legend
  // ----------------------------------------------------------------
  it("shows dot size legend", () => {
    render(
      <ActivityHeatmap
        heatmapData={mockHeatmapData}
        activeDays={42}
        dimensions={mockDimensions}
      />
    );

    expect(screen.getByText("Low")).toBeTruthy();
    expect(screen.getByText("Med")).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("Activity:")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 9. Works without dimensions prop (graceful fallback)
  // ----------------------------------------------------------------
  it("renders without dimensions prop", () => {
    render(
      <ActivityHeatmap heatmapData={mockHeatmapData} activeDays={42} />
    );

    const grid = screen.getByRole("img", {
      name: "Activity dot timeline",
    });
    expect(grid).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 10. Uses CSS variables instead of hardcoded hex colors
  // ----------------------------------------------------------------
  it("uses CSS variables for dimension colors, not hardcoded hex", () => {
    expect(SOURCE).toContain("var(--color-dimension-delivery)");
    expect(SOURCE).toContain("var(--color-dimension-quality)");
    expect(SOURCE).toContain("var(--color-dimension-consistency)");
    expect(SOURCE).toContain("var(--color-dimension-breadth)");

    const dimColorsBlock = SOURCE.match(
      /DIMENSION_COLORS[\s\S]*?};/
    )?.[0] ?? "";
    expect(dimColorsBlock).not.toContain('"#22c55e"');
    expect(dimColorsBlock).not.toContain('"#f97316"');
    expect(dimColorsBlock).not.toContain('"#06b6d4"');
    expect(dimColorsBlock).not.toContain('"#ec4899"');
  });

  // ----------------------------------------------------------------
  // 11. Renders empty state gracefully
  // ----------------------------------------------------------------
  it("renders gracefully with empty data", () => {
    render(<ActivityHeatmap heatmapData={[]} activeDays={0} />);

    expect(screen.getByText("No activity recorded yet")).toBeTruthy();
  });
});
