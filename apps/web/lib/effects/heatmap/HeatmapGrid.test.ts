// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import {
  getIntensityLevel,
  HeatmapGrid,
  HEATMAP_GRID_CSS,
  computeMonthLabels,
  computeDayLabels,
} from "./HeatmapGrid";
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
/* computeMonthLabels (pure function)                                  */
/* ------------------------------------------------------------------ */

describe("computeMonthLabels", () => {
  it("returns WEEKS-length array", () => {
    const data = makeWeekAlignedDays(91, "2025-01-05");
    expect(computeMonthLabels(data)).toHaveLength(WEEKS);
  });

  it("shows month abbreviation at the first week of each month", () => {
    // 91 days starting Jan 5 (Sun) → spans Jan, Feb, Mar, Apr
    const data = makeWeekAlignedDays(91, "2025-01-05");
    const labels = computeMonthLabels(data);
    // First label should be Jan
    expect(labels[0]).toBe("Jan");
    // At least one label should be Feb, one Mar
    expect(labels).toContain("Feb");
    expect(labels).toContain("Mar");
  });

  it("has empty strings for non-boundary weeks", () => {
    const data = makeWeekAlignedDays(91, "2025-01-05");
    const labels = computeMonthLabels(data);
    const nonEmpty = labels.filter((l) => l !== "");
    // There should be fewer labels than WEEKS (not every week is a boundary)
    expect(nonEmpty.length).toBeLessThan(WEEKS);
    expect(nonEmpty.length).toBeGreaterThan(0);
  });

  it("drops labels that are too close together (< 2 columns apart)", () => {
    // Start on Nov 30 (Sun) — Nov only gets 1 column before Dec starts
    const data = makeWeekAlignedDays(91, "2024-11-24");
    const labels = computeMonthLabels(data);
    // Nov should be dropped (only 1 column) and Dec should be kept
    expect(labels).not.toContain("Nov");
    expect(labels).toContain("Dec");
  });

  it("handles empty data", () => {
    const labels = computeMonthLabels([]);
    expect(labels).toHaveLength(WEEKS);
    expect(labels.every((l) => l === "")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* computeDayLabels (pure function)                                    */
/* ------------------------------------------------------------------ */

describe("computeDayLabels", () => {
  it("returns DAYS-length array", () => {
    // Data starting on a Sunday (2025-01-05 is a Sunday)
    const data = makeWeekAlignedDays(7, "2025-01-05");
    expect(computeDayLabels(data)).toHaveLength(DAYS);
  });

  it("shows Mon, Wed, Fri labels for data starting on Sunday", () => {
    // 2025-01-05 is Sunday → row 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const data = makeWeekAlignedDays(7, "2025-01-05");
    const labels = computeDayLabels(data);
    expect(labels[0]).toBe(""); // Sun
    expect(labels[1]).toBe("Mon");
    expect(labels[2]).toBe(""); // Tue
    expect(labels[3]).toBe("Wed");
    expect(labels[4]).toBe(""); // Thu
    expect(labels[5]).toBe("Fri");
    expect(labels[6]).toBe(""); // Sat
  });

  it("handles empty data", () => {
    const labels = computeDayLabels([]);
    expect(labels).toHaveLength(DAYS);
    expect(labels.every((l) => l === "")).toBe(true);
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

/** Generate week-aligned days starting from a specific date. */
function makeWeekAlignedDays(count: number, startDate: string): HeatmapDay[] {
  const start = new Date(startDate + "T12:00:00");
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().split("T")[0] ?? startDate,
      count: (i % 5) + 1,
    };
  });
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

  describe("showLabels", () => {
    it("does not render labels or legend by default", () => {
      const data = makeDays(91);
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in" }),
      );
      expect(container.querySelector('[aria-label="Activity level legend"]')).toBeNull();
      // No text content for "Less" or "More"
      expect(container.textContent).not.toContain("Less");
      expect(container.textContent).not.toContain("More");
    });

    it("renders legend when showLabels is true", () => {
      const data = makeWeekAlignedDays(91, "2025-01-05");
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in", showLabels: true }),
      );
      const legend = container.querySelector('[aria-label="Activity level legend"]');
      expect(legend).not.toBeNull();
      expect(legend?.textContent).toContain("Less");
      expect(legend?.textContent).toContain("More");
    });

    it("renders 5 legend color swatches", () => {
      const data = makeWeekAlignedDays(91, "2025-01-05");
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in", showLabels: true }),
      );
      const legend = container.querySelector('[aria-label="Activity level legend"]');
      const swatches = legend?.querySelectorAll("div");
      expect(swatches?.length).toBe(5);
    });

    it("renders month labels when showLabels is true", () => {
      const data = makeWeekAlignedDays(91, "2025-01-05");
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in", showLabels: true }),
      );
      // Should contain at least "Jan" in the text
      expect(container.textContent).toContain("Jan");
    });

    it("renders day-of-week labels when showLabels is true", () => {
      const data = makeWeekAlignedDays(91, "2025-01-05");
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in", showLabels: true }),
      );
      expect(container.textContent).toContain("Mon");
      expect(container.textContent).toContain("Wed");
      expect(container.textContent).toContain("Fri");
    });

    it("still renders 91 cells even with labels", () => {
      const data = makeWeekAlignedDays(91, "2025-01-05");
      const { container } = render(
        createElement(HeatmapGrid, { data, animation: "fade-in", showLabels: true }),
      );
      const grid = container.querySelector('[role="img"]');
      const cells = grid?.querySelectorAll("[aria-hidden='true']");
      expect(cells?.length).toBe(WEEKS * DAYS);
    });
  });
});

