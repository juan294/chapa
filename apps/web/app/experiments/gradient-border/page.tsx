"use client";

import { useState, useMemo, useId } from "react";

/* ──────────────────────────────────────────────────────────────
   Animated Gradient Border — Experiment #40
   Shows three border variations (thin, medium, glow) around a
   mock badge card. Includes animation toggle + speed control.
   ────────────────────────────────────────────────────────────── */

// ── Heatmap data (mock 7x13 grid like a contribution graph) ──
const HEATMAP_ROWS = 7;
const HEATMAP_COLS = 13;

function generateHeatmap(): number[][] {
  // Deterministic pseudo-random based on position
  const grid: number[][] = [];
  for (let row = 0; row < HEATMAP_ROWS; row++) {
    const r: number[] = [];
    for (let col = 0; col < HEATMAP_COLS; col++) {
      const seed = (row * 17 + col * 31 + 7) % 100;
      if (seed < 20) r.push(0);
      else if (seed < 45) r.push(1);
      else if (seed < 70) r.push(2);
      else if (seed < 88) r.push(3);
      else r.push(4);
    }
    grid.push(r);
  }
  return grid;
}

const HEATMAP = generateHeatmap();

const HEAT_COLORS = [
  "rgba(226,168,75,0.06)", // 0 — empty
  "rgba(226,168,75,0.18)", // 1 — low
  "rgba(226,168,75,0.35)", // 2 — medium
  "rgba(226,168,75,0.60)", // 3 — high
  "rgba(226,168,75,0.90)", // 4 — max
];

// ── Mock badge card ──────────────────────────────────────────

function MockBadgeCard() {
  return (
    <div className="relative z-10 rounded-2xl bg-[#1A1610] p-6 sm:p-8 w-full aspect-[1200/630] flex flex-col justify-between overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-heading text-sm sm:text-base text-text-secondary">
          @juan294
        </span>
        <span className="font-heading text-sm sm:text-base font-bold text-amber">
          Chapa.
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center gap-4 sm:gap-8 py-4">
        {/* Heatmap */}
        <div className="flex-1 min-w-0">
          <div
            className="grid gap-[2px] sm:gap-[3px]"
            style={{
              gridTemplateColumns: `repeat(${HEATMAP_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${HEATMAP_ROWS}, 1fr)`,
            }}
            role="img"
            aria-label="Activity heatmap showing commit frequency over 90 days"
          >
            {HEATMAP.flat().map((level, i) => (
              <div
                key={i}
                className="rounded-[2px] sm:rounded-[3px] aspect-square"
                style={{ backgroundColor: HEAT_COLORS[level] }}
              />
            ))}
          </div>
        </div>

        {/* Score + Tier */}
        <div className="flex flex-col items-center gap-1 sm:gap-2 shrink-0">
          <span className="font-heading text-4xl sm:text-5xl md:text-6xl font-extrabold text-amber leading-none">
            87
          </span>
          <span className="rounded-full bg-amber/10 border border-amber/20 px-3 py-0.5 sm:px-4 sm:py-1 text-xs sm:text-sm font-semibold text-amber tracking-wide uppercase">
            Elite
          </span>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-2 sm:gap-4 text-text-secondary text-[10px] sm:text-xs font-medium">
        <span>523 commits</span>
        <span className="text-amber/30" aria-hidden="true">|</span>
        <span>47 PRs</span>
        <span className="text-amber/30" aria-hidden="true">|</span>
        <span>89 reviews</span>
      </div>
    </div>
  );
}

// ── Border wrapper components ────────────────────────────────

type Variant = "thin" | "medium" | "glow";

interface BorderWrapperProps {
  variant: Variant;
  enabled: boolean;
  speed: number;
  children: React.ReactNode;
}

const VARIANT_META: Record<Variant, { label: string; description: string }> = {
  thin: { label: "Thin (2px)", description: "Elegant, subtle rotating border" },
  medium: {
    label: "Medium (3px)",
    description: "Balanced presence, easy to spot",
  },
  glow: {
    label: "Glow (4px + blur)",
    description: "Dramatic glow effect on the edge",
  },
};

