import type { DimensionScores, ProfileType, StatsData } from "@chapa/shared";
import { BATCH_SIZE_DEFAULT, SCORING_CAPS, SCORING_WINDOW_DAYS } from "@chapa/shared";
import { computeHeatmapEvenness, computeWeekCoverage } from "@/lib/impact/heatmap-evenness";
import { normalize } from "@/lib/impact/utils";

export type DimensionKey = keyof DimensionScores;

export type DimensionSubMetricKey =
  | "prWeight"
  | "issues"
  | "commits"
  | "reviews"
  | "reviewRatio"
  | "batchSize"
  | "prDescription"
  | "featureBranch"
  | "issueLinkage"
  | "activeDays"
  | "evenness"
  | "weekCoverage"
  | "repos"
  | "spread"
  | "docs"
  | "stars"
  | "forks"
  | "aiToolProficiency"
  | "effectiveness"
  | "sophistication";

export interface DimensionSubMetric {
  key: DimensionSubMetricKey;
  weight: string;
  normalizedValue: number;
  rawLabel: string;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function computeReviewRatio(stats: StatsData): number {
  if (stats.prsMergedCount > 0) {
    return Math.min(stats.reviewsSubmittedCount / stats.prsMergedCount, 5) / 5;
  }
  return stats.reviewsSubmittedCount > 0 ? 1 : 0;
}

export function getDimensionSubMetrics(
  dimension: DimensionKey,
  stats: StatsData,
  profileType: ProfileType = "collaborative",
): DimensionSubMetric[] {
  switch (dimension) {
    case "delivery":
      return [
        {
          key: "prWeight",
          weight: "70%",
          normalizedValue: normalize(stats.prsMergedWeight, SCORING_CAPS.prWeight),
          rawLabel: `${stats.prsMergedCount} PRs merged`,
        },
        {
          key: "issues",
          weight: "20%",
          normalizedValue: normalize(stats.issuesClosedCount, SCORING_CAPS.issues),
          rawLabel: `${stats.issuesClosedCount} issues closed`,
        },
        {
          key: "commits",
          weight: "10%",
          normalizedValue: normalize(stats.commitsTotal, SCORING_CAPS.commits),
          rawLabel: `${stats.commitsTotal} commits`,
        },
      ];

    case "quality": {
      const batchSize = stats.batchSizeScore ?? BATCH_SIZE_DEFAULT;
      if (profileType === "solo") {
        const descRate = stats.prDescriptionRate ?? 0;
        const branchRate = stats.featureBranchRate ?? 0;
        const linkageRate = stats.issueLinkageRate ?? 0;

        return [
          {
            key: "prDescription",
            weight: "40%",
            normalizedValue: descRate,
            rawLabel: `${percent(descRate)} of PRs have descriptions`,
          },
          {
            key: "featureBranch",
            weight: "25%",
            normalizedValue: branchRate,
            rawLabel: `${percent(branchRate)} from feature branches`,
          },
          {
            key: "issueLinkage",
            weight: "20%",
            normalizedValue: linkageRate,
            rawLabel: `${percent(linkageRate)} linked to issues`,
          },
          {
            key: "batchSize",
            weight: "15%",
            normalizedValue: batchSize,
            rawLabel: `${percent(batchSize)} of PRs in reviewable batch size`,
          },
        ];
      }

      const reviewRatio = computeReviewRatio(stats);
      return [
        {
          key: "reviews",
          weight: "60%",
          normalizedValue: normalize(stats.reviewsSubmittedCount, SCORING_CAPS.reviews),
          rawLabel: `${stats.reviewsSubmittedCount} reviews`,
        },
        {
          key: "reviewRatio",
          weight: "25%",
          normalizedValue: reviewRatio,
          rawLabel: `${(reviewRatio * 5).toFixed(1)}:1 reviews per PR`,
        },
        {
          key: "batchSize",
          weight: "15%",
          normalizedValue: batchSize,
          rawLabel: `${percent(batchSize)} of PRs in reviewable batch size`,
        },
      ];
    }

    case "consistency": {
      const activeDayCurve = Math.sqrt(
        Math.min(stats.activeDays, SCORING_WINDOW_DAYS) / SCORING_WINDOW_DAYS,
      );
      const evenness = computeHeatmapEvenness(stats.heatmapData);
      const weekCoverage = computeWeekCoverage(stats.heatmapData);

      return [
        {
          key: "activeDays",
          weight: "45%",
          normalizedValue: activeDayCurve,
          rawLabel: `${stats.activeDays} of ${SCORING_WINDOW_DAYS} days`,
        },
        {
          key: "evenness",
          weight: "40%",
          normalizedValue: evenness,
          rawLabel: "Distribution across weeks",
        },
        {
          key: "weekCoverage",
          weight: "15%",
          normalizedValue: weekCoverage,
          rawLabel: `${percent(weekCoverage)} active weeks`,
        },
      ];
    }

    case "breadth": {
      const docsRatio = stats.docsOnlyPrRatio ?? 0;
      const topRepoShare = stats.topRepoShare;

      return [
        {
          key: "repos",
          weight: "40%",
          normalizedValue: Math.min(stats.reposContributed / SCORING_CAPS.repos, 1),
          rawLabel: `${stats.reposContributed} repos`,
        },
        {
          key: "spread",
          weight: "25%",
          normalizedValue: 1 - topRepoShare,
          rawLabel: `Top repo: ${percent(topRepoShare)} of activity`,
        },
        {
          key: "stars",
          weight: "10%",
          normalizedValue: normalize(stats.totalStars, SCORING_CAPS.stars),
          rawLabel: `${stats.totalStars} stars earned`,
        },
        {
          key: "forks",
          weight: "5%",
          normalizedValue: normalize(stats.totalForks, SCORING_CAPS.forks),
          rawLabel: `${stats.totalForks} forks`,
        },
        {
          key: "docs",
          weight: "15%",
          normalizedValue: docsRatio,
          rawLabel: `${percent(docsRatio)} docs-only PRs`,
        },
      ];
    }

    case "craft":
      return [
        {
          key: "aiToolProficiency",
          weight: "34%",
          normalizedValue: 0,
          rawLabel: "Upload insights report to compute",
        },
        {
          key: "effectiveness",
          weight: "33%",
          normalizedValue: 0,
          rawLabel: "Upload insights report to compute",
        },
        {
          key: "sophistication",
          weight: "33%",
          normalizedValue: 0,
          rawLabel: "Upload insights report to compute",
        },
      ];
  }
}
