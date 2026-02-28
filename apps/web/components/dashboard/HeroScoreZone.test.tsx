// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ImpactV4Result } from "@chapa/shared";
import { HeroScoreZone } from "./HeroScoreZone";

vi.mock("./ScoreRingGauge", () => ({
  ScoreRingGauge: () => <div data-testid="ring-gauge" />,
}));

vi.mock("./ScoreBoldNumber", () => ({
  ScoreBoldNumber: () => <div data-testid="bold-number" />,
}));

vi.mock("./ScoreConcentricRings", () => ({
  ScoreConcentricRings: () => <div data-testid="concentric-rings" />,
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
  it("renders ScoreRingGauge when variant='ring'", () => {
    const { container } = render(
      <HeroScoreZone variant="ring" impact={mockImpact} />,
    );

    expect(container.querySelector("[data-testid='ring-gauge']")).toBeTruthy();
    expect(container.querySelector("[data-testid='bold-number']")).toBeNull();
    expect(
      container.querySelector("[data-testid='concentric-rings']"),
    ).toBeNull();
  });

  it("renders ScoreBoldNumber when variant='bold'", () => {
    const { container } = render(
      <HeroScoreZone variant="bold" impact={mockImpact} />,
    );

    expect(container.querySelector("[data-testid='bold-number']")).toBeTruthy();
    expect(container.querySelector("[data-testid='ring-gauge']")).toBeNull();
    expect(
      container.querySelector("[data-testid='concentric-rings']"),
    ).toBeNull();
  });

  it("renders ScoreConcentricRings when variant='rings'", () => {
    const { container } = render(
      <HeroScoreZone variant="rings" impact={mockImpact} />,
    );

    expect(
      container.querySelector("[data-testid='concentric-rings']"),
    ).toBeTruthy();
    expect(container.querySelector("[data-testid='ring-gauge']")).toBeNull();
    expect(container.querySelector("[data-testid='bold-number']")).toBeNull();
  });
});
