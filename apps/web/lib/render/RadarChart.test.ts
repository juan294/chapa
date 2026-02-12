import { describe, it, expect } from "vitest";
import { renderRadarChart } from "./RadarChart";
import type { DimensionScores } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDimensions(overrides: Partial<DimensionScores> = {}): DimensionScores {
  return {
    building: 50,
    guarding: 50,
    consistency: 50,
    breadth: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// renderRadarChart(dimensions, cx, cy, radius)
// ---------------------------------------------------------------------------

describe("renderRadarChart(dimensions, cx, cy, radius)", () => {
  it("returns SVG group element", () => {
    const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
    expect(svg).toContain("<g");
    expect(svg).toContain("</g>");
  });

  it("contains a polygon for the data shape", () => {
    const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
    expect(svg).toContain("<polygon");
  });

  it("polygon points are within bounds of center + radius", () => {
    const cx = 200, cy = 200, r = 100;
    const svg = renderRadarChart(makeDimensions({ building: 100, guarding: 100, consistency: 100, breadth: 100 }), cx, cy, r);
    const pointsMatch = svg.match(/points="([^"]+)"/);
    expect(pointsMatch).not.toBeNull();
    const points = pointsMatch![1].split(" ").map(p => p.split(",").map(Number));
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(cx - r - 1);
      expect(x).toBeLessThanOrEqual(cx + r + 1);
      expect(y).toBeGreaterThanOrEqual(cy - r - 1);
      expect(y).toBeLessThanOrEqual(cy + r + 1);
    }
  });

  it("draws axis lines from center", () => {
    const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
    expect(svg).toContain("<line");
  });

  it("draws concentric guide shapes (rings)", () => {
    const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
    // Should have at least the outer ring
    const polygonCount = (svg.match(/<polygon/g) || []).length;
    expect(polygonCount).toBeGreaterThanOrEqual(2); // data shape + at least 1 ring
  });

  it("all-zero dimensions produce a point at center", () => {
    const svg = renderRadarChart(makeDimensions({ building: 0, guarding: 0, consistency: 0, breadth: 0 }), 200, 200, 100);
    // Match the data polygon (fill-opacity, not fill="none")
    const pointsMatch = svg.match(/points="([^"]+)"[^>]*fill-opacity/);
    expect(pointsMatch).not.toBeNull();
    const points = pointsMatch![1].split(" ").map(p => p.split(",").map(Number));
    // All points should be at or very near center
    for (const [x, y] of points) {
      expect(Math.abs(x - 200)).toBeLessThan(2);
      expect(Math.abs(y - 200)).toBeLessThan(2);
    }
  });

  it("uniform scores produce a symmetric shape", () => {
    const svg = renderRadarChart(makeDimensions({ building: 70, guarding: 70, consistency: 70, breadth: 70 }), 200, 200, 100);
    const pointsMatch = svg.match(/points="([^"]+)"[^>]*fill-opacity/);
    expect(pointsMatch).not.toBeNull();
    const points = pointsMatch![1].split(" ").map(p => p.split(",").map(Number));
    // All points should be equidistant from center
    const distances = points.map(([x, y]) => Math.sqrt((x - 200) ** 2 + (y - 200) ** 2));
    const maxDiff = Math.max(...distances) - Math.min(...distances);
    expect(maxDiff).toBeLessThan(2);
  });

  it("higher score means further from center", () => {
    const lowSvg = renderRadarChart(makeDimensions({ building: 30 }), 200, 200, 100);
    const highSvg = renderRadarChart(makeDimensions({ building: 90 }), 200, 200, 100);
    // Extract the building point (top) from both
    const extractFirstPoint = (svg: string) => {
      const match = svg.match(/points="([^"]+)"[^>]*fill-opacity/);
      return match![1].split(" ")[0].split(",").map(Number);
    };
    const [, lowY] = extractFirstPoint(lowSvg);
    const [, highY] = extractFirstPoint(highSvg);
    // Building is at top → higher score = smaller y value (further up)
    expect(highY).toBeLessThan(lowY);
  });

  it("uses accent color for the data shape fill", () => {
    const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
    // Data polygon should have some fill color with opacity
    expect(svg).toMatch(/fill="[^"]*"/);
  });

  it("has 4 axis labels (Building, Guarding, Consistency, Breadth)", () => {
    const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
    expect(svg).toContain("Building");
    expect(svg).toContain("Guarding");
    expect(svg).toContain("Consistency");
    expect(svg).toContain("Breadth");
  });
});
