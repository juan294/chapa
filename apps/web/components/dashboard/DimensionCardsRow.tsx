"use client";

import type {
  ClientImpactV6Result,
  CraftResult,
  StatsData,
  DimensionScores,
} from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";
import { DimensionCard } from "./DimensionCard";
import { useTranslation } from "@/lib/i18n";

/** Core dimensions — always shown. */
const CORE_DIMENSIONS = ["delivery", "quality", "consistency", "breadth"] as const;

export interface DimensionCardsRowProps {
  // #1067 — redacted PublicImpactV6Result for a non-owner visitor, full
  // ImpactV6Result for the owner. This component never reads confidence.
  impact: ClientImpactV6Result;
  stats: StatsData;
  trend?: TrendSummary | null;
  diff?: SnapshotDiff | null;
  activeDimension?: keyof DimensionScores | null;
  className?: string;
  craftResult?: CraftResult | null;
}

export function DimensionCardsRow({
  impact,
  stats,
  trend,
  diff,
  activeDimension,
  className,
  craftResult = null,
}: DimensionCardsRowProps) {
  const { t } = useTranslation();
  const hasCraft = impact.dimensions.craft != null;
  const dimensions: (keyof DimensionScores)[] = hasCraft
    ? [...CORE_DIMENSIONS, "craft"]
    : [...CORE_DIMENSIONS];

  const gridCols = hasCraft
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section className={className}>
      <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-3">
        {t('dashboard.performanceDimensions') as string}
      </h3>
      <div className={`grid ${gridCols} gap-3`}>
        {dimensions.map((dim, i) => {
          const isInactive =
            activeDimension != null && activeDimension !== dim;

          return (
            <DimensionCard
              key={dim}
              dimension={dim}
              score={impact.dimensions[dim] ?? 0}
              stats={stats}
              trend={trend?.dimensions[dim] ?? null}
              delta={diff?.dimensions[dim] ?? null}
              animationDelay={400 + i * 100}
              className={
                isInactive
                  ? "opacity-70 transition-opacity duration-200"
                  : ""
              }
              profileType={impact.profileType}
              craftResult={craftResult}
            />
          );
        })}
      </div>
    </section>
  );
}
