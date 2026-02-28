// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ImpactV4Result } from "@chapa/shared";
import { ScoreBoldNumber } from "./ScoreBoldNumber";

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
});
