// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import type { DimensionScores } from "@chapa/shared";
import { RadarChartInteractive } from "./RadarChartInteractive";

vi.mock("@/lib/effects/counters/use-in-view", () => ({
  useInView: () => true,
}));

afterEach(cleanup);

const mockDimensions: DimensionScores = {
  delivery: 85,
  quality: 72,
  consistency: 91,
  breadth: 68,
};

/** Helper: render with animation disabled (rAF doesn't fire in jsdom). */
function renderChart(props: Partial<React.ComponentProps<typeof RadarChartInteractive>> = {}) {
  return render(
    <RadarChartInteractive
      dimensions={mockDimensions}
      animated={false}
      {...props}
    />,
  );
}

describe("RadarChartInteractive", () => {
  // -----------------------------------------------------------------------
  // 1. SVG viewBox
  // -----------------------------------------------------------------------
  describe("SVG structure", () => {
    it("renders SVG with correct viewBox (default size 280)", () => {
      const { container } = renderChart();
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("viewBox")).toBe("0 0 280 280");
    });

    it("renders SVG with custom size viewBox", () => {
      const { container } = renderChart({ size: 400 });
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 400 400");
    });
  });

  // -----------------------------------------------------------------------
  // 2. Guide diamonds (concentric polygon guides at 25%, 50%, 75%, 100%)
  // -----------------------------------------------------------------------
  describe("guide diamonds", () => {
    it("renders 4 concentric guide diamond polygons", () => {
      const { container } = renderChart();
      const guides = container.querySelectorAll(
        "[data-testid='guide-diamond']",
      );
      expect(guides.length).toBe(4);
    });

    it("guide diamonds have fill=none (they are outlines only)", () => {
      const { container } = renderChart();
      const guides = container.querySelectorAll(
        "[data-testid='guide-diamond']",
      );
      for (const guide of guides) {
        expect(guide.getAttribute("fill")).toBe("none");
      }
    });
  });

  // -----------------------------------------------------------------------
  // 3. Data polygon
  // -----------------------------------------------------------------------
  describe("data polygon", () => {
    it("renders data polygon with points matching dimension scores", () => {
      const { container } = renderChart();
      const dataPoly = container.querySelector(
        "[data-testid='data-polygon']",
      );
      expect(dataPoly).not.toBeNull();
      const points = dataPoly!.getAttribute("points");
      expect(points).toBeTruthy();
      // Should have 4 coordinate pairs (one per dimension)
      const pairs = points!.trim().split(/\s+/);
      expect(pairs.length).toBe(4);
    });

    it("data polygon points reflect dimension values (higher = further from center)", () => {
      const { container } = renderChart({
        dimensions: { delivery: 100, quality: 0, consistency: 100, breadth: 0 },
      });
      const dataPoly = container.querySelector(
        "[data-testid='data-polygon']",
      );
      const points = dataPoly!.getAttribute("points")!;
      const pairs = points.trim().split(/\s+/).map((p) => p.split(",").map(Number));
      const cx = 140; // default size 280 / 2
      const cy = 140;
      // Delivery (top, angle=-PI/2): score 100 => y far from center (above)
      expect(pairs[0]![1]!).toBeLessThan(cy);
      // Quality (right, angle=0): score 0 => at center
      expect(Math.abs(pairs[1]![0]! - cx)).toBeLessThan(2);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Vertex dots
  // -----------------------------------------------------------------------
  describe("vertex dots", () => {
    it("renders 4 vertex dots", () => {
      const { container } = renderChart();
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      expect(dots.length).toBe(4);
    });

    it("vertex dots use dimension-specific fill colors", () => {
      const { container } = renderChart();
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      const fills = Array.from(dots).map((d) => d.getAttribute("fill"));
      expect(fills).toContain("var(--color-dimension-delivery)");
      expect(fills).toContain("var(--color-dimension-quality)");
      expect(fills).toContain("var(--color-dimension-consistency)");
      expect(fills).toContain("var(--color-dimension-breadth)");
    });
  });

  // -----------------------------------------------------------------------
  // 5. Axis labels
  // -----------------------------------------------------------------------
  describe("axis labels", () => {
    it("renders 4 axis labels with dimension names and scores", () => {
      const { container } = renderChart();
      const labels = container.querySelectorAll("[data-testid='axis-label']");
      expect(labels.length).toBe(4);

      const text = container.querySelector("svg")!.textContent ?? "";
      expect(text).toContain("Delivery");
      expect(text).toContain("85");
      expect(text).toContain("Quality");
      expect(text).toContain("72");
      expect(text).toContain("Consistency");
      expect(text).toContain("91");
      expect(text).toContain("Breadth");
      expect(text).toContain("68");
    });
  });

  // -----------------------------------------------------------------------
  // 6. Hover on axis area triggers onDimensionHover callback
  // -----------------------------------------------------------------------
  describe("hover interactions", () => {
    it("hover on axis area triggers onDimensionHover callback", () => {
      const hoverFn = vi.fn();
      const { container } = renderChart({ onDimensionHover: hoverFn });
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      expect(hitAreas.length).toBe(4);

      fireEvent.mouseEnter(hitAreas[0]!);
      expect(hoverFn).toHaveBeenCalledWith("delivery");
    });

    it("mouse leave from SVG clears hover", () => {
      const hoverFn = vi.fn();
      const { container } = renderChart({ onDimensionHover: hoverFn });
      const svg = container.querySelector("svg")!;
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");

      fireEvent.mouseEnter(hitAreas[0]!);
      hoverFn.mockClear();

      fireEvent.mouseLeave(svg);
      expect(hoverFn).toHaveBeenCalledWith(null);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Click on axis area triggers onDimensionClick callback
  // -----------------------------------------------------------------------
  describe("click interactions", () => {
    it("click on axis area triggers onDimensionClick callback", () => {
      const clickFn = vi.fn();
      const { container } = renderChart({ onDimensionClick: clickFn });
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      fireEvent.click(hitAreas[1]!); // quality
      expect(clickFn).toHaveBeenCalledWith("quality");
    });
  });

  // -----------------------------------------------------------------------
  // 8. Keyboard focus on vertex triggers highlight (activeDimension state)
  // -----------------------------------------------------------------------
  describe("keyboard accessibility", () => {
    it("focus on vertex dot triggers activeDimension highlight", () => {
      const hoverFn = vi.fn();
      const { container } = renderChart({ onDimensionHover: hoverFn });
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      fireEvent.focus(dots[2]!); // consistency
      expect(hoverFn).toHaveBeenCalledWith("consistency");
    });

    // -----------------------------------------------------------------------
    // 9. Enter key on focused vertex triggers onDimensionClick
    // -----------------------------------------------------------------------
    it("Enter key on focused vertex triggers onDimensionClick", () => {
      const clickFn = vi.fn();
      const { container } = renderChart({ onDimensionClick: clickFn });
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      fireEvent.keyDown(dots[0]!, { key: "Enter" });
      expect(clickFn).toHaveBeenCalledWith("delivery");
    });

    it("Space key on focused vertex triggers onDimensionClick", () => {
      const clickFn = vi.fn();
      const { container } = renderChart({ onDimensionClick: clickFn });
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      fireEvent.keyDown(dots[3]!, { key: " " });
      expect(clickFn).toHaveBeenCalledWith("breadth");
    });
  });

  // -----------------------------------------------------------------------
  // 10. Accessibility: role="img" with descriptive aria-label
  // -----------------------------------------------------------------------
  describe("accessibility", () => {
    it('has role="img" with descriptive aria-label', () => {
      const { container } = renderChart();
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("role")).toBe("img");
      expect(svg?.getAttribute("aria-label")).toBe(
        "Radar chart showing Delivery 85, Quality 72, Consistency 91, Breadth 68",
      );
    });

    it("vertex dots are focusable with aria-labels", () => {
      const { container } = renderChart();
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      for (const dot of dots) {
        expect(dot.getAttribute("tabindex")).toBe("0");
        expect(dot.getAttribute("aria-label")).toBeTruthy();
      }
    });

    it("vertex dots do not suppress focus outline", () => {
      const { container } = renderChart();
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      for (const dot of dots) {
        const style = (dot as SVGElement).style;
        expect(style.outline).not.toBe("none");
      }
    });

    it("guide diamonds and axis lines are aria-hidden", () => {
      const { container } = renderChart();
      const guides = container.querySelectorAll(
        "[data-testid='guide-diamond']",
      );
      for (const guide of guides) {
        expect(guide.getAttribute("aria-hidden")).toBe("true");
      }
      const axisLines = container.querySelectorAll(
        "[data-testid='axis-line']",
      );
      for (const line of axisLines) {
        expect(line.getAttribute("aria-hidden")).toBe("true");
      }
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe("edge cases", () => {
    it("handles all-zero dimensions", () => {
      const { container } = renderChart({
        dimensions: { delivery: 0, quality: 0, consistency: 0, breadth: 0 },
      });
      const dataPoly = container.querySelector(
        "[data-testid='data-polygon']",
      );
      expect(dataPoly).not.toBeNull();
      // All points should be at center
      const points = dataPoly!.getAttribute("points")!;
      const pairs = points.trim().split(/\s+/).map((p) => p.split(",").map(Number));
      for (const pt of pairs) {
        expect(Math.abs(pt![0]! - 140)).toBeLessThan(2);
        expect(Math.abs(pt![1]! - 140)).toBeLessThan(2);
      }
    });

    it("handles all-100 dimensions", () => {
      const { container } = renderChart({
        dimensions: { delivery: 100, quality: 100, consistency: 100, breadth: 100 },
      });
      const dataPoly = container.querySelector(
        "[data-testid='data-polygon']",
      );
      expect(dataPoly).not.toBeNull();
    });

    it("passes className to wrapper div", () => {
      const { container } = renderChart({ className: "my-radar" });
      const wrapper = container.firstElementChild;
      expect(wrapper?.classList.contains("my-radar")).toBe(true);
    });

    it("uses controlled activeDimension prop", () => {
      const { container } = renderChart({ activeDimension: "quality" });
      // The quality vertex dot should have the active radius (r=7)
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      // quality is the second axis (index 1)
      expect(dots[1]?.getAttribute("r")).toBe("7");
      // others should be r=5
      expect(dots[0]?.getAttribute("r")).toBe("5");
      expect(dots[2]?.getAttribute("r")).toBe("5");
      expect(dots[3]?.getAttribute("r")).toBe("5");
    });
  });
});
