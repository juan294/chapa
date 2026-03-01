"use client";

import { useState, useMemo, useCallback, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Hexagonal Heatmap Experiments                                      */
/*  3 variations of a honeycomb heatmap with per-day dimension colors  */
/* ------------------------------------------------------------------ */

// ── Types ────────────────────────────────────────────────────────────

type Dimension = "delivery" | "quality" | "consistency" | "breadth";
type HexVariant = "dominant" | "blend" | "glow";

interface HexDay {
  date: string;
  count: number;
  intensity: number; // 0-4
  dimensions: Record<Dimension, number>; // normalized 0-1, sum=1
  dominant: Dimension;
  secondary: Dimension;
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

const VARIANT_META: {
  id: HexVariant;
  label: string;
  description: string;
}[] = [
  {
    id: "dominant",
    label: "Dominant Dimension",
    description:
      "Each hex colored by the strongest dimension. Opacity scales with activity level.",
  },
  {
    id: "blend",
    label: "Dimension Blend",
    description:
      "Radial gradient blending dominant and secondary dimension colors.",
  },
  {
    id: "glow",
    label: "Radial Glow",
    description:
      "Dark mode with glowing hexes. High-activity cells emit colored light.",
  },
];

// ── Hex geometry (flat-top) ──────────────────────────────────────────
// Flat-top hex: width = 2*size, height = sqrt(3)*size
// Col step = 1.5*size, row step = sqrt(3)*size
// Odd columns offset down by sqrt(3)/2 * size

const HEX_CLIP_PATH =
  "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

function hexPosition(
  col: number,
  row: number,
  size: number,
  gap: number
): { x: number; y: number } {
  const w = size * 2;
  const h = size * Math.sqrt(3);
  const colStep = w * 0.75 + gap * 0.75;
  const rowStep = h + gap;
  const offset = col % 2 === 1 ? (h + gap) / 2 : 0;
  return {
    x: col * colStep,
    y: row * rowStep + offset,
  };
}

function hexGridDimensions(
  size: number,
  gap: number
): { width: number; height: number } {
  const lastCol = hexPosition(WEEKS - 1, 0, size, gap);
  const lastRow = hexPosition(0, DAYS - 1, size, gap);
  const w = size * 2;
  const h = size * Math.sqrt(3);
  const offsetExtra = (h + gap) / 2; // for odd columns
  return {
    width: lastCol.x + w,
    height: lastRow.y + h + offsetExtra,
  };
}

// ── Mock data generator ──────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateHexmapData(): HexDay[] {
  const days: HexDay[] = [];
  const start = new Date("2024-09-15");
  const rng = mulberry32(42);

  for (let i = 0; i < WEEKS * DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);

    // Activity count with weekly rhythm
    const dow = i % 7; // 0=Sun
    const weekNum = Math.floor(i / 7);
    const isWeekend = dow === 0 || dow === 6;
    const baseActivity = isWeekend ? rng() * 0.4 : rng();

    // Some weeks are busier than others
    const weekBusyness =
      0.3 + 0.7 * Math.sin(((weekNum + 2) * Math.PI) / 6.5);
    const activityScore = baseActivity * weekBusyness;

    let count = 0;
    let intensity = 0;
    if (activityScore > 0.15 && activityScore <= 0.35) {
      count = 1 + Math.floor(rng() * 3);
      intensity = 1;
    } else if (activityScore > 0.35 && activityScore <= 0.55) {
      count = 4 + Math.floor(rng() * 4);
      intensity = 2;
    } else if (activityScore > 0.55 && activityScore <= 0.75) {
      count = 8 + Math.floor(rng() * 4);
      intensity = 3;
    } else if (activityScore > 0.75) {
      count = 12 + Math.floor(rng() * 6);
      intensity = 4;
    }

    // Dimension breakdown with patterns:
    // - Mondays/Tuesdays: delivery-heavy (shipping code)
    // - Wednesdays/Thursdays: quality-heavy (reviews, tests)
    // - Fridays: breadth-heavy (exploring, side projects)
    // - Weekends: consistency (light maintenance)
    const rawDims = {
      delivery: rng() + (dow <= 2 && !isWeekend ? 0.4 : 0),
      quality: rng() + (dow >= 3 && dow <= 4 ? 0.35 : 0),
      consistency: rng() + (isWeekend ? 0.3 : 0.1),
      breadth: rng() + (dow === 5 ? 0.3 : 0),
    };

    // Week-level trends: some weeks are quality-focused, some delivery-focused
    const weekPhase = weekNum % 4;
    if (weekPhase === 0) rawDims.delivery += 0.2;
    else if (weekPhase === 1) rawDims.quality += 0.2;
    else if (weekPhase === 2) rawDims.consistency += 0.15;
    else rawDims.breadth += 0.25;

    const total =
      rawDims.delivery +
      rawDims.quality +
      rawDims.consistency +
      rawDims.breadth;
    const dimensions: Record<Dimension, number> = {
      delivery: rawDims.delivery / total,
      quality: rawDims.quality / total,
      consistency: rawDims.consistency / total,
      breadth: rawDims.breadth / total,
    };

    const sorted = (
      Object.entries(dimensions) as [Dimension, number][]
    ).sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0]![0];
    const secondary = sorted[1]![0];

    days.push({
      date: d.toISOString().slice(0, 10),
      count,
      intensity,
      dimensions,
      dominant,
      secondary,
    });
  }

  return days;
}

