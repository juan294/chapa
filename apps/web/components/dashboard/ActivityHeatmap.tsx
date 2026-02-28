"use client";

import { useMemo } from "react";
import type { HeatmapDay } from "@chapa/shared";
import { HeatmapGrid, HEATMAP_GRID_CSS } from "@/lib/effects/heatmap/HeatmapGrid";
import { computeActivityInsights } from "./activity-insights";

export interface ActivityHeatmapProps {
  heatmapData: HeatmapDay[];
  activeDays: number;
}

/** Format a date as "Mon, Mar 15" — short and scannable. */
function formatPeakDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ActivityHeatmap({ heatmapData, activeDays }: ActivityHeatmapProps) {
  const insights = useMemo(() => computeActivityInsights(heatmapData), [heatmapData]);

  const hasInsights = heatmapData.length > 0 && activeDays > 0;

  return (
    <section
      aria-label="Contribution activity heatmap"
      className="animate-fade-in-up"
      style={{ animationDelay: "2000ms" }}
    >
      <style dangerouslySetInnerHTML={{ __html: HEATMAP_GRID_CSS }} />

      <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-4">
        Activity
      </h3>

      <p className="text-sm text-text-secondary mb-3">
        {activeDays} active days in the last year
      </p>

      {/* Insight stats strip */}
      {hasInsights && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <InsightStat
            label="Current streak"
            value={`${insights.currentStreak}d`}
          />
          <InsightStat
            label="Longest streak"
            value={`${insights.longestStreak}d`}
          />
          <InsightStat
            label="Busiest day"
            value={insights.busiestDay || "—"}
          />
          <InsightStat
            label="Avg / active day"
            value={insights.avgPerActiveDay.toFixed(1)}
          />
        </div>
      )}

      <div className="rounded-xl border border-stroke bg-card p-4">
        <HeatmapGrid data={heatmapData} animation="ripple" showLabels />
      </div>

      {/* Peak day callout */}
      {hasInsights && insights.peakDay.count > 0 && (
        <p className="text-xs text-text-secondary mt-2">
          Peak:{" "}
          <span className="text-amber font-medium">
            {insights.peakDay.count} contributions
          </span>{" "}
          on {formatPeakDate(insights.peakDay.date)}
        </p>
      )}
    </section>
  );
}

function InsightStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-base font-heading font-semibold text-text-primary leading-none">
        {value}
      </span>
      <span className="text-[10px] text-text-secondary font-body uppercase tracking-wider leading-none">
        {label}
      </span>
    </div>
  );
}
