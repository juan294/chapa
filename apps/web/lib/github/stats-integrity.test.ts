import { describe, it, expect } from "vitest";
import { isDegradedPrFetch } from "./stats-integrity";
import { makeStats } from "../test-helpers/fixtures";

describe("isDegradedPrFetch", () => {
  it("flags a zero-PR fetch when last-known-good had merged PRs and activity remains", () => {
    // The confirmed #1002 signature: viewer-scoped fetch loses private-repo
    // PR visibility → prsMergedCount 0, but commits/issues stay high.
    const fresh = makeStats({
      prsMergedCount: 0,
      prsMergedWeight: 0,
      commitsTotal: 15533,
      issuesClosedCount: 5096,
    });
    const lastGood = makeStats({
      prsMergedCount: 41,
      prsMergedWeight: 120,
      commitsTotal: 14000,
      issuesClosedCount: 608,
    });

    expect(isDegradedPrFetch(fresh, lastGood)).toBe(true);
  });

  it("flags a zero-PR fetch when only issues remain (no commits)", () => {
    const fresh = makeStats({ prsMergedCount: 0, commitsTotal: 0, issuesClosedCount: 42 });
    const lastGood = makeStats({ prsMergedCount: 10 });
    expect(isDegradedPrFetch(fresh, lastGood)).toBe(true);
  });

  it("accepts a fetch that still has merged PRs (not a collapse)", () => {
    const fresh = makeStats({ prsMergedCount: 3, prsMergedWeight: 8 });
    const lastGood = makeStats({ prsMergedCount: 41, prsMergedWeight: 120 });
    expect(isDegradedPrFetch(fresh, lastGood)).toBe(false);
  });

  it("accepts a zero-PR fetch when there is no baseline (first-ever fetch)", () => {
    const fresh = makeStats({ prsMergedCount: 0, commitsTotal: 100 });
    expect(isDegradedPrFetch(fresh, null)).toBe(false);
    expect(isDegradedPrFetch(fresh, undefined)).toBe(false);
  });

  it("accepts a legitimate no-PR reviewer (baseline also had zero PRs)", () => {
    const fresh = makeStats({ prsMergedCount: 0, commitsTotal: 200, issuesClosedCount: 30 });
    const lastGood = makeStats({ prsMergedCount: 0, commitsTotal: 180 });
    expect(isDegradedPrFetch(fresh, lastGood)).toBe(false);
  });

  it("accepts a fully-empty fetch (indistinguishable from a reset account)", () => {
    const fresh = makeStats({ prsMergedCount: 0, commitsTotal: 0, issuesClosedCount: 0 });
    const lastGood = makeStats({ prsMergedCount: 10, commitsTotal: 500 });
    expect(isDegradedPrFetch(fresh, lastGood)).toBe(false);
  });

  it("allows the recovery path: zero baseline → real PRs writes through", () => {
    // When last-known-good was itself poisoned (prsMergedCount 0), a later
    // healthy fetch with real PRs must NOT be blocked, so the profile heals.
    const fresh = makeStats({ prsMergedCount: 41, prsMergedWeight: 120 });
    const poisonedBaseline = makeStats({ prsMergedCount: 0, prsMergedWeight: 0, commitsTotal: 15000 });
    expect(isDegradedPrFetch(fresh, poisonedBaseline)).toBe(false);
  });
});
