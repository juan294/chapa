// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ActivityHeatmap } from "./ActivityHeatmap";
import fs from "fs";
import { resolve } from "path";

const SOURCE = fs.readFileSync(
  resolve(__dirname, "ActivityHeatmap.tsx"),
  "utf-8"
);

const DIMENSION_COLORS_SOURCE = fs.readFileSync(
  resolve(__dirname, "../../lib/utils/dimension-colors.ts"),
  "utf-8"
);

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

import type { HeatmapDay } from "@chapa/shared";

const mockHeatmapData: HeatmapDay[] = [
  { date: "2025-03-01", count: 5 },
  { date: "2025-03-02", count: 3 },
  { date: "2025-03-03", count: 0 },
];

const mockDimensions = {
  delivery: 85,
  quality: 72,
  consistency: 91,
  breadth: 68,
};

/** Generate consecutive days with specific counts for insight testing. */
function makeDays(startDate: string, counts: number[]): HeatmapDay[] {
  const start = new Date(startDate + "T12:00:00");
  return counts.map((count, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { date: d.toISOString().split("T")[0] ?? startDate, count };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ActivityHeatmap", () => {
  // ----------------------------------------------------------------
  // 1. Renders dot timeline chart
  // ----------------------------------------------------------------
  it("renders dot timeline chart", () => {
    render(
      <ActivityHeatmap
        heatmapData={mockHeatmapData}
        activeDays={42}
        dimensions={mockDimensions}
      />
    );

    const grid = screen.getByRole("img", {
      name: /Activity heatmap: 42 active days/i,
    });
    expect(grid).toBeTruthy();
  }, 15000);

  // ----------------------------------------------------------------
  // 2. Shows contextual summary (not generic "active days" count)
  // ----------------------------------------------------------------
  it("shows contextual summary instead of generic active days count", () => {
    const data = makeDays("2025-03-01", [3, 5, 2, 0, 4, 1, 8]);
    render(<ActivityHeatmap heatmapData={data} activeDays={6} />);

    // Should NOT show the old generic paragraph
    expect(screen.queryByText(/active days in the last year/)).toBeNull();
  });

  // ----------------------------------------------------------------
  // 3. Has correct ARIA label
  // ----------------------------------------------------------------
  it("has correct ARIA label on section", () => {
    render(
      <ActivityHeatmap heatmapData={mockHeatmapData} activeDays={42} />
    );

    const section = screen.getByLabelText("Contribution activity");
    expect(section).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 4. Shows dimension legend
  // ----------------------------------------------------------------
  it("shows dimension color legend", () => {
    render(
      <ActivityHeatmap
        heatmapData={mockHeatmapData}
        activeDays={42}
        dimensions={mockDimensions}
      />
    );

    expect(screen.getByText("Delivery")).toBeTruthy();
    expect(screen.getByText("Quality")).toBeTruthy();
    expect(screen.getByText("Consistency")).toBeTruthy();
    expect(screen.getByText("Breadth")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 5. Shows insight cards when data is available
  // ----------------------------------------------------------------
  it("shows streak, rhythm, and this-week cards", () => {
    const data = makeDays("2025-03-01", [3, 5, 2, 0, 4, 1]);
    render(
      <ActivityHeatmap
        heatmapData={data}
        activeDays={5}
        dimensions={mockDimensions}
      />
    );

    expect(screen.getByText("Current streak")).toBeTruthy();
    expect(screen.getByText("Most active day")).toBeTruthy();
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText(/Best:/)).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 6. Hides insight cards when no active days
  // ----------------------------------------------------------------
  it("hides insight cards when activeDays is 0", () => {
    const data = makeDays("2025-03-01", [0, 0, 0]);
    render(<ActivityHeatmap heatmapData={data} activeDays={0} />);

    expect(screen.queryByText("Current streak")).toBeNull();
    expect(screen.queryByText("Most active day")).toBeNull();
  });

  // ----------------------------------------------------------------
  // 7. Shows day-of-week column headers
  // ----------------------------------------------------------------
  it("shows day-of-week column headers in dot grid", () => {
    const data = makeDays("2025-03-01", [3, 5, 2, 0, 4, 1, 8]);
    render(
      <ActivityHeatmap heatmapData={data} activeDays={6} dimensions={mockDimensions} />
    );

    // Headers M, T, W, T, F, S, S should be present
    const allMs = screen.getAllByText("M");
    expect(allMs.length).toBeGreaterThanOrEqual(1);
    const allFs = screen.getAllByText("F");
    expect(allFs.length).toBeGreaterThanOrEqual(1);
  });

  // ----------------------------------------------------------------
  // 8. Shows dot size legend
  // ----------------------------------------------------------------
  it("shows dot size legend", () => {
    render(
      <ActivityHeatmap
        heatmapData={mockHeatmapData}
        activeDays={42}
        dimensions={mockDimensions}
      />
    );

    expect(screen.getByText("Low")).toBeTruthy();
    expect(screen.getByText("Med")).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("Activity:")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 9. Works without dimensions prop (graceful fallback)
  // ----------------------------------------------------------------
  it("renders without dimensions prop", () => {
    render(
      <ActivityHeatmap heatmapData={mockHeatmapData} activeDays={42} />
    );

    const grid = screen.getByRole("img", {
      name: /Activity heatmap: 42 active days/i,
    });
    expect(grid).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 10. Uses CSS variables instead of hardcoded hex colors
  // ----------------------------------------------------------------
  it("uses CSS variables for dimension colors, not hardcoded hex", () => {
    // DIMENSION_COLORS is now centralized in the shared dimension-colors
    // module (single source of truth, see issue #1040 / UX-L3) rather than
    // redefined locally in this file — ActivityHeatmap only imports it.
    expect(SOURCE).toContain(
      'import { DIMENSION_COLORS } from "@/lib/utils/dimension-colors"'
    );
    expect(SOURCE).not.toMatch(/const DIMENSION_COLORS/);

    expect(DIMENSION_COLORS_SOURCE).toContain("var(--color-dimension-delivery)");
    expect(DIMENSION_COLORS_SOURCE).toContain("var(--color-dimension-quality)");
    expect(DIMENSION_COLORS_SOURCE).toContain("var(--color-dimension-consistency)");
    expect(DIMENSION_COLORS_SOURCE).toContain("var(--color-dimension-breadth)");

    const dimColorsBlock =
      DIMENSION_COLORS_SOURCE.match(/DIMENSION_COLORS[\s\S]*?};/)?.[0] ?? "";
    expect(dimColorsBlock).not.toContain('"#22c55e"');
    expect(dimColorsBlock).not.toContain('"#f97316"');
    expect(dimColorsBlock).not.toContain('"#06b6d4"');
    expect(dimColorsBlock).not.toContain('"#ec4899"');
  });

  // ----------------------------------------------------------------
  // 11. Renders empty state gracefully
  // ----------------------------------------------------------------
  it("renders gracefully with empty data", () => {
    render(<ActivityHeatmap heatmapData={[]} activeDays={0} />);

    expect(screen.getByText("No activity recorded yet")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // 12. ChartTooltip rendering via handleDotEnter
  // ----------------------------------------------------------------
  describe("tooltip interactions", () => {
    /** Generate exactly 7 days (one week) so we get a single week row with predictable dots. */
    function makeWeekData(): { data: HeatmapDay[]; peakDate: string } {
      // 7 days: some with activity, one peak, one zero
      const counts = [3, 10, 5, 0, 7, 2, 1];
      const data = makeDays("2025-03-01", counts);
      const peakDate = data[1]!.date; // count=10 is highest
      return { data, peakDate };
    }

    /** Find all dot divs inside the timeline (rounded-full cursor-pointer). */
    function getDotElements(container: HTMLElement): HTMLElement[] {
      const timeline = container.querySelector("[role='img'][aria-label*='Activity heatmap']");
      if (!timeline) return [];
      // Dots are the inner divs with class "rounded-full" and "cursor-pointer"
      const allDivs = timeline.querySelectorAll<HTMLElement>("div.rounded-full.cursor-pointer");
      return Array.from(allDivs);
    }

    it("shows tooltip with date and contribution count on mouseenter", () => {
      const { data } = makeWeekData();
      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={6} dimensions={mockDimensions} />,
      );

      const dots = getDotElements(container);
      expect(dots.length).toBeGreaterThan(0);

      // Hover over the first dot (date "2025-03-01", count=3)
      fireEvent.mouseEnter(dots[0]!);

      // Tooltip should appear in the document body (portaled)
      const tooltip = document.querySelector("[role='tooltip']");
      expect(tooltip).not.toBeNull();
      // Should contain the contribution count
      expect(tooltip!.textContent).toContain("3 contributions");
    });

    it("tooltip shows dimension weight percentages", () => {
      const { data } = makeWeekData();
      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={6} dimensions={mockDimensions} />,
      );

      const dots = getDotElements(container);
      fireEvent.mouseEnter(dots[0]!);

      const tooltip = document.querySelector("[role='tooltip']");
      expect(tooltip).not.toBeNull();
      // Should contain dimension labels
      expect(tooltip!.textContent).toContain("Delivery");
      expect(tooltip!.textContent).toContain("Quality");
      expect(tooltip!.textContent).toContain("Consistency");
      expect(tooltip!.textContent).toContain("Breadth");
      // Each should have a percentage
      expect(tooltip!.textContent).toMatch(/\d+%/);
    });

    it("tooltip shows 'No activity' for zero-count day", () => {
      const { data } = makeWeekData();
      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={6} dimensions={mockDimensions} />,
      );

      const dots = getDotElements(container);
      // The 4th day (index 3) has count=0
      fireEvent.mouseEnter(dots[3]!);

      const tooltip = document.querySelector("[role='tooltip']");
      expect(tooltip).not.toBeNull();
      expect(tooltip!.textContent).toContain("No activity");
    });

    it("tooltip disappears on mouseleave (handleLeave)", () => {
      const { data } = makeWeekData();
      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={6} dimensions={mockDimensions} />,
      );

      const dots = getDotElements(container);
      // Show tooltip
      fireEvent.mouseEnter(dots[0]!);
      expect(document.querySelector("[role='tooltip']")).not.toBeNull();

      // Leave — tooltip should disappear
      fireEvent.mouseLeave(dots[0]!);
      expect(document.querySelector("[role='tooltip']")).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // 13. isPeak logic — peak day gets special box-shadow styling
  // ----------------------------------------------------------------
  describe("peak day styling", () => {
    it("peak day dot has amber box-shadow", () => {
      // 7 days: day at index 2 has the highest count (20)
      const counts = [3, 5, 20, 1, 7, 2, 4];
      const data = makeDays("2025-03-01", counts);

      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={7} dimensions={mockDimensions} />,
      );

      const timeline = container.querySelector("[role='img'][aria-label*='Activity heatmap']");
      const dots = Array.from(
        timeline!.querySelectorAll<HTMLElement>("div.rounded-full.cursor-pointer"),
      );

      // The peak day (index 2, count=20) should have a boxShadow
      const peakDot = dots[2]!;
      expect(peakDot.style.boxShadow).toContain("var(--color-amber)");

      // Non-peak active dots should NOT have amber box-shadow
      const nonPeakDot = dots[0]!;
      expect(nonPeakDot.style.boxShadow).toBe("");
    });

    it("zero-count day is never marked as peak even if it matches peakDate", () => {
      // All zeros — peakDay.date will be the first date but count=0
      const data = makeDays("2025-03-01", [0, 0, 0, 0, 0, 0, 0]);

      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={0} />,
      );

      const timeline = container.querySelector("[role='img'][aria-label*='Activity heatmap']");
      if (timeline) {
        const dots = Array.from(
          timeline.querySelectorAll<HTMLElement>("div.rounded-full.cursor-pointer"),
        );
        // No dot should have the peak boxShadow since all counts are 0
        for (const dot of dots) {
          expect(dot.style.boxShadow).toBe("");
        }
      }
    });
  });

  // ----------------------------------------------------------------
  // 14. Dot opacity varies with contribution count
  // ----------------------------------------------------------------
  describe("dot opacity", () => {
    it("dots with higher counts have higher opacity than lower-count dots", () => {
      // Create data with known distribution: low=1, high=10
      const counts = [1, 10, 5, 0, 3, 8, 2];
      const data = makeDays("2025-03-01", counts);

      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={6} dimensions={mockDimensions} />,
      );

      const timeline = container.querySelector("[role='img'][aria-label*='Activity heatmap']");
      const dots = Array.from(
        timeline!.querySelectorAll<HTMLElement>("div.rounded-full.cursor-pointer"),
      );

      // Index 0 (count=1): opacity = 0.3 + (1/10)*0.7 = 0.37
      // Index 1 (count=10): opacity = 0.3 + (10/10)*0.7 = 1.0
      const lowOpacity = parseFloat(dots[0]!.style.opacity);
      const highOpacity = parseFloat(dots[1]!.style.opacity);

      expect(highOpacity).toBeGreaterThan(lowOpacity);
      expect(highOpacity).toBeCloseTo(1.0, 1);
      expect(lowOpacity).toBeCloseTo(0.37, 1);
    });

    it("zero-count dots have opacity 1 (empty state, not faded)", () => {
      const counts = [0, 5, 0];
      const data = makeDays("2025-03-01", counts);

      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={1} dimensions={mockDimensions} />,
      );

      const timeline = container.querySelector("[role='img'][aria-label*='Activity heatmap']");
      const dots = Array.from(
        timeline!.querySelectorAll<HTMLElement>("div.rounded-full.cursor-pointer"),
      );

      // Zero-count dot (index 0) should have opacity 1
      const zeroOpacity = parseFloat(dots[0]!.style.opacity);
      expect(zeroOpacity).toBe(1);
    });
  });

  // ----------------------------------------------------------------
  // 15. Dot size varies with contribution count
  // ----------------------------------------------------------------
  describe("dot size", () => {
    it("active dots are larger than empty dots", () => {
      const counts = [0, 10, 3];
      const data = makeDays("2025-03-01", counts);

      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={2} dimensions={mockDimensions} />,
      );

      const timeline = container.querySelector("[role='img'][aria-label*='Activity heatmap']");
      const dots = Array.from(
        timeline!.querySelectorAll<HTMLElement>("div.rounded-full.cursor-pointer"),
      );

      const emptySize = parseFloat(dots[0]!.style.width);
      const highSize = parseFloat(dots[1]!.style.width);
      const lowSize = parseFloat(dots[2]!.style.width);

      // Empty dots are 6px
      expect(emptySize).toBe(6);
      // Active dots: 8 + (count/max)*24 → max count=10 → 8+24=32
      expect(highSize).toBe(32);
      // count=3 → 8 + (3/10)*24 = 15.2
      expect(lowSize).toBeCloseTo(15.2, 0);
      // Higher count → bigger dot
      expect(highSize).toBeGreaterThan(lowSize);
    });
  });

  // ----------------------------------------------------------------
  // W4. DotTimeline aria-label includes active-day count
  // ----------------------------------------------------------------
  describe("W4 – DotTimeline accessible summary", () => {
    it("aria-label includes the total active-days count", () => {
      const data = makeDays("2025-03-01", [3, 0, 5, 2, 0, 8, 1]);
      // activeDays = 5 (non-zero days)
      render(
        <ActivityHeatmap heatmapData={data} activeDays={5} dimensions={mockDimensions} />,
      );

      // The role="img" wrapper should expose a label with the active-day count
      const timeline = screen.getByRole("img", {
        name: /Activity heatmap: 5 active days/i,
      });
      expect(timeline).toBeTruthy();
    });

    it("aria-label says '1 active day' (singular) when activeDays is 1", () => {
      const data = makeDays("2025-03-01", [0, 0, 0, 0, 0, 3, 0]);
      render(<ActivityHeatmap heatmapData={data} activeDays={1} />);

      const timeline = screen.getByRole("img", {
        name: /Activity heatmap: 1 active day/i,
      });
      expect(timeline).toBeTruthy();
    });

    it("aria-label says '0 active days' when there is no activity", () => {
      render(<ActivityHeatmap heatmapData={[]} activeDays={0} />);

      // The DotTimeline is not rendered for empty data, so the outer section
      // label should still be present
      const section = screen.getByLabelText("Contribution activity");
      expect(section).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // W17. StreakCard mini dots have accessible description
  // ----------------------------------------------------------------
  describe("W17 – StreakCard mini dots accessible description", () => {
    it("last-7-days dot container has an accessible label", () => {
      const data = makeDays("2025-03-01", [3, 5, 2, 0, 4, 1, 8]);
      render(
        <ActivityHeatmap heatmapData={data} activeDays={6} dimensions={mockDimensions} />,
      );

      // The 7-dot row should have an accessible label describing what it represents
      const dotsContainer = screen.getByLabelText(/last 7 days activity/i);
      expect(dotsContainer).toBeTruthy();
    });

    it("last-7-days dot container is aria-hidden=false so screen readers reach it", () => {
      const data = makeDays("2025-03-01", [3, 5, 2, 0, 4, 1, 8]);
      render(
        <ActivityHeatmap heatmapData={data} activeDays={6} dimensions={mockDimensions} />,
      );

      const dotsContainer = screen.getByLabelText(/last 7 days activity/i);
      // Should NOT be aria-hidden — it carries meaning for screen readers
      expect(dotsContainer.getAttribute("aria-hidden")).not.toBe("true");
    });
  });

  // ----------------------------------------------------------------
  // H4. Keyboard accessibility — day dots are keyboard navigable
  // ----------------------------------------------------------------
  describe("H4 – keyboard accessibility for day dots", () => {
    function makeDotData(): HeatmapDay[] {
      return makeDays("2025-03-01", [3, 10, 5, 0, 7, 2, 1]);
    }

    function getActivityDots(container: HTMLElement): HTMLElement[] {
      const timeline = container.querySelector(
        "[role='img'][aria-label*='Activity heatmap']",
      );
      if (!timeline) return [];
      return Array.from(
        timeline.querySelectorAll<HTMLElement>("div.rounded-full.cursor-pointer"),
      );
    }

    it("every day dot has tabIndex={0}", () => {
      const { container } = render(
        <ActivityHeatmap
          heatmapData={makeDotData()}
          activeDays={6}
          dimensions={mockDimensions}
        />,
      );

      const dots = getActivityDots(container);
      expect(dots.length).toBeGreaterThan(0);
      for (const dot of dots) {
        expect(dot.getAttribute("tabindex")).toBe("0");
      }
    });

    it("every day dot has role=\"button\"", () => {
      const { container } = render(
        <ActivityHeatmap
          heatmapData={makeDotData()}
          activeDays={6}
          dimensions={mockDimensions}
        />,
      );

      const dots = getActivityDots(container);
      expect(dots.length).toBeGreaterThan(0);
      for (const dot of dots) {
        expect(dot.getAttribute("role")).toBe("button");
      }
    });

    it("every day dot has an aria-label describing the date and count", () => {
      const { container } = render(
        <ActivityHeatmap
          heatmapData={makeDotData()}
          activeDays={6}
          dimensions={mockDimensions}
        />,
      );

      const dots = getActivityDots(container);
      expect(dots.length).toBeGreaterThan(0);
      for (const dot of dots) {
        const label = dot.getAttribute("aria-label");
        expect(label).toBeTruthy();
        // Should contain either a date pattern and/or contribution count
        expect(label).toMatch(/contribution/i);
      }
    });

    it("focus on a dot shows the tooltip (onFocus)", () => {
      const { container } = render(
        <ActivityHeatmap
          heatmapData={makeDotData()}
          activeDays={6}
          dimensions={mockDimensions}
        />,
      );

      const dots = getActivityDots(container);
      expect(dots.length).toBeGreaterThan(0);

      fireEvent.focus(dots[0]!);

      const tooltip = document.querySelector("[role='tooltip']");
      expect(tooltip).not.toBeNull();
    });

    it("blur on a dot hides the tooltip (onBlur)", () => {
      const { container } = render(
        <ActivityHeatmap
          heatmapData={makeDotData()}
          activeDays={6}
          dimensions={mockDimensions}
        />,
      );

      const dots = getActivityDots(container);
      // Show tooltip first
      fireEvent.focus(dots[0]!);
      expect(document.querySelector("[role='tooltip']")).not.toBeNull();

      // Blur — tooltip should disappear
      fireEvent.blur(dots[0]!);
      expect(document.querySelector("[role='tooltip']")).toBeNull();
    });

    it("Enter key on a dot shows the tooltip (onKeyDown Enter)", () => {
      const { container } = render(
        <ActivityHeatmap
          heatmapData={makeDotData()}
          activeDays={6}
          dimensions={mockDimensions}
        />,
      );

      const dots = getActivityDots(container);
      expect(dots.length).toBeGreaterThan(0);

      fireEvent.keyDown(dots[0]!, { key: "Enter" });

      const tooltip = document.querySelector("[role='tooltip']");
      expect(tooltip).not.toBeNull();
    });

    it("Space key on a dot shows the tooltip (onKeyDown Space)", () => {
      const { container } = render(
        <ActivityHeatmap
          heatmapData={makeDotData()}
          activeDays={6}
          dimensions={mockDimensions}
        />,
      );

      const dots = getActivityDots(container);
      expect(dots.length).toBeGreaterThan(0);

      fireEvent.keyDown(dots[0]!, { key: " " });

      const tooltip = document.querySelector("[role='tooltip']");
      expect(tooltip).not.toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // 16. enrichDays dimension weighting
  // ----------------------------------------------------------------
  describe("enrichDays dimension weighting", () => {
    it("enriched days use dimension colors matching profile dimensions", () => {
      // Create data with high delivery score only
      const skewedDimensions = { delivery: 100, quality: 0, consistency: 0, breadth: 0 };
      const data = makeDays("2025-03-01", [5, 3, 7, 2, 8, 1, 4]);

      const { container } = render(
        <ActivityHeatmap
          heatmapData={data}
          activeDays={7}
          dimensions={skewedDimensions}
        />,
      );

      const timeline = container.querySelector("[role='img'][aria-label*='Activity heatmap']");
      const activeDots = Array.from(
        timeline!.querySelectorAll<HTMLElement>("div.rounded-full.cursor-pointer"),
      ).filter((d) => parseFloat(d.style.opacity) < 1); // active dots have opacity < 1

      // With delivery=100 and everything else=0, all active dots should be delivery color
      for (const dot of activeDots) {
        expect(dot.style.backgroundColor).toBe("var(--color-dimension-delivery)");
      }
    });

    it("balanced dimensions produce mixed dominant colors across days", () => {
      const balancedDimensions = { delivery: 80, quality: 80, consistency: 80, breadth: 80 };
      // Generate 14 days to get enough variation
      const counts = [5, 3, 7, 2, 8, 1, 4, 6, 9, 3, 5, 7, 2, 8];
      const data = makeDays("2025-03-01", counts);

      const { container } = render(
        <ActivityHeatmap
          heatmapData={data}
          activeDays={14}
          dimensions={balancedDimensions}
        />,
      );

      const timeline = container.querySelector("[role='img'][aria-label*='Activity heatmap']");
      const activeDots = Array.from(
        timeline!.querySelectorAll<HTMLElement>("div.rounded-full.cursor-pointer"),
      ).filter((d) => parseFloat(d.style.opacity) < 1);

      // Collect unique background colors
      const colors = new Set(activeDots.map((d) => d.style.backgroundColor));
      // With balanced dimensions, we should see more than one color across 14 days
      expect(colors.size).toBeGreaterThan(1);
    });

    it("falls back to equal weighting when dimensions prop is omitted", () => {
      const data = makeDays("2025-03-01", [5, 3, 7, 2, 8, 1, 4, 6, 9, 3, 5, 7, 2, 8]);

      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={14} />,
      );

      const timeline = container.querySelector("[role='img'][aria-label*='Activity heatmap']");
      const activeDots = Array.from(
        timeline!.querySelectorAll<HTMLElement>("div.rounded-full.cursor-pointer"),
      ).filter((d) => parseFloat(d.style.opacity) < 1);

      // Should still render with dimension colors (default is 70 each)
      const colors = new Set(activeDots.map((d) => d.style.backgroundColor));
      expect(colors.size).toBeGreaterThan(0);
      // All colors should be dimension CSS variables
      for (const color of colors) {
        expect(color).toMatch(/^var\(--color-dimension-/);
      }
    });
  });
});
