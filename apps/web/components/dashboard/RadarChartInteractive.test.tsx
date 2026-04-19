// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
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

    it("W16: axis labels use CSS variable for font family instead of hardcoded string", () => {
      const { container } = renderChart();
      const labels = container.querySelectorAll("[data-testid='axis-label']");
      expect(labels.length).toBeGreaterThan(0);
      for (const el of labels) {
        const fontFamily = el.getAttribute("font-family");
        expect(fontFamily).toBe("var(--font-plus-jakarta)");
        expect(fontFamily).not.toContain("Plus Jakarta Sans");
      }
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

  // -----------------------------------------------------------------------
  // Animation with animated=true and inView=true
  // -----------------------------------------------------------------------
  describe("animation", () => {
    it("#733: animation does not replay when component scrolls back into view (hasAnimated guard)", () => {
      // useInView mock starts returning true.
      // We collect rAF callbacks to control animation timing.
      const rafCallbacks: Array<(ts: number) => void> = [];
      const origRAF = globalThis.requestAnimationFrame;
      const origCAF = globalThis.cancelAnimationFrame;
      let rafCallCount = 0;
      globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        rafCallCount++;
        return rafCallCount;
      };
      globalThis.cancelAnimationFrame = vi.fn();

      const { rerender } = render(
        <RadarChartInteractive dimensions={mockDimensions} animated={true} />,
      );

      // Drive animation to completion
      act(() => {
        const firstCb = rafCallbacks[0];
        if (firstCb) firstCb(0);
      });
      act(() => {
        const lastCb = rafCallbacks[rafCallbacks.length - 1];
        if (lastCb) lastCb(2000); // well past 1s duration → animation completes
      });

      const rafCountAfterFirstPlay = rafCallCount;

      // Re-render (simulates scroll away and back — useInView toggles false then true).
      // Since useInView mock always returns true here, we trigger a re-render to
      // simulate the effect re-running. The hasAnimated guard should block new rAF calls.
      act(() => {
        rerender(
          <RadarChartInteractive dimensions={mockDimensions} animated={true} />,
        );
      });

      // No additional rAF should have been requested after the first animation completed.
      expect(rafCallCount).toBe(rafCountAfterFirstPlay);

      globalThis.requestAnimationFrame = origRAF;
      globalThis.cancelAnimationFrame = origCAF;
    });

    it("starts with progress=0 when animated=true and advances via rAF", () => {
      // useInView mock already returns true.
      // When animated=true, progress starts at 0 so initial display values are 0.
      // Mock rAF to collect callbacks without recursion issues.
      let latestCallback: ((ts: number) => void) | null = null;
      const origRAF = globalThis.requestAnimationFrame;
      const origCAF = globalThis.cancelAnimationFrame;
      globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
        latestCallback = cb;
        return 1;
      };
      globalThis.cancelAnimationFrame = vi.fn();

      const { container } = render(
        <RadarChartInteractive dimensions={mockDimensions} animated={true} />,
      );

      // Before any rAF fires, progress is 0 → all display values are 0 → data polygon at center
      const dataPoly = container.querySelector("[data-testid='data-polygon']");
      const pointsBefore = dataPoly!.getAttribute("points")!;
      const pairsBefore = pointsBefore.trim().split(/\s+/).map((p) => p.split(",").map(Number));
      // All points should be at center (140, 140) since progress=0
      for (const pt of pairsBefore) {
        expect(Math.abs(pt![0]! - 140)).toBeLessThan(2);
        expect(Math.abs(pt![1]! - 140)).toBeLessThan(2);
      }

      // Drive rAF to completion inside act() so React flushes state updates.
      // First call sets startTimeRef, second call with t > duration completes animation.
      act(() => {
        if (latestCallback) latestCallback(0);
      });
      act(() => {
        if (latestCallback) latestCallback(2000);
      });

      // After animation completes, polygon points should reflect actual dimension scores
      const pointsAfter = dataPoly!.getAttribute("points")!;
      const pairsAfter = pointsAfter.trim().split(/\s+/).map((p) => p.split(",").map(Number));
      // Delivery=85, angle=-PI/2 (top): vertex should be above center
      const deliveryY = pairsAfter[0]![1]!;
      expect(deliveryY).toBeLessThan(140); // above center

      globalThis.requestAnimationFrame = origRAF;
      globalThis.cancelAnimationFrame = origCAF;
    });
  });

  // -----------------------------------------------------------------------
  // Vertex onBlur handler
  // -----------------------------------------------------------------------
  describe("vertex blur", () => {
    it("clears active state and calls onDimensionHover(null) on blur", () => {
      const hoverFn = vi.fn();
      const { container } = renderChart({ onDimensionHover: hoverFn });
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");

      // Focus to activate
      fireEvent.focus(dots[0]!);
      expect(hoverFn).toHaveBeenCalledWith("delivery");
      hoverFn.mockClear();

      // Blur to deactivate
      fireEvent.blur(dots[0]!);
      expect(hoverFn).toHaveBeenCalledWith(null);

      // Verify the vertex dot returns to inactive radius (r=5)
      expect(dots[0]?.getAttribute("r")).toBe("5");
    });
  });

  // -----------------------------------------------------------------------
  // Text anchor positioning
  // -----------------------------------------------------------------------
  describe("text anchor positioning", () => {
    it('right-side axis (Quality, angle=0) has text-anchor="start"', () => {
      const { container } = renderChart();
      const labels = container.querySelectorAll("[data-testid='axis-label']");
      // Quality is the second axis (index 1), angle=0 → cosA=1 > 0.3 → "start"
      expect(labels[1]?.getAttribute("text-anchor")).toBe("start");
    });

    it('left-side axis (Breadth, angle=PI) has text-anchor="end"', () => {
      const { container } = renderChart();
      const labels = container.querySelectorAll("[data-testid='axis-label']");
      // Breadth is the fourth axis (index 3), angle=PI → cosA=-1 < -0.3 → "end"
      expect(labels[3]?.getAttribute("text-anchor")).toBe("end");
    });

    it('top axis (Delivery, angle=-PI/2) has text-anchor="middle"', () => {
      const { container } = renderChart();
      const labels = container.querySelectorAll("[data-testid='axis-label']");
      // Delivery is the first axis (index 0), angle=-PI/2 → cosA≈0 → "middle"
      expect(labels[0]?.getAttribute("text-anchor")).toBe("middle");
    });

    it('bottom axis (Consistency, angle=PI/2) has text-anchor="middle"', () => {
      const { container } = renderChart();
      const labels = container.querySelectorAll("[data-testid='axis-label']");
      // Consistency is the third axis (index 2), angle=PI/2 → cosA≈0 → "middle"
      expect(labels[2]?.getAttribute("text-anchor")).toBe("middle");
    });
  });

  // -----------------------------------------------------------------------
  // Non-Enter/Space keydown on vertex
  // -----------------------------------------------------------------------
  describe("non-activating keydown on vertex", () => {
    it("Tab key on vertex dot does not trigger onDimensionClick", () => {
      const clickFn = vi.fn();
      const { container } = renderChart({ onDimensionClick: clickFn });
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      fireEvent.keyDown(dots[0]!, { key: "Tab" });
      expect(clickFn).not.toHaveBeenCalled();
    });

    it("Escape key on vertex dot does not trigger onDimensionClick", () => {
      const clickFn = vi.fn();
      const { container } = renderChart({ onDimensionClick: clickFn });
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      fireEvent.keyDown(dots[1]!, { key: "Escape" });
      expect(clickFn).not.toHaveBeenCalled();
    });

    it("letter key on vertex dot does not trigger onDimensionClick", () => {
      const clickFn = vi.fn();
      const { container } = renderChart({ onDimensionClick: clickFn });
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      fireEvent.keyDown(dots[2]!, { key: "a" });
      expect(clickFn).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Hit area keyboard accessibility
  // -----------------------------------------------------------------------
  describe("hit area keyboard accessibility", () => {
    it("hit areas have role='button' and tabIndex={0}", () => {
      const { container } = renderChart();
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      expect(hitAreas.length).toBe(4);
      for (const hitArea of hitAreas) {
        expect(hitArea.getAttribute("role")).toBe("button");
        expect(hitArea.getAttribute("tabindex")).toBe("0");
      }
    });

    it("hit areas have descriptive aria-labels", () => {
      const { container } = renderChart();
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      expect(hitAreas[0]?.getAttribute("aria-label")).toBe("Select Delivery dimension");
      expect(hitAreas[1]?.getAttribute("aria-label")).toBe("Select Quality dimension");
      expect(hitAreas[2]?.getAttribute("aria-label")).toBe("Select Consistency dimension");
      expect(hitAreas[3]?.getAttribute("aria-label")).toBe("Select Breadth dimension");
    });

    it("W15: hit areas do not have focusable attribute (non-standard, tabIndex handles focusability)", () => {
      const { container } = renderChart();
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      for (const hitArea of hitAreas) {
        expect(hitArea.hasAttribute("focusable")).toBe(false);
      }
    });

    it("Enter key on hit area triggers onDimensionClick", () => {
      const clickFn = vi.fn();
      const { container } = renderChart({ onDimensionClick: clickFn });
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      fireEvent.keyDown(hitAreas[0]!, { key: "Enter" });
      expect(clickFn).toHaveBeenCalledWith("delivery");
    });

    it("Space key on hit area triggers onDimensionClick", () => {
      const clickFn = vi.fn();
      const { container } = renderChart({ onDimensionClick: clickFn });
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      fireEvent.keyDown(hitAreas[2]!, { key: " " });
      expect(clickFn).toHaveBeenCalledWith("consistency");
    });

    it("non-activating keys on hit area do not trigger onDimensionClick", () => {
      const clickFn = vi.fn();
      const { container } = renderChart({ onDimensionClick: clickFn });
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      fireEvent.keyDown(hitAreas[0]!, { key: "Tab" });
      fireEvent.keyDown(hitAreas[1]!, { key: "Escape" });
      fireEvent.keyDown(hitAreas[2]!, { key: "a" });
      expect(clickFn).not.toHaveBeenCalled();
    });

    it("focus on hit area triggers onDimensionHover", () => {
      const hoverFn = vi.fn();
      const { container } = renderChart({ onDimensionHover: hoverFn });
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      fireEvent.focus(hitAreas[1]!);
      expect(hoverFn).toHaveBeenCalledWith("quality");
    });

    it("blur on hit area clears hover", () => {
      const hoverFn = vi.fn();
      const { container } = renderChart({ onDimensionHover: hoverFn });
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      fireEvent.focus(hitAreas[0]!);
      hoverFn.mockClear();
      fireEvent.blur(hitAreas[0]!);
      expect(hoverFn).toHaveBeenCalledWith(null);
    });

    it("hit areas have descriptive aria-labels in pentagon mode", () => {
      const pentaDims: DimensionScores = {
        delivery: 85, quality: 72, consistency: 91, breadth: 68, craft: 55,
      };
      const { container } = renderChart({ dimensions: pentaDims });
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      expect(hitAreas.length).toBe(5);
      expect(hitAreas[4]?.getAttribute("aria-label")).toBe("Select Craft dimension");
    });
  });

  // -----------------------------------------------------------------------
  // 5-dimension (pentagon) mode
  // -----------------------------------------------------------------------
  describe("pentagon mode (5 dimensions)", () => {
    const pentagonDimensions: DimensionScores = {
      delivery: 85,
      quality: 72,
      consistency: 91,
      breadth: 68,
      craft: 55,
    };

    it("renders 5 vertex dots when craft dimension is present", () => {
      const { container } = renderChart({ dimensions: pentagonDimensions });
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      expect(dots.length).toBe(5);
    });

    it("renders 5 guide pentagons instead of diamonds", () => {
      const { container } = renderChart({ dimensions: pentagonDimensions });
      const guides = container.querySelectorAll("[data-testid='guide-diamond']");
      expect(guides.length).toBe(4); // Still 4 ring levels
      // Each guide polygon should have 5 points (pentagon)
      for (const guide of guides) {
        const points = guide.getAttribute("points")!;
        const pairs = points.trim().split(/\s+/);
        expect(pairs.length).toBe(5);
      }
    });

    it("renders 5 axis lines", () => {
      const { container } = renderChart({ dimensions: pentagonDimensions });
      const axisLines = container.querySelectorAll("[data-testid='axis-line']");
      expect(axisLines.length).toBe(5);
    });

    it("renders 5 axis labels including Craft", () => {
      const { container } = renderChart({ dimensions: pentagonDimensions });
      const labels = container.querySelectorAll("[data-testid='axis-label']");
      expect(labels.length).toBe(5);
      const svgText = container.querySelector("svg")!.textContent ?? "";
      expect(svgText).toContain("Craft");
      expect(svgText).toContain("55");
    });

    it("data polygon has 5 points in pentagon mode", () => {
      const { container } = renderChart({ dimensions: pentagonDimensions });
      const dataPoly = container.querySelector("[data-testid='data-polygon']");
      const points = dataPoly!.getAttribute("points")!;
      const pairs = points.trim().split(/\s+/);
      expect(pairs.length).toBe(5);
    });

    it("5th vertex dot uses craft dimension color", () => {
      const { container } = renderChart({ dimensions: pentagonDimensions });
      const dots = container.querySelectorAll("[data-testid='vertex-dot']");
      expect(dots[4]?.getAttribute("fill")).toBe("var(--color-dimension-craft)");
    });

    it("aria-label includes all 5 dimensions", () => {
      const { container } = renderChart({ dimensions: pentagonDimensions });
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("aria-label")).toBe(
        "Radar chart showing Delivery 85, Quality 72, Consistency 91, Breadth 68, Craft 55",
      );
    });

    it("renders 5 hit areas for hover interaction", () => {
      const { container } = renderChart({ dimensions: pentagonDimensions });
      const hitAreas = container.querySelectorAll("[data-testid='axis-hit-area']");
      expect(hitAreas.length).toBe(5);
    });
  });
});
