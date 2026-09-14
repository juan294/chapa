import { describe, expect, expectTypeOf, it } from "vitest";
import policyFixture from "./__fixtures__/scoring-observed-policy.json";
import { SCORING_OBSERVED_POLICY, observedPointResult, type PointResult, type ObservedCoreInputs, type ObservedCoreResult, type ReportCraftResult, type ObservedScoreIdentity } from "./scoring-observed";

describe("v7.2 policy foundation (not publication dispatch)", () => {
  it("pins the machine policy and four weights independently of Craft presentation", () => {
    expect(SCORING_OBSERVED_POLICY).toEqual(policyFixture.policy);
    expect(Object.keys(SCORING_OBSERVED_POLICY.coreWeights)).toEqual(["delivery", "quality", "consistency", "breadth"]);
    expect(Object.values(SCORING_OBSERVED_POLICY.coreWeights)).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(Object.isFrozen(SCORING_OBSERVED_POLICY.coreWeights)).toBe(true);
    expect(Object.isFrozen(SCORING_OBSERVED_POLICY.reportCraft.outcomeCredits)).toBe(true);
    expectTypeOf<Extract<keyof ObservedCoreInputs, "craft" | "radarAxes" | "confidence" | "tool">>().toEqualTypeOf<never>();
  });
  it("has point-only and exact version discriminants while retaining nullable archetypes", () => {
    expectTypeOf<PointResult["kind"]>().toEqualTypeOf<"point">();
    expectTypeOf<ObservedCoreInputs["policyVersion"]>().toEqualTypeOf<"v7.2">();
    expectTypeOf<ObservedScoreIdentity["algorithmRevision"]>().toEqualTypeOf<"v7.2">();
    expectTypeOf<Extract<ObservedCoreResult["archetype"], null>>().toEqualTypeOf<null>();
    expectTypeOf<Extract<ReportCraftResult, { status: "expired" }>["point"]>().toEqualTypeOf<null>();
    expectTypeOf<Extract<ReportCraftResult, { status: "scored" }>["unlocked"]>().toEqualTypeOf<true>();
  });
  it("pins every acceptance case without claiming later phases have passed", () => {
    expect(policyFixture.acceptanceInventory.map(row => row.id)).toEqual(Array.from({ length: 24 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`));
    expect(policyFixture.acceptanceInventory.every(row => row.status === "specified")).toBe(true);
  });
  it.each(policyFixture.displayExamples)("uses the canonical display for $exact", ({ exact, displayValue, displayLabel }) => {
    expect(observedPointResult(exact, "core")).toEqual({ kind: "point", exact, displayValue, displayLabel });
  });
  it("keeps binary64 neighbors below a tier boundary in that tier", () => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    for (const boundary of [30, 70, 85]) {
      view.setFloat64(0, boundary);
      view.setBigUint64(0, view.getBigUint64(0) - 1n);
      const below = view.getFloat64(0);
      expect(observedPointResult(below, "core").displayValue).toBe(boundary - 0.01);
      expect(observedPointResult(boundary, "core").displayValue).toBe(boundary);
      view.setFloat64(0, boundary);
      view.setBigUint64(0, view.getBigUint64(0) + 1n);
      expect(observedPointResult(view.getFloat64(0), "core").displayValue).toBe(boundary);
    }
  });
  it("rounds dimension/Craft displays normally without changing the exact point", () => {
    expect(observedPointResult(69.999, "dimension")).toEqual({ kind: "point", exact: 69.999, displayValue: 70, displayLabel: "70" });
    expect(observedPointResult(0, "craft")).toEqual({ kind: "point", exact: 0, displayValue: 0, displayLabel: "0" });
  });
  it.each([NaN, Infinity, -Infinity, -1, 100.001])("rejects invalid score %s", value => {
    expect(() => observedPointResult(value, "core")).toThrow(RangeError);
  });
});
