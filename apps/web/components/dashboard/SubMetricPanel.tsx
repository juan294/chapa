"use client";

import { useEffect } from "react";
import type { DimensionScores, StatsData, ProfileType } from "@chapa/shared";

interface SubMetric {
  label: string;
  weight: string;
  normalizedValue: number;
  rawLabel: string;
}

export interface SubMetricPanelProps {
  dimension: keyof DimensionScores;
  stats: StatsData;
  isOpen: boolean;
  onClose: () => void;
  profileType?: ProfileType;
}

const DIMENSION_COLORS: Record<keyof DimensionScores, string> = {
  delivery: "var(--color-dimension-delivery)",
  quality: "var(--color-dimension-quality)",
  consistency: "var(--color-dimension-consistency)",
  breadth: "var(--color-dimension-breadth)",
  craft: "var(--color-dimension-craft)",
};

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  delivery: "Delivery",
  quality: "Quality",
  consistency: "Consistency",
  breadth: "Breadth",
  craft: "Craft",
};

function getSubMetrics(
  dimension: keyof DimensionScores,
  stats: StatsData,
  profileType: ProfileType = "collaborative",
): SubMetric[] {
  switch (dimension) {
    case "delivery":
      return [
        {
          label: "PR Weight",
          weight: "70%",
          normalizedValue: Math.min(stats.prsMergedWeight / 60, 1),
          rawLabel: `${stats.prsMergedCount} PRs merged`,
        },
        {
          label: "Issues Closed",
          weight: "20%",
          normalizedValue: Math.min(stats.issuesClosedCount / 40, 1),
          rawLabel: `${stats.issuesClosedCount} issues closed`,
        },
        {
          label: "Commits",
          weight: "10%",
          normalizedValue: Math.min(stats.commitsTotal / 300, 1),
          rawLabel: `${stats.commitsTotal} commits`,
        },
      ];

    case "quality": {
      if (profileType === "solo") {
        const descRate = stats.prDescriptionRate ?? 0;
        const branchRate = stats.featureBranchRate ?? 0;
        const linkageRate = stats.issueLinkageRate ?? 0;
        const microRatio = stats.microCommitRatio ?? 0.3;

        return [
          {
            label: "PR Descriptions",
            weight: "40%",
            normalizedValue: descRate,
            rawLabel: `${(descRate * 100).toFixed(0)}% of PRs have descriptions`,
          },
          {
            label: "Feature Branches",
            weight: "25%",
            normalizedValue: branchRate,
            rawLabel: `${(branchRate * 100).toFixed(0)}% from feature branches`,
          },
          {
            label: "Issue Linkage",
            weight: "20%",
            normalizedValue: linkageRate,
            rawLabel: `${(linkageRate * 100).toFixed(0)}% linked to issues`,
          },
          {
            label: "Commit Cleanliness",
            weight: "15%",
            normalizedValue: 1 - microRatio,
            rawLabel: `${((1 - microRatio) * 100).toFixed(0)}% clean commits`,
          },
        ];
      }

      const reviewRatio =
        stats.prsMergedCount > 0
          ? Math.min(stats.reviewsSubmittedCount / stats.prsMergedCount, 5) / 5
          : stats.reviewsSubmittedCount > 0
            ? 1
            : 0;
      const microRatio = stats.microCommitRatio ?? 0.3;

      return [
        {
          label: "Reviews",
          weight: "60%",
          normalizedValue: Math.min(stats.reviewsSubmittedCount / 80, 1),
          rawLabel: `${stats.reviewsSubmittedCount} reviews`,
        },
        {
          label: "Review Ratio",
          weight: "25%",
          normalizedValue: reviewRatio,
          rawLabel: `${(reviewRatio * 5).toFixed(1)}:1 reviews per PR`,
        },
        {
          label: "Code Cleanliness",
          weight: "15%",
          normalizedValue: 1 - microRatio,
          rawLabel: `${((1 - microRatio) * 100).toFixed(0)}% clean commits`,
        },
      ];
    }

    case "consistency": {
      const evenness = 0.5; // Placeholder — can't easily compute without full heatmap data
      const burst = Math.min(stats.maxCommitsIn10Min / 30, 1);

      return [
        {
          label: "Active Days",
          weight: "45%",
          normalizedValue: Math.sqrt(Math.min(stats.activeDays / 365, 1)),
          rawLabel: `${stats.activeDays} of 365 days`,
        },
        {
          label: "Weekly Evenness",
          weight: "40%",
          normalizedValue: evenness,
          rawLabel: "Distribution across weeks",
        },
        {
          label: "Low Burst Activity",
          weight: "15%",
          normalizedValue: 1 - burst,
          rawLabel: `Peak: ${stats.maxCommitsIn10Min} commits in 10min`,
        },
      ];
    }

    case "breadth": {
      const docsRatio = stats.docsOnlyPrRatio ?? 0;
      const topRepoShare = stats.topRepoShare;

      return [
        {
          label: "Repos Contributed",
          weight: "40%",
          normalizedValue: Math.min(stats.reposContributed / 12, 1),
          rawLabel: `${stats.reposContributed} repos`,
        },
        {
          label: "Spread",
          weight: "25%",
          normalizedValue: 1 - topRepoShare,
          rawLabel: `Top repo: ${(topRepoShare * 100).toFixed(0)}% of activity`,
        },
        {
          label: "Stars",
          weight: "10%",
          normalizedValue: Math.min(stats.totalStars / 150, 1),
          rawLabel: `${stats.totalStars} stars earned`,
        },
        {
          label: "Forks",
          weight: "5%",
          normalizedValue: Math.min(stats.totalForks / 80, 1),
          rawLabel: `${stats.totalForks} forks`,
        },
        {
          label: "Docs PRs",
          weight: "15%",
          normalizedValue: docsRatio,
          rawLabel: `${(docsRatio * 100).toFixed(0)}% docs-only PRs`,
        },
      ];
    }

    case "craft":
      return [
        {
          label: "AI Tool Proficiency",
          weight: "34%",
          normalizedValue: 0,
          rawLabel: "Upload insights report to compute",
        },
        {
          label: "Effectiveness",
          weight: "33%",
          normalizedValue: 0,
          rawLabel: "Upload insights report to compute",
        },
        {
          label: "Sophistication",
          weight: "33%",
          normalizedValue: 0,
          rawLabel: "Upload insights report to compute",
        },
      ];
  }
}

export function SubMetricPanel({
  dimension,
  stats,
  isOpen,
  onClose,
  profileType = "collaborative",
}: SubMetricPanelProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const subMetrics = getSubMetrics(dimension, stats, profileType);
  const color = DIMENSION_COLORS[dimension];
  const label = DIMENSION_LABELS[dimension];

  return (
    <div
      role="region"
      aria-label={`${label} dimension breakdown`}
      className="animate-scale-in relative rounded-xl border border-stroke bg-card p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3
          className="font-heading text-sm uppercase tracking-wider text-text-secondary"
          style={{ color }}
        >
          {label} Breakdown
        </h3>
        <button
          type="button"
          aria-label="Close breakdown panel"
          onClick={onClose}
          className="rounded-full p-1 text-text-secondary transition-colors hover:text-text-primary"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {subMetrics.map((metric) => {
          const percent = Math.round(metric.normalizedValue * 100);
          return (
            <div key={metric.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {metric.label}
                </span>
                <span className="text-xs font-medium text-text-secondary">
                  {metric.weight}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full rounded-full bg-stroke"
              >
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                {metric.rawLabel}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
