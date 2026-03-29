import { describe, it, expect } from "vitest";
import { mergeStats } from "@/lib/github/merge";
import { computeImpactV4 } from "./v4";
import { buildSnapshot } from "@/lib/history/snapshot";
import { makeFullStats } from "@/lib/test-helpers/fixtures";
import { MERGE_EXPECTED_KEYS } from "@chapa/shared";
import type { StatsData } from "@chapa/shared";

/**
 * End-to-end pipeline integrity tests.
 *
 * Traces the full scoring pipeline without mocks:
 *   aggregation → merge → scoring → snapshot
 *
 * Asserts field survival and score ranges at each stage.
 */
describe("scoring pipeline integrity", () => {
  it("all fields survive aggregation → merge → scoring → snapshot", () => {
    const primary = makeFullStats({ handle: "alice", prsMergedCount: 30 });
    const supplemental = makeFullStats({ handle: "bob", prsMergedCount: 10 });

    // Stage 1: Merge
    const merged = mergeStats(primary, supplemental);
    for (const key of MERGE_EXPECTED_KEYS) {
      expect(
        merged[key as keyof typeof merged],
        `merge lost: ${key}`,
      ).not.toBeUndefined();
    }

    // Stage 2: Score
    const impact = computeImpactV4(merged);
    expect(impact.dimensions.delivery).toBeGreaterThanOrEqual(0);
    expect(impact.dimensions.delivery).toBeLessThanOrEqual(100);
    expect(impact.dimensions.quality).toBeGreaterThanOrEqual(0);
    expect(impact.dimensions.quality).toBeLessThanOrEqual(100);
    expect(impact.dimensions.consistency).toBeGreaterThanOrEqual(0);
    expect(impact.dimensions.consistency).toBeLessThanOrEqual(100);
    expect(impact.dimensions.breadth).toBeGreaterThanOrEqual(0);
    expect(impact.dimensions.breadth).toBeLessThanOrEqual(100);

    // Stage 3: Snapshot
    const snapshot = buildSnapshot(merged, impact);
    expect(snapshot.delivery).toBe(impact.dimensions.delivery);
    expect(snapshot.quality).toBe(impact.dimensions.quality);
    expect(snapshot.consistency).toBe(impact.dimensions.consistency);
    expect(snapshot.breadth).toBe(impact.dimensions.breadth);
  });

  it("v2.5.0 regression: solo quality survives multi-platform merge", () => {
    const primary = makeFullStats({
      reviewsSubmittedCount: 0,
      prsMergedCount: 20,
      prDescriptionRate: 0.8,
      featureBranchRate: 0.9,
      issueLinkageRate: 0.6,
      batchSizeScore: 0.7,
    });
    const supplemental = makeFullStats({
      reviewsSubmittedCount: 0,
      prsMergedCount: 5,
    });

    const merged = mergeStats(primary, supplemental);
    const impact = computeImpactV4(merged);

    // Solo quality MUST be > 0 when solo quality fields are populated
    expect(impact.profileType).toBe("solo");
    expect(impact.dimensions.quality).toBeGreaterThan(0);

    // Verify the specific fields survived merge
    expect(merged.prDescriptionRate).toBeDefined();
    expect(merged.featureBranchRate).toBeDefined();
    expect(merged.issueLinkageRate).toBeDefined();
    expect(merged.batchSizeScore).toBeDefined();
  });
});
