import { describe, it, expect } from "vitest";
import { buildHeatmapCells, renderHeatmapSvg } from "./heatmap";
import type { HeatmapDay } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHeatmapData(length: number = 91): HeatmapDay[] {
  return Array.from({ length }, (_, i) => ({
    date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
    count: i % 7,
  }));
}

// ---------------------------------------------------------------------------
// buildHeatmapCells
// ---------------------------------------------------------------------------

describe("buildHeatmapCells", () => {
  it("returns 91 cells (13 weeks x 7 days)", () => {
    const cells = buildHeatmapCells(makeHeatmapData());
    expect(cells).toHaveLength(91);
  });

  it("each cell has x, y, fill, and delay properties", () => {
    const cells = buildHeatmapCells(makeHeatmapData());
    for (const cell of cells) {
      expect(cell).toHaveProperty("x");
      expect(cell).toHaveProperty("y");
      expect(cell).toHaveProperty("fill");
      expect(cell).toHaveProperty("delay");
      expect(typeof cell.x).toBe("number");
      expect(typeof cell.y).toBe("number");
      expect(typeof cell.fill).toBe("string");
      expect(typeof cell.delay).toBe("number");
    }
  });

  it("handles empty heatmap data", () => {
    const cells = buildHeatmapCells([]);
    // Should still produce 91 cells (grid is always 13x7), all with count 0 colors
    expect(cells).toHaveLength(91);
    // All cells should have the same fill (0-count color)
    const firstFill = cells[0].fill;
    for (const cell of cells) {
      expect(cell.fill).toBe(firstFill);
    }
  });

  it("applies offset correctly", () => {
    const offsetX = 100;
    const offsetY = 200;
    const cells = buildHeatmapCells(makeHeatmapData(), offsetX, offsetY);
    // First cell (week 0, day 0) should be at the offset position
    expect(cells[0].x).toBe(offsetX);
    expect(cells[0].y).toBe(offsetY);
  });

  it("spaces cells correctly across weeks and days", () => {
    const cells = buildHeatmapCells(makeHeatmapData(), 0, 0);
    // Cell at week 1, day 0 (index 7)
    const cellSize = 14;
    const cellGap = 3;
    expect(cells[7].x).toBe(1 * (cellSize + cellGap));
    expect(cells[7].y).toBe(0);
    // Cell at week 0, day 1 (index 1)
    expect(cells[1].x).toBe(0);
    expect(cells[1].y).toBe(1 * (cellSize + cellGap));
  });

  it("assigns delay based on week index", () => {
    const cells = buildHeatmapCells(makeHeatmapData(), 0, 0);
    // Week 0 cells should have delay 0
    expect(cells[0].delay).toBe(0);
    // Week 1 cells should have delay 60
    expect(cells[7].delay).toBe(60);
    // Week 12 cells should have delay 720
    expect(cells[84].delay).toBe(12 * 60);
  });
});

// ---------------------------------------------------------------------------
// renderHeatmapSvg
// ---------------------------------------------------------------------------

describe("renderHeatmapSvg", () => {
  it("returns SVG string with rect elements", () => {
    const cells = buildHeatmapCells(makeHeatmapData());
    const svg = renderHeatmapSvg(cells);
    expect(svg).toContain("<rect");
    expect(svg).toContain("</rect>");
  });

  it("contains animate elements for fade-in", () => {
    const cells = buildHeatmapCells(makeHeatmapData());
    const svg = renderHeatmapSvg(cells);
    expect(svg).toContain("<animate");
    expect(svg).toContain('attributeName="opacity"');
    expect(svg).toContain('from="0"');
    expect(svg).toContain('to="1"');
    expect(svg).toContain('fill="freeze"');
  });

  it("produces one rect per cell", () => {
    const cells = buildHeatmapCells(makeHeatmapData());
    const svg = renderHeatmapSvg(cells);
    const rectCount = (svg.match(/<rect /g) || []).length;
    expect(rectCount).toBe(91);
  });

  it("returns empty string for empty cells array", () => {
    const svg = renderHeatmapSvg([]);
    expect(svg).toBe("");
  });
});
