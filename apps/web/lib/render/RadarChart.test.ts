import { describe, it, expect } from "vitest";
import { renderRadarChart } from "./RadarChart";
import type { DimensionScores } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDimensions(overrides: Partial<DimensionScores> = {}): DimensionScores {
  return {
    delivery: 50,
    quality: 50,
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
    const svg = renderRadarChart(makeDimensions({ delivery: 100, quality: 100, consistency: 100, breadth: 100 }), cx, cy, r);
    const pointsMatch = svg.match(/points="([^"]+)"/);
    expect(pointsMatch).not.toBeNull();
    const points = pointsMatch![1]!.split(" ").map(p => p.split(",").map(Number));
    for (const pt of points) {
      expect(pt![0]!).toBeGreaterThanOrEqual(cx - r - 1);
      expect(pt![0]!).toBeLessThanOrEqual(cx + r + 1);
      expect(pt![1]!).toBeGreaterThanOrEqual(cy - r - 1);
      expect(pt![1]!).toBeLessThanOrEqual(cy + r + 1);
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

  it("renders a visible center marker for all-zero dimensions instead of a collapsed polygon", () => {
    const svg = renderRadarChart(makeDimensions({ delivery: 0, quality: 0, consistency: 0, breadth: 0 }), 200, 200, 100);
    expect(svg).not.toMatch(/fill-opacity="0\.15"/);
    expect(svg).toContain('data-role="radar-empty-marker"');
    expect(svg).toContain('cx="200" cy="200" r="3"');
    expect(svg).toContain(">no data yet<");
  });

  it("uniform scores produce a symmetric shape", () => {
    const svg = renderRadarChart(makeDimensions({ delivery: 70, quality: 70, consistency: 70, breadth: 70 }), 200, 200, 100);
    const pointsMatch = svg.match(/points="([^"]+)"[^>]*fill-opacity/);
    expect(pointsMatch).not.toBeNull();
    const points = pointsMatch![1]!.split(" ").map(p => p.split(",").map(Number));
    // All points should be equidistant from center
    const distances = points.map((pt) => Math.sqrt((pt![0]! - 200) ** 2 + (pt![1]! - 200) ** 2));
    const maxDiff = Math.max(...distances) - Math.min(...distances);
    expect(maxDiff).toBeLessThan(2);
  });

  it("higher score means further from center", () => {
    const lowSvg = renderRadarChart(makeDimensions({ delivery: 30 }), 200, 200, 100);
    const highSvg = renderRadarChart(makeDimensions({ delivery: 90 }), 200, 200, 100);
    // Extract the delivery point (top) from both
    const extractFirstPoint = (svg: string) => {
      const match = svg.match(/points="([^"]+)"[^>]*fill-opacity/);
      return match![1]!.split(" ")[0]!.split(",").map(Number);
    };
    const lowPt = extractFirstPoint(lowSvg);
    const highPt = extractFirstPoint(highSvg);
    // Delivery is at top → higher score = smaller y value (further up)
    expect(highPt[1]!).toBeLessThan(lowPt[1]!);
  });

  it("uses accent color for the data shape fill", () => {
    const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
    // Data polygon should have some fill color with opacity
    expect(svg).toMatch(/fill="[^"]*"/);
  });

  it("has 4 axis labels (Delivery, Quality, Consistency, Breadth)", () => {
    const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
    expect(svg).toContain(">Delivery<");
    expect(svg).toContain(">Quality<");
    expect(svg).toContain(">Consistency<");
    expect(svg).toContain(">Breadth<");
  });

  it("delivery axis points straight up (no rotation)", () => {
    const cx = 200, cy = 200, r = 100;
    const svg = renderRadarChart(makeDimensions({ delivery: 100 }), cx, cy, r);
    // With 0° rotation, delivery angle = -π/2 → straight up
    // cos(-π/2) = 0 → x = cx, sin(-π/2) = -1 → y = cy - r
    const pointsMatch = svg.match(/points="([^"]+)"[^>]*fill-opacity/);
    expect(pointsMatch).not.toBeNull();
    const bPt = pointsMatch![1]!.split(" ")[0]!.split(",").map(Number);
    // Delivery should be directly above center (x ≈ cx, y = cy - r)
    expect(Math.abs(bPt[0]! - cx)).toBeLessThan(2);
    expect(bPt[1]!).toBe(cy - r);
  });

  // ---------------------------------------------------------------------------
  // Pentagon mode (5 axes with craft dimension)
  // ---------------------------------------------------------------------------

  describe("pentagon mode (craft dimension present)", () => {
    function makePentagonDimensions(overrides: Partial<DimensionScores> = {}): DimensionScores {
      return {
        delivery: 50,
        quality: 50,
        consistency: 50,
        breadth: 50,
        craft: 50,
        ...overrides,
      };
    }

    it("renders 5 axis lines when craft is present", () => {
      const svg = renderRadarChart(makePentagonDimensions(), 200, 200, 100);
      const lineCount = (svg.match(/<line /g) || []).length;
      expect(lineCount).toBe(5);
    });

    it("renders 5 label texts including Craft when craft is present", () => {
      const svg = renderRadarChart(makePentagonDimensions(), 200, 200, 100);
      expect(svg).toContain(">Delivery<");
      expect(svg).toContain(">Quality<");
      expect(svg).toContain(">Consistency<");
      expect(svg).toContain(">Breadth<");
      expect(svg).toContain(">Craft<");
    });

    it("renders a 5-point data polygon when craft is present", () => {
      const svg = renderRadarChart(makePentagonDimensions(), 200, 200, 100);
      const pointsMatch = svg.match(/points="([^"]+)"[^>]*fill-opacity/);
      expect(pointsMatch).not.toBeNull();
      const points = pointsMatch![1]!.split(" ");
      expect(points).toHaveLength(5);
    });

    it("guide rings render as pentagons (5 points) when craft is present", () => {
      const svg = renderRadarChart(makePentagonDimensions(), 200, 200, 100);
      // Guide ring polygons have fill="none" — match either attribute order
      const guideRings = svg.match(/<polygon\s+points="[^"]+"\s+fill="none"/g) || [];
      expect(guideRings.length).toBe(4); // 25%, 50%, 75%, 100%
      for (const ring of guideRings) {
        const pts = ring.match(/points="([^"]+)"/)![1]!.split(" ");
        expect(pts).toHaveLength(5);
      }
    });

    it("renders 5 dot circles on data points when craft is present", () => {
      const svg = renderRadarChart(makePentagonDimensions(), 200, 200, 100);
      // Data point dots: <circle cx="..." cy="..." r="4"
      const dotCount = (svg.match(/<circle[^>]*r="4"/g) || []).length;
      expect(dotCount).toBe(5);
    });

    it("renders the empty-state marker for an all-zero pentagon", () => {
      const svg = renderRadarChart(
        makePentagonDimensions({
          delivery: 0,
          quality: 0,
          consistency: 0,
          breadth: 0,
          craft: 0,
        }),
        200,
        200,
        100,
      );

      expect(svg).toContain('data-role="radar-empty-marker"');
      expect(svg).toContain(">no data yet<");
      expect(svg).not.toMatch(/fill-opacity="0\.15"/);
    });

    it("uniform pentagon scores produce equidistant points", () => {
      const svg = renderRadarChart(makePentagonDimensions({ delivery: 70, quality: 70, consistency: 70, breadth: 70, craft: 70 }), 200, 200, 100);
      const pointsMatch = svg.match(/points="([^"]+)"[^>]*fill-opacity/);
      expect(pointsMatch).not.toBeNull();
      const points = pointsMatch![1]!.split(" ").map(p => p.split(",").map(Number));
      const distances = points.map((pt) => Math.sqrt((pt![0]! - 200) ** 2 + (pt![1]! - 200) ** 2));
      const maxDiff = Math.max(...distances) - Math.min(...distances);
      expect(maxDiff).toBeLessThan(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Diamond fallback (craft absent)
  // ---------------------------------------------------------------------------

  describe("diamond fallback (craft absent)", () => {
    it("renders 4 axis lines when craft is undefined", () => {
      const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
      const lineCount = (svg.match(/<line /g) || []).length;
      expect(lineCount).toBe(4);
    });

    it("does NOT include Craft label when craft is absent", () => {
      const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
      expect(svg).not.toContain(">Craft<");
    });

    it("renders a 4-point data polygon when craft is absent", () => {
      const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
      const pointsMatch = svg.match(/points="([^"]+)"[^>]*fill-opacity/);
      expect(pointsMatch).not.toBeNull();
      const points = pointsMatch![1]!.split(" ");
      expect(points).toHaveLength(4);
    });

    it("guide rings render as diamonds (4 points) when craft is absent", () => {
      const svg = renderRadarChart(makeDimensions(), 200, 200, 100);
      // Guide ring polygons have fill="none" — match either attribute order
      const guideRings = svg.match(/<polygon\s+points="[^"]+"\s+fill="none"/g) || [];
      expect(guideRings.length).toBe(4); // 25%, 50%, 75%, 100%
      for (const ring of guideRings) {
        const pts = ring.match(/points="([^"]+)"/)![1]!.split(" ");
        expect(pts).toHaveLength(4);
      }
    });

    it("uses diamond angles (90 degree spacing) not pentagon angles with a gap", () => {
      const cx = 200, cy = 200, r = 100;
      // With diamond angles: delivery=top(-π/2), quality=right(0), consistency=bottom(π/2), breadth=left(π)
      const svg = renderRadarChart(makeDimensions({ delivery: 100, quality: 100, consistency: 100, breadth: 100 }), cx, cy, r);
      const pointsMatch = svg.match(/points="([^"]+)"[^>]*fill-opacity/);
      const points = pointsMatch![1]!.split(" ").map(p => p.split(",").map(Number));
      // Delivery=top: (200, 100)
      expect(Math.abs(points[0]![0]! - cx)).toBeLessThan(2);
      expect(points[0]![1]!).toBe(cy - r);
      // Quality=right: (300, 200)
      expect(points[1]![0]!).toBe(cx + r);
      expect(Math.abs(points[1]![1]! - cy)).toBeLessThan(2);
      // Consistency=bottom: (200, 300)
      expect(Math.abs(points[2]![0]! - cx)).toBeLessThan(2);
      expect(points[2]![1]!).toBe(cy + r);
      // Breadth=left: (100, 200)
      expect(points[3]![0]!).toBe(cx - r);
      expect(Math.abs(points[3]![1]! - cy)).toBeLessThan(2);
    });
  });
});