// ── Color helpers ────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  return `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha})`;
}

// ── Intensity → opacity mapping ──────────────────────────────────────

const INTENSITY_ALPHA: Record<number, number> = {
  0: 0.07,
  1: 0.3,
  2: 0.5,
  3: 0.72,
  4: 0.92,
};

// ── Hex cell components ──────────────────────────────────────────────

interface HexCellProps {
  day: HexDay;
  x: number;
  y: number;
  size: number;
  variant: HexVariant;
  animDelay: number;
  onHover: (day: HexDay, x: number, y: number, bottom: number) => void;
  onLeave: () => void;
}

function HexCell({
  day,
  x,
  y,
  size,
  variant,
  animDelay,
  onHover,
  onLeave,
}: HexCellProps) {
  const w = size * 2;
  const h = size * Math.sqrt(3);
  const alpha = INTENSITY_ALPHA[day.intensity] ?? 0.07;

  let background: string;
  let boxShadow: string | undefined;

  switch (variant) {
    case "dominant": {
      if (day.count === 0) {
        background = "rgba(124, 106, 239, 0.06)";
      } else {
        background = hexToRgba(DIMENSION_COLORS[day.dominant], alpha);
      }
      break;
    }
    case "blend": {
      if (day.count === 0) {
        background = "rgba(124, 106, 239, 0.06)";
      } else {
        const center = hexToRgba(DIMENSION_COLORS[day.dominant], alpha);
        const edge = hexToRgba(
          DIMENSION_COLORS[day.secondary],
          alpha * 0.6
        );
        background = `radial-gradient(ellipse at 40% 40%, ${center} 0%, ${edge} 100%)`;
      }
      break;
    }
    case "glow": {
      if (day.count === 0) {
        background = "rgba(255, 255, 255, 0.03)";
      } else {
        background = hexToRgba(
          DIMENSION_COLORS[day.dominant],
          alpha * 0.9
        );
        if (day.intensity >= 3) {
          const glowColor = hexToRgba(
            DIMENSION_COLORS[day.dominant],
            0.4 + day.intensity * 0.1
          );
          boxShadow = `0 0 ${6 + day.intensity * 4}px ${2 + day.intensity * 2}px ${glowColor}`;
        }
      }
      break;
    }
  }

  return (
    <div
      className="absolute cursor-pointer opacity-0 transition-[transform,box-shadow] duration-150 hover:z-10"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        clipPath: HEX_CLIP_PATH,
        background,
        boxShadow,
        animation: `hex-cell-in 0.45s ease-out ${animDelay}ms forwards`,
        transform: "scale(1)",
      }}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onHover(day, rect.left + rect.width / 2, rect.top, rect.bottom);
      }}
      onMouseLeave={onLeave}
      aria-hidden="true"
    />
  );
}

// ── Hex grid component ───────────────────────────────────────────────

interface HexGridProps {
  data: HexDay[];
  variant: HexVariant;
  size: number;
  gap: number;
  className?: string;
}

