"use client";

import type { HeatmapDay } from "@chapa/shared";
import { HeatmapGrid, HEATMAP_GRID_CSS } from "@/lib/effects/heatmap/HeatmapGrid";

export interface ActivityHeatmapProps {
  heatmapData: HeatmapDay[];
  activeDays: number;
}

export function ActivityHeatmap({ heatmapData, activeDays }: ActivityHeatmapProps) {
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

      <div className="rounded-xl border border-stroke bg-card p-4">
        <HeatmapGrid data={heatmapData} animation="ripple" />
      </div>
    </section>
  );
}
