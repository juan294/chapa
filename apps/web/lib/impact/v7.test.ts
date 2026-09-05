import { describe, expect, it } from "vitest";
import { createCoreScoringInputs, createScoringWindow, SCORING_V7_POLICY, type CoreCountInputs } from "@chapa/shared";
import { calculateCoreV7, coreArchetypeV7, coreTierV7, formatCorePointV7 } from "./v7";
const window = createScoringWindow("2026-09-05T12:00:00Z");
const bound = (lower: number, upper = lower) => ({ lower, upper });
const counts = (n = 0): CoreCountInputs => ({ deliveryUnits: bound(n), quality: { rationale: bound(n), verification: bound(n), review_or_correction: bound(n), outcome_followup: bound(n) }, activeIsoWeeks: bound(n), eligibleProjects: bound(n), eligibleCategories: bound(n) });
const calculate = (value: CoreCountInputs) => calculateCoreV7(createCoreScoringInputs(window, value));

describe("v7 fixed four-dimension arithmetic", () => {
  it("has attainable exact zero and full-scale endpoints", () => {
    expect(calculate(counts()).core.composite).toEqual({ kind: "point", value: 0, displayValue: 0 });
    const top = calculate(counts(120));
    expect(top.core.composite).toEqual({ kind: "point", value: 100, displayValue: 100 });
    expect(Object.values(top.core.dimensions).every(d => d.kind === "point" && d.value === 100)).toBe(true);
    expect(top.core.tier).toBe("Elite");
    expect(top.core.archetype).toBe("Balanced");
    expect(Object.values(SCORING_V7_POLICY.coreWeights).reduce((a, b) => a + b, 0)).toBe(1);
  });
  it("uses log normalization, four fixed weights and unrounded intermediate arithmetic", () => {
    const result = calculate(counts(1));
    const expected = (100 * Math.log1p(1) / Math.log1p(120) + 100 * Math.log1p(1) / Math.log1p(12) + 100 * Math.log1p(1) / Math.log1p(40) + 100 * Math.log1p(1) / Math.log1p(4)) / 4;
    expect(result.core.composite).toMatchObject({ kind: "point", displayValue: Math.round(expected) });
    expect(result.calculation.quality.rationale.multiplier).toBe(25);
    expect(result.calculation.breadth.projects.multiplier).toBe(50);
    expect(Math.abs(result.calculation.composite.lower - expected)).toBeLessThanOrEqual(SCORING_V7_POLICY.numericTolerance);
  });
  it("ignores optional Craft, AI/tool metadata, solo mode, tenure and legacy penalties", () => {
    const base = createCoreScoringInputs(window, counts(3));
    for (const extra of [{ craft: 0 }, { craft: 100 }, { ai: true, generatedLines: 1e9, tokens: 1e8 }, { tool: "none", confidence: 50, solo: true, accountCreatedAt: "2026-09-05" }, { insightsReport: { tool: "Claude Code", uploaded: true } }]) {
      expect(calculateCoreV7({ ...base, ...extra })).toEqual(calculateCoreV7(base));
    }
  });
  it("additional observed practice cannot lower the score through a profile switch", () => {
    const before = counts(2);
    const after = { ...before, quality: { ...before.quality, review_or_correction: bound(3) } };
    expect(calculate(after).calculation.composite.lower).toBeGreaterThan(calculate(before).calculation.composite.lower);
  });
  it("discloses missing Quality as a range with the same denominator", () => {
    const value = { ...counts(120), quality: { rationale: bound(0, 12), verification: bound(0, 12), review_or_correction: bound(0, 12), outcome_followup: bound(0, 12) } };
    const result = calculate(value);
    expect(result.core.dimensions.quality).toEqual({ kind: "range", lower: 0, upper: 100, displayLower: 0, displayUpper: 100 });
    expect(result.core.composite).toEqual({ kind: "range", lower: 75, upper: 100, displayLower: 75, displayUpper: 100 });
    expect(result.core.tier).toBeNull();
    expect(result.core.archetype).toBeNull();
  });
  it("never collapses a nonzero exact interval because displayed endpoints round similarly", () => {
    const value = { ...counts(119), deliveryUnits: bound(119, 120) };
    const result = calculate(value);
    expect(result.core.composite.kind).toBe("range");
    expect(result.core.tier).toBe("Elite");
    expect(result.core.archetype).toBeNull();
  });
  it("rejects wrong versions and invalid count/reference inputs", () => {
    const base = createCoreScoringInputs(window, counts());
    expect(() => calculateCoreV7({ ...base, policyVersion: "v6" as "v7" })).toThrow();
    expect(() => calculateCoreV7({ ...base, counts: { ...base.counts, deliveryUnits: bound(-1) } })).toThrow();
    expect(() => calculateCoreV7({ ...base, window: { ...window, referenceDate: "2026-09-04" } })).toThrow();
  });
  it("is monotone in every count and preserves bounded finite outputs", () => {
    for (let n = 0; n < 150; n++) {
      const a = calculate(counts(n)); const b = calculate(counts(n + 1));
      expect(b.calculation.composite.lower).toBeGreaterThanOrEqual(a.calculation.composite.lower);
      expect(b.calculation.composite.upper).toBeLessThanOrEqual(100);
    }
  });
});

describe("v7 labels use exact values", () => {
  it.each([[29.999, "Emerging"], [30, "Solid"], [69.999, "Solid"], [70, "High"], [84.999, "High"], [85, "Elite"]] as const)("tiers %s as %s", (value, tier) => expect(coreTierV7(value)).toBe(tier));
  it.each([[29.999, "29.999"], [69.999, "69.999"], [84.999, "84.999"], [69.999999999, "<70"], [69.9, "69.9"], [70, "70"], [30.2, "30"]] as const)("formats %s without crossing a tier boundary", (value, formatted) => expect(formatCorePointV7(value)).toBe(formatted));
  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid point %s", value => {
    expect(() => coreTierV7(value)).toThrow();
    expect(() => formatCorePointV7(value)).toThrow();
  });
  it.each([
    [{ delivery: 0, quality: 0, consistency: 0, breadth: 0 }, "Emerging"],
    [{ delivery: 39, quality: 39, consistency: 39, breadth: 39 }, "Emerging"],
    [{ delivery: 55, quality: 55, consistency: 55, breadth: 55 }, "Balanced"],
    [{ delivery: 70, quality: 20, consistency: 70, breadth: 70 }, "Polymath"],
    [{ delivery: 60, quality: 70, consistency: 70, breadth: 10 }, "Quality Champion"],
    [{ delivery: 60, quality: 10, consistency: 70, breadth: 10 }, "Marathoner"],
    [{ delivery: 70, quality: 10, consistency: 30, breadth: 10 }, "Builder"],
    [{ delivery: 59, quality: 10, consistency: 45, breadth: 10 }, "Emerging"],
  ] as const)("retains the descriptive decision tree for %j", (dimensions, archetype) => expect(coreArchetypeV7(dimensions)).toBe(archetype));
});