function HexGrid({ data, variant, size, gap, className = "" }: HexGridProps) {
  const gridDims = hexGridDimensions(size, gap);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    day: HexDay;
    screenX: number;
    screenY: number;
    cellBottom: number;
  } | null>(null);

  const handleHover = useCallback(
    (day: HexDay, screenX: number, screenY: number, cellBottom: number) => {
      setTooltip({ day, screenX, screenY, cellBottom });
    },
    []
  );

  const handleLeave = useCallback(() => setTooltip(null), []);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ width: gridDims.width, height: gridDims.height }}
      role="img"
      aria-label={`Hexagonal heatmap — ${variant} variant`}
    >
      {Array.from({ length: WEEKS * DAYS }, (_, i) => {
        const col = Math.floor(i / DAYS);
        const row = i % DAYS;
        const pos = hexPosition(col, row, size, gap);
        const day = data[i];
        if (!day) return null;

        // Ripple delay from center
        const centerCol = Math.floor(WEEKS / 2);
        const centerRow = Math.floor(DAYS / 2);
        const dist = Math.sqrt(
          (col - centerCol) ** 2 + (row - centerRow) ** 2
        );
        const delay = Math.round(dist * 55);

        return (
          <HexCell
            key={`${col}-${row}`}
            day={day}
            x={pos.x}
            y={pos.y}
            size={size}
            variant={variant}
            animDelay={delay}
            onHover={handleHover}
            onLeave={handleLeave}
          />
        );
      })}

      {/* Tooltip — fixed position, always on top, flips below when near viewport top */}
      {tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed rounded-lg border border-stroke bg-card/95 px-3 py-2.5 text-xs font-body shadow-xl backdrop-blur-xl"
          style={{
            zIndex: 99999,
            left: tooltip.screenX,
            ...(tooltip.screenY < 120
              ? { top: tooltip.cellBottom + 8, transform: "translateX(-50%)" }
              : { top: tooltip.screenY - 8, transform: "translate(-50%, -100%)" }),
          }}
        >
          <p className="font-medium text-text-primary whitespace-nowrap">
            {new Date(tooltip.day.date + "T12:00:00").toLocaleDateString(
              "en-US",
              { weekday: "short", month: "short", day: "numeric" }
            )}
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
                    tooltip.day.dimensions[dim] * 100
                  );
                  return (
                    <div
                      key={dim}
                      className="flex items-center gap-1.5"
                    >
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
                            dim === tooltip.day.dominant
                              ? 600
                              : 400,
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
        </div>
      )}
    </div>
  );
}

// ── Dimension legend ─────────────────────────────────────────────────

function DimensionLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {ALL_DIMENSIONS.map((dim) => (
        <div key={dim} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: DIMENSION_COLORS[dim] }}
          />
          <span className="text-xs text-text-secondary font-body">
            {DIMENSION_LABELS[dim]}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-stroke">
        <div className="h-2.5 w-2.5 rounded-full bg-amber/10" />
        <span className="text-xs text-text-secondary font-body">
          No activity
        </span>
      </div>
    </div>
  );
}

// ── Intensity legend ─────────────────────────────────────────────────

