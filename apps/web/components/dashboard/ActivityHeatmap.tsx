"use client";

import { useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { HeatmapDay } from "@chapa/shared";
import { getIntensityLevel } from "@/lib/effects/heatmap/HeatmapGrid";
import { computeActivityInsights } from "./activity-insights";

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
  delivery: "#22c55e",
  quality: "#f97316",
  consistency: "#06b6d4",
  breadth: "#ec4899",
};

const DIMENSION_LABELS: Record<Dimension, string> = {
  delivery: "Delivery",
  quality: "Quality",
  consistency: "Consistency",
  breadth: "Breadth",
};

const ALL_DIMENSIONS: Dimension[] = [
  "delivery",
  "quality",
  "consistency",
  "breadth",
];

const INTENSITY_ALPHA: Record<number, number> = {
  0: 0.07,
  1: 0.3,
  2: 0.5,
  3: 0.72,
  4: 0.92,
};

const HEX_CLIP_PATH =
  "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

const SQRT3 = Math.sqrt(3);

// ── Hex geometry (flat-top) ──────────────────────────────────────────

function hexPosition(
  col: number,
  row: number,
  size: number,
  gap: number
): { x: number; y: number } {
  const w = size * 2;
  const h = size * SQRT3;
  const colStep = w * 0.75 + gap * 0.75;
  const rowStep = h + gap;
  const offset = col % 2 === 1 ? (h + gap) / 2 : 0;
  return { x: col * colStep, y: row * rowStep + offset };
}

function hexGridDimensions(
  size: number,
  gap: number
): { width: number; height: number } {
  const lastCol = hexPosition(WEEKS - 1, 0, size, gap);
  const lastRow = hexPosition(0, DAYS - 1, size, gap);
  const w = size * 2;
  const h = size * SQRT3;
  return {
    width: lastCol.x + w,
    height: lastRow.y + h + (h + gap) / 2,
  };
}

// ── Per-day dimension assignment ─────────────────────────────────────

interface HexDay extends HeatmapDay {
  intensity: number;
  dominant: Dimension;
  dimensionWeights: Record<Dimension, number>;
}

/** Simple deterministic pseudo-random from seed. */
function seededRandom(seed: number): number {
  const s = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Derive per-day dimension weights from the profile-level scores + date-based variation.
 * The profile dimensions set the base proportions; per-day variation adds realism.
 */
function enrichDays(
  data: HeatmapDay[],
  profileDimensions?: Record<Dimension, number>
): HexDay[] {
  const displaySize = WEEKS * DAYS;
  const sliced = data.length > displaySize ? data.slice(-displaySize) : data;
  const max = Math.max(1, ...sliced.map((d) => d.count));

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
    const intensity = getIntensityLevel(day.count, max);

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
    for (const dim of ALL_DIMENSIONS) {
      weights[dim] = total > 0 ? Math.max(0, weights[dim]) / total : 0;
    }

    const dominant = ALL_DIMENSIONS.reduce((a, b) =>
      weights[a] >= weights[b] ? a : b
    );

    return { ...day, intensity, dominant, dimensionWeights: weights };
  });
}

// ── Color helpers ────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  return `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha})`;
}

// ── Format helpers ───────────────────────────────────────────────────

