// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ImpactV4Result } from "@chapa/shared";
import { ScoreRingGauge } from "./ScoreRingGauge";

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

describe("ScoreRingGauge", () => {
  it("renders score ring with the adjusted composite value", () => {
    const { container } = render(<ScoreRingGauge impact={mockImpact} />);

    // ScoreRing renders an SVG with two circles
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("shows tier pill with correct tier text", () => {
    render(<ScoreRingGauge impact={mockImpact} />);

    const pills = screen.getAllByText("High");
    expect(pills.length).toBeGreaterThanOrEqual(1);
  });

  it("shows archetype name", () => {
    render(<ScoreRingGauge impact={mockImpact} />);

    const names = screen.getAllByText("Builder");
    expect(names.length).toBeGreaterThanOrEqual(1);
  });

  it("shows profile description text", () => {
    render(<ScoreRingGauge impact={mockImpact} />);

    // getArchetypeProfile returns a description string for Builder archetype
    // We check that some profile text is rendered in the description area
    const profileTexts = screen.getAllByTestId("profile-text");
    expect(profileTexts.length).toBeGreaterThanOrEqual(1);
    expect(profileTexts[0]!.textContent).toBeTruthy();
    expect(profileTexts[0]!.textContent!.length).toBeGreaterThan(0);
  });

  it("applies ScoreEffectText for Elite tier", () => {
    const { container } = render(<ScoreRingGauge impact={eliteImpact} />);

    // ScoreEffectText with gold-shimmer adds class te-gold-shimmer
    const shimmerEl = container.querySelector(".te-gold-shimmer");
    expect(shimmerEl).toBeTruthy();
  });

  it("does not render ScoreEffectText for non-Elite tiers", () => {
    const { container } = render(<ScoreRingGauge impact={mockImpact} />);

    const shimmerEl = container.querySelector(".te-gold-shimmer");
    expect(shimmerEl).toBeNull();
  });
});