/* ------------------------------------------------------------------ */
/* HEATMAP_GRID_CSS                                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* getIntensityLabel (via tooltip content)                              */
/* ------------------------------------------------------------------ */

describe("getIntensityLabel (via tooltip)", () => {
  it("shows 'No activity' for a cell with count 0", () => {
    const data: HeatmapDay[] = Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: 0,
    }));
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain("No activity");
  });

  it("shows 'Light activity' for intensity level 1", () => {
    // All counts are 1, max is 10 → ratio 0.1 → level 1
    const data: HeatmapDay[] = Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: i === 0 ? 1 : 0,
    }));
    // maxValue=10 so count=1 has ratio=0.1 → level 1
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in", maxValue: 10 }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain("Light activity");
  });

  it("shows 'Active day' for intensity level 2", () => {
    const data: HeatmapDay[] = Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: i === 0 ? 5 : 0,
    }));
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in", maxValue: 10 }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain("Active day");
  });

  it("shows 'High output' for intensity level 3", () => {
    const data: HeatmapDay[] = Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: i === 0 ? 7 : 0,
    }));
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in", maxValue: 10 }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain("High output");
  });

  it("shows 'Peak performance' for intensity level 4", () => {
    const data: HeatmapDay[] = Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: i === 0 ? 10 : 0,
    }));
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in", maxValue: 10 }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain("Peak performance");
  });
});

/* ------------------------------------------------------------------ */
/* Cell hover interactions                                             */
/* ------------------------------------------------------------------ */

describe("HeatmapGrid hover interactions", () => {
  it("shows a tooltip on mouseenter", () => {
    const data = makeDays(91, 5);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
  });

  it("hides the tooltip on mouseleave", () => {
    const data = makeDays(91, 5);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();
    fireEvent.mouseLeave(cell);
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("displays correct contribution count in tooltip", () => {
    const data: HeatmapDay[] = Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: i === 0 ? 7 : 0,
    }));
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain("7 contributions");
  });

  it("displays singular 'contribution' for count of 1", () => {
    const data: HeatmapDay[] = Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: i === 0 ? 1 : 0,
    }));
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain("1 contribution");
    expect(tooltip?.textContent).not.toContain("1 contributions");
  });

  it("displays 'No contributions' for count of 0", () => {
    const data: HeatmapDay[] = Array.from({ length: 91 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      count: 0,
    }));
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain("No contributions");
  });
});

/* ------------------------------------------------------------------ */
/* Tooltip positioning with showLabels                                 */
/* ------------------------------------------------------------------ */

describe("HeatmapGrid tooltip positioning", () => {
  it("applies DAY_LABEL_W offset when showLabels is true", () => {
    const data = makeWeekAlignedDays(91, "2025-01-05");
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in", showLabels: true }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tooltip).not.toBeNull();
    // DAY_LABEL_W is 32, so the left position includes that offset
    const left = parseFloat(tooltip.style.left);
    // With showLabels=true, left = tooltipPos.x + 32
    // tooltipPos.x is 0 in jsdom (getBoundingClientRect returns zeros), so left = 32
    expect(left).toBe(32);
  });

  it("does not apply DAY_LABEL_W offset when showLabels is false", () => {
    const data = makeWeekAlignedDays(91, "2025-01-05");
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in", showLabels: false }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tooltip).not.toBeNull();
    // Without showLabels, left = tooltipPos.x + 0 = 0
    const left = parseFloat(tooltip.style.left);
    expect(left).toBe(0);
  });

  it("applies different top offset when showLabels is true vs false", () => {
    const data = makeWeekAlignedDays(91, "2025-01-05");
    // With showLabels=true
    const { container: c1 } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in", showLabels: true }),
    );
    const grid1 = c1.querySelector('[role="img"]');
    const cell1 = grid1?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell1);
    const tooltip1 = c1.querySelector('[role="tooltip"]') as HTMLElement;
    const top1 = parseFloat(tooltip1.style.top);

    // With showLabels=false
    const { container: c2 } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in", showLabels: false }),
    );
    const grid2 = c2.querySelector('[role="img"]');
    const cell2 = grid2?.querySelector("[aria-hidden='true']") as HTMLElement;
    fireEvent.mouseEnter(cell2);
    const tooltip2 = c2.querySelector('[role="tooltip"]') as HTMLElement;
    const top2 = parseFloat(tooltip2.style.top);

    // showLabels=true adds +20 to top: top = 0 - 8 + 20 = 12
    // showLabels=false: top = 0 - 8 + 0 = -8
    expect(top1).toBe(12);
    expect(top2).toBe(-8);
  });
});

/* ------------------------------------------------------------------ */
/* hoveredIdx boundary safety                                          */
/* ------------------------------------------------------------------ */

describe("HeatmapGrid hoveredIdx boundary", () => {
  it("does not show tooltip when hovering a cell beyond data length", () => {
    // Only 10 days of data, but grid renders 91 cells. Last cells have no entry.
    const data = makeDays(10, 5);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cells = grid?.querySelectorAll("[aria-hidden='true']");
    // Hover the last cell (index 90), which is beyond sliced.length (10)
    const lastCell = cells?.[90] as HTMLElement;
    fireEvent.mouseEnter(lastCell);
    // hoveredDay should be null because idx >= sliced.length
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* gridRef null safety                                                  */
/* ------------------------------------------------------------------ */

describe("HeatmapGrid gridRef null safety", () => {
  it("does not crash when gridRef.current is null during hover", () => {
    const data = makeDays(91, 5);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    // Even if getBoundingClientRect returns zeros (jsdom default), tooltip should still render
    fireEvent.mouseEnter(cell);
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
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