/** Format ISO date string as "Fri, Mar 15". */
function formatIsoDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
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
  const hexDays = useMemo(
    () => enrichDays(heatmapData, dimensions),
    [heatmapData, dimensions]
  );

  const hasInsights = heatmapData.length > 0 && activeDays > 0;

  return (
    <section
      aria-label="Contribution activity heatmap"
      className="animate-fade-in-up"
      style={{ animationDelay: "2000ms" }}
    >
      {/* SAFETY: CSS-only string literal with no user input */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes hex-cell-in {
              from { opacity: 0; transform: scale(0.3); }
              to { opacity: 1; transform: scale(1); }
            }
            @media (prefers-reduced-motion: reduce) {
              [role="img"][aria-label="Hexagonal activity heatmap"] div {
                animation: none !important;
                opacity: 1 !important;
                transform: none !important;
              }
            }
          `,
        }}
      />

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

      <div className="rounded-xl border border-stroke bg-card p-4 overflow-x-auto">
        <HexHeatmapGrid data={hexDays} />
      </div>

      {/* Dimension legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3">
        {ALL_DIMENSIONS.map((dim) => (
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

// ── Hex heatmap grid ─────────────────────────────────────────────────

const HEX_SIZE = 12;
const HEX_GAP = 2;
const HEX_H = HEX_SIZE * SQRT3;
const CENTER_COL = Math.floor(WEEKS / 2);
const CENTER_ROW = Math.floor(DAYS / 2);

function HexHeatmapGrid({ data }: { data: HexDay[] }) {
  const gridDims = hexGridDimensions(HEX_SIZE, HEX_GAP);
  const [tooltip, setTooltip] = useState<{
    day: HexDay;
    screenX: number;
    screenY: number;
    cellBottom: number;
  } | null>(null);

  const handleHover = useCallback(
    (day: HexDay, e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({
        day,
        screenX: rect.left + rect.width / 2,
        screenY: rect.top,
        cellBottom: rect.bottom,
      });
    },
    []
  );

  const handleLeave = useCallback(() => setTooltip(null), []);

  // Pad to full grid if needed
  const cells = data.length;
  const totalCells = WEEKS * DAYS;

  return (
    <>
      <div
        className="relative mx-auto"
        style={{ width: gridDims.width, height: gridDims.height }}
        role="img"
        aria-label="Hexagonal activity heatmap"
      >
        {Array.from({ length: totalCells }, (_, i) => {
          const col = Math.floor(i / DAYS);
          const row = i % DAYS;
          const pos = hexPosition(col, row, HEX_SIZE, HEX_GAP);
          const day = i < cells ? data[i] : null;

          const alpha = day ? (INTENSITY_ALPHA[day.intensity] ?? 0.07) : 0.07;
          const background =
            day && day.count > 0
              ? hexToRgba(DIMENSION_COLORS[day.dominant], alpha)
              : "var(--color-amber, rgba(124,106,239,0.06))";
          const emptyBg =
            !day || day.count === 0;

          // Ripple delay from center
          const dist = Math.sqrt(
            (col - CENTER_COL) ** 2 + (row - CENTER_ROW) ** 2
          );
          const delay = Math.round(dist * 55);

          return (
            <div
              key={`${col}-${row}`}
              className="absolute cursor-pointer opacity-0 transition-transform duration-100 hover:scale-125 hover:z-10"
              style={{
                left: pos.x,
                top: pos.y,
                width: HEX_SIZE * 2,
                height: HEX_H,
                clipPath: HEX_CLIP_PATH,
                backgroundColor: emptyBg
                  ? "rgba(124,106,239,0.06)"
                  : undefined,
                background: emptyBg ? undefined : background,
                animation: `hex-cell-in 0.45s ease-out ${delay}ms forwards`,
              }}
              onMouseEnter={(e) => day && handleHover(day, e)}
              onMouseLeave={handleLeave}
              aria-hidden="true"
            />
          );
        })}
      </div>

      {/* Tooltip — portaled to document.body to escape ancestor transforms/overflow.
          Uses position: fixed with viewport coordinates and z-index: 99999.
          Flips below when cell is within 120px of viewport top. */}
      {tooltip &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed rounded-lg border border-stroke bg-card/95 px-3 py-2.5 text-xs font-body shadow-xl backdrop-blur-xl"
            style={{
              zIndex: 99999,
              left: tooltip.screenX,
              ...(tooltip.screenY < 120
                ? {
                    top: tooltip.cellBottom + 8,
                    transform: "translateX(-50%)",
                  }
                : {
                    top: tooltip.screenY - 8,
                    transform: "translate(-50%, -100%)",
                  }),
            }}
          >
            <p className="font-medium text-text-primary whitespace-nowrap">
              {formatIsoDate(tooltip.day.date)}
            </p>
            {tooltip.day.count > 0 ? (
              <>
                <p className="text-text-secondary whitespace-nowrap">
                  {tooltip.day.count} contribution
                  {tooltip.day.count !== 1 ? "s" : ""}
                </p>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {ALL_DIMENSIONS.map((dim) => {
                    const pct = Math.round(
                      tooltip.day.dimensionWeights[dim] * 100
                    );
                    return (
                      <div key={dim} className="flex items-center gap-1.5">
                        <div
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: DIMENSION_COLORS[dim],
                          }}
                        />
                        <span
                          className="whitespace-nowrap"
                          style={{
                            color:
                              dim === tooltip.day.dominant
                                ? DIMENSION_COLORS[dim]
                                : undefined,
                            fontWeight:
                              dim === tooltip.day.dominant ? 600 : 400,
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
        )}
    </>
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
