import { describe, expect, it } from "vitest";
import type { ScoringComparison, ScoringObservation } from "./scoring-observations";
import { isSignificantScoringChange } from "./significant-change";

/**
 * #1335 phase 5 — the v6 `isSignificantChange` (SnapshotDiff-based) this file
 * used to test is retired along with `metrics_snapshots`. `scoring-observations
 * .test.ts` already covers the `score_bump` reason and the two `not_comparable`
 * short-circuits (different policy / different window) for
 * `isSignificantScoringChange`; this file covers the reasons and multi-reason
 * behavior that were not exercised anywhere: `tier_change`, `archetype_change`,
 * more than one reason firing at once, and the exact-composite boundary.
 */

const BASE_OBSERVATION: ScoringObservation = {
  policyVersion: "v7.2",
  identity: null,
  window: null,
  composite: { exact: 0, display: 0 },
  dimensions: {
    delivery: { exact: 50, display: 50 },
    quality: { exact: 50, display: 50 },
    consistency: { exact: 50, display: 50 },
    breadth: { exact: 50, display: 50 },
  },
  tier: "Solid",
  archetype: "Builder",
  craft: null,
};

function comparable(overrides: {
  previous?: Partial<ScoringObservation>;
  current?: Partial<ScoringObservation>;
  compositeExact?: number;
}): ScoringComparison {
  const previous = { ...BASE_OBSERVATION, ...overrides.previous };
  const current = { ...BASE_OBSERVATION, ...overrides.current };
  return {
    previous,
    current,
    status: "comparable",
    composite: { exact: overrides.compositeExact ?? 0, display: overrides.compositeExact ?? 0 },
    dimensions: {
      delivery: { exact: 0, display: 0 },
      quality: { exact: 0, display: 0 },
      consistency: { exact: 0, display: 0 },
      breadth: { exact: 0, display: 0 },
    },
    craft: null,
    craftLimitation: "not_scored",
  };
}

describe("isSignificantScoringChange", () => {
  it("reports a tier change alone", () => {
    const result = isSignificantScoringChange(
      comparable({ current: { tier: "High" } }),
    );
    expect(result).toMatchObject({ significant: true, reason: "tier_change", allReasons: ["tier_change"] });
  });

  it("reports an archetype change alone", () => {
    const result = isSignificantScoringChange(
      comparable({ current: { archetype: "Quality Champion" } }),
    );
    expect(result).toMatchObject({ significant: true, reason: "archetype_change", allReasons: ["archetype_change"] });
  });

  it("treats exactly the threshold composite increase as a score bump, and just under it as insignificant", () => {
    expect(isSignificantScoringChange(comparable({ compositeExact: 10 }))).toMatchObject({
      significant: true, reason: "score_bump", allReasons: ["score_bump"],
    });
    expect(isSignificantScoringChange(comparable({ compositeExact: 9.999 }))).toEqual({ significant: false });
  });

  it("does not treat a composite decrease as significant on its own", () => {
    expect(isSignificantScoringChange(comparable({ compositeExact: -20 }))).toEqual({ significant: false });
  });

  it("collects every reason that fires and orders allReasons tier/archetype/score_bump, reporting the first as reason", () => {
    const result = isSignificantScoringChange(
      comparable({
        current: { tier: "High", archetype: "Quality Champion" },
        compositeExact: 25,
      }),
    );
    expect(result).toMatchObject({
      significant: true,
      reason: "tier_change",
      allReasons: ["tier_change", "archetype_change", "score_bump"],
    });
  });

  it("reports insignificant when nothing changed", () => {
    expect(isSignificantScoringChange(comparable({}))).toEqual({ significant: false });
  });

  it("is never significant for a not_comparable result, even with a tier/archetype difference between the two observations", () => {
    const previous = { ...BASE_OBSERVATION, tier: "Solid" as const };
    const current = { ...BASE_OBSERVATION, tier: "High" as const, policyVersion: "v7" as const };
    const result = isSignificantScoringChange({
      previous,
      current,
      status: "not_comparable",
      reason: "policy_mismatch",
    });
    expect(result).toEqual({ significant: false });
  });

  it("is never significant when the current observation is not v7.2, even inside a comparable window", () => {
    const result = isSignificantScoringChange(
      comparable({ current: { policyVersion: "v7" as ScoringObservation["policyVersion"], tier: "High" } }),
    );
    expect(result).toEqual({ significant: false });
  });
});
