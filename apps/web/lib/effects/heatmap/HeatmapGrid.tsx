"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { getDelayFn, WEEKS, DAYS } from "./animations";
import type { AnimationVariant } from "./animations";
import type { HeatmapDay } from "@chapa/shared";
import { formatIsoDate } from "@/lib/utils/date";
import { INTENSITY_COLORS } from "@/lib/utils/dimension-colors";

export interface HeatmapGridProps {
  data: HeatmapDay[];
  animation: AnimationVariant;
  /** Override max value for normalization. Auto-detected from data by default. */
  maxValue?: number;
  /** Show month labels, day-of-week labels, and color legend around the grid. */
  showLabels?: boolean;
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

const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Compute month labels for each week column.
 * Returns an array of length WEEKS where non-empty entries mark the first week of a new month.
 * Requires a minimum gap of MIN_LABEL_GAP columns between labels to avoid crowding.
 */
export function computeMonthLabels(sliced: HeatmapDay[]): string[] {
  const MIN_LABEL_GAP = 2;

  // First pass: find all month boundaries
  const boundaries: { week: number; label: string; month: number }[] = [];
  let lastMonth = -1;

  for (let week = 0; week < WEEKS; week++) {
    const idx = week * DAYS;
    const entry = sliced[idx];
    if (entry?.date) {
      const d = new Date(entry.date + "T12:00:00");
      const month = d.getMonth();
      if (month !== lastMonth) {
        boundaries.push({
          week,
          label: d.toLocaleDateString("en-US", { month: "short" }),
          month,
        });
        lastMonth = month;
      }
    }
  }

  // Second pass: drop labels that are too close to their successor.
  // When two labels are crowded, keep the later one (it has more weeks visible).
  const kept = new Set<number>();
  for (let i = 0; i < boundaries.length; i++) {
    const cur = boundaries[i]!;
    const next = boundaries[i + 1];
    if (next && next.week - cur.week < MIN_LABEL_GAP) {
      // Skip the current label — it only has 1 column of space
      continue;
    }
    kept.add(cur.week);
  }

  // Build final array
  const labels: string[] = [];
  const boundaryMap = new Map(boundaries.map((b) => [b.week, b.label]));
  for (let week = 0; week < WEEKS; week++) {
    if (kept.has(week)) {
      labels.push(boundaryMap.get(week) ?? "");
    } else {
      labels.push("");
    }
  }
  return labels;
}

/**
 * Compute day-of-week labels for each row.
 * Shows Mon, Wed, Fri; empty for other days to keep it clean.
 */
export function computeDayLabels(sliced: HeatmapDay[]): string[] {
  const labels: string[] = [];
  for (let day = 0; day < DAYS; day++) {
    const entry = sliced[day];
    if (entry?.date) {
      const d = new Date(entry.date + "T12:00:00");
      const dow = d.getDay(); // 0=Sun .. 6=Sat
      // Show only Mon (1), Wed (3), Fri (5)
      if (dow === 1 || dow === 3 || dow === 5) {
        labels.push(SHORT_DAY_NAMES[dow] ?? "");
      } else {
        labels.push("");
      }
    } else {
      labels.push("");
    }
  }
  return labels;
}

/** Width of the day-of-week label column in pixels. */
const DAY_LABEL_W = 32;

/** Portal-rendered tooltip payload, tracked in viewport (screen) coordinates. */
interface HeatmapTooltipData {
  date: string;
  count: number;
  level: number;
  /** Horizontal center of the hovered cell, in viewport coordinates. */
  screenX: number;
  /** Top edge of the hovered cell, in viewport coordinates. */
  screenY: number;
  /** Bottom edge of the hovered cell, in viewport coordinates (used for flip-below). */
  cellBottom: number;
}

/**
 * Cell tooltip, portal-rendered directly to `document.body`.
 *
 * Portaling (rather than `position: absolute` nested in the heatmap's own DOM
 * tree) is required because this component renders inside contexts — e.g. the
 * Studio/badge preview's tilt-3D card — that apply a CSS `transform` to an
 * ancestor. `position: fixed` inside a transformed ancestor resolves relative
 * to that ancestor instead of the viewport, so escaping via a portal is the
 * only reliable fix. See docs/agents pre-launch UX-M1 / issue #1021.
 */
function HeatmapTooltip({ tip }: { tip: HeatmapTooltipData }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed rounded-lg bg-card/95 backdrop-blur-xl border border-stroke shadow-lg px-3 py-2 text-xs font-body transition-opacity duration-150"
      style={{
        zIndex: 99999,
        left: tip.screenX,
        ...(tip.screenY < 120
          ? { top: tip.cellBottom + 8, transform: "translateX(-50%)" }
          : { top: tip.screenY - 8, transform: "translate(-50%, -100%)" }),
      }}
    >
      <p className="font-medium text-text-primary whitespace-nowrap">
        {formatIsoDate(tip.date)}
      </p>
      <p className="text-text-secondary whitespace-nowrap">
        {tip.count === 0
          ? "No contributions"
          : `${tip.count} contribution${tip.count !== 1 ? "s" : ""}`}
      </p>
      <p className="text-amber font-medium whitespace-nowrap">
        {getIntensityLabel(tip.level)}
      </p>
    </div>,
    document.body,
  );
}

