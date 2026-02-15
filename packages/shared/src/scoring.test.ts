import { describe, it, expect } from "vitest";
import { computePrWeight } from "./scoring";

describe("computePrWeight", () => {
  it("returns 0 for a trivial PR (0 files, 0 lines)", () => {
    expect(computePrWeight({ additions: 0, deletions: 0, changedFiles: 0 })).toBe(0);
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

  it("matches the expected formula with size multiplier applied", () => {
    const pr = { additions: 100, deletions: 20, changedFiles: 5 };
    // totalChanges = 5 + 100 + 20 = 125 → sizeMultiplier = min(1, 125/10) = 1
    const rawWeight = 0.5 + 0.25 * Math.log(1 + 5) + 0.25 * Math.log(1 + 120);
    expect(computePrWeight(pr)).toBeCloseTo(rawWeight, 10);
  });

  // --- Size multiplier tests ---

  describe("size multiplier (anti-trivial-PR spam)", () => {
    it("returns 0 when totalChanges is 0 (empty PR)", () => {
      const weight = computePrWeight({ additions: 0, deletions: 0, changedFiles: 0 });
      expect(weight).toBe(0);
    });

    it("scales linearly from 0→1 as totalChanges grows from 0→10", () => {
      // 1 file, 0 lines → totalChanges = 1 → sizeMultiplier = 0.1
      const w1 = computePrWeight({ additions: 0, deletions: 0, changedFiles: 1 });
      // 5 files, 0 lines → totalChanges = 5 → sizeMultiplier = 0.5
      const w5 = computePrWeight({ additions: 0, deletions: 0, changedFiles: 5 });
      // 10 files, 0 lines → totalChanges = 10 → sizeMultiplier = 1.0
      const w10 = computePrWeight({ additions: 0, deletions: 0, changedFiles: 10 });

      expect(w5).toBeGreaterThan(w1);
      expect(w10).toBeGreaterThan(w5);
    });

    it("gives full weight when totalChanges >= 10", () => {
      // 10 total changes: sizeMultiplier = 1.0 → full rawWeight
      const w10 = computePrWeight({ additions: 5, deletions: 3, changedFiles: 2 });
      // 20 total changes: sizeMultiplier = 1.0 → same formula, higher raw
      const w20 = computePrWeight({ additions: 10, deletions: 5, changedFiles: 5 });

      // Both should get full multiplier; w20 is larger only because of higher raw weight
      const raw10 = 0.5 + 0.25 * Math.log(1 + 2) + 0.25 * Math.log(1 + 8);
      expect(w10).toBeCloseTo(raw10, 10);
    });

    it("reduces weight for 1-file 1-line PR (totalChanges=2)", () => {
      const weight = computePrWeight({ additions: 1, deletions: 0, changedFiles: 1 });
      // totalChanges = 2, sizeMultiplier = 0.2
      const rawWeight = 0.5 + 0.25 * Math.log(1 + 1) + 0.25 * Math.log(1 + 1);
      expect(weight).toBeCloseTo(rawWeight * 0.2, 10);
    });

    it("sums changedFiles + additions + deletions for totalChanges", () => {
      // 3 files + 4 additions + 3 deletions = 10 → sizeMultiplier = 1.0
      const weight = computePrWeight({ additions: 4, deletions: 3, changedFiles: 3 });
      const rawWeight = 0.5 + 0.25 * Math.log(1 + 3) + 0.25 * Math.log(1 + 7);
      expect(weight).toBeCloseTo(rawWeight, 10);
    });
  });
});