function IntensityLegend() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-text-secondary font-body mr-0.5">
        Less
      </span>
      {[0, 1, 2, 3, 4].map((level) => (
        <div
          key={level}
          className="w-3 h-3"
          style={{
            clipPath: HEX_CLIP_PATH,
            backgroundColor: hexToRgba(
              "#7C6AEF",
              INTENSITY_ALPHA[level] ?? 0.07
            ),
          }}
        />
      ))}
      <span className="text-[10px] text-text-secondary font-body ml-0.5">
        More
      </span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function HexmapExperimentPage() {
  const [activeVariant, setActiveVariant] = useState<HexVariant>("dominant");
  const [replayKey, setReplayKey] = useState(0);
  const [hexSize, setHexSize] = useState(14);

  const data = useMemo(() => generateHexmapData(), []);

  const replay = useCallback(() => {
    setReplayKey((k) => k + 1);
  }, []);

  return (
    <main className="min-h-screen bg-bg bg-grid-warm">
      <div className="relative mx-auto max-w-6xl px-6 py-20">
        {/* ── Header ─────────────────────────────────────────── */}
        <p className="mb-4 text-sm font-medium tracking-widest uppercase text-amber">
          Experiment
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
          Hexagonal Heatmap
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">
          Honeycomb-shaped activity heatmap with per-day dimension coloring.
          Three variations: single dominant color, dual-dimension blend, and
          radial glow on dark.
        </p>

        {/* ── Controls ───────────────────────────────────────── */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          {VARIANT_META.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setActiveVariant(v.id);
                setReplayKey((k) => k + 1);
              }}
              className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-all ${
                activeVariant === v.id
                  ? "border-amber bg-amber/10 text-amber"
                  : "border-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <label
              htmlFor="size-slider"
              className="text-sm font-medium text-text-secondary"
            >
              Hex Size
            </label>
            <input
              id="size-slider"
              type="range"
              min={8}
              max={22}
              step={1}
              value={hexSize}
              onChange={(e) => {
                setHexSize(parseInt(e.target.value));
                setReplayKey((k) => k + 1);
              }}
              className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-warm-stroke accent-amber"
            />
            <span className="min-w-[3ch] text-sm tabular-nums text-amber">
              {hexSize}px
            </span>
          </div>

          <button
            onClick={replay}
            className="rounded-full border border-stroke px-6 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]"
          >
            <span className="mr-2" aria-hidden="true">
              &#x21bb;
            </span>
            Replay
          </button>
        </div>

        {/* ── Legends ────────────────────────────────────────── */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <DimensionLegend />
          <IntensityLegend />
        </div>

        {/* ── Main Showcase ──────────────────────────────────── */}
        <div className="mt-8">
          <div
            className={`rounded-2xl border border-stroke overflow-hidden p-8 transition-colors duration-300 ${
              activeVariant === "glow"
                ? "bg-[#06060A]"
                : "bg-card/50"
            }`}
          >
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="font-heading text-xl font-bold text-text-primary">
                {VARIANT_META.find((v) => v.id === activeVariant)?.label}
              </h2>
              <p className="text-sm text-text-secondary">
                {
                  VARIANT_META.find((v) => v.id === activeVariant)
                    ?.description
                }
              </p>
            </div>
            <div className="flex justify-center">
              <HexGrid
                key={`main-${activeVariant}-${replayKey}`}
                data={data}
                variant={activeVariant}
                size={hexSize}
                gap={3}
              />
            </div>
          </div>
        </div>

        {/* ── All Variants ───────────────────────────────────── */}
        <h2 className="mt-16 font-heading text-2xl font-bold tracking-tight text-text-primary">
          All Variants
        </h2>
        <p className="mt-2 mb-8 text-text-secondary">
          Side-by-side comparison at compact size.
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {VARIANT_META.map((v) => (
            <div
              key={v.id}
              className={`rounded-2xl border overflow-hidden p-6 transition-all ${
                activeVariant === v.id
                  ? "border-amber/30"
                  : "border-stroke"
              } ${v.id === "glow" ? "bg-[#06060A]" : "bg-card/50"}`}
            >
              <h3 className="font-heading text-base font-bold text-text-primary">
                {v.label}
              </h3>
              <p className="mb-4 mt-1 text-xs text-text-secondary">
                {v.description}
              </p>
              <div className="flex justify-center overflow-x-auto">
                <HexGrid
                  key={`grid-${v.id}-${replayKey}`}
                  data={data}
                  variant={v.id}
                  size={10}
                  gap={2}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ── Design notes ───────────────────────────────────── */}
        <div className="mt-16 rounded-2xl border border-stroke bg-card/50 p-8">
          <h2 className="font-heading text-xl font-bold text-text-primary mb-4">
            Design Notes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-text-secondary font-body leading-relaxed">
            <div>
              <h3 className="font-heading text-sm font-bold text-text-primary mb-2">
                Dominant Dimension
              </h3>
              <p>
                Each hex is colored by the single strongest dimension that day.
                Clean and scannable — you can instantly see patterns like
                &ldquo;Mondays are delivery-heavy&rdquo; or &ldquo;Fridays
                shift to breadth.&rdquo; Opacity encodes activity intensity.
              </p>
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-text-primary mb-2">
                Dimension Blend
              </h3>
              <p>
                A radial gradient blends the dominant and secondary dimensions.
                Richer information density — you can see when a day was
                split between delivery and quality, or when breadth exploration
                mixed with consistency work.
              </p>
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-text-primary mb-2">
                Radial Glow
              </h3>
              <p>
                Forced dark background with CSS glow on high-intensity cells.
                Creates a luminous, data-visualization feel. The glow
                halo makes peak-performance days visually pop. Best for the
                badge SVG context.
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="mt-16 border-t border-stroke pt-8">
          <p className="text-sm text-text-secondary">
            Hexagonal Heatmap Experiment &mdash; Honeycomb activity map with
            per-dimension coloring. Built for the Chapa badge breakdown section.
          </p>
        </div>
      </div>

      {/* SAFETY: CSS-only string literal, no user input */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes hex-cell-in {
              from {
                opacity: 0;
                transform: scale(0.3);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              [role="img"][aria-label^="Hexagonal heatmap"] div {
                animation: none !important;
                opacity: 1 !important;
                transform: none !important;
              }
            }
          `,
        }}
      />
    </main>
  );
}
