"use client";

import { useState, useCallback, useMemo } from "react";
import {
  type AnimationVariant,
  VARIANTS,
  WEEKS,
  DAYS,
  getDelayFn,
  generateMockHeatmap,
  INTENSITY_COLORS,
} from "@/lib/effects/heatmap/animations";

/* ------------------------------------------------------------------ */
/*  Heatmap Wave Animation — Experiment #41                           */
/*  Demonstrates 5 cell-reveal animation patterns for the heatmap.    */
/* ------------------------------------------------------------------ */

const CELL_SIZE = 22;
const CELL_GAP = 3;

export default function HeatmapWavePage() {
  const [activeVariant, setActiveVariant] = useState<AnimationVariant>("diagonal");
  const [replayKey, setReplayKey] = useState(0);
  const [speed, setSpeed] = useState(1);

  const heatmap = useMemo(() => generateMockHeatmap(), []);

  const replay = useCallback(() => {
    setReplayKey((k) => k + 1);
  }, []);

  return (
    <main className="min-h-screen bg-bg bg-grid-warm">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber/[0.04] blur-[150px]"
        style={{ width: 600, height: 600 }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-6 py-20">
        {/* ── Header ─────────────────────────────────────────── */}
        <p className="mb-4 text-sm font-medium tracking-widest uppercase text-amber">
          Experiment #41
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
          Heatmap Wave Animation
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">
          Five cell-reveal patterns for the contribution heatmap. Each cell
          scales and fades in with a computed delay, creating a wave, ripple,
          scatter, cascade, or waterfall effect.
        </p>

        {/* ── Controls ───────────────────────────────────────── */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setActiveVariant(v.id);
                setReplayKey((k) => k + 1);
              }}
              className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-all ${
                activeVariant === v.id
                  ? "border-amber bg-amber/10 text-amber"
                  : "border-warm-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Speed + Replay */}
        <div className="mt-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <label
              htmlFor="speed-slider"
              className="text-sm font-medium text-text-secondary"
            >
              Speed
            </label>
            <input
              id="speed-slider"
              type="range"
              min={0.25}
              max={2}
              step={0.25}
              value={speed}
              onChange={(e) => {
                setSpeed(parseFloat(e.target.value));
                setReplayKey((k) => k + 1);
              }}
              className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-warm-stroke accent-amber"
            />
            <span className="min-w-[3ch] text-sm tabular-nums text-amber">
              {speed}x
            </span>
          </div>

          <button
            onClick={replay}
            className="rounded-full border border-warm-stroke px-6 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]"
          >
            <span className="mr-2" aria-hidden="true">
              &#x21bb;
            </span>
            Replay
          </button>
        </div>

        {/* ── Main Showcase ──────────────────────────────────── */}
        <div className="mt-10">
          <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-8">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-heading text-xl font-bold text-text-primary">
                {VARIANTS.find((v) => v.id === activeVariant)?.label}
              </h2>
              <p className="text-sm text-text-secondary">
                {VARIANTS.find((v) => v.id === activeVariant)?.description}
              </p>
            </div>
            <HeatmapGrid
              key={`main-${activeVariant}-${replayKey}`}
              heatmap={heatmap}
              variant={activeVariant}
              speedMultiplier={speed}
              cellSize={CELL_SIZE}
              gap={CELL_GAP}
            />
          </div>
        </div>

        {/* ── All Variants Grid ──────────────────────────────── */}
        <h2 className="mt-16 font-heading text-2xl font-bold tracking-tight text-text-primary">
          All Variants
        </h2>
        <p className="mt-2 mb-8 text-text-secondary">
          Side-by-side comparison. Hit Replay to see them all animate
          simultaneously.
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VARIANTS.map((v) => (
            <div
              key={v.id}
              className={`rounded-2xl border p-6 transition-all ${
                activeVariant === v.id
                  ? "border-amber/30 bg-warm-card"
                  : "border-warm-stroke bg-warm-card/50"
              }`}
            >
              <h3 className="font-heading text-base font-bold text-text-primary">
                {v.label}
              </h3>
              <p className="mb-4 mt-1 text-xs text-text-secondary">
                {v.description}
              </p>
              <HeatmapGrid
                key={`grid-${v.id}-${replayKey}`}
                heatmap={heatmap}
                variant={v.id}
                speedMultiplier={speed}
                cellSize={16}
                gap={2}
              />
            </div>
          ))}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="mt-16 border-t border-warm-stroke pt-8">
          <p className="text-sm text-text-secondary">
            Experiment #41 &mdash; Enhanced Heatmap Diagonal Wave Animation.
            Built for the Chapa badge heatmap reveal.
          </p>
        </div>
      </div>

      {/* Global keyframes injected via style tag */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes cell-reveal {
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
              .heatmap-cell {
                animation: none !important;
                opacity: 1 !important;
                transform: scale(1) !important;
              }
            }
          `,
        }}
      />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  HeatmapGrid — renders the 13x7 grid with animated cells          */
/* ------------------------------------------------------------------ */

interface HeatmapGridProps {
  heatmap: number[][];
  variant: AnimationVariant;
  speedMultiplier: number;
  cellSize: number;
  gap: number;
}

function HeatmapGrid({
  heatmap,
  variant,
  speedMultiplier,
  cellSize,
  gap,
}: HeatmapGridProps) {
  const delayFn = getDelayFn(variant);

  // Compute a speed factor: higher speed = shorter delays
  // speedMultiplier of 1 = normal, 2 = double speed (half delay), 0.5 = half speed
  const speedFactor = 1 / speedMultiplier;

  const gridWidth = WEEKS * (cellSize + gap) - gap;
  const gridHeight = DAYS * (cellSize + gap) - gap;

  return (
    <div
      className="relative mx-auto"
      style={{ width: gridWidth, height: gridHeight }}
      role="img"
      aria-label={`Contribution heatmap with ${variant} reveal animation`}
    >
      {heatmap.map((week, col) =>
        week.map((intensity, row) => {
          const delay = Math.round(delayFn(col, row) * speedFactor);
          return (
            <div
              key={`${col}-${row}`}
              className="heatmap-cell absolute"
              style={{
                left: col * (cellSize + gap),
                top: row * (cellSize + gap),
                width: cellSize,
                height: cellSize,
                borderRadius: 4,
                backgroundColor: INTENSITY_COLORS[intensity],
                opacity: 0,
                transform: "scale(0.3)",
                animation: `cell-reveal 0.4s ease-out ${delay}ms forwards`,
              }}
            />
          );
        })
      )}
    </div>
  );
}
