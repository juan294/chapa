// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Sparkline } from "./Sparkline";

afterEach(cleanup);

const sampleValues = [
  { date: "2025-01-01", value: 60 },
  { date: "2025-01-02", value: 72 },
  { date: "2025-01-03", value: 65 },
  { date: "2025-01-04", value: 80 },
  { date: "2025-01-05", value: 75 },
];

describe("Sparkline", () => {
  describe("dimensions", () => {
    it("renders SVG with default width=80 and height=24", () => {
      const { container } = render(
        <Sparkline values={sampleValues} color="#7C6AEF" />,
      );
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("width")).toBe("80");
      expect(svg?.getAttribute("height")).toBe("24");
    });

    it("respects custom width and height props", () => {
      const { container } = render(
        <Sparkline values={sampleValues} color="#7C6AEF" width={120} height={40} />,
      );
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("width")).toBe("120");
      expect(svg?.getAttribute("height")).toBe("40");
    });

    it("sets viewBox matching width and height", () => {
      const { container } = render(
        <Sparkline values={sampleValues} color="#7C6AEF" width={100} height={30} />,
      );
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 100 30");
    });
  });

  describe("polyline rendering", () => {
    it("renders a polyline with points matching the number of values", () => {
      const { container } = render(
        <Sparkline values={sampleValues} color="#7C6AEF" />,
      );
      const polyline = container.querySelector("polyline");
      expect(polyline).not.toBeNull();
      const points = polyline!.getAttribute("points")!.trim().split(" ");
      // Each value produces one "x,y" point
      expect(points).toHaveLength(sampleValues.length);
    });

    it("applies the color prop as the polyline stroke", () => {
      const { container } = render(
        <Sparkline values={sampleValues} color="#4ADE80" />,
      );
      const polyline = container.querySelector("polyline");
      expect(polyline?.getAttribute("stroke")).toBe("#4ADE80");
    });

    it("polyline has fill=none", () => {
      const { container } = render(
        <Sparkline values={sampleValues} color="#7C6AEF" />,
      );
      const polyline = container.querySelector("polyline");
      expect(polyline?.getAttribute("fill")).toBe("none");
    });

    it("polyline has rounded line joins and caps", () => {
      const { container } = render(
        <Sparkline values={sampleValues} color="#7C6AEF" />,
      );
      const polyline = container.querySelector("polyline");
      expect(polyline?.getAttribute("stroke-linejoin")).toBe("round");
      expect(polyline?.getAttribute("stroke-linecap")).toBe("round");
    });
  });

  describe("fill polygon", () => {
    it("renders a polygon below the line with reduced opacity fill", () => {
      const { container } = render(
        <Sparkline values={sampleValues} color="#7C6AEF" />,
      );
      const polygon = container.querySelector("polygon");
      expect(polygon).not.toBeNull();
      expect(polygon?.getAttribute("opacity")).toBe("0.1");
    });

    it("polygon has the same color as the line stroke", () => {
      const { container } = render(
        <Sparkline values={sampleValues} color="#F87171" />,
      );
      const polygon = container.querySelector("polygon");
      expect(polygon?.getAttribute("fill")).toBe("#F87171");
    });

    it("polygon points include bottom corners to close the fill area", () => {
      const width = 80;
      const height = 24;
      const { container } = render(
        <Sparkline values={sampleValues} color="#7C6AEF" width={width} height={height} />,
      );
      const polygon = container.querySelector("polygon");
      const points = polygon!.getAttribute("points")!.trim();
      // The polygon should have sampleValues.length + 2 points
      // (data points + bottom-right + bottom-left)
      const pointPairs = points.split(" ");
      expect(pointPairs).toHaveLength(sampleValues.length + 2);

      // Last two points should be the bottom-right and bottom-left corners
      const lastTwo = pointPairs.slice(-2);
      // Bottom-right: x = width - padding, y = height - padding
      expect(lastTwo[0]).toMatch(/,22$/); // y = height - 2 (padding)
      expect(lastTwo[1]).toMatch(/^2,/); // x = 2 (padding)
      expect(lastTwo[1]).toMatch(/,22$/); // y = height - 2 (padding)
    });
  });

  describe("edge cases", () => {
    it("renders nothing when values has fewer than 2 data points", () => {
      const { container } = render(
        <Sparkline values={[{ date: "2025-01-01", value: 50 }]} color="#7C6AEF" />,
      );
      const svg = container.querySelector("svg");
      expect(svg).toBeNull();
    });

    it("renders nothing for empty values array", () => {
      const { container } = render(
        <Sparkline values={[]} color="#7C6AEF" />,
      );
      const svg = container.querySelector("svg");
      expect(svg).toBeNull();
    });

    it("renders a flat line when all values are the same", () => {
      const flatValues = [
        { date: "2025-01-01", value: 50 },
        { date: "2025-01-02", value: 50 },
        { date: "2025-01-03", value: 50 },
      ];
      const { container } = render(
        <Sparkline values={flatValues} color="#7C6AEF" height={24} />,
      );
      const polyline = container.querySelector("polyline");
      expect(polyline).not.toBeNull();
      const points = polyline!.getAttribute("points")!.trim().split(" ");
      // All Y coordinates should be the same (middle of the chart)
      const yCoords = points.map((p) => parseFloat(p.split(",")[1]!));
      const allSame = yCoords.every((y) => y === yCoords[0]);
      expect(allSame).toBe(true);
      // Middle Y should be height / 2
      expect(yCoords[0]).toBe(12);
    });

    it("handles exactly 2 values correctly", () => {
      const twoValues = [
        { date: "2025-01-01", value: 30 },
        { date: "2025-01-02", value: 70 },
      ];
      const { container } = render(
        <Sparkline values={twoValues} color="#7C6AEF" />,
      );
      const polyline = container.querySelector("polyline");
      expect(polyline).not.toBeNull();
      const points = polyline!.getAttribute("points")!.trim().split(" ");
      expect(points).toHaveLength(2);
    });
  });

  describe("accessibility", () => {
    it("has aria-hidden=true since it is decorative", () => {
      const { container } = render(
        <Sparkline values={sampleValues} color="#7C6AEF" />,
      );
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("className prop", () => {
    it("passes className to the SVG element", () => {
      const { container } = render(
        <Sparkline values={sampleValues} color="#7C6AEF" className="my-sparkline" />,
      );
      const svg = container.querySelector("svg");
      expect(svg?.classList.contains("my-sparkline")).toBe(true);
    });
  });
});
