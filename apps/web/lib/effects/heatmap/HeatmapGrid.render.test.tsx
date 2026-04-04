// @vitest-environment jsdom
/**
 * HeatmapGrid component render tests — issue #675
 *
 * Covers the four required scenarios:
 * 1. Component renders without crashing given minimal valid heatmap data
 * 2. A cell with count > 0 carries the expected background-color style
 * 3. A cell with count = 0 uses the "empty" (lowest-intensity) background color
 * 4. The wrapper has role="img" and a meaningful aria-label for the overall heatmap
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { HeatmapGrid } from "./HeatmapGrid";
import { INTENSITY_COLORS, WEEKS, DAYS } from "./animations";
import type { HeatmapDay } from "@chapa/shared";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build N days with a fixed count value, starting from a stable date. */
function makeDays(count: number, value = 1): HeatmapDay[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2025-03-${String(i + 1).padStart(2, "0")}`,
    count: value,
  }));
}

// ---------------------------------------------------------------------------
// 1. Renders without crashing
// ---------------------------------------------------------------------------

describe("HeatmapGrid render — no crash", () => {
  it("renders with 30 days of data without throwing", () => {
    const data = makeDays(30);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders all 91 cells (WEEKS × DAYS) for a 30-day dataset", () => {
    const data = makeDays(30);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cells = grid?.querySelectorAll("[aria-hidden='true']");
    expect(cells?.length).toBe(WEEKS * DAYS);
  });
});

/**
 * jsdom normalizes rgba() by adding spaces after commas.
 * e.g. "rgba(139,92,246,0.52)" becomes "rgba(139, 92, 246, 0.52)".
 * Convert INTENSITY_COLORS to jsdom-normalized form for comparison.
 */
function normalizeCssColor(value: string): string {
  return value.replace(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/, (_, r, g, b, a) =>
    `rgba(${r}, ${g}, ${b}, ${a})`,
  );
}

const NORMALIZED_COLORS: Record<number, string> = Object.fromEntries(
  Object.entries(INTENSITY_COLORS).map(([k, v]) => [k, normalizeCssColor(v)]),
);

// ---------------------------------------------------------------------------
// 2. Active cell (count > 0)
// ---------------------------------------------------------------------------

describe("HeatmapGrid render — active cell (count > 0)", () => {
  it("uses a non-zero intensity background color for count > 0", () => {
    // All 30 days have count = 5, maxValue = 10 → ratio 0.5 → level 2
    const data = makeDays(30, 5);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in", maxValue: 10 }),
    );
    const grid = container.querySelector('[role="img"]');
    // First 30 cells correspond to the supplied data
    const firstCell = grid?.querySelector("[aria-hidden='true']") as HTMLElement;
    expect(firstCell).not.toBeNull();
    const bg = firstCell.style.backgroundColor;
    // Level 2 color (jsdom-normalized)
    expect(bg).toBe(NORMALIZED_COLORS[2]);
  });

  it("active cells do NOT use the level-0 (empty) background color", () => {
    const data = makeDays(91, 10);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cells = grid?.querySelectorAll("[aria-hidden='true']");
    expect(cells).not.toBeNull();
    // All cells have count = max → level 4 → none should be the level-0 color
    for (const cell of Array.from(cells ?? [])) {
      expect((cell as HTMLElement).style.backgroundColor).not.toBe(
        NORMALIZED_COLORS[0],
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Empty/inactive cell (count = 0)
// ---------------------------------------------------------------------------

describe("HeatmapGrid render — empty cell (count = 0)", () => {
  it("uses the level-0 (empty) background color for cells with count = 0", () => {
    // Data has all zeros so every cell renders at intensity 0
    const data = makeDays(91, 0);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cells = grid?.querySelectorAll("[aria-hidden='true']");
    expect(cells).not.toBeNull();
    for (const cell of Array.from(cells ?? [])) {
      expect((cell as HTMLElement).style.backgroundColor).toBe(NORMALIZED_COLORS[0]);
    }
  });

  it("cells beyond provided data (padding) also use the empty background color", () => {
    // Only 10 days provided — remaining 81 cells have count = 0
    const data = makeDays(10, 0);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cells = Array.from(
      grid?.querySelectorAll("[aria-hidden='true']") ?? [],
    ) as HTMLElement[];
    // Cells beyond index 9 have no entry → count = 0 → level 0
    for (let i = 10; i < cells.length; i++) {
      expect(cells[i]!.style.backgroundColor).toBe(NORMALIZED_COLORS[0]);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Accessible wrapper — role="img" + aria-label
// ---------------------------------------------------------------------------

describe("HeatmapGrid render — accessible heatmap wrapper", () => {
  it("renders a wrapper with role='img'", () => {
    const data = makeDays(30);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    expect(grid).not.toBeNull();
  });

  it("wrapper aria-label reads 'Contribution heatmap'", () => {
    const data = makeDays(30);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    expect(grid?.getAttribute("aria-label")).toBe("Contribution heatmap");
  });

  it("grid cells inside the wrapper are aria-hidden (decorative)", () => {
    const data = makeDays(30);
    const { container } = render(
      createElement(HeatmapGrid, { data, animation: "fade-in" }),
    );
    const grid = container.querySelector('[role="img"]');
    const cells = grid?.querySelectorAll("[aria-hidden='true']");
    // All 91 cells should be aria-hidden — accessible label is on the wrapper
    expect(cells?.length).toBe(WEEKS * DAYS);
  });
});
