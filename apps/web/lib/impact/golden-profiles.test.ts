import { describe, it, expect } from "vitest";
import { computeImpactV4 } from "./v4";
import { mergeStats } from "@/lib/github/merge";
import { makeFullStats, makeStats } from "@/lib/test-helpers/fixtures";

/**
 * Golden-file scoring tests — reference profiles with known-correct scores.
 *
 * These inline snapshots capture the exact output of the scoring pipeline
 * for canonical developer profiles. Any scoring change that shifts results
 * will cause a snapshot mismatch — the reviewer sees the diff in the PR.
 *
 * To update snapshots after an intentional scoring change:
 *   pnpm vitest run --update apps/web/lib/impact/golden-profiles.test.ts
 */
describe("golden profiles", () => {
  it("solo high-delivery developer", () => {
    const stats = makeFullStats({
      commitsTotal: 200,
      prsMergedCount: 40,
      prsMergedWeight: 60,
      reviewsSubmittedCount: 0,
      issuesClosedCount: 15,
      activeDays: 150,
      linesAdded: 8000,
      linesDeleted: 3000,
      reposContributed: 6,
      topRepoShare: 0.35,
      prDescriptionRate: 0.9,
      featureBranchRate: 0.85,
      issueLinkageRate: 0.7,
      batchSizeScore: 0.7,
      heatmapData: generateHeatmap(150),
    });

    const result = computeImpactV4(stats);
    expect({
      delivery: result.dimensions.delivery,
      quality: result.dimensions.quality,
      consistency: result.dimensions.consistency,
      breadth: result.dimensions.breadth,
      archetype: result.archetype,
      profileType: result.profileType,
      compositeScore: result.compositeScore,
      tier: result.tier,
    }).toMatchInlineSnapshot(`
      {
        "archetype": "Builder",
        "breadth": 38,
        "compositeScore": 72,
        "consistency": 79,
        "delivery": 98,
        "profileType": "solo",
        "quality": 82,
        "tier": "High",
      }
    `);
  });

  it("collaborative balanced developer", () => {
    const stats = makeFullStats({
      commitsTotal: 100,
      prsMergedCount: 20,
      prsMergedWeight: 30,
      reviewsSubmittedCount: 15,
      issuesClosedCount: 8,
      activeDays: 100,
      linesAdded: 4000,
      linesDeleted: 1500,
      reposContributed: 5,
      topRepoShare: 0.3,
      prDescriptionRate: 0.7,
      featureBranchRate: 0.8,
      issueLinkageRate: 0.5,
      batchSizeScore: 0.6,
      heatmapData: generateHeatmap(100),
    });

    const result = computeImpactV4(stats);
    expect({
      delivery: result.dimensions.delivery,
      quality: result.dimensions.quality,
      consistency: result.dimensions.consistency,
      breadth: result.dimensions.breadth,
      archetype: result.archetype,
      profileType: result.profileType,
      compositeScore: result.compositeScore,
      tier: result.tier,
    }).toMatchInlineSnapshot(`
      {
        "archetype": "Builder",
        "breadth": 36,
        "compositeScore": 61,
        "consistency": 73,
        "delivery": 82,
        "profileType": "collaborative",
        "quality": 51,
        "tier": "Solid",
      }
    `);
  });

  it("emerging low-activity developer", () => {
    const stats = makeStats({
      commitsTotal: 20,
      prsMergedCount: 3,
      prsMergedWeight: 5,
      reviewsSubmittedCount: 0,
      issuesClosedCount: 1,
      activeDays: 15,
      linesAdded: 800,
      linesDeleted: 200,
      reposContributed: 2,
      topRepoShare: 0.7,
      maxCommitsIn10Min: 2,
      heatmapData: generateHeatmap(15),
    });

    const result = computeImpactV4(stats);
    expect({
      delivery: result.dimensions.delivery,
      quality: result.dimensions.quality,
      consistency: result.dimensions.consistency,
      breadth: result.dimensions.breadth,
      archetype: result.archetype,
      profileType: result.profileType,
      compositeScore: result.compositeScore,
      tier: result.tier,
    }).toMatchInlineSnapshot(`
      {
        "archetype": "Emerging",
        "breadth": 14,
        "compositeScore": 35,
        "consistency": 51,
        "delivery": 40,
        "profileType": "solo",
        "quality": 5,
        "tier": "Solid",
      }
    `);
  });

  it("multi-platform supplemental developer", () => {
    const primary = makeFullStats({
      handle: "alice",
      commitsTotal: 120,
      prsMergedCount: 25,
      prsMergedWeight: 40,
      reviewsSubmittedCount: 12,
      issuesClosedCount: 10,
      activeDays: 90,
      linesAdded: 5000,
      linesDeleted: 2000,
      reposContributed: 5,
      topRepoShare: 0.4,
      prDescriptionRate: 0.75,
      featureBranchRate: 0.8,
      issueLinkageRate: 0.55,
      batchSizeScore: 0.6,
      heatmapData: generateHeatmap(90),
    });
    const supplemental = makeFullStats({
      handle: "alice-corp",
      commitsTotal: 80,
      prsMergedCount: 15,
      prsMergedWeight: 25,
      reviewsSubmittedCount: 8,
      issuesClosedCount: 5,
      activeDays: 60,
      linesAdded: 3000,
      linesDeleted: 1000,
      reposContributed: 3,
      topRepoShare: 0.5,
      prDescriptionRate: 0.6,
      featureBranchRate: 0.7,
      issueLinkageRate: 0.3,
      batchSizeScore: 0.5,
      heatmapData: generateHeatmap(60, 90), // offset to avoid full overlap
    });

    const merged = mergeStats(primary, supplemental);
    const result = computeImpactV4(merged);
    expect({
      delivery: result.dimensions.delivery,
      quality: result.dimensions.quality,
      consistency: result.dimensions.consistency,
      breadth: result.dimensions.breadth,
      archetype: result.archetype,
      profileType: result.profileType,
      compositeScore: result.compositeScore,
      tier: result.tier,
    }).toMatchInlineSnapshot(`
      {
        "archetype": "Builder",
        "breadth": 47,
        "compositeScore": 69,
        "consistency": 78,
        "delivery": 98,
        "profileType": "collaborative",
        "quality": 53,
        "tier": "Solid",
      }
    `);
  });
});

// ---------------------------------------------------------------------------
// Helper: generate a realistic heatmap with `activeDays` active days
// ---------------------------------------------------------------------------

function generateHeatmap(
  activeDays: number,
  startOffset = 0,
): { date: string; count: number }[] {
  const days: { date: string; count: number }[] = [];
  const baseDate = new Date("2025-01-01");
  for (let i = 0; i < activeDays; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i + startOffset);
    days.push({
      date: d.toISOString().slice(0, 10),
      count: 1 + (i % 5), // varying counts: 1-5
    });
  }
  return days;
}
