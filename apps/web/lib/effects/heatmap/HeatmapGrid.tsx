"use client";

import { getDelayFn, INTENSITY_COLORS, WEEKS, DAYS } from "./animations";
import type { AnimationVariant } from "./animations";
import type { HeatmapDay } from "@chapa/shared";

export interface HeatmapGridProps {
  data: HeatmapDay[];
  animation: AnimationVariant;
  /** Override max value for normalization. Auto-detected from data by default. */
  maxValue?: number;
}

/** Map a count to an intensity level (0–4) based on ratio to max. */
export function getIntensityLevel(count: number, max: number): number {
  if (count === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Animated 13×7 contribution heatmap grid.
 *
 * Uses CSS Grid with column-flow so weeks run left→right and days run top→bottom.
 * Each cell fades in with a delay computed by the chosen animation variant.
 */
export function HeatmapGrid({ data, animation, maxValue }: HeatmapGridProps) {
  // Slice to last 13 weeks (91 days) — scoring window may be 365 days
  const displaySize = WEEKS * DAYS;
  const sliced = data.length > displaySize ? data.slice(-displaySize) : data;

  const max = maxValue ?? Math.max(1, ...sliced.map((d) => d.count));
  const delayFn = getDelayFn(animation);

  return (
    <div
      className="grid gap-[3px]"
      style={{
        gridTemplateRows: `repeat(${DAYS}, 1fr)`,
        gridAutoFlow: "column",
      }}
      role="img"
      aria-label="Contribution heatmap"
    >
      {Array.from({ length: WEEKS * DAYS }, (_, i) => {
        const week = Math.floor(i / DAYS);
        const day = i % DAYS;
        const idx = week * DAYS + day;
        const count = idx < sliced.length ? sliced[idx].count : 0;
        const level = getIntensityLevel(count, max);
        const delay = delayFn(week, day);

        return (
          <div
            key={`${week}-${day}`}
            className="aspect-square rounded-[3px] opacity-0"
            style={{
              backgroundColor: INTENSITY_COLORS[level],
              animation: `heatmap-cell-in 0.4s ease-out ${delay}ms forwards`,
            }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

/** CSS keyframes for heatmap cell entrance animation. Inject once in the page. */
export const HEATMAP_GRID_CSS = `
@keyframes heatmap-cell-in {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  [role="img"][aria-label="Contribution heatmap"] div {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
`;
