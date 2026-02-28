"use client";

import type { StatsData } from "@chapa/shared";
import { formatCompact } from "@chapa/shared";
import type { SnapshotDiff } from "@/lib/history/diff";
import { InfoTooltip } from "@/components/InfoTooltip";
import { DeltaIndicator } from "./DeltaIndicator";

const STAT_TOOLTIPS: Record<string, { id: string; tip: string }> = {
  Stars: {
    id: "stat-stars",
    tip: "Stars received on your repos \u2014 not repos you\u2019ve starred yourself.",
  },
  Forks: {
    id: "stat-forks",
    tip: "Times other developers forked your repositories.",
  },
  Watchers: {
    id: "stat-watchers",
    tip: "People watching your repos for activity notifications.",
  },
  "Active Days": {
    id: "stat-active-days",
    tip: "Unique days with at least one contribution in the last 365 days.",
  },
  Commits: {
    id: "stat-commits",
    tip: "Commits pushed across all repos in the last 365 days.",
  },
  "PRs Merged": {
    id: "stat-prs-merged",
    tip: "Pull requests you authored that were merged in the last 365 days.",
  },
  Reviews: {
    id: "stat-reviews",
    tip: "Code reviews submitted on others\u2019 PRs in the last 365 days.",
  },
  Repos: {
    id: "stat-repos",
    tip: "Distinct repositories you contributed to in the last 365 days.",
  },
};

interface StatItem {
  value: number;
  label: string;
  delta: number | undefined;
}

interface StatsGridProps {
  stats: StatsData;
  diff: SnapshotDiff | null;
}

export function StatsGrid({ stats, diff }: StatsGridProps) {
  const items: StatItem[] = [
    {
      value: stats.totalStars,
      label: "Stars",
      delta: diff?.stats.totalStars,
    },
    {
      value: stats.totalForks,
      label: "Forks",
      delta: diff?.stats.totalForks,
    },
    {
      value: stats.totalWatchers,
      label: "Watchers",
      delta: diff?.stats.totalWatchers,
    },
    {
      value: stats.activeDays,
      label: "Active Days",
      delta: diff?.stats.activeDays,
    },
    {
      value: stats.commitsTotal,
      label: "Commits",
      delta: diff?.stats.commitsTotal,
    },
    {
      value: stats.prsMergedCount,
      label: "PRs Merged",
      delta: diff?.stats.prsMergedCount,
    },
    {
      value: stats.reviewsSubmittedCount,
      label: "Reviews",
      delta: diff?.stats.reviewsSubmittedCount,
    },
    {
      value: stats.reposContributed,
      label: "Repos",
      delta: diff?.stats.reposContributed,
    },
  ];

  return (
    <section aria-label="Key statistics">
      <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-4">
        Key Numbers
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item, i) => {
          const tooltip = STAT_TOOLTIPS[item.label];
          const showDelta =
            item.delta !== undefined && item.delta !== 0;

          return (
            <div
              key={item.label}
              className="rounded-xl border border-stroke bg-card px-3 py-4 text-center animate-fade-in-up"
              style={{ animationDelay: `${2200 + i * 60}ms` }}
            >
              <div className="font-heading text-2xl font-bold text-text-primary">
                {formatCompact(item.value)}
              </div>

              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-xs text-text-secondary uppercase tracking-wider">
                  {item.label}
                </span>
                {tooltip && (
                  <InfoTooltip
                    content={tooltip.tip}
                    id={tooltip.id}
                  />
                )}
              </div>

              {showDelta && (
                <div className="mt-1">
                  <DeltaIndicator
                    delta={item.delta!}
                    size="sm"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
