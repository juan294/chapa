// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { getIntensityLevel, HeatmapGrid, HEATMAP_GRID_CSS } from "./HeatmapGrid";
import { WEEKS, DAYS } from "./animations";
import type { HeatmapDay } from "@chapa/shared";

/* ------------------------------------------------------------------ */
/* getIntensityLevel (pure function)                                   */
/* ------------------------------------------------------------------ */

describe("getIntensityLevel", () => {
  it("returns 0 for count of 0", () => {
    expect(getIntensityLevel(0, 10)).toBe(0);
  });

  it("returns 1 for low ratio (<=25%)", () => {
    expect(getIntensityLevel(1, 10)).toBe(1);
    expect(getIntensityLevel(2, 10)).toBe(1);
  });

  it("returns 2 for medium ratio (<=50%)", () => {
    expect(getIntensityLevel(3, 10)).toBe(2);
    expect(getIntensityLevel(5, 10)).toBe(2);
  });

  it("returns 3 for high ratio (<=75%)", () => {
    expect(getIntensityLevel(6, 10)).toBe(3);
    expect(getIntensityLevel(7, 10)).toBe(3);
  });

  it("returns 4 for intense ratio (>75%)", () => {
    expect(getIntensityLevel(8, 10)).toBe(4);
    expect(getIntensityLevel(10, 10)).toBe(4);
  });

  it("handles max of 1 (edge case)", () => {
    expect(getIntensityLevel(1, 1)).toBe(4);
  });

  it("handles equal count and max", () => {
    expect(getIntensityLevel(5, 5)).toBe(4);
  });

  it("returns 0 for count 0 regardless of max", () => {
    expect(getIntensityLevel(0, 1)).toBe(0);
    expect(getIntensityLevel(0, 100)).toBe(0);
  });

  it("returns exact boundary values correctly", () => {
    // 25% boundary
    expect(getIntensityLevel(25, 100)).toBe(1);
    // 50% boundary
    expect(getIntensityLevel(50, 100)).toBe(2);
    // 75% boundary
    expect(getIntensityLevel(75, 100)).toBe(3);
    // Just above 75%
    expect(getIntensityLevel(76, 100)).toBe(4);
  });
});

/* ------------------------------------------------------------------ */
/* HeatmapGrid component                                               */
/* ------------------------------------------------------------------ */

function makeDays(count: number, value = 1): HeatmapDay[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2025-01-${String(i + 1).padStart(2, "0")}`,
    count: value,
  }));
}

describe("HeatmapGrid", () => {
  describe("rendering", () => {
    it("renders without crashing", () => {
      const data = makeDays(91);
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in" }),
      );
      expect(container.firstChild).toBeTruthy();
    });

    it("renders with role=img and heatmap aria-label", () => {
      const data = makeDays(91);
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in" }),
      );
      const grid = container.querySelector('[role="img"]');
      expect(grid).not.toBeNull();
      expect(grid?.getAttribute("aria-label")).toBe("Contribution heatmap");
    });

    it("renders WEEKS * DAYS cells (91 total)", () => {
      const data = makeDays(91);
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in" }),
      );
      const grid = container.querySelector('[role="img"]');
      const cells = grid?.querySelectorAll("[aria-hidden='true']");
      expect(cells?.length).toBe(WEEKS * DAYS);
    });

    it("all cells are aria-hidden", () => {
      const data = makeDays(91);
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "diagonal" }),
      );
      const grid = container.querySelector('[role="img"]');
      const cells = grid?.children;
      if (cells) {
        for (const cell of cells) {
          expect(cell.getAttribute("aria-hidden")).toBe("true");
        }
      }
    });
  });

  describe("data slicing", () => {
    it("handles data shorter than 91 days", () => {
      const data = makeDays(30);
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in" }),
      );
      // Should still render 91 cells but extras have 0 count
      const cells = container.querySelectorAll("[aria-hidden='true']");
      expect(cells.length).toBe(91);
    });

    it("slices data longer than 91 days to last 91", () => {
      const data = makeDays(365, 5);
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in" }),
      );
      const cells = container.querySelectorAll("[aria-hidden='true']");
      expect(cells.length).toBe(91);
    });

    it("handles empty data array", () => {
      const { container } = render(
        createElement(HeatmapGrid, { data: [], animation: "fade-in" }),
      );
      const cells = container.querySelectorAll("[aria-hidden='true']");
      expect(cells.length).toBe(91);
    });
  });

  describe("maxValue prop", () => {
    it("uses auto-detected max when not provided", () => {
      const data: HeatmapDay[] = [
        { date: "2025-01-01", count: 10 },
        { date: "2025-01-02", count: 5 },
        { date: "2025-01-03", count: 0 },
      ];
      // Should not crash — auto-detects max as 10
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in" }),
      );
      expect(container.firstChild).toBeTruthy();
    });

    it("uses provided maxValue for normalization", () => {
      const data = makeDays(5, 3);
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in", maxValue: 10 }),
      );
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe("animation variants", () => {
    const variants = [
      "fade-in",
      "diagonal",
      "ripple",
      "scatter",
      "column-cascade",
      "row-waterfall",
    ] as const;

    for (const variant of variants) {
      it(`renders with ${variant} animation`, () => {
        const data = makeDays(91);
        const { container } = render(
          createElement(HeatmapGrid, { data, animation: variant }),
        );
        const cells = container.querySelectorAll("[aria-hidden='true']");
        expect(cells.length).toBe(91);
        // Each cell should have an animation style
        const firstCell = cells[0] as HTMLElement;
        expect(firstCell.style.animation).toContain("heatmap-cell-in");
      });
    }
  });

  describe("CSS grid layout", () => {
    it("uses column-flow grid auto-flow", () => {
      const data = makeDays(91);
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in" }),
      );
      const grid = container.querySelector('[role="img"]') as HTMLElement;
      expect(grid.style.gridAutoFlow).toBe("column");
    });

    it("sets gridTemplateRows to DAYS rows", () => {
      const data = makeDays(91);
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in" }),
      );
      const grid = container.querySelector('[role="img"]') as HTMLElement;
      expect(grid.style.gridTemplateRows).toBe(`repeat(${DAYS}, 1fr)`);
    });
  });
});

/* ------------------------------------------------------------------ */
/* HEATMAP_GRID_CSS                                                    */
/* ------------------------------------------------------------------ */

describe("HEATMAP_GRID_CSS", () => {
  it("exports a non-empty CSS string", () => {
    expect(typeof HEATMAP_GRID_CSS).toBe("string");
    expect(HEATMAP_GRID_CSS.length).toBeGreaterThan(0);
  });

  it("defines heatmap-cell-in keyframes", () => {
    expect(HEATMAP_GRID_CSS).toContain("@keyframes heatmap-cell-in");
  });

  it("includes prefers-reduced-motion support", () => {
    expect(HEATMAP_GRID_CSS).toContain("prefers-reduced-motion");
  });

  it("disables animation for reduced motion", () => {
    expect(HEATMAP_GRID_CSS).toContain("animation: none");
  });
});
