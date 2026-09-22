import { describe, expect, it } from "vitest";
import { createCoreScoringInputs } from "./stats-schema";
import { createScoringWindow } from "./scoring-window";
import type { CoreCountInputs } from "./scoring-evidence";

const counts: CoreCountInputs = {
  deliveryUnits: { lower: 2, upper: 4 },
  quality: { rationale: { lower: 0, upper: 2 }, verification: { lower: 1, upper: 3 }, review_or_correction: { lower: 0, upper: 1 }, outcome_followup: { lower: 0, upper: 1 } },
  activeIsoWeeks: { lower: 2, upper: 4 }, eligibleProjects: { lower: 0, upper: 1 }, eligibleCategories: { lower: 0, upper: 2 },
};
describe("core arithmetic input boundary", () => {
  it("retains identical numeric inputs under arbitrary AI/report/identity metadata and removes secrets", () => {
    const window = createScoringWindow("2026-09-05T12:00:00Z");
    const base = createCoreScoringInputs(window, counts);
    const enriched = { ...counts, craft: 99, tool: "example", aiProvenance: "generated", accessToken: "sensitive", accountCreatedAt: "2000-01-01", deliveryUnits: { ...counts.deliveryUnits, privateRepo: "secret" } };
    const enrichedWindow = { ...window, accessToken: "secret" };
    expect(createCoreScoringInputs(enrichedWindow, enriched)).toEqual(base);
    expect(JSON.stringify(base)).not.toMatch(/craft|tool|secret|privateRepo|accountCreatedAt/);
    expect(base.counts).not.toBe(counts);
  });
  it("rejects invalid bounds and inconsistent reference contexts rather than inventing measurements", () => {
    const window = createScoringWindow("2026-09-05T12:00:00Z");
    expect(() => createCoreScoringInputs(window, { ...counts, activeIsoWeeks: { lower: 1, upper: Infinity } })).toThrow();
    expect(() => createCoreScoringInputs({ ...window, referenceDate: "2020-01-01" }, counts)).toThrow();
  });
});
