"use client";

import { useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { HeatmapDay } from "@chapa/shared";
import { computeActivityInsights } from "./activity-insights";
import { formatIsoDate } from "@/lib/utils/date";
import { seededRandom } from "@/lib/utils/prng";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";

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

    return { ...day, dominant, dimensionWeights: weights };
  });
}

// ── Component ────────────────────────────────────────────────────────

export function ActivityHeatmap({
  heatmapData,
  activeDays,
  dimensions,
}: ActivityHeatmapProps) {
  const { t } = useTranslation();
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
      aria-label={t('aria.contributionActivity') as string}
      className="animate-fade-in-up"
      style={{ animationDelay: "2000ms" }}
    >
      <h3 className="font-heading text-xs uppercase tracking-wider text-text-secondary mb-4">
        Activity
      </h3>

      <p className="text-sm text-text-secondary mb-3">
        {insights.summary}
      </p>

      {/* Insight cards */}
      {hasInsights && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <StreakCard
            current={insights.currentStreak}
            longest={insights.longestStreak}
            last7={insights.last7DaysActive}
          />
          <RhythmCard
            busiestDay={insights.busiestDay}
            busiestDayIndex={insights.busiestDayIndex}
            distribution={insights.weekdayDistribution}
          />
          <ThisWeekCard
            total={insights.thisWeekTotal}
            weeklyAvg={insights.weeklyAverage}
          />
        </div>
      )}

      <div className="rounded-xl border border-stroke bg-card p-4">
        <DotTimeline data={enriched} peakDate={insights.peakDay.date} activeDays={activeDays} />
      </div>

      {/* Legends */}
      <div className="flex flex-wrap items-center justify-between mt-3 gap-2">
        {/* Dimension colors */}
        <div className="flex flex-wrap items-center gap-4">
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
        {/* Dot size key */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-text-secondary font-body">Activity:</span>
          {[
            { label: "Low", size: 5 },
            { label: "Med", size: 9 },
            { label: "High", size: 14 },
          ].map(({ label, size }) => (
            <div key={label} className="flex items-center gap-1">
              <div
                className="rounded-full bg-amber/40"
                style={{ width: size, height: size }}
              />
              <span className="text-[9px] text-text-secondary font-body">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Insight cards ────────────────────────────────────────────────────

const CARD_CLASS = "rounded-lg border border-stroke bg-card p-3";

function StreakCard({
  current,
  longest,
  last7,
}: {
  current: number;
  longest: number;
  last7: boolean[];
}) {
  const { t } = useTranslation();
  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span
            className="text-2xl font-heading font-bold text-text-primary leading-none"
            title="Days with 1+ contribution"
          >
            {current}d
          </span>
          <span className="text-[10px] text-text-secondary font-body uppercase tracking-wider mt-0.5">
            Current streak
          </span>
        </div>
        <div
          className="flex gap-1 items-center"
          aria-label={t('aria.last7DaysActivity') as string}
          role="img"
        >
          {last7.map((active, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                active
                  ? "bg-amber"
                  : "bg-track border border-stroke"
              }`}
            />
          ))}
        </div>
      </div>
      <p className="text-[10px] text-text-secondary font-body mt-1.5">
        Best: <span className="text-text-primary font-medium">{longest}d</span>
      </p>
    </div>
  );
}

/** Maps Mon–Sun display order to JS getDay() indices (Mon=1, ..., Sun=0) */
const WEEKDAY_JS_INDICES = [1, 2, 3, 4, 5, 6, 0];

function RhythmCard({
  busiestDay,
  busiestDayIndex,
  distribution,
}: {
  busiestDay: string;
  busiestDayIndex: number;
  distribution: number[];
}) {
  const maxVal = Math.max(1, ...distribution);
  return (
    <div className={CARD_CLASS}>
      <span className="text-lg font-heading font-semibold text-text-primary leading-none">
        {busiestDay || "—"}
      </span>
      <span className="text-[10px] text-text-secondary font-body uppercase tracking-wider block mt-0.5">
        Most active day
      </span>
      <div className="flex items-end gap-px mt-2" style={{ height: 20 }}>
        {WEEKDAY_JS_INDICES.map((jsIdx, displayIdx) => {
          const val = distribution[jsIdx] ?? 0;
          const barH = maxVal > 0 ? (val / maxVal) * 16 : 0;
          const isBusiest = jsIdx === busiestDayIndex;
          return (
            <div
              key={displayIdx}
              className="flex-1 flex flex-col items-center gap-0.5"
            >
              <div
                className="w-full rounded-sm"
                style={{
                  height: Math.max(2, barH),
                  backgroundColor: isBusiest
                    ? "var(--color-amber)"
                    : "var(--color-purple-tint)",
                }}
              />
              <span className="text-[7px] text-text-secondary font-body leading-none">
                {DOW_HEADERS[displayIdx]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThisWeekCard({
  total,
  weeklyAvg,
}: {
  total: number;
  weeklyAvg: number;
}) {
  const ratio = weeklyAvg > 0 ? total / weeklyAvg : 0;
  const ratioLabel = ratio > 0 ? `${ratio.toFixed(1)}x avg` : "";
  const isAbove = ratio >= 1;

  return (
    <div className={CARD_CLASS}>
      <span className="text-lg font-heading font-semibold text-text-primary leading-none">
        {total.toLocaleString()}
      </span>
      <span className="text-[10px] text-text-secondary font-body uppercase tracking-wider block mt-0.5">
        This week
      </span>
      {ratioLabel && (
        <p className="text-[10px] font-body font-medium mt-1">
          <span
            className={
              isAbove ? "text-terminal-green" : "text-terminal-red"
            }
          >
            {isAbove ? "↑" : "↓"} {ratioLabel}
          </span>
        </p>
      )}
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
  const chunks: { first: EnrichedDay; days: EnrichedDay[]; total: number }[] = [];
  for (let i = 0; i < data.length; i += DAYS) {
    const chunk = data.slice(i, i + DAYS);
    const first = chunk[0];
    if (!first) continue;
    chunks.push({ first, days: chunk, total: chunk.reduce((s, c) => s + c.count, 0) });
  }
  return chunks.map(({ first, days, total }, idx) => {
    const weeksAgo = chunks.length - 1 - idx;
    let label: string;
    if (weeksAgo === 0) label = "This wk";
    else if (weeksAgo === 1) label = "Last wk";
    else {
      const d = new Date(first.date + "T12:00:00");
      label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return { label, total, days };
  });
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

const DOW_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

function DotTimeline({
  data,
  peakDate,
  activeDays,
}: {
  data: EnrichedDay[];
  peakDate: string;
  activeDays: number;
}) {
  const { t } = useTranslation();
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

  const handleDotFocus = useCallback(
    (day: EnrichedDay, e: React.FocusEvent<HTMLDivElement>) => {
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

  const handleDotKeyDown = useCallback(
    (day: EnrichedDay, e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
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
      }
    },
    []
  );

  const handleLeave = useCallback(() => setTooltip(null), []);

  const dayWord = activeDays === 1 ? "day" : "days";
  const timelineLabel = `Activity heatmap: ${activeDays} active ${dayWord} over the past year`;

  return (
    <div role="img" aria-label={timelineLabel}>
      {/* Day-of-week column headers */}
      <div className="flex items-center gap-2 mb-1">
        <span className="w-12 shrink-0" />
        <div className="flex items-center gap-1 flex-1">
          {DOW_HEADERS.map((label, i) => (
            <span
              key={i}
              className="flex-1 text-center text-[7px] text-text-secondary font-body"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Week rows */}
      <div className="space-y-2">
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
                const isPeak = day.date === peakDate && day.count > 0;
                return (
                  <div key={di} className="flex flex-col items-center gap-0.5 flex-1">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={interpolate(t('aria.contributionOnDate') as string, { count: String(day.count), date: formatIsoDate(day.date) })}
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
                          ? "1px solid var(--color-stroke)"
                          : "none",
                        boxShadow: isPeak
                          ? "0 0 0 2px var(--color-amber)"
                          : undefined,
                      }}
                      onMouseEnter={(e) => handleDotEnter(day, e)}
                      onMouseLeave={handleLeave}
                      onFocus={(e) => handleDotFocus(day, e)}
                      onBlur={handleLeave}
                      onKeyDown={(e) => handleDotKeyDown(day, e)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {tooltip && <ChartTooltip tip={tooltip} />}
    </div>
  );
}
