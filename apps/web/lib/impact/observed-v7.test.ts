import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countBounds, createScoringWindow, observedPointResult, type CoreCountInputs, type ObservedCoreInputs } from "@chapa/shared";
import { calculateObservedCoreV7 } from "./observed-v7";
import { calculateCoreV7, coreTierV7 } from "./v7";

const window = createScoringWindow("2026-09-07T17:20:02.164Z");
const bounds = (n: number) => countBounds(n, n);
const quality = (n: number) => ({ rationale: bounds(n), verification: bounds(n), review_or_correction: bounds(n), outcome_followup: bounds(n) });
const counts = (n = 0): CoreCountInputs => ({ deliveryUnits: bounds(n), quality: quality(n), activeIsoWeeks: bounds(n), eligibleProjects: bounds(n), eligibleCategories: bounds(n) });
const input = (values = counts()): ObservedCoreInputs => ({ policyVersion: "v7.2", window, counts: values });

describe("v7.2 observed-core arithmetic", () => {
  it("C01/C18: complete zero is an exact point and Emerging", () => {
    const result = calculateObservedCoreV7(input());
    expect(result.core).toEqual({ dimensions: { delivery: observedPointResult(0, "dimension"), quality: observedPointResult(0, "dimension"), consistency: observedPointResult(0, "dimension"), breadth: observedPointResult(0, "dimension") }, composite: observedPointResult(0, "core"), tier: "Emerging", archetype: "Emerging" });
    expect(result.inputs.policyVersion).toBe("v7.2");
  });
  it("C02: independently pins archived observed scalar values without rewriting its envelope", () => {
    const path = "docs/plans/2026-09-07-local-e2e-verification-phases/evidence/phase6/receipt-envelope.json";
    const bytes = readFileSync(path, "utf8");
    const archived = JSON.parse(bytes);
    const result = calculateObservedCoreV7(input(archived.receipt.inputs.counts));
    expect(result.trace.dimensions).toEqual({ delivery: 87.36108681546068, quality: 0, consistency: 48.24894837218527, breadth: 50 });
    expect(result.core.composite).toEqual({ kind: "point", exact: 46.40250879691149, displayValue: 46, displayLabel: "46" });
    expect(result.core.tier).toBe("Solid");
    expect(result.core.archetype).toBeNull();
    expect(result.trace.delivery).toEqual({ originalBounds: { lower: 65, upper: 120 }, observedCount: 65, cap: 120, clamped: 65, normalized: 0.8736108681546069, multiplier: 100, weighted: 87.36108681546068 });
    expect(archived.receipt.core.composite).toMatchObject({ kind: "range", displayLower: 46, displayUpper: 100 });
    expect(readFileSync(path, "utf8")).toBe(bytes);
  });
  it("C01: saturates every dimension and retains original uncapped bounds in the trace", () => {
    const result = calculateObservedCoreV7(input(counts(1000)));
    expect(Object.values(result.core.dimensions).map(value => value.exact)).toEqual([100, 100, 100, 100]);
    expect(result.core.composite.exact).toBe(100);
    expect(result.core.tier).toBe("Elite");
    expect(result.trace.delivery.originalBounds).toEqual(bounds(1000));
    expect(result.trace.delivery.observedCount).toBe(1000);
    expect(result.trace.delivery.clamped).toBe(120);
  });
  it("C01/C04: missing Quality keeps its quarter of the denominator", () => {
    const result = calculateObservedCoreV7(input({ ...counts(120), quality: { rationale: countBounds(0, 12), verification: countBounds(0, 12), review_or_correction: countBounds(0, 12), outcome_followup: countBounds(0, 12) } }));
    expect(result.trace.weightedDimensions).toEqual({ delivery: 25, quality: 0, consistency: 25, breadth: 25 });
    expect(result.core.composite.exact).toBe(75);
    expect(result.core.archetype).toBeNull();
  });
  it("C04: upper-only changes do not alter the observed points, but retain truthful original bounds", () => {
    const original = input(counts(1));
    const changed = input({ ...original.counts, deliveryUnits: countBounds(1, 120), activeIsoWeeks: countBounds(1, 40) });
    const a = calculateObservedCoreV7(original); const b = calculateObservedCoreV7(changed);
    expect(b.core.composite).toEqual(a.core.composite);
    expect(b.core.dimensions).toEqual(a.core.dimensions);
    expect(b.trace.delivery.originalBounds).toEqual({ lower: 1, upper: 120 });
    expect(b.inputs.counts).toEqual(changed.counts);
    expect(b.core.archetype).toBeNull();
  });
  it("C18: saturation preserves definitive archetypes despite unequal raw completion bounds", () => {
    const saturated = { deliveryUnits: countBounds(120, 150), quality: { rationale: countBounds(12, 15), verification: countBounds(12, 15), review_or_correction: countBounds(12, 15), outcome_followup: countBounds(12, 15) }, activeIsoWeeks: countBounds(40, 50), eligibleProjects: countBounds(4, 10), eligibleCategories: countBounds(4, 10) };
    expect(calculateObservedCoreV7(input(saturated)).core.archetype).toBe("Balanced");
  });
  it("C18: preserves historical tie order on exactly complete evidence", () => {
    for (const [values, expected] of [
      [{ ...counts(0), deliveryUnits: bounds(120), eligibleProjects: bounds(4), eligibleCategories: bounds(4) }, "Polymath"],
      [{ ...counts(0), quality: quality(12), activeIsoWeeks: bounds(40) }, "Quality Champion"],
      [{ ...counts(0), deliveryUnits: bounds(120), activeIsoWeeks: bounds(40) }, "Marathoner"],
      [{ ...counts(0), deliveryUnits: bounds(120) }, "Builder"],
    ] as const) {
      const result = calculateObservedCoreV7(input(values));
      expect(result.core.archetype).toBe(expected);
      expect(result.core.archetype).toBe(calculateCoreV7({ ...input(values), policyVersion: "v7" }).core.archetype);
    }
  });
  it("C05: increasing each observed component is monotonic, including saturation", () => {
    for (let n = 0; n < 150; n++) {
      const before = calculateObservedCoreV7(input(counts(n)));
      const after = calculateObservedCoreV7(input(counts(n + 1)));
      expect(after.core.composite.exact).toBeGreaterThanOrEqual(before.core.composite.exact);
      expect(after.core.composite.exact).toBeLessThanOrEqual(100);
    }
  });
  it("C17: optional reports, tools and legacy confidence cannot enter returned arithmetic inputs", () => {
    const baseline = input(counts(3));
    const expected = calculateObservedCoreV7(baseline);
    for (const craft of [undefined, null, { status: "scored", point: 0 }, { status: "scored", point: 57 }, { status: "deleted" }]) {
      expect(calculateObservedCoreV7({ ...baseline, craft, confidence: 100, tool: "Claude", legacyScore: 80 } as ObservedCoreInputs)).toEqual(expected);
    }
  });
  it.each([NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid observed count %s", value => {
    expect(() => calculateObservedCoreV7(input({ ...counts(), deliveryUnits: { lower: value, upper: value } }))).toThrow();
  });
  it("rejects reversed bounds, foreign policy and inconsistent reference context", () => {
    expect(() => calculateObservedCoreV7(input({ ...counts(), deliveryUnits: { lower: 2, upper: 1 } }))).toThrow();
    expect(() => calculateObservedCoreV7({ ...input(), policyVersion: "v7" } as unknown as ObservedCoreInputs)).toThrow();
    expect(() => calculateObservedCoreV7({ ...input(), window: { ...window, referenceDate: "2026-09-08" } })).toThrow();
  });
  it("C03: uses the shared display rule at tier boundaries and binary64 neighbors", () => {
    const data = new DataView(new ArrayBuffer(8));
    for (const boundary of [30, 70, 85]) {
      data.setFloat64(0, boundary); data.setBigUint64(0, data.getBigUint64(0) - 1n);
      const below = observedPointResult(data.getFloat64(0), "core");
      expect(below.displayValue).toBe(boundary - 0.01);
      expect(coreTierV7(below.displayValue)).toBe(coreTierV7(below.exact));
      expect(observedPointResult(boundary, "core").displayValue).toBe(boundary);
    }
  });
});
