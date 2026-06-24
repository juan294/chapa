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
  /** i18n key under `scoreExplanation.rawLabels.*` for the raw-value caption. */
  rawLabelKey: string;
  /** Interpolation params for the raw-value caption (all stringified). */
  rawLabelParams: Record<string, string>;
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
          rawLabelKey: "prsMerged",
          rawLabelParams: { count: String(stats.prsMergedCount) },
        },
        {
          key: "issues",
          weight: "20%",
          normalizedValue: normalize(stats.issuesClosedCount, SCORING_CAPS.issues),
          rawLabelKey: "issuesClosed",
          rawLabelParams: { count: String(stats.issuesClosedCount) },
        },
        {
          key: "commits",
          weight: "10%",
          normalizedValue: normalize(stats.commitsTotal, SCORING_CAPS.commits),
          rawLabelKey: "commits",
          rawLabelParams: { count: String(stats.commitsTotal) },
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
            rawLabelKey: "prsWithDescriptions",
            rawLabelParams: { percent: percent(descRate) },
          },
          {
            key: "featureBranch",
            weight: "25%",
            normalizedValue: branchRate,
            rawLabelKey: "fromFeatureBranches",
            rawLabelParams: { percent: percent(branchRate) },
          },
          {
            key: "issueLinkage",
            weight: "20%",
            normalizedValue: linkageRate,
            rawLabelKey: "linkedToIssues",
            rawLabelParams: { percent: percent(linkageRate) },
          },
          {
            key: "batchSize",
            weight: "15%",
            normalizedValue: batchSize,
            rawLabelKey: "reviewableBatchSize",
            rawLabelParams: { percent: percent(batchSize) },
          },
        ];
      }

      const reviewRatio = computeReviewRatio(stats);
      return [
        {
          key: "reviews",
          weight: "60%",
          normalizedValue: normalize(stats.reviewsSubmittedCount, SCORING_CAPS.reviews),
          rawLabelKey: "reviews",
          rawLabelParams: { count: String(stats.reviewsSubmittedCount) },
        },
        {
          key: "reviewRatio",
          weight: "25%",
          normalizedValue: reviewRatio,
          rawLabelKey: "reviewsPerPr",
          rawLabelParams: { ratio: (reviewRatio * 5).toFixed(1) },
        },
        {
          key: "batchSize",
          weight: "15%",
          normalizedValue: batchSize,
          rawLabelKey: "reviewableBatchSize",
          rawLabelParams: { percent: percent(batchSize) },
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
          rawLabelKey: "activeOfDays",
          rawLabelParams: { active: String(stats.activeDays), total: String(SCORING_WINDOW_DAYS) },
        },
        {
          key: "evenness",
          weight: "40%",
          normalizedValue: evenness,
          rawLabelKey: "distributionAcrossWeeks",
          rawLabelParams: {},
        },
        {
          key: "weekCoverage",
          weight: "15%",
          normalizedValue: weekCoverage,
          rawLabelKey: "activeWeeks",
          rawLabelParams: { percent: percent(weekCoverage) },
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
          rawLabelKey: "repos",
          rawLabelParams: { count: String(stats.reposContributed) },
        },
        {
          key: "spread",
          weight: "25%",
          normalizedValue: 1 - topRepoShare,
          rawLabelKey: "topRepoShare",
          rawLabelParams: { percent: percent(topRepoShare) },
        },
        {
          key: "stars",
          weight: "10%",
          normalizedValue: normalize(stats.totalStars, SCORING_CAPS.stars),
          rawLabelKey: "starsEarned",
          rawLabelParams: { count: String(stats.totalStars) },
        },
        {
          key: "forks",
          weight: "5%",
          normalizedValue: normalize(stats.totalForks, SCORING_CAPS.forks),
          rawLabelKey: "forks",
          rawLabelParams: { count: String(stats.totalForks) },
        },
        {
          key: "docs",
          weight: "15%",
          normalizedValue: docsRatio,
          rawLabelKey: "docsOnlyPrs",
          rawLabelParams: { percent: percent(docsRatio) },
        },
      ];
    }

    case "craft":
      return [
        {
          key: "aiToolProficiency",
          weight: "34%",
          normalizedValue: 0,
          rawLabelKey: "uploadInsights",
          rawLabelParams: {},
        },
        {
          key: "effectiveness",
          weight: "33%",
          normalizedValue: 0,
          rawLabelKey: "uploadInsights",
          rawLabelParams: {},
        },
        {
          key: "sophistication",
          weight: "33%",
          normalizedValue: 0,
          rawLabelKey: "uploadInsights",
          rawLabelParams: {},
        },
      ];
  }
}