/**
 * Animated 13×7 contribution heatmap grid.
 *
 * Uses CSS Grid with column-flow so weeks run left→right and days run top→bottom.
 * Each cell fades in with a delay computed by the chosen animation variant.
 *
 * When `showLabels` is true, renders month labels (top), day-of-week labels (left),
 * and a color intensity legend (bottom right).
 */
export function HeatmapGrid({ data, animation, maxValue, showLabels = false }: HeatmapGridProps) {
  // Slice to last 13 weeks (91 days) — scoring window may be 365 days
  const displaySize = WEEKS * DAYS;
  const sliced = data.length > displaySize ? data.slice(-displaySize) : data;

  const max = maxValue ?? Math.max(1, ...sliced.map((d) => d.count));
  const delayFn = getDelayFn(animation);

  const [tooltip, setTooltip] = useState<HeatmapTooltipData | null>(null);

  const handleMouseEnter = useCallback(
    (idx: number, e: React.MouseEvent<HTMLDivElement>) => {
      const day = idx < sliced.length ? sliced[idx] : null;
      if (!day) {
        setTooltip(null);
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({
        date: day.date,
        count: day.count,
        level: getIntensityLevel(day.count, max),
        screenX: rect.left + rect.width / 2,
        screenY: rect.top,
        cellBottom: rect.bottom,
      });
    },
    [sliced, max],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const monthLabels = showLabels ? computeMonthLabels(sliced) : [];
  const dayLabels = showLabels ? computeDayLabels(sliced) : [];

  return (
    <div className="relative">
      {/* Month labels row */}
      {showLabels && (
        <div
          aria-hidden="true"
          className="grid gap-[3px] mb-1.5"
          style={{
            gridTemplateColumns: `repeat(${WEEKS}, 1fr)`,
            marginLeft: DAY_LABEL_W,
          }}
        >
          {monthLabels.map((label, i) => (
            <span
              key={i}
              className="text-[10px] leading-none text-text-secondary font-body truncate"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="flex">
        {/* Day-of-week labels column */}
        {showLabels && (
          <div
            aria-hidden="true"
            className="grid gap-[3px] shrink-0"
            style={{
              gridTemplateRows: `repeat(${DAYS}, 1fr)`,
              width: DAY_LABEL_W,
            }}
          >
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="flex items-center text-[10px] leading-none text-text-secondary font-body"
              >
                {label}
              </div>
            ))}
          </div>
        )}

        {/* Heatmap grid */}
        <div
          className="grid gap-[3px] flex-1"
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
      </div>

      {/* Legend row */}
      {showLabels && (
        <div
          aria-label="Activity level legend"
          className="flex items-center justify-end mt-2 gap-1"
          style={{ marginLeft: DAY_LABEL_W }}
        >
          <span className="text-[10px] text-text-secondary font-body mr-0.5">Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className="w-[10px] h-[10px] rounded-[2px]"
              style={{ backgroundColor: INTENSITY_COLORS[level] }}
            />
          ))}
          <span className="text-[10px] text-text-secondary font-body ml-0.5">More</span>
        </div>
      )}

      {/* Tooltip — portal-rendered to document.body (see HeatmapTooltip) */}
      {tooltip && <HeatmapTooltip tip={tooltip} />}
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
