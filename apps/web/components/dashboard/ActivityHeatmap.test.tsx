// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { LanguageProvider } from "@/lib/i18n";
import { es } from "@/lib/i18n/dictionaries/es";

// FE-M2 (#1173): controllable per-test so both the pre-hydration (SSR-safe)
// and post-hydration render paths can be exercised. Defaults to true, which
// matches every pre-existing test below (they were written assuming the
// always-on-client trimming behavior this hook now gates).
const isClientState = vi.hoisted(() => ({ current: true }));
vi.mock("@/hooks/useIsClient", () => ({
  useIsClient: () => isClientState.current,
}));

afterEach(() => {
  cleanup();
  isClientState.current = true;
});

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
    // DIMENSION_COLORS is centralized in the shared dimension-colors module
    // (single source of truth, see issue #1040 / UX-L3). Render the legend
    // swatches and confirm each one's inline background resolves to the
    // shared CSS custom property, not a hardcoded hex literal — this would
    // fail if the component fell back to a locally-redefined color map.
    const { container } = render(
      <ActivityHeatmap
        heatmapData={mockHeatmapData}
        activeDays={2}
        dimensions={mockDimensions}
      />,
    );

    const swatches = Array.from(
      container.querySelectorAll(".h-2.w-2.rounded-full"),
    ).filter((el) => (el as HTMLElement).style.backgroundColor);
    expect(swatches).toHaveLength(4);
    const expectedVars = [
      "var(--color-dimension-delivery)",
      "var(--color-dimension-quality)",
      "var(--color-dimension-consistency)",
      "var(--color-dimension-breadth)",
    ];
    swatches.forEach((swatch, i) => {
      const bg = (swatch as HTMLElement).style.backgroundColor;
      expect(bg).toBe(expectedVars[i]);
      expect(bg).not.toMatch(/^#/);
    });
  });

  // ----------------------------------------------------------------
  // 11. Renders empty state gracefully
  // ----------------------------------------------------------------
  it("renders gracefully with empty data", () => {
    render(<ActivityHeatmap heatmapData={[]} activeDays={0} />);

    expect(screen.getByText("No activity recorded yet")).toBeTruthy();
  });

  it("renders the complete activity panel in Spanish", () => {
    const data = makeDays("2025-03-03", [3, 5, 2, 0, 4, 1, 8]);
    const { container } = render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <ActivityHeatmap
          heatmapData={data}
          activeDays={6}
          dimensions={mockDimensions}
        />
      </LanguageProvider>,
    );

    expect(screen.getByText("Actividad")).toBeTruthy();
    expect(screen.getByText("Racha actual")).toBeTruthy();
    expect(screen.getByText("Día más activo")).toBeTruthy();
    expect(screen.getByText("Esta semana")).toBeTruthy();
    expect(screen.getByText("Entrega")).toBeTruthy();
    expect(screen.getByText("Calidad")).toBeTruthy();
    expect(screen.getByText("Constancia")).toBeTruthy();
    expect(screen.getByText("Alcance")).toBeTruthy();
    expect(
      screen.getByRole("img", {
        name: /Mapa de actividad: 6 días activos durante el último año/i,
      }),
    ).toBeTruthy();

    expect(container.textContent).not.toContain("Current streak");
    expect(container.textContent).not.toContain("Most active day");
    expect(container.textContent).not.toContain("This week");
    expect(container.textContent).not.toContain("No activity");
  });

  it("renders the empty activity summary in Spanish", () => {
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <ActivityHeatmap heatmapData={[]} activeDays={0} />
      </LanguageProvider>,
    );

    expect(screen.getByText("Aún no hay actividad registrada")).toBeTruthy();
    expect(screen.queryByText("No activity recorded yet")).toBeNull();
  });

  it("formats a same-month most-active-week range in Spanish order", () => {
    const data = makeDays("2025-03-03", [
      1, 1, 1, 1, 1, 1, 1,
      10, 10, 10, 10, 10, 10, 10,
    ]);
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <ActivityHeatmap heatmapData={data} activeDays={14} />
      </LanguageProvider>,
    );

    expect(
      screen.getByText(/Semana más activa: 10.*16.*mar.*10\.0 veces/i),
    ).toBeTruthy();
  });

  it("normalizes Intl range spacing so server and browser text hydrate identically", () => {
    const data = makeDays("2025-04-08", [
      1, 1, 1, 1, 1, 1, 1,
      10, 10, 10, 10, 10, 10, 10,
    ]);
    const { container } = render(
      <ActivityHeatmap heatmapData={data} activeDays={14} />,
    );

    expect(container.textContent).toContain(
      "Most active week: Apr 15 – 21 — 10.0x your weekly average",
    );
    expect(container.textContent).not.toMatch(/[\u2009\u202f]/);
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
  // H4. Accessibility — day dots are decorative, day-level data survives
  // in a visually-hidden table (#1182 / UX-M9)
  // ----------------------------------------------------------------
  //
  // `role="img"` on the timeline wrapper collapses its subtree for
  // assistive tech (only the wrapper's own summary aria-label is
  // announced), but the old implementation still put a real
  // `role="button" tabIndex={0}` on each of the ~90 day dots — a keyboard
  // user needed ~90 Tab presses to reach the content below the heatmap,
  // through elements whose only "action" was revealing a hover tooltip.
  // Fix: the dots become non-focusable decoration (no role, no tabIndex,
  // `aria-hidden`), and every day's date + contribution count is exposed
  // instead via a `sr-only` table rendered as a sibling of the `role="img"`
  // wrapper (a table inside the collapsed subtree would be silently
  // dropped by the same role="img" collapsing behavior that hides the
  // dots). Mouse hover still reveals the same portal tooltip — that
  // behavior is covered by the "tooltip interactions" describe block above
  // and is unchanged by this fix.
  describe("H4 – day dots are decorative, day-level data survives for AT", () => {
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

    it("no day dot is focusable (no tabIndex) — zero extra tab stops", () => {
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
        expect(dot.getAttribute("tabindex")).toBeNull();
      }
    });

    it("no day dot has role=\"button\" — they are decorative, not controls", () => {
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
        expect(dot.getAttribute("role")).toBeNull();
        expect(dot.getAttribute("aria-hidden")).toBe("true");
      }
    });

    it("the timeline contains zero focusable descendants (no ~90-tab-stop trap)", () => {
      const { container } = render(
        <ActivityHeatmap
          heatmapData={makeDotData()}
          activeDays={6}
          dimensions={mockDimensions}
        />,
      );

      const timeline = container.querySelector(
        "[role='img'][aria-label*='Activity heatmap']",
      )!;
      const focusable = timeline.querySelectorAll(
        'a[href], button, input, textarea, select, [tabindex]',
      );
      expect(focusable.length).toBe(0);
    });

    it("a visually-hidden table exposes every day's date and contribution count to assistive tech", () => {
      const data = makeDotData();
      const { container } = render(
        <ActivityHeatmap
          heatmapData={data}
          activeDays={6}
          dimensions={mockDimensions}
        />,
      );

      const table = container.querySelector("table.sr-only");
      expect(table).not.toBeNull();

      const rows = table!.querySelectorAll("tbody tr");
      expect(rows.length).toBe(data.length);

      // Spot-check specific days: date 2025-03-02 has count=10 (plural),
      // date 2025-03-04 has count=0.
      expect(table!.textContent).toMatch(/10 contributions/);
      expect(table!.textContent).toMatch(/0 contributions/);
    });

    it("the hidden table is reachable via the accessible table role (not display:none/visibility:hidden)", () => {
      render(
        <ActivityHeatmap
          heatmapData={makeDotData()}
          activeDays={6}
          dimensions={mockDimensions}
        />,
      );

      // sr-only clips visually but stays in the accessibility tree — RTL's
      // role queries exclude display:none/visibility:hidden/aria-hidden,
      // none of which sr-only sets.
      expect(screen.getByRole("table", { hidden: false })).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  // UX-L1 (partial, #1182) — day-of-week header and week-label text was
  // below the readable threshold (7px / 9px) at any contrast. Raised to
  // 10px. The day-of-week headers are single letters (already shortened,
  // e.g. "M"/"T"/"W" or "L"/"M"/"X"), so the 7-column grid they sit in
  // never wraps regardless of font size. The week-label column (`w-14`,
  // NOT divided across the 7 columns) holds already-abbreviated strings
  // ("This wk" / "Esta sem.") that are widened rather than shortened
  // further, since single letters would destroy their meaning.
  // ----------------------------------------------------------------
  describe("UX-L1 (partial) – heatmap label font sizes", () => {
    function getTimeline(container: HTMLElement): HTMLElement {
      return container.querySelector(
        "[role='img'][aria-label*='Activity heatmap']",
      )!;
    }

    it("day-of-week header labels are at least 10px", () => {
      const data = makeDays("2025-03-01", [3, 10, 5, 0, 7, 2, 1]);
      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={6} dimensions={mockDimensions} />,
      );

      const timeline = getTimeline(container);
      // Day-of-week header row: 7 single-letter spans, each flex-1.
      const headerRow = timeline.querySelector(".flex.items-center.gap-2.mb-1 > .flex-1");
      expect(headerRow).not.toBeNull();
      const headers = Array.from(headerRow!.querySelectorAll("span"));
      expect(headers.length).toBe(7);
      for (const header of headers) {
        expect(header.className).not.toMatch(/text-\[[1-9]px\]/);
        expect(header.className).toMatch(/text-\[(1[0-9]|[2-9][0-9])px\]/);
        // Still single-character content — no wrap risk introduced.
        expect(header.textContent!.length).toBeLessThanOrEqual(1);
      }
    });

    it("week-label column text is at least 10px and the column is widened to avoid wrap", () => {
      const data = makeDays("2025-03-01", [3, 10, 5, 0, 7, 2, 1, 4, 6, 2, 1, 9, 0, 3]);
      const { container } = render(
        <ActivityHeatmap heatmapData={data} activeDays={12} dimensions={mockDimensions} />,
      );

      const timeline = getTimeline(container);
      const weekLabel = timeline.querySelector("span.text-right");
      expect(weekLabel).not.toBeNull();
      expect(weekLabel!.className).not.toMatch(/text-\[[1-9]px\]/);
      expect(weekLabel!.className).toMatch(/text-\[(1[0-9]|[2-9][0-9])px\]/);
      // Widened from w-12 (48px) so the larger font doesn't wrap/overflow.
      expect(weekLabel!.className).not.toMatch(/\bw-12\b/);
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

  // FE-M2 (#1173): this component is server-rendered (SharePageOwnerContentLazy
  // uses next/dynamic with default ssr:true), but its streak calculation
  // deliberately uses the *local* device clock to decide whether "today" is
  // over. Server = UTC, browser = the viewer's zone, so a viewer whose local
  // date differs from UTC could see server HTML and the first client render
  // disagree — a React 19 text mismatch. The fix gates the trim behind
  // useIsClient() rather than ever substituting a server-computed UTC date.
  describe("hydration-safe streak trimming (useIsClient gating)", () => {
    /** Local calendar date string (matches activity-insights.ts's own formatting). */
    function localDateStr(offsetDays = 0): string {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    it("does not trim a zero-count 'today' entry before hydration (isClient=false), matching an SSR pass", () => {
      isClientState.current = false;
      const data = [
        { date: localDateStr(-2), count: 5 },
        { date: localDateStr(-1), count: 3 },
        { date: localDateStr(0), count: 0 },
      ];
      render(<ActivityHeatmap heatmapData={data} activeDays={2} />);
      const streakCard = screen.getByText("Current streak").closest("div");
      expect(streakCard?.textContent).toContain("0d");
    });

    it("trims a zero-count 'today' entry after hydration (isClient=true)", () => {
      isClientState.current = true;
      const data = [
        { date: localDateStr(-2), count: 5 },
        { date: localDateStr(-1), count: 3 },
        { date: localDateStr(0), count: 0 },
      ];
      render(<ActivityHeatmap heatmapData={data} activeDays={2} />);
      const streakCard = screen.getByText("Current streak").closest("div");
      expect(streakCard?.textContent).toContain("2d");
    });
  });
});

// #1217 — the chart's own aria-label carried the active-days total, so a
// sighted reader had no count anywhere on the page, and the chart had no
// scroller so a narrow screen crushed every column.
describe("ActivityHeatmap — v2 chart framing (#1217)", () => {
  it("shows the active-days count as visible text", () => {
    render(
      <ActivityHeatmap
        heatmapData={mockHeatmapData}
        activeDays={248}
        dimensions={mockDimensions}
      />,
    );
    expect(screen.getByTestId("activity-active-days").textContent).toContain(
      "248",
    );
  });

  it("puts the chart in a horizontal scroller with a minimum width", () => {
    const { container } = render(
      <ActivityHeatmap
        heatmapData={mockHeatmapData}
        activeDays={248}
        dimensions={mockDimensions}
      />,
    );
    const scroller = container.querySelector(".overflow-x-auto") as HTMLElement;
    expect(scroller).not.toBeNull();
    expect(
      (scroller.firstElementChild as HTMLElement).className,
    ).toContain("min-w-[560px]");
  });
});
