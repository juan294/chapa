// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { makeScoring } from "@/lib/test-helpers/fixtures";
import { DimensionCardsRow } from "./DimensionCardsRow";

// ---------------------------------------------------------------------------
// Mock DimensionCard to isolate this component's behavior
// ---------------------------------------------------------------------------
vi.mock("./DimensionCard", () => ({
  DimensionCard: (props: Record<string, unknown>) => {
    const receiptPresentation = props.receiptPresentation as { display: string | null } | undefined;
    return (
      <div
        data-testid={`dimension-card-${props.dimension}`}
        data-display={receiptPresentation?.display ?? ""}
        data-animation-delay={props.animationDelay}
        className={typeof props.className === "string" ? props.className : ""}
      >
        {String(props.dimension)}
      </div>
    );
  },
}));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const scoringNoCraft = makeScoring({
  dimensions: {
    delivery: { kind: "point", value: 85, display: 85 },
    quality: { kind: "point", value: 72, display: 72 },
    consistency: { kind: "point", value: 91, display: 91 },
    breadth: { kind: "point", value: 68, display: 68 },
  },
});

const scoringWithCraft = makeScoring({
  dimensions: scoringNoCraft.dimensions,
  reportCraft: {
    status: "scored",
    unlocked: true,
    report: {
      reportRef: "00000000-0000-4000-8000-000000000099",
      supersedesReportRef: null,
      inputs: {
        policyVersion: "v7.2",
        classifierRevision: "cc-outcomes-v7.2",
        window: { referenceTime: "2026-09-08T10:00:00.000Z", referenceDate: "2026-09-08", startInclusive: "2025-09-09T00:00:00.000Z", endExclusive: "2026-09-09T00:00:00.000Z", calendarDays: 365 },
        reportPeriod: { startInclusive: "2026-09-01T00:00:00.000Z", endExclusive: "2026-09-08T00:00:00.000Z" },
        totalSessions: 10,
        outcomes: { fully_achieved: 4, mostly_achieved: 2, partially_achieved: 0, not_achieved: 0 },
        unknownSessions: 0,
        unclassifiedSessions: 0,
      },
      result: {
        status: "scored",
        unlocked: true,
        provenance: "report_derived",
        assessment: "model_estimate",
        reportPeriod: { startInclusive: "2026-09-01T00:00:00.000Z", endExclusive: "2026-09-08T00:00:00.000Z" },
        point: { kind: "point", exact: 45, displayValue: 45, displayLabel: "45" },
        trace: { outcomeCredits: { fully_achieved: 1, mostly_achieved: 0.7, partially_achieved: 0.3, not_achieved: 0 }, creditedSessions: 5.4, recognizedSessions: 6, totalSessions: 10, unknownSessions: 0, unclassifiedSessions: 0, recognizedCoverage: 0.6, exact: 45 },
      },
    },
  },
} as never);

describe("DimensionCardsRow", () => {
  it("renders 4 DimensionCards, one per dimension, when Craft is not unlocked", () => {
    render(<DimensionCardsRow scoring={scoringNoCraft} />);

    expect(screen.getByTestId("dimension-card-delivery")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-quality")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-consistency")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-breadth")).toBeTruthy();
    expect(screen.queryByTestId("dimension-card-craft")).toBeNull();
  });

  it("passes the receipt-presented display value to each DimensionCard", () => {
    render(<DimensionCardsRow scoring={scoringNoCraft} />);

    expect(screen.getByTestId("dimension-card-delivery").getAttribute("data-display")).toBe("85");
    expect(screen.getByTestId("dimension-card-quality").getAttribute("data-display")).toBe("72");
    expect(screen.getByTestId("dimension-card-consistency").getAttribute("data-display")).toBe("91");
    expect(screen.getByTestId("dimension-card-breadth").getAttribute("data-display")).toBe("68");
  });

  it('renders section header "Performance Dimensions"', () => {
    render(<DimensionCardsRow scoring={scoringNoCraft} />);

    const header = screen.getByText("Performance Dimensions");
    expect(header).toBeTruthy();
    expect(header.tagName).toBe("H3");
  });

  it("has responsive 4-column grid classes when Craft is not unlocked", () => {
    const { container } = render(
      <DimensionCardsRow scoring={scoringNoCraft} />,
    );

    const grid = container.querySelector(".grid");
    expect(grid).toBeTruthy();
    expect(grid!.classList.contains("grid-cols-1")).toBe(true);
    expect(grid!.classList.contains("sm:grid-cols-2")).toBe(true);
    expect(grid!.classList.contains("lg:grid-cols-4")).toBe(true);
    expect(grid!.classList.contains("gap-3")).toBe(true);
  });

  it("passes staggered animationDelay to each card (400, 500, 600, 700)", () => {
    render(<DimensionCardsRow scoring={scoringNoCraft} />);

    expect(screen.getByTestId("dimension-card-delivery").getAttribute("data-animation-delay")).toBe("400");
    expect(screen.getByTestId("dimension-card-quality").getAttribute("data-animation-delay")).toBe("500");
    expect(screen.getByTestId("dimension-card-consistency").getAttribute("data-animation-delay")).toBe("600");
    expect(screen.getByTestId("dimension-card-breadth").getAttribute("data-animation-delay")).toBe("700");
  });

  it("applies custom className to the section wrapper", () => {
    const { container } = render(
      <DimensionCardsRow scoring={scoringNoCraft} className="mt-8" />,
    );

    const section = container.firstElementChild as HTMLElement;
    expect(section.classList.contains("mt-8")).toBe(true);
  });

  it("renders 5 cards and a 5-column grid when Craft is unlocked", () => {
    const { container } = render(
      <DimensionCardsRow scoring={scoringWithCraft} />,
    );

    expect(screen.getByTestId("dimension-card-delivery")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-quality")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-consistency")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-breadth")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-craft")).toBeTruthy();
    expect(screen.getByTestId("dimension-card-craft").getAttribute("data-display")).toBe("45");

    const grid = container.querySelector(".grid");
    expect(grid!.classList.contains("grid-cols-2")).toBe(true);
    expect(grid!.classList.contains("sm:grid-cols-3")).toBe(true);
    expect(grid!.classList.contains("lg:grid-cols-5")).toBe(true);
  });
});
