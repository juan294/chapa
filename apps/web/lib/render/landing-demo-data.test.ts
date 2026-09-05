import { describe, it, expect } from "vitest";
import { deriveArchetype } from "@/lib/impact/v6";
import { getTier } from "@/lib/impact/utils";
import { DEMO_IMPACT, DEMO_STATS } from "./demoData";
import { LANDING_IMPACT } from "./landing-demo-data";
import { renderBadgeSvg } from "./BadgeSvg";

describe("curated landing sample", () => {
  it("uses the independent 92/Elite Balanced profile while preserving demo identity", () => {
    expect(LANDING_IMPACT).toMatchObject({
      handle: DEMO_IMPACT.handle,
      profileType: DEMO_IMPACT.profileType,
      computedAt: DEMO_IMPACT.computedAt,
      dimensions: { delivery: 96, quality: 88, consistency: 94, breadth: 90, craft: 92 },
      compositeScore: 92, adjustedComposite: 92, confidence: 100,
      confidencePenalties: [], tier: "Elite", archetype: "Balanced",
    });
    expect(LANDING_IMPACT.tier).toBe(getTier(LANDING_IMPACT.adjustedComposite));
    expect(LANDING_IMPACT.archetype).toBe(deriveArchetype(LANDING_IMPACT.dimensions, LANDING_IMPACT.profileType));
  });

  it("cannot mutate the shared High/82 demo through any sample-owned object", () => {
    expect(LANDING_IMPACT).not.toBe(DEMO_IMPACT);
    expect(LANDING_IMPACT.dimensions).not.toBe(DEMO_IMPACT.dimensions);
    expect(LANDING_IMPACT.confidencePenalties).not.toBe(DEMO_IMPACT.confidencePenalties);
    expect(Object.isFrozen(LANDING_IMPACT)).toBe(true);
    expect(Object.isFrozen(LANDING_IMPACT.dimensions)).toBe(true);
    expect(Object.isFrozen(LANDING_IMPACT.confidencePenalties)).toBe(true);
    expect(DEMO_IMPACT).toMatchObject({ adjustedComposite: 82, tier: "High", compositeScore: 76, confidence: 87 });
    expect(DEMO_IMPACT.dimensions).toEqual({ delivery: 88, quality: 72, consistency: 80, breadth: 65, craft: 72 });
  });

  it.each([false, true])("renders 92/Elite with explicit sample disclosure (static=%s)", (disableAnimation) => {
    const svg = renderBadgeSvg(DEMO_STATS, LANDING_IMPACT, { demoMode: true, includeBranding: true, disableAnimation });
    expect(svg).toMatch(/data-element="score"[^>]*>92<\/text>/);
    expect(svg).toMatch(/data-element="tier"[^>]*>Elite<\/text>/);
    expect(svg).toContain("Simulated metrics");
    expect(svg).toContain("SAMPLE · NOT A REAL BADGE");
    expect(svg).not.toContain('href="https://chapa.thecreativetoken.com/verify/');
  });
});
