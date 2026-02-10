import { describe, it, expect } from "vitest";
import { computePrWeight } from "./scoring";

describe("computePrWeight", () => {
  it("returns 0.5 for a trivial PR (0 files, 0 lines)", () => {
    expect(computePrWeight({ additions: 0, deletions: 0, changedFiles: 0 })).toBeCloseTo(0.5, 2);
  });

  it("increases with more changed files", () => {
    const small = computePrWeight({ additions: 10, deletions: 5, changedFiles: 1 });
    const large = computePrWeight({ additions: 10, deletions: 5, changedFiles: 20 });
    expect(large).toBeGreaterThan(small);
  });

  it("increases with more lines changed", () => {
    const small = computePrWeight({ additions: 10, deletions: 5, changedFiles: 3 });
    const large = computePrWeight({ additions: 1000, deletions: 500, changedFiles: 3 });
    expect(large).toBeGreaterThan(small);
  });

  it("caps at 3.0 for very large PRs", () => {
    const weight = computePrWeight({ additions: 10000, deletions: 5000, changedFiles: 100 });
    expect(weight).toBe(3.0);
  });

  it("matches the expected formula: 0.5 + 0.25*ln(1+files) + 0.25*ln(1+adds+dels)", () => {
    const pr = { additions: 100, deletions: 20, changedFiles: 5 };
    const expected = 0.5 + 0.25 * Math.log(1 + 5) + 0.25 * Math.log(1 + 120);
    expect(computePrWeight(pr)).toBeCloseTo(expected, 10);
  });
});
