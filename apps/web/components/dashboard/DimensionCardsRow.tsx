"use client";

import type { ImpactV4Result, StatsData, DimensionScores } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { SnapshotDiff } from "@/lib/history/diff";
import { DimensionCard } from "./DimensionCard";

const DIMENSIONS: (keyof DimensionScores)[] = [
  "delivery",
  "quality",
  "consistency",
  "breadth",
];

export interface DimensionCardsRowProps {
  impact: ImpactV4Result;
  stats: StatsData;
  trend?: TrendSummary | null;
  diff?: SnapshotDiff | null;
  activeDimension?: keyof DimensionScores | null;
  className?: string;
}

export function DimensionCardsRow({
  impact,
  stats,
  trend,
  diff,
  activeDimension,
  className,
}: DimensionCardsRowProps) {
  return (
    <section className={className}>
      <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-3">
        Performance Dimensions
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {DIMENSIONS.map((dim, i) => {
          const isInactive =
            activeDimension != null && activeDimension !== dim;

          return (
            <DimensionCard
              key={dim}
              dimension={dim}
              score={impact.dimensions[dim]}
              stats={stats}
              trend={trend?.dimensions[dim] ?? null}
              delta={diff?.dimensions[dim] ?? null}
              animationDelay={400 + i * 100}
              className={
                isInactive
                  ? "opacity-70 transition-opacity duration-200"
                  : ""
              }
            />
          );
        })}
      </div>
    </section>
  );
}
