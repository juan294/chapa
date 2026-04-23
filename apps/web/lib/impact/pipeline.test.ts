import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mergeStats } from "@/lib/github/merge";
import { computeImpactV6 } from "./v6";
import { buildSnapshot } from "@/lib/history/snapshot";
import { makeFullStats } from "@/lib/test-helpers/fixtures";
import { buildPayload, computeHash, generateVerificationCode } from "@/lib/verification/hmac";
import { MERGE_EXPECTED_KEYS } from "@chapa/shared";

/**
 * End-to-end pipeline integrity tests.
 *
 * Traces the full scoring pipeline without mocks:
 *   aggregation → merge → scoring → snapshot
 *
 * Asserts field survival and score ranges at each stage.
 */
describe("scoring pipeline integrity", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T12:00:00Z"));
    process.env = {
      ...originalEnv,
      CHAPA_VERIFICATION_SECRET: "pipeline-secret-0123456789abcdef012345",
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
  });

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
    const impact = computeImpactV6(merged);
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
    const impact = computeImpactV6(merged);

    // Solo quality MUST be > 0 when solo quality fields are populated
    expect(impact.profileType).toBe("solo");
    expect(impact.dimensions.quality).toBeGreaterThan(0);

    // Verify the specific fields survived merge
    expect(merged.prDescriptionRate).toBeDefined();
    expect(merged.featureBranchRate).toBeDefined();
    expect(merged.issueLinkageRate).toBeDefined();
    expect(merged.batchSizeScore).toBeDefined();
  });

  it("produces a deterministic verification payload and hash from the scored snapshot inputs", () => {
    const primary = makeFullStats({
      handle: "Juan294",
      commitsTotal: 321,
      activeDays: 210,
      prsMergedCount: 44,
      prsMergedWeight: 80,
      reviewsSubmittedCount: 12,
      reposContributed: 9,
      topRepoShare: 0.36,
      totalStars: 144,
      totalForks: 18,
      totalWatchers: 12,
      displayName: "Juan Unicode Δ",
    });
    const supplemental = makeFullStats({
      handle: "juan294",
      commitsTotal: 0,
      activeDays: 0,
      prsMergedCount: 0,
      prsMergedWeight: 0,
      reviewsSubmittedCount: 0,
      reposContributed: 0,
      totalStars: 0,
      totalForks: 0,
      totalWatchers: 0,
      hasSupplementalData: true,
    });

    const merged = mergeStats(primary, supplemental);
    const impact = computeImpactV6(merged, 41);
    const snapshot = buildSnapshot(merged, impact, "2026-04-20");
    const payload = buildPayload(merged, impact, "2026-04-20");
    const hash = computeHash(
      payload,
      "pipeline-secret-0123456789abcdef012345",
    );
    const verification = generateVerificationCode(merged, impact);

    expect(snapshot.adjustedComposite).toBe(impact.adjustedComposite);
    expect(snapshot.delivery).toBe(impact.dimensions.delivery);
    expect(snapshot.quality).toBe(impact.dimensions.quality);
    expect(snapshot.consistency).toBe(impact.dimensions.consistency);
    expect(snapshot.breadth).toBe(impact.dimensions.breadth);
    expect(merged.activeDays).toBe(0);
    expect(payload).toBe(
      `v2|juan294|${impact.adjustedComposite}|${impact.confidence}|${impact.tier}|${impact.archetype}|${Math.round(impact.dimensions.delivery)}|${Math.round(impact.dimensions.quality)}|${Math.round(impact.dimensions.consistency)}|${Math.round(impact.dimensions.breadth)}|${Math.round(impact.dimensions.craft ?? 0)}|${merged.commitsTotal}|${merged.prsMergedCount}|${merged.reviewsSubmittedCount}|${merged.activeDays}|${merged.reposContributed}|2026-04-20`,
    );
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(verification).toEqual({
      hash,
      date: "2026-04-20",
    });
  });
});
