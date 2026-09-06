import { describe, expect, it } from "vitest";
import type { ImpactV6Result, StatsData } from "@chapa/shared";
import { simulateCoreScore } from "./simulate";

const heatmapData: StatsData["heatmapData"] = Array.from({ length: 365 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 0, 1) + index * 86_400_000).toISOString().slice(0, 10),
  count: index % 3 === 0 ? 2 : 0,
}));

const impact: ImpactV6Result = {
  handle: "alice",
  profileType: "collaborative",
  dimensions: { delivery: 70, quality: 60, consistency: 50, breadth: 40 },
  archetype: "Builder",
  compositeScore: 55,
  confidence: 90,
  confidencePenalties: [],
  adjustedComposite: 0,
  tier: "Solid",
  computedAt: "2026-09-01T12:00:00.000Z",
};

/** The current adjusted score, as the profile itself would report it. */
const current = simulateCoreScore({ ...impact, adjustedComposite: 0 }, heatmapData).adjusted;
const profile: ImpactV6Result = { ...impact, adjustedComposite: current };

describe("shared what-if calculator", () => {
  it("returns zero delta when nothing is overridden", () => {
    expect(simulateCoreScore(profile, heatmapData).deltaVsCurrent).toBe(0);
  });

  it("returns zero delta when overrides restate the current dimensions", () => {
    expect(simulateCoreScore(profile, heatmapData, { ...profile.dimensions }).deltaVsCurrent).toBe(0);
  });

  it("moves the score only in the direction the override moves a dimension", () => {
    expect(simulateCoreScore(profile, heatmapData, { delivery: 100 }).deltaVsCurrent).toBeGreaterThan(0);
    expect(simulateCoreScore(profile, heatmapData, { delivery: 0 }).deltaVsCurrent).toBeLessThan(0);
  });

  it("holds profile type fixed: a solo profile keeps its own dimension set", () => {
    const solo = { ...profile, profileType: "solo" as const };
    const soloCurrent = simulateCoreScore({ ...solo, adjustedComposite: 0 }, heatmapData).adjusted;

    expect(simulateCoreScore({ ...solo, adjustedComposite: soloCurrent }, heatmapData).deltaVsCurrent).toBe(0);
  });

  it("assumes no confidence penalty for a visitor projection that carries none", () => {
    const { confidence: _confidence, confidencePenalties: _penalties, ...visitor } = profile;

    expect(simulateCoreScore(visitor, heatmapData).adjusted)
      .toBeGreaterThanOrEqual(simulateCoreScore(profile, heatmapData).adjusted);
  });
});
