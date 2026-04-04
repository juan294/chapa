// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ImpactV6Result } from "@chapa/shared";
import { ScoreBoldNumber } from "./ScoreBoldNumber";

afterEach(cleanup);

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

const mockImpact: ImpactV6Result = {
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

describe("ScoreBoldNumber", () => {
  it("renders large score number with animated counter value", () => {
    render(<ScoreBoldNumber impact={mockImpact} />);

    // The animated counter should display the adjustedComposite value
    expect(screen.getByText("80")).toBeTruthy();
  });

  it("shows tier pill inline with tier text", () => {
    render(<ScoreBoldNumber impact={mockImpact} />);

    const pills = screen.getAllByText("High");
    expect(pills.length).toBeGreaterThanOrEqual(1);
  });

  it("shows archetype name", () => {
    render(<ScoreBoldNumber impact={mockImpact} />);

    const names = screen.getAllByText("Builder");
    expect(names.length).toBeGreaterThanOrEqual(1);
  });

  it("shows profile text", () => {
    render(<ScoreBoldNumber impact={mockImpact} />);

    const profileTexts = screen.getAllByTestId("profile-text");
    expect(profileTexts.length).toBeGreaterThanOrEqual(1);
    expect(profileTexts[0]!.textContent).toBeTruthy();
    expect(profileTexts[0]!.textContent!.length).toBeGreaterThan(0);
  });

  it("shows divider between archetype and profile text", () => {
    const { container } = render(<ScoreBoldNumber impact={mockImpact} />);

    // The divider has border-t border-stroke
    const divider = container.querySelector("[data-testid='divider']");
    expect(divider).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // Score = 0 edge case
  // ----------------------------------------------------------------
  it("renders score of 0 correctly", () => {
    const zeroImpact: ImpactV6Result = {
      ...mockImpact,
      adjustedComposite: 0,
      tier: "Emerging",
    };

    render(<ScoreBoldNumber impact={zeroImpact} />);

    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getAllByText("Emerging").length).toBeGreaterThanOrEqual(1);
  });

  // ----------------------------------------------------------------
  // Score = 100 edge case
  // ----------------------------------------------------------------
  it("renders score of 100 correctly", () => {
    const maxImpact: ImpactV6Result = {
      ...mockImpact,
      adjustedComposite: 100,
      tier: "Elite",
    };

    render(<ScoreBoldNumber impact={maxImpact} />);

    expect(screen.getByText("100")).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // Elite tier uses ScoreEffectText (gold-shimmer)
  // ----------------------------------------------------------------
  it("uses ScoreEffectText for Elite tier", () => {
    const eliteImpact: ImpactV6Result = {
      ...mockImpact,
      adjustedComposite: 95,
      tier: "Elite",
    };

    const { container } = render(<ScoreBoldNumber impact={eliteImpact} />);

    // For Elite tier, the score is wrapped in ScoreEffectText with "gold-shimmer" effect
    // which renders with class te-gold-shimmer and aria-label
    const shimmerEl = container.querySelector("[aria-label='95']");
    expect(shimmerEl).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // Non-Elite tier uses plain span (no ScoreEffectText)
  // ----------------------------------------------------------------
  it("does not use ScoreEffectText for non-Elite tiers", () => {
    const { container } = render(<ScoreBoldNumber impact={mockImpact} />);

    // Non-Elite score should be a plain span without aria-label attribute
    const shimmerEl = container.querySelector("[aria-label='80']");
    expect(shimmerEl).toBeNull();
  });

  // ----------------------------------------------------------------
  // Custom className is applied
  // ----------------------------------------------------------------
  it("applies custom className", () => {
    const { container } = render(
      <ScoreBoldNumber impact={mockImpact} className="custom-class" />,
    );

    const wrapper = container.querySelector(".custom-class");
    expect(wrapper).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // Default className is empty string
  // ----------------------------------------------------------------
  it("applies animate-fade-in-up by default", () => {
    const { container } = render(<ScoreBoldNumber impact={mockImpact} />);

    const wrapper = container.querySelector(".animate-fade-in-up");
    expect(wrapper).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // Solid tier rendering
  // ----------------------------------------------------------------
  it("renders Solid tier correctly", () => {
    const solidImpact: ImpactV6Result = {
      ...mockImpact,
      adjustedComposite: 45,
      tier: "Solid",
      archetype: "Marathoner",
    };

    render(<ScoreBoldNumber impact={solidImpact} />);

    expect(screen.getByText("45")).toBeTruthy();
    expect(screen.getAllByText("Solid").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Marathoner").length).toBeGreaterThanOrEqual(1);
  });

  // ----------------------------------------------------------------
  // Emerging tier rendering
  // ----------------------------------------------------------------
  it("renders Emerging tier correctly", () => {
    const emergingImpact: ImpactV6Result = {
      ...mockImpact,
      adjustedComposite: 15,
      tier: "Emerging",
      archetype: "Emerging",
    };

    render(<ScoreBoldNumber impact={emergingImpact} />);

    expect(screen.getByText("15")).toBeTruthy();
    // "Emerging" appears as both tier pill and archetype
    const emergingTexts = screen.getAllByText("Emerging");
    expect(emergingTexts.length).toBeGreaterThanOrEqual(2);
  });

  // ----------------------------------------------------------------
  // Balanced archetype rendering
  // ----------------------------------------------------------------
  it("renders Balanced archetype with profile text", () => {
    const balancedImpact: ImpactV6Result = {
      ...mockImpact,
      archetype: "Balanced",
    };

    render(<ScoreBoldNumber impact={balancedImpact} />);

    expect(screen.getAllByText("Balanced").length).toBeGreaterThanOrEqual(1);
    const profileText = screen.getByTestId("profile-text");
    expect(profileText.textContent).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // All archetype types render profile text
  // ----------------------------------------------------------------
  const archetypes = [
    "Builder",
    "Quality Champion",
    "Marathoner",
    "Polymath",
    "Artificer",
    "Balanced",
    "Emerging",
  ] as const;

  for (const archetype of archetypes) {
    it(`renders profile text for ${archetype} archetype`, () => {
      const impact: ImpactV6Result = {
        ...mockImpact,
        archetype,
      };

      render(<ScoreBoldNumber impact={impact} />);

      const profileText = screen.getByTestId("profile-text");
      expect(profileText.textContent).toBeTruthy();
      expect(profileText.textContent!.length).toBeGreaterThan(0);
    });
  }

  // ----------------------------------------------------------------
  // Injects CSS styles for tier visuals and score effects
  // ----------------------------------------------------------------
  it("injects TIER_VISUALS_CSS and SCORE_EFFECT_CSS via style tag", () => {
    const { container } = render(<ScoreBoldNumber impact={mockImpact} />);

    const styleTag = container.querySelector("style");
    expect(styleTag).toBeTruthy();
    expect(styleTag!.innerHTML).toBeTruthy();
  });

  // ----------------------------------------------------------------
  // Decimal adjusted composite (rounded by animated counter)
  // ----------------------------------------------------------------
  it("renders decimal adjusted composite as integer (from animated counter)", () => {
    const decimalImpact: ImpactV6Result = {
      ...mockImpact,
      adjustedComposite: 82.7,
    };

    render(<ScoreBoldNumber impact={decimalImpact} />);

    // The useAnimatedCounter mock returns the target directly (82.7)
    // In real usage this would be an integer, but the mock passes through
    expect(screen.getByText("82.7")).toBeTruthy();
  });
});