function BorderWrapper({ variant, enabled, speed, children }: BorderWrapperProps) {
  const gradientId = useId();

  // Compute sizes per variant
  const borderWidth = variant === "thin" ? 2 : variant === "medium" ? 3 : 4;
  const blurPx = variant === "glow" ? 4 : 0;

  const animationStyle = enabled
    ? {
        animationDuration: `${speed}s`,
      }
    : {
        animationPlayState: "paused" as const,
      };

  return (
    <div className="w-full max-w-2xl">
      {/* Label */}
      <div className="mb-3 flex items-center gap-3">
        <h3 className="font-heading text-sm text-text-primary font-medium">
          {VARIANT_META[variant].label}
        </h3>
        <span className="text-xs text-text-secondary">
          {VARIANT_META[variant].description}
        </span>
      </div>

      {/* Card with animated border */}
      <div
        className="animated-border-wrapper relative rounded-2xl"
        style={
          {
            "--border-width": `${borderWidth}px`,
            "--blur-px": `${blurPx}px`,
            "--gradient-id": gradientId,
          } as React.CSSProperties
        }
      >
        {/* Pseudo-element via a real element for the gradient border */}
        <div
          className="animated-gradient-border absolute rounded-[18px] pointer-events-none"
          style={{
            inset: `-${borderWidth}px`,
            filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
            zIndex: 0,
            ...animationStyle,
          }}
          aria-hidden="true"
        />
        {children}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function GradientBorderExperiment() {
  const [enabled, setEnabled] = useState(true);
  const [speed, setSpeed] = useState(4);

  const variants: Variant[] = useMemo(() => ["thin", "medium", "glow"], []);

  return (
    <>
      {/* Inline styles for the animated gradient border techniques */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
/* ── Technique 1: @property conic-gradient (Chrome/Edge) ── */
@property --gradient-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes rotate-gradient-border {
  0% { --gradient-angle: 0deg; }
  100% { --gradient-angle: 360deg; }
}

.animated-gradient-border {
  background: conic-gradient(
    from var(--gradient-angle),
    #C28A2E,
    #E2A84B,
    #F0C97D,
    #E2A84B,
    #C28A2E
  );
  animation: rotate-gradient-border 4s linear infinite;
}

/* ── Technique 2: Fallback for browsers without @property ── */
@supports not (background: conic-gradient(from var(--gradient-angle), red, blue)) {
  .animated-gradient-border {
    background: linear-gradient(90deg, #C28A2E, #E2A84B, #F0C97D, #E2A84B, #C28A2E);
    background-size: 300% 300%;
    animation: gradient-shift-fallback 3s ease infinite;
  }

  @keyframes gradient-shift-fallback {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .animated-gradient-border {
    animation: none !important;
    background: conic-gradient(
      from 45deg,
      #C28A2E,
      #E2A84B,
      #F0C97D,
      #E2A84B,
      #C28A2E
    );
  }
}
          `,
        }}
      />

      <main className="min-h-screen bg-bg bg-grid-warm">
        {/* Ambient glow */}
        <div
          className="pointer-events-none fixed inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute top-1/4 -left-32 h-[500px] w-[500px] rounded-full bg-amber/[0.03] blur-[150px]" />
          <div className="absolute bottom-1/4 -right-32 h-[400px] w-[400px] rounded-full bg-amber/[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-6 py-16 sm:py-24">
          {/* Header */}
          <div className="mb-12 sm:mb-16">
            <p className="text-amber text-sm tracking-widest uppercase mb-4 font-medium">
              Experiment #40
            </p>
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-4">
              Animated Gradient{" "}
              <span className="text-amber">Border</span>
            </h1>
            <p className="text-text-secondary text-base sm:text-lg leading-relaxed max-w-2xl">
              A warm amber gradient slowly rotates around the badge card edge.
              Three variations demonstrate different border thicknesses and
              effects. Uses CSS <code className="font-heading text-amber/70 text-sm">@property</code> for
              smooth conic-gradient rotation with a linear-gradient fallback.
            </p>
          </div>

          {/* Controls */}
          <div className="mb-12 sm:mb-16 flex flex-wrap items-center gap-6 rounded-2xl border border-warm-stroke bg-warm-card/50 p-6">
            {/* Toggle */}
            <div className="flex items-center gap-3">
              <label
                htmlFor="animation-toggle"
                className="text-sm font-medium text-text-primary"
              >
                Animation
              </label>
              <button
                id="animation-toggle"
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${
                  enabled ? "bg-amber" : "bg-warm-stroke"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-warm-bg shadow-lg ring-0 transition duration-200 ease-in-out ${
                    enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-xs text-text-secondary">
                {enabled ? "On" : "Off"}
              </span>
            </div>

            {/* Speed slider */}
            <div className="flex items-center gap-3">
              <label
                htmlFor="speed-slider"
                className="text-sm font-medium text-text-primary"
              >
                Speed
              </label>
              <input
                id="speed-slider"
                type="range"
                min={2}
                max={8}
                step={0.5}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-32 sm:w-40 accent-amber"
                aria-label={`Rotation speed: ${speed} seconds per revolution`}
              />
              <span className="text-xs text-text-secondary tabular-nums w-8">
                {speed}s
              </span>
            </div>
          </div>

          {/* Variations */}
          <div className="flex flex-col items-center gap-12 sm:gap-16">
            {variants.map((variant) => (
              <BorderWrapper
                key={variant}
                variant={variant}
                enabled={enabled}
                speed={speed}
              >
                <MockBadgeCard />
              </BorderWrapper>
            ))}
          </div>

          {/* Technique notes */}
          <div className="mt-16 sm:mt-24 rounded-2xl border border-warm-stroke bg-warm-card/50 p-6 sm:p-8">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-text-primary mb-4">
              Implementation Notes
            </h2>
            <ul className="space-y-3 text-sm text-text-secondary leading-relaxed">
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">1.</span>
                <span>
                  <strong className="text-text-primary">Conic gradient + @property</strong>{" "}
                  — Chrome/Edge animate CSS custom properties registered with{" "}
                  <code className="font-heading text-amber/70 text-xs">@property</code>.
                  The gradient angle rotates from 0 to 360 degrees smoothly.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">2.</span>
                <span>
                  <strong className="text-text-primary">Linear gradient fallback</strong>{" "}
                  — Browsers without <code className="font-heading text-amber/70 text-xs">@property</code>{" "}
                  get a shifting linear gradient via{" "}
                  <code className="font-heading text-amber/70 text-xs">background-size</code> animation.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">3.</span>
                <span>
                  <strong className="text-text-primary">Glow variant</strong>{" "}
                  — Adds <code className="font-heading text-amber/70 text-xs">filter: blur(4px)</code>{" "}
                  on the border element for a soft, dramatic edge glow.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">4.</span>
                <span>
                  <strong className="text-text-primary">prefers-reduced-motion</strong>{" "}
                  — Disables all animation for users who prefer reduced motion.
                  The border still displays as a static gradient.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
