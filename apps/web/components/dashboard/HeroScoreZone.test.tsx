// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ImpactV4Result } from "@chapa/shared";
import { HeroScoreZone } from "./HeroScoreZone";

vi.mock("./ScoreBoldNumber", () => ({
  ScoreBoldNumber: () => <div data-testid="bold-number" />,
}));

afterEach(cleanup);

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

describe("HeroScoreZone", () => {
  it("renders ScoreBoldNumber", () => {
    const { container } = render(
      <HeroScoreZone impact={mockImpact} />,
    );

    expect(container.querySelector("[data-testid='bold-number']")).toBeTruthy();
  });

  it("passes className to ScoreBoldNumber", () => {
    // Verifies it renders without error with className
    const { container } = render(
      <HeroScoreZone impact={mockImpact} className="custom-class" />,
    );

    expect(container.querySelector("[data-testid='bold-number']")).toBeTruthy();
  });
});
