"use client";

import { useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { HeatmapDay } from "@chapa/shared";
import { computeActivityInsights } from "./activity-insights";
import { formatIsoDate } from "@/lib/utils/date";
import { seededRandom } from "@/lib/utils/prng";

// ── Types ────────────────────────────────────────────────────────────

type Dimension = "delivery" | "quality" | "consistency" | "breadth";

export interface ActivityHeatmapProps {
  heatmapData: HeatmapDay[];
  activeDays: number;
  /** Profile-level dimension scores (0–100). Used to derive per-day dominant dimension. */
  dimensions?: Record<Dimension, number>;
}

// ── Constants ────────────────────────────────────────────────────────

const WEEKS = 13;
const DAYS = 7;

const DIMENSION_COLORS: Record<Dimension, string> = {
  delivery: "var(--color-dimension-delivery)",
  quality: "var(--color-dimension-quality)",
  consistency: "var(--color-dimension-consistency)",
  breadth: "var(--color-dimension-breadth)",
};

const DIMENSION_LABELS: Record<Dimension, string> = {
  delivery: "Delivery",
  quality: "Quality",
  consistency: "Consistency",
  breadth: "Breadth",
};

const DIMENSIONS: Dimension[] = [
  "delivery",
  "quality",
  "consistency",
  "breadth",
];

// ── Per-day dimension assignment ─────────────────────────────────────

interface EnrichedDay extends HeatmapDay {
  dominant: Dimension;
  dimensionWeights: Record<Dimension, number>;
  /** Single-character weekday label (e.g. "M", "T") — precomputed to avoid Date parsing in render */
  dayLabel: string;
}

/**
 * Derive per-day dimension weights from the profile-level scores + date-based variation.
 * The profile dimensions set the base proportions; per-day variation adds realism.
 */
function enrichDays(
  data: HeatmapDay[],
  profileDimensions?: Record<Dimension, number>
): EnrichedDay[] {
  const displaySize = WEEKS * DAYS;
  const sliced = data.length > displaySize ? data.slice(-displaySize) : data;

  // Compress profile scores so non-zero dimensions can win on some days.
  // Raw proportions (e.g. 86/168=51%) leave the top dimension dominant on every
  // single day. Instead, apply a sqrt transform: sqrt(86)≈9.3, sqrt(37)≈6.1,
  // sqrt(45)≈6.7 — much closer together, giving realistic daily variation.
  // Zero stays zero so absent dimensions never appear.
  const raw = profileDimensions ?? {
    delivery: 70,
    quality: 70,
    consistency: 70,
    breadth: 70,
  };
  const compressed: Record<Dimension, number> = {
    delivery: Math.sqrt(raw.delivery),
    quality: Math.sqrt(raw.quality),
    consistency: Math.sqrt(raw.consistency),
    breadth: Math.sqrt(raw.breadth),
  };
  const compressedTotal =
    compressed.delivery + compressed.quality + compressed.consistency + compressed.breadth;

  // Pre-compute base weights once (stable across all days)
  const baseWeights: Record<Dimension, number> =
    compressedTotal > 0
      ? {
          delivery: compressed.delivery / compressedTotal,
          quality: compressed.quality / compressedTotal,
          consistency: compressed.consistency / compressedTotal,
          breadth: compressed.breadth / compressedTotal,
        }
      : { delivery: 0.25, quality: 0.25, consistency: 0.25, breadth: 0.25 };

  return sliced.map((day) => {
    // Date-based seed for deterministic variation (single Date parse per day)
    const d = new Date(day.date + "T12:00:00");
    const dateSeed = d.getTime() / 86400000;
    const dow = d.getDay();
    const dayLabel = d
      .toLocaleDateString("en-US", { weekday: "short" })
      .charAt(0);

    // Start with base weights, then apply per-day variation
    const weights: Record<Dimension, number> = { ...baseWeights };

    // Add day-based variation (±25% — enough to flip the winner on many days)
    const variation = 0.25;
    weights.delivery += (dow <= 2 ? variation : -variation * 0.5) * seededRandom(dateSeed * 7);
    weights.quality += (dow >= 3 && dow <= 4 ? variation : -variation * 0.5) * seededRandom(dateSeed * 13);
    weights.consistency += (dow === 0 || dow === 6 ? variation : -variation * 0.4) * seededRandom(dateSeed * 19);
    weights.breadth += (dow === 5 ? variation : -variation * 0.5) * seededRandom(dateSeed * 23);

    // Normalize (clamp negatives to zero — keeps absent dimensions absent)
    const total =
      Math.max(0, weights.delivery) + Math.max(0, weights.quality) +
      Math.max(0, weights.consistency) + Math.max(0, weights.breadth);
    for (const dim of DIMENSIONS) {
      weights[dim] = total > 0 ? Math.max(0, weights[dim]) / total : 0;
    }

    const dominant = DIMENSIONS.reduce((a, b) =>
      weights[a] >= weights[b] ? a : b
    );

    return { ...day, dominant, dimensionWeights: weights, dayLabel };
  });
}

// ── Component ────────────────────────────────────────────────────────

export function ActivityHeatmap({
  heatmapData,
  activeDays,
  dimensions,
}: ActivityHeatmapProps) {
  const insights = useMemo(
    () => computeActivityInsights(heatmapData),
    [heatmapData]
  );
  const enriched = useMemo(
    () => enrichDays(heatmapData, dimensions),
    [heatmapData, dimensions]
  );

  const hasInsights = heatmapData.length > 0 && activeDays > 0;

  return (
    <section
      aria-label="Contribution activity"
      className="animate-fade-in-up"
      style={{ animationDelay: "2000ms" }}
    >
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
        <DotTimeline data={enriched} />
      </div>

      {/* Dimension legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3">
        {DIMENSIONS.map((dim) => (
          <div key={dim} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: DIMENSION_COLORS[dim] }}
            />
            <span className="text-[10px] text-text-secondary font-body">
              {DIMENSION_LABELS[dim]}
            </span>
          </div>
        ))}
      </div>

      {/* Peak day callout */}
      {hasInsights && insights.peakDay.count > 0 && (
        <p className="text-xs text-text-secondary mt-2">
          Peak:{" "}
          <span className="text-amber font-medium">
            {insights.peakDay.count} contributions
          </span>{" "}
          on {formatIsoDate(insights.peakDay.date)}
        </p>
      )}
    </section>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

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

// ── Helper: aggregate days into weeks ─────────────────────────────────

interface WeekBucket {
  label: string;
  total: number;
  days: EnrichedDay[];
}

function bucketByWeek(data: EnrichedDay[]): WeekBucket[] {
  const weeks: WeekBucket[] = [];
  for (let i = 0; i < data.length; i += DAYS) {
    const chunk = data.slice(i, i + DAYS);
    const first = chunk[0];
    if (!first) continue;
    const d = new Date(first.date + "T12:00:00");
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const total = chunk.reduce((s, c) => s + c.count, 0);
    weeks.push({ label, total, days: chunk });
  }
  return weeks;
}

// ── Shared tooltip (portaled) ─────────────────────────────────────────

interface ChartTooltipData {
  title: string;
  count: number;
  dimensionWeights: Record<Dimension, number>;
  dominant: Dimension;
  screenX: number;
  screenY: number;
  cellBottom: number;
}

function ChartTooltip({ tip }: { tip: ChartTooltipData }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed rounded-lg border border-stroke bg-card/95 px-3 py-2.5 text-xs font-body shadow-xl backdrop-blur-xl"
      style={{
        zIndex: 99999,
        left: tip.screenX,
        ...(tip.screenY < 120
          ? { top: tip.cellBottom + 8, transform: "translateX(-50%)" }
          : { top: tip.screenY - 8, transform: "translate(-50%, -100%)" }),
      }}
    >
      <p className="font-medium text-text-primary whitespace-nowrap">{tip.title}</p>
      {tip.count > 0 ? (
        <>
          <p className="text-text-secondary whitespace-nowrap">
            {tip.count} contribution{tip.count !== 1 ? "s" : ""}
          </p>
          <div className="mt-1.5 flex flex-col gap-0.5">
            {DIMENSIONS.map((dim) => {
              const pct = Math.round(tip.dimensionWeights[dim] * 100);
              return (
                <div key={dim} className="flex items-center gap-1.5">
                  <div
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: DIMENSION_COLORS[dim] }}
                  />
                  <span
                    className="whitespace-nowrap"
                    style={{
                      color: dim === tip.dominant ? DIMENSION_COLORS[dim] : undefined,
                      fontWeight: dim === tip.dominant ? 600 : 400,
                    }}
                  >
                    {DIMENSION_LABELS[dim]} {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-text-secondary">No activity</p>
      )}
    </div>,
    document.body
  );
}

// ── Dot timeline ─────────────────────────────────────────────────────

function DotTimeline({ data }: { data: EnrichedDay[] }) {
  const maxCount = useMemo(
    () => Math.max(1, ...data.map((d) => d.count)),
    [data]
  );
  const weeks = useMemo(() => bucketByWeek(data), [data]);
  const [tooltip, setTooltip] = useState<ChartTooltipData | null>(null);

  const handleDotEnter = useCallback(
    (day: EnrichedDay, e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({
        title: formatIsoDate(day.date),
        count: day.count,
        dimensionWeights: day.dimensionWeights,
        dominant: day.dominant,
        screenX: rect.left + rect.width / 2,
        screenY: rect.top,
        cellBottom: rect.bottom,
      });
    },
    []
  );

  const handleLeave = useCallback(() => setTooltip(null), []);

  return (
    <div className="space-y-2" role="img" aria-label="Activity dot timeline">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex items-center gap-2">
          <span className="text-[9px] text-text-secondary font-body w-12 shrink-0 text-right">
            {week.label}
          </span>
          <div className="flex items-center gap-1 flex-1">
            {week.days.map((day, di) => {
              const size = day.count > 0
                ? 8 + (day.count / maxCount) * 24
                : 6;
              return (
                <div key={di} className="flex flex-col items-center gap-0.5 flex-1">
                  <div
                    className="rounded-full transition-transform duration-150 hover:scale-125 cursor-pointer"
                    style={{
                      width: size,
                      height: size,
                      backgroundColor: day.count > 0
                        ? DIMENSION_COLORS[day.dominant]
                        : "var(--color-purple-tint)",
                      opacity: day.count > 0
                        ? 0.3 + (day.count / maxCount) * 0.7
                        : 1,
                      border: day.count === 0
                        ? "1px solid rgba(139,92,246,0.15)"
                        : "none",
                    }}
                    onMouseEnter={(e) => handleDotEnter(day, e)}
                    onMouseLeave={handleLeave}
                  />
                  <span className="text-[7px] text-text-secondary font-body leading-none">
                    {day.dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
          <span className="text-[9px] text-text-secondary font-body w-8 shrink-0 tabular-nums">
            {week.total > 0 ? week.total : ""}
          </span>
        </div>
      ))}
      {tooltip && <ChartTooltip tip={tooltip} />}
    </div>
  );
}
