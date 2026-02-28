"use client";

import { useState, useCallback, useRef } from "react";
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

/** Human-friendly intensity label for tooltip. */
function getIntensityLabel(level: number): string {
  switch (level) {
    case 0: return "No activity";
    case 1: return "Light activity";
    case 2: return "Active day";
    case 3: return "High output";
    case 4: return "Peak performance";
    default: return "";
  }
}

/** Format ISO date string as "Fri, Mar 15" */
function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(
    (idx: number, e: React.MouseEvent<HTMLDivElement>) => {
      setHoveredIdx(idx);
      if (gridRef.current) {
        const gridRect = gridRef.current.getBoundingClientRect();
        const cellRect = e.currentTarget.getBoundingClientRect();
        setTooltipPos({
          x: cellRect.left - gridRect.left + cellRect.width / 2,
          y: cellRect.top - gridRect.top,
        });
      }
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
  }, []);

  const hoveredDay = hoveredIdx !== null && hoveredIdx < sliced.length ? sliced[hoveredIdx] : null;
  const hoveredLevel = hoveredDay ? getIntensityLevel(hoveredDay.count, max) : 0;

  return (
    <div ref={gridRef} className="relative">
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
          const entry = idx < sliced.length ? sliced[idx] : null;
          const count = entry?.count ?? 0;
          const level = getIntensityLevel(count, max);
          const delay = delayFn(week, day);

          return (
            <div
              key={`${week}-${day}`}
              className="aspect-square rounded-[3px] opacity-0 cursor-pointer transition-transform duration-100 hover:scale-125 hover:z-10"
              style={{
                backgroundColor: INTENSITY_COLORS[level],
                animation: `heatmap-cell-in 0.4s ease-out ${delay}ms forwards`,
              }}
              onMouseEnter={(e) => handleMouseEnter(idx, e)}
              onMouseLeave={handleMouseLeave}
              aria-hidden="true"
            />
          );
        })}
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-50 -translate-x-1/2 rounded-lg bg-card/95 backdrop-blur-xl border border-stroke shadow-lg px-3 py-2 text-xs font-body transition-opacity duration-150"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-medium text-text-primary whitespace-nowrap">
            {formatDate(hoveredDay.date)}
          </p>
          <p className="text-text-secondary whitespace-nowrap">
            {hoveredDay.count === 0
              ? "No contributions"
              : `${hoveredDay.count} contribution${hoveredDay.count !== 1 ? "s" : ""}`}
          </p>
          <p className="text-amber font-medium whitespace-nowrap">
            {getIntensityLabel(hoveredLevel)}
          </p>
        </div>
      )}
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
