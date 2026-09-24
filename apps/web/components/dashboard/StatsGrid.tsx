"use client";

import type { StatsData } from "@chapa/shared";
import { formatCompact } from "@chapa/shared";
import { InfoTooltip } from "@/components/InfoTooltip";
import { useTranslation } from "@/lib/i18n";

interface StatItem {
  key: "stars" | "forks" | "watchers" | "activeDays" | "commits" | "prsMerged" | "reviews" | "repos";
  tooltipId: string;
  value: number;
}

interface StatsGridProps {
  stats: StatsData;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const { t } = useTranslation();
  const items: StatItem[] = [
    {
      key: "stars",
      tooltipId: "stat-stars",
      value: stats.totalStars,
    },
    {
      key: "forks",
      tooltipId: "stat-forks",
      value: stats.totalForks,
    },
    {
      key: "watchers",
      tooltipId: "stat-watchers",
      value: stats.totalWatchers,
    },
    {
      key: "activeDays",
      tooltipId: "stat-active-days",
      value: stats.activeDays,
    },
    {
      key: "commits",
      tooltipId: "stat-commits",
      value: stats.commitsTotal,
    },
    {
      key: "prsMerged",
      tooltipId: "stat-prs-merged",
      value: stats.prsMergedCount,
    },
    {
      key: "reviews",
      tooltipId: "stat-reviews",
      value: stats.reviewsSubmittedCount,
    },
    {
      key: "repos",
      tooltipId: "stat-repos",
      value: stats.reposContributed,
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

          return (
            <div
              key={item.key}
              className="rounded-[3px] border border-stroke bg-card px-3 py-4 text-center animate-fade-in-up"
              // Enters alongside the dimension cards (400–700ms), not after
              // the whole dashboard: the grid sits far below the fold, so a
              // 2.2s+ stagger showed nobody a choreography, but it did leave
              // the captions at ~0.5 opacity when Lighthouse measured contrast
              // (3.19:1 for a token that resolves to 7.78:1 — LE-8-3).
              style={{ animationDelay: `${400 + i * 60}ms` }}
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
