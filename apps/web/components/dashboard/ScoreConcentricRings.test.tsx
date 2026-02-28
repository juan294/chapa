// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ImpactV4Result } from "@chapa/shared";
import { ScoreConcentricRings } from "./ScoreConcentricRings";

vi.mock("@/lib/effects/counters/use-in-view", () => ({
  useInView: () => true,
}));

vi.mock("@/lib/effects/counters/use-animated-counter", () => ({
  useAnimatedCounter: (target: number) => ({
    value: target,
    isAnimating: false,
    animate: vi.fn(),
  }),
}));

const mockImpact: ImpactV4Result = {
  handle: "testuser",
  profileType: "solo",
  dimensions: { delivery: 85, quality: 72, consistency: 91, breadth: 68 },
  archetype: "Builder",
  compositeScore: 82,
  confidence: 85,
  confidencePenalties: [],
  adjustedComposite: 80,
  tier: "High",
  computedAt: "2026-02-28T00:00:00Z",
};

const eliteImpact: ImpactV4Result = {
  ...mockImpact,
  adjustedComposite: 92,
  tier: "Elite",
};

describe("ScoreConcentricRings", () => {
  it("renders 4 nested ScoreRing components (8 circles total: 2 per ring)", () => {
    const { container } = render(
      <ScoreConcentricRings impact={mockImpact} />,
    );

    // Each ScoreRing renders an SVG with 2 circles (track + value).
    // 4 nested rings = 4 SVGs = 8 circles.
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(8);
  });

  it("shows composite score in center (the animated counter value)", () => {
    const { container } = render(
      <ScoreConcentricRings impact={mockImpact} />,
    );

    // adjustedComposite is 80 — rendered inside the center of the nested rings
    const scoreEl = container.querySelector(
      ".font-heading.text-3xl.font-extrabold",
    );
    expect(scoreEl).toBeTruthy();
    expect(scoreEl!.textContent).toBe("80");
  });

  it("shows tier pill and archetype name below rings", () => {
    const { container } = render(
      <ScoreConcentricRings impact={mockImpact} />,
    );

    // Scope queries to container to avoid cross-test DOM leakage
    const tierPill = container.querySelector(
      ".inline-flex.items-center.rounded-full.border",
    );
    expect(tierPill).toBeTruthy();
    expect(tierPill!.textContent).toBe("High");

    // Archetype name
    const archetype = container.querySelector(
      ".font-heading.text-sm.font-medium",
    );
    expect(archetype).toBeTruthy();
    expect(archetype!.textContent).toBe("Builder");
  });

  it("shows legend with 4 dimensions and their scores", () => {
    const { container } = render(
      <ScoreConcentricRings impact={mockImpact} />,
    );

    // Legend items: each has a dot, dimension name, and score
    const legendItems = container.querySelectorAll("[data-testid='legend-dot']");
    expect(legendItems.length).toBe(4);

    // Check dimension labels and scores via textContent of the legend area
    const legendText = container.textContent ?? "";
    expect(legendText).toContain("Delivery");
    expect(legendText).toContain("Quality");
    expect(legendText).toContain("Consistency");
    expect(legendText).toContain("Breadth");
    expect(legendText).toContain("85");
    expect(legendText).toContain("72");
    expect(legendText).toContain("91");
    expect(legendText).toContain("68");
  });

  it("legend has colored dots for each dimension", () => {
    const { container } = render(
      <ScoreConcentricRings impact={mockImpact} />,
    );

    const dots = container.querySelectorAll("[data-testid='legend-dot']");
    expect(dots.length).toBe(4);
  });

  it("applies ScoreEffectText for Elite tier", () => {
    const { container } = render(
      <ScoreConcentricRings impact={eliteImpact} />,
    );

    // ScoreEffectText with gold-shimmer adds class te-gold-shimmer
    const shimmerEl = container.querySelector(".te-gold-shimmer");
    expect(shimmerEl).toBeTruthy();
  });

  it("does not render ScoreEffectText for non-Elite tiers", () => {
    const { container } = render(
      <ScoreConcentricRings impact={mockImpact} />,
    );

    const shimmerEl = container.querySelector(".te-gold-shimmer");
    expect(shimmerEl).toBeNull();
  });
});
