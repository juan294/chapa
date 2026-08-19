"use client";

import type { StatsData } from "@chapa/shared";
import { formatCompact } from "@chapa/shared";
import type { ClientSnapshotDiff } from "@/lib/history/diff";
import { InfoTooltip } from "@/components/InfoTooltip";
import { DeltaIndicator } from "./DeltaIndicator";
import { useTranslation } from "@/lib/i18n";

interface StatItem {
  key: "stars" | "forks" | "watchers" | "activeDays" | "commits" | "prsMerged" | "reviews" | "repos";
  tooltipId: string;
  value: number;
  delta: number | undefined;
}

interface StatsGridProps {
  stats: StatsData;
  diff: ClientSnapshotDiff | null;
}

export function StatsGrid({ stats, diff }: StatsGridProps) {
  const { t } = useTranslation();
  const items: StatItem[] = [
    {
      key: "stars",
      tooltipId: "stat-stars",
      value: stats.totalStars,
      delta: diff?.stats.totalStars,
    },
    {
      key: "forks",
      tooltipId: "stat-forks",
      value: stats.totalForks,
      delta: diff?.stats.totalForks,
    },
    {
      key: "watchers",
      tooltipId: "stat-watchers",
      value: stats.totalWatchers,
      delta: diff?.stats.totalWatchers,
    },
    {
      key: "activeDays",
      tooltipId: "stat-active-days",
      value: stats.activeDays,
      delta: diff?.stats.activeDays,
    },
    {
      key: "commits",
      tooltipId: "stat-commits",
      value: stats.commitsTotal,
      delta: diff?.stats.commitsTotal,
    },
    {
      key: "prsMerged",
      tooltipId: "stat-prs-merged",
      value: stats.prsMergedCount,
      delta: diff?.stats.prsMergedCount,
    },
    {
      key: "reviews",
      tooltipId: "stat-reviews",
      value: stats.reviewsSubmittedCount,
      delta: diff?.stats.reviewsSubmittedCount,
    },
    {
      key: "repos",
      tooltipId: "stat-repos",
      value: stats.reposContributed,
      delta: diff?.stats.reposContributed,
    },
  ];

  return (
    <section aria-label={t('aria.keyStatistics') as string}>
      <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-4">
        {t('dashboard.keyNumbers') as string}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item, i) => {
          const label = t(`dashboard.stats.${item.key}.label`) as string;
          const showDelta =
            item.delta !== undefined && item.delta !== 0;

          return (
            <div
              key={item.key}
              className="rounded-xl border border-stroke bg-card px-3 py-4 text-center animate-fade-in-up"
              style={{ animationDelay: `${2200 + i * 60}ms` }}
            >
              <div className="font-heading text-2xl font-bold text-text-primary">
                {formatCompact(item.value)}
              </div>

              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-xs text-text-secondary uppercase tracking-wider">
                  {label}
                </span>
                <InfoTooltip
                  content={t(`dashboard.stats.${item.key}.tip`) as string}
                  id={item.tooltipId}
                />
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
