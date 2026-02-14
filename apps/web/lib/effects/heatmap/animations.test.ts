import { describe, it, expect } from "vitest";
import {
  fadeInDelay,
  diagonalDelay,
  rippleDelay,
  scatterDelay,
  columnCascadeDelay,
  rowWaterfallDelay,
  getDelayFn,
  generateMockHeatmap,
  INTENSITY_COLORS,
  VARIANTS,
  WEEKS,
  DAYS,
} from "./animations";

describe("diagonalDelay", () => {
  it("returns 0 for top-left corner (0,0)", () => {
    expect(diagonalDelay(0, 0)).toBe(0);
  });

  it("increases with column index", () => {
    expect(diagonalDelay(5, 0)).toBeGreaterThan(diagonalDelay(2, 0));
  });

  it("increases with row index", () => {
    expect(diagonalDelay(0, 5)).toBeGreaterThan(diagonalDelay(0, 2));
  });

  it("computes col*40 + row*60", () => {
    expect(diagonalDelay(3, 4)).toBe(3 * 40 + 4 * 60); // 120 + 240 = 360
  });

  it("bottom-right corner has the largest delay", () => {
    const maxDelay = diagonalDelay(WEEKS - 1, DAYS - 1);
    // Check a few interior cells are smaller
    expect(diagonalDelay(6, 3)).toBeLessThan(maxDelay);
    expect(diagonalDelay(0, 0)).toBeLessThan(maxDelay);
  });
});

describe("rippleDelay", () => {
  it("returns 0 for the center cell", () => {
    // Center: col=6, row=3
    expect(rippleDelay(6, 3)).toBe(0);
  });

  it("returns same delay for equidistant cells", () => {
    // (7,3) and (5,3) are both 1 unit from center (6,3)
    expect(rippleDelay(7, 3)).toBe(rippleDelay(5, 3));
  });

  it("increases with distance from center", () => {
    expect(rippleDelay(0, 0)).toBeGreaterThan(rippleDelay(5, 3));
  });

  it("is always non-negative", () => {
    for (let c = 0; c < WEEKS; c++) {
      for (let r = 0; r < DAYS; r++) {
        expect(rippleDelay(c, r)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("scatterDelay", () => {
  it("is deterministic — same input always gives same output", () => {
    const a = scatterDelay(5, 3);
    const b = scatterDelay(5, 3);
    expect(a).toBe(b);
  });

  it("stays within 0-1199ms range", () => {
    for (let c = 0; c < WEEKS; c++) {
      for (let r = 0; r < DAYS; r++) {
        const d = scatterDelay(c, r);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(1200);
      }
    }
  });

  it("produces varied delays (not all the same)", () => {
    const delays = new Set<number>();
    for (let c = 0; c < WEEKS; c++) {
      for (let r = 0; r < DAYS; r++) {
        delays.add(scatterDelay(c, r));
      }
    }
    // With 91 cells and a range of 0-1199, we expect many distinct values
    expect(delays.size).toBeGreaterThan(20);
  });
});

describe("columnCascadeDelay", () => {
  it("returns 0 for column 0 regardless of row", () => {
    expect(columnCascadeDelay(0, 0)).toBe(0);
    expect(columnCascadeDelay(0, 6)).toBe(0);
  });

  it("same delay for all rows in a given column", () => {
    expect(columnCascadeDelay(5, 0)).toBe(columnCascadeDelay(5, 6));
    expect(columnCascadeDelay(5, 2)).toBe(columnCascadeDelay(5, 4));
  });

  it("computes col * 80", () => {
    expect(columnCascadeDelay(10, 3)).toBe(800);
  });
});

describe("rowWaterfallDelay", () => {
  it("returns 0 for row 0 regardless of column", () => {
    expect(rowWaterfallDelay(0, 0)).toBe(0);
    expect(rowWaterfallDelay(12, 0)).toBe(0);
  });

  it("same delay for all columns in a given row", () => {
    expect(rowWaterfallDelay(0, 3)).toBe(rowWaterfallDelay(12, 3));
  });

  it("computes row * 100", () => {
    expect(rowWaterfallDelay(5, 4)).toBe(400);
  });
});

describe("fadeInDelay", () => {
  it("returns 0 for top-left corner (0,0)", () => {
    expect(fadeInDelay(0, 0)).toBe(0);
  });

  it("produces small uniform stagger", () => {
    const d = fadeInDelay(1, 0);
    // 1 * DAYS + 0 = 7, * 8 = 56
    expect(d).toBe(7 * 8);
  });

  it("is always non-negative", () => {
    for (let c = 0; c < WEEKS; c++) {
      for (let r = 0; r < DAYS; r++) {
        expect(fadeInDelay(c, r)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("getDelayFn", () => {
  it("returns correct function for each variant", () => {
    expect(getDelayFn("fade-in")).toBe(fadeInDelay);
    expect(getDelayFn("diagonal")).toBe(diagonalDelay);
    expect(getDelayFn("ripple")).toBe(rippleDelay);
    expect(getDelayFn("scatter")).toBe(scatterDelay);
    expect(getDelayFn("column-cascade")).toBe(columnCascadeDelay);
    expect(getDelayFn("row-waterfall")).toBe(rowWaterfallDelay);
  });

  it("supports BadgeConfig aliases (cascade, waterfall)", () => {
    expect(getDelayFn("cascade")).toBe(columnCascadeDelay);
    expect(getDelayFn("waterfall")).toBe(rowWaterfallDelay);
  });
});

describe("generateMockHeatmap", () => {
  it("returns 13 weeks", () => {
    const heatmap = generateMockHeatmap();
    expect(heatmap).toHaveLength(WEEKS);
  });

  it("each week has 7 days", () => {
    const heatmap = generateMockHeatmap();
    for (const week of heatmap) {
      expect(week).toHaveLength(DAYS);
    }
  });

  it("all values are in 0-4 range", () => {
    const heatmap = generateMockHeatmap();
    for (const week of heatmap) {
      for (const day of week) {
        expect(day).toBeGreaterThanOrEqual(0);
        expect(day).toBeLessThanOrEqual(4);
      }
    }
  });

  it("is deterministic", () => {
    const a = generateMockHeatmap();
    const b = generateMockHeatmap();
    expect(a).toEqual(b);
  });

  it("contains a variety of intensity levels", () => {
    const heatmap = generateMockHeatmap();
    const levels = new Set(heatmap.flat());
    // With 91 cells and 5 levels, should have all 5
    expect(levels.size).toBe(5);
  });
});

describe("INTENSITY_COLORS", () => {
  it("has entries for levels 0 through 4", () => {
    for (let i = 0; i <= 4; i++) {
      expect(INTENSITY_COLORS[i]).toBeDefined();
      expect(INTENSITY_COLORS[i]).toMatch(/^rgba\(124,106,239,/);
    }
  });

  it("opacity increases with level", () => {
    // Extract alpha values
    const alphas = [0, 1, 2, 3, 4].map((level) => {
      const match = INTENSITY_COLORS[level]!.match(/,([\d.]+)\)$/);
      return parseFloat(match![1]!);
    });
    for (let i = 1; i < alphas.length; i++) {
      expect(alphas[i]!).toBeGreaterThan(alphas[i - 1]!);
    }
  });
});

describe("VARIANTS", () => {
  it("has 5 variants", () => {
    expect(VARIANTS).toHaveLength(5);
  });

  it("each variant has id, label, and description", () => {
    for (const v of VARIANTS) {
      expect(v.id).toBeTruthy();
      expect(v.label).toBeTruthy();
      expect(v.description).toBeTruthy();
    }
  });
});
