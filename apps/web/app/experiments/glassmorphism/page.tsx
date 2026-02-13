"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Mock heatmap data (13 weeks x 7 days)                              */
/* ------------------------------------------------------------------ */
const HEATMAP = Array.from({ length: 13 * 7 }, (_, i) => {
  const v = Math.abs(Math.sin(i * 0.7 + 3) * 4);
  return Math.floor(v); // 0-3
});

function heatmapColor(level: number): string {
  switch (level) {
    case 0:
      return "rgba(124,106,239,0.06)";
    case 1:
      return "rgba(124,106,239,0.25)";
    case 2:
      return "rgba(124,106,239,0.5)";
    default:
      return "rgba(124,106,239,0.85)";
  }
}

/* ------------------------------------------------------------------ */
/*  Glass style helpers                                                */
/* ------------------------------------------------------------------ */
interface GlassConfig {
  bgOpacity: number;
  blur: number;
  saturation: number;
  borderOpacity: number;
  showBorder: boolean;
}

function glassStyle(config: GlassConfig): React.CSSProperties {
  return {
    background: `rgba(19, 20, 30, ${config.bgOpacity})`,
    backdropFilter: `blur(${config.blur}px) saturate(${config.saturation}%)`,
    WebkitBackdropFilter: `blur(${config.blur}px) saturate(${config.saturation}%)`,
    border: config.showBorder
      ? `1px solid rgba(124, 106, 239, ${config.borderOpacity})`
      : "1px solid transparent",
  };
}

/* ------------------------------------------------------------------ */
/*  Presets                                                            */
/* ------------------------------------------------------------------ */
type GlassVariant = "light" | "medium" | "heavy" | "amber";

const PRESETS: Record<
  GlassVariant,
  { label: string; description: string; bgOpacity: number; blur: number; saturation: number; borderOpacity: number; shadow?: string; insetHighlight?: boolean }
> = {
  light: {
    label: "Light Glass",
    description: "Subtle frosted effect. Low opacity, gentle blur. Best for overlaying colorful backgrounds.",
    bgOpacity: 0.4,
    blur: 12,
    saturation: 120,
    borderOpacity: 0.12,
  },
  medium: {
    label: "Medium Glass",
    description: "Balanced frosted glass. Good readability with visible depth. Default choice for cards.",
    bgOpacity: 0.6,
    blur: 20,
    saturation: 150,
    borderOpacity: 0.15,
    shadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  },
  heavy: {
    label: "Heavy Glass",
    description: "Dense frosted glass with inset highlight. Strong blur, high contrast. Best for primary content.",
    bgOpacity: 0.75,
    blur: 30,
    saturation: 180,
    borderOpacity: 0.2,
    shadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
    insetHighlight: true,
  },
  amber: {
    label: "Amber-Tinted Glass",
    description: "Warm amber-tinted transparent glass. Very low opacity with amber hue bleed-through.",
    bgOpacity: 0.08,
    blur: 16,
    saturation: 140,
    borderOpacity: 0.2,
  },
};

function presetToStyle(variant: GlassVariant, showBorder: boolean): React.CSSProperties {
  const p = PRESETS[variant];
  const base: React.CSSProperties = {
    backdropFilter: `blur(${p.blur}px) saturate(${p.saturation}%)`,
    WebkitBackdropFilter: `blur(${p.blur}px) saturate(${p.saturation}%)`,
    border: showBorder
      ? `1px solid rgba(124, 106, 239, ${p.borderOpacity})`
      : "1px solid transparent",
  };

  // Amber variant uses amber-tinted background
  if (variant === "amber") {
    base.background = `rgba(124, 106, 239, ${p.bgOpacity})`;
  } else {
    base.background = `rgba(19, 20, 30, ${p.bgOpacity})`;
  }

  if (p.shadow) {
    base.boxShadow = p.shadow;
  }
  if (p.insetHighlight) {
    base.boxShadow = `${p.shadow || ""}, inset 0 1px 0 rgba(255, 255, 255, 0.05)`.replace(/^, /, "");
  }

  return base;
}

/* ------------------------------------------------------------------ */
/*  Badge Card Component (reused across variants)                      */
/* ------------------------------------------------------------------ */
function BadgeCard() {
  return (
    <>
      {/* Header row */}
      <div className="mb-6 flex items-center justify-between">
        <span className="font-body text-lg text-text-primary">@juan294</span>
        <span className="font-heading text-xl font-bold text-amber">
          Chapa<span className="text-amber">.</span>
        </span>
      </div>

      {/* Two columns */}
      <div className="flex gap-8">
        {/* Left: Heatmap grid */}
        <div className="flex-1">
          <p className="mb-3 text-xs uppercase tracking-widest text-text-secondary">
            Activity
          </p>
          <div
            className="grid gap-[3px]"
            style={{
              gridTemplateColumns: "repeat(13, 1fr)",
              gridTemplateRows: "repeat(7, 1fr)",
            }}
          >
            {HEATMAP.map((level, i) => (
              <div
                key={i}
                className="aspect-square rounded-[2px]"
                style={{ backgroundColor: heatmapColor(level) }}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        {/* Right: Score */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="mb-2 text-xs uppercase tracking-widest text-text-secondary">
            Impact Score
          </p>
          <span className="font-heading text-7xl font-extrabold text-amber">
            87
          </span>
          <span className="mt-2 rounded-full border border-amber/20 bg-amber/10 px-3 py-1 text-sm text-amber">
            &#9733; Elite
          </span>
        </div>
      </div>

      {/* Archetype pill */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <span className="rounded-full border border-amber/10 bg-amber/5 px-3 py-0.5 text-xs text-text-secondary">
          Builder
        </span>
      </div>

      {/* Stats row */}
      <div className="mt-4 text-center text-sm text-text-secondary">
        1.2k stars &middot; 89 forks &middot; 34 watchers
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Compact Badge Card (for grid layout)                               */
/* ------------------------------------------------------------------ */
function CompactBadgeCard() {
  return (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="font-body text-sm text-text-primary">@juan294</span>
        <span className="font-heading text-sm font-bold text-amber">
          Chapa.
        </span>
      </div>

      {/* Heatmap */}
      <div
        className="mb-4 grid gap-[2px]"
        style={{
          gridTemplateColumns: "repeat(13, 1fr)",
          gridTemplateRows: "repeat(7, 1fr)",
        }}
      >
        {HEATMAP.map((level, i) => (
          <div
            key={i}
            className="aspect-square rounded-[1px]"
            style={{ backgroundColor: heatmapColor(level) }}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Score + tier row */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-3xl font-extrabold text-amber">
            87
          </span>
          <span className="rounded-full border border-amber/20 bg-amber/10 px-2 py-0.5 text-xs text-amber">
            &#9733; Elite
          </span>
        </div>
        <span className="text-xs text-text-secondary">1.2k&#9733; &middot; 89fk</span>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Background Blobs                                                   */
/* ------------------------------------------------------------------ */
function BackgroundBlobs({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Large amber blob, top-left area */}
      <div
        className="absolute rounded-full"
        style={{
          top: "5%",
          left: "20%",
          width: "24rem",
          height: "24rem",
          background: "#7C6AEF",
          opacity: 0.08,
          filter: "blur(100px)",
        }}
      />
      {/* Lighter blob, bottom-right */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: "15%",
          right: "20%",
          width: "20rem",
          height: "20rem",
          background: "#9D8FFF",
          opacity: 0.06,
          filter: "blur(120px)",
        }}
      />
      {/* Dark amber blob, center */}
      <div
        className="absolute rounded-full"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "500px",
          height: "300px",
          background: "#5E4FCC",
          opacity: 0.05,
          filter: "blur(150px)",
        }}
      />
      {/* Extra blob for depth, lower-left */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: "30%",
          left: "10%",
          width: "18rem",
          height: "18rem",
          background: "#7C6AEF",
          opacity: 0.04,
          filter: "blur(130px)",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle Switch                                                      */
/* ------------------------------------------------------------------ */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-amber" : "bg-warm-stroke"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-warm-bg transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Slider                                                             */
/* ------------------------------------------------------------------ */
function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-text-secondary">
        {label}:{" "}
        <span className="font-heading text-amber">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-warm-stroke accent-amber"
      />
      <div className="flex justify-between text-xs text-text-secondary">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Impact Breakdown Stat Card                                         */
/* ------------------------------------------------------------------ */
function StatCard({
  label,
  value,
  maxValue,
  detail,
  style,
}: {
  label: string;
  value: number;
  maxValue: number;
  detail: string;
  style: React.CSSProperties;
}) {
  const pct = Math.round((value / maxValue) * 100);
  return (
    <div className="rounded-2xl p-5" style={style}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="font-heading text-lg font-bold text-amber">{value}</span>
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-warm-bg/60">
        <div
          className="h-full rounded-full bg-amber/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-text-secondary leading-relaxed">{detail}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function GlassmorphismExperimentPage() {
  // Controls state
  const [blur, setBlur] = useState(20);
  const [opacity, setOpacity] = useState(0.6);
  const [saturation, setSaturation] = useState(150);
  const [showBlobs, setShowBlobs] = useState(true);
  const [showBorder, setShowBorder] = useState(true);

  // Build dynamic glass config from controls
  const dynamicConfig: GlassConfig = {
    bgOpacity: opacity,
    blur,
    saturation,
    borderOpacity: 0.15,
    showBorder,
  };

  const handleResetControls = useCallback(() => {
    setBlur(20);
    setOpacity(0.6);
    setSaturation(150);
    setShowBlobs(true);
    setShowBorder(true);
  }, []);

  return (
    <main
      id="main-content"
      className="relative min-h-screen bg-bg"
    >
      {/* Background blobs — essential for glass to look like glass */}
      <BackgroundBlobs visible={showBlobs} />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        {/* ============================================ */}
        {/*  Header                                      */}
        {/* ============================================ */}
        <div className="mb-16 text-center">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Experiment #46
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
            Dark Glassmorphism
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-text-secondary leading-relaxed">
            Frosted glass containers with warm amber tint on a rich background.
            The key insight: glassmorphism only works when there is something
            colorful behind the glass. Toggle the background blobs off to see
            the difference.
          </p>
        </div>

        {/* ============================================ */}
        {/*  Section 1: Badge Card Showcase (4 variants) */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Glass Variants
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Four Levels of Frost
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {(Object.keys(PRESETS) as GlassVariant[]).map((variant) => {
              const preset = PRESETS[variant];
              return (
                <div key={variant} className="flex flex-col gap-3">
                  {/* Label */}
                  <div className="flex items-baseline justify-between">
                    <span className="font-heading text-sm font-bold text-text-primary">
                      {preset.label}
                    </span>
                    <span className="text-xs text-text-secondary">
                      blur: {preset.blur}px &middot; opacity:{" "}
                      {variant === "amber"
                        ? `amber ${preset.bgOpacity}`
                        : preset.bgOpacity}
                    </span>
                  </div>

                  {/* Glass card */}
                  <div
                    className="rounded-2xl p-6"
                    style={presetToStyle(variant, showBorder)}
                  >
                    <CompactBadgeCard />
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {preset.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ============================================ */}
        {/*  Section 2: Stacked Glass Panels (depth)     */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Depth &amp; Layering
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Stacked Glass Panels
          </h2>
          <p className="mb-8 max-w-xl text-text-secondary leading-relaxed">
            Multiple glass layers create a sense of depth. The lightest panel sits
            furthest back, the heaviest sits on top. Each layer picks up blur
            from the layers below it.
          </p>

          {/* Stacked container */}
          <div className="relative mx-auto" style={{ maxWidth: "40rem", height: "28rem" }}>
            {/* Layer 1: Light glass (background) */}
            <div
              className="absolute inset-0 rounded-2xl p-8"
              style={presetToStyle("light", showBorder)}
            >
              <p className="text-xs uppercase tracking-widest text-text-secondary">
                Layer 1 &mdash; Light Glass
              </p>
              <p className="mt-2 text-sm text-text-secondary/60 leading-relaxed">
                Background layer with subtle frosting. Content behind bleeds
                through softly, establishing ambient depth.
              </p>
            </div>

            {/* Layer 2: Medium glass (middle) */}
            <div
              className="absolute rounded-2xl p-6"
              style={{
                top: "3.5rem",
                left: "2rem",
                right: "2rem",
                bottom: "3.5rem",
                ...presetToStyle("medium", showBorder),
              }}
            >
              <p className="text-xs uppercase tracking-widest text-text-secondary">
                Layer 2 &mdash; Medium Glass
              </p>
              <p className="mt-2 text-sm text-text-secondary/60 leading-relaxed">
                Primary content layer. Balanced opacity provides readable
                contrast while preserving ambient blur.
              </p>
            </div>

            {/* Layer 3: Heavy glass (top) */}
            <div
              className="absolute rounded-2xl p-6"
              style={{
                top: "7rem",
                left: "4rem",
                right: "4rem",
                bottom: "7rem",
                ...presetToStyle("heavy", showBorder),
              }}
            >
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="font-heading text-5xl font-extrabold text-amber">
                  87
                </span>
                <span className="mt-2 rounded-full border border-amber/20 bg-amber/10 px-3 py-1 text-sm text-amber">
                  &#9733; Elite
                </span>
                <p className="mt-3 text-xs text-text-secondary">
                  Layer 3 &mdash; Heavy Glass
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/*  Section 3: Impact Breakdown in Glass Cards  */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Data Readability
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Impact Breakdown
          </h2>
          <p className="mb-8 max-w-xl text-text-secondary leading-relaxed">
            Testing data density inside glass containers. Each stat category
            lives in its own glass card, demonstrating that progress bars, text,
            and numbers remain readable through the frosted effect.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Building"
              value={34}
              maxValue={40}
              detail="Core code contributions across 12 repos. Consistent daily contribution pattern with weekend peaks."
              style={presetToStyle("medium", showBorder)}
            />
            <StatCard
              label="Guarding"
              value={28}
              maxValue={30}
              detail="Code reviews, issue triage, and quality enforcement. Active reviewer with thoughtful feedback."
              style={presetToStyle("medium", showBorder)}
            />
            <StatCard
              label="Breadth"
              value={15}
              maxValue={20}
              detail="Contributions to 5 repos with 50K+ stars. Non-trivial changes across diverse codebases."
              style={presetToStyle("medium", showBorder)}
            />
            <StatCard
              label="Consistency"
              value={10}
              maxValue={10}
              detail="310 out of 365 days active. Strong sustained engagement over the full evaluation period."
              style={presetToStyle("medium", showBorder)}
            />
          </div>

          {/* Confidence row */}
          <div
            className="mt-4 rounded-2xl p-5"
            style={presetToStyle("amber", showBorder)}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-text-primary">
                Confidence
              </span>
              <span className="font-heading text-lg font-bold text-amber">
                92%
              </span>
            </div>
            <p className="mt-2 text-xs text-text-secondary leading-relaxed">
              High confidence. Public profile with consistent activity across
              multiple organizations. Contribution graph aligns with PR merge
              dates.
            </p>
          </div>
        </section>

        {/* ============================================ */}
        {/*  Section 4: Interactive Controls             */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Playground
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Customize the Glass
          </h2>

          <div className="grid gap-8 sm:grid-cols-2">
            {/* Controls panel */}
            <div className="flex flex-col gap-6 rounded-2xl border border-warm-stroke bg-warm-card/50 p-6">
              <h3 className="font-heading text-lg font-bold text-text-primary">
                Controls
              </h3>

              <Slider
                label="Blur amount"
                value={blur}
                min={0}
                max={40}
                step={1}
                unit="px"
                onChange={setBlur}
              />

              <Slider
                label="Background opacity"
                value={opacity}
                min={0.1}
                max={0.9}
                step={0.05}
                unit=""
                onChange={setOpacity}
              />

              <Slider
                label="Saturation"
                value={saturation}
                min={100}
                max={200}
                step={5}
                unit="%"
                onChange={setSaturation}
              />

              <Toggle
                checked={showBlobs}
                onChange={setShowBlobs}
                label="Background blobs (essential for glass effect)"
              />

              <Toggle
                checked={showBorder}
                onChange={setShowBorder}
                label="Border visibility"
              />

              <button
                type="button"
                onClick={handleResetControls}
                className="mt-2 self-start rounded-full border border-warm-stroke px-5 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:bg-amber/[0.04] hover:text-text-primary"
              >
                Reset defaults
              </button>
            </div>

            {/* Live preview card */}
            <div className="flex flex-col gap-4">
              <h3 className="font-heading text-lg font-bold text-text-primary">
                Live Preview
              </h3>
              <div
                className="rounded-2xl p-6"
                style={glassStyle(dynamicConfig)}
              >
                <BadgeCard />
              </div>

              {/* CSS output */}
              <div className="rounded-xl border border-warm-stroke bg-[#0d0b08] overflow-hidden">
                {/* Terminal header */}
                <div className="flex items-center gap-2 border-b border-warm-stroke px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-amber/20" />
                  <div className="h-3 w-3 rounded-full bg-amber/10" />
                  <div className="h-3 w-3 rounded-full bg-amber/[0.06]" />
                  <span className="ml-2 text-xs text-text-secondary">
                    Generated CSS
                  </span>
                </div>
                <pre className="overflow-x-auto p-4 font-heading text-xs leading-relaxed text-text-secondary">
                  <code>{`.glass-custom {
  background: rgba(19, 20, 30, ${opacity});
  backdrop-filter: blur(${blur}px) saturate(${saturation}%);
  -webkit-backdrop-filter: blur(${blur}px) saturate(${saturation}%);${
    showBorder
      ? `\n  border: 1px solid rgba(124, 106, 239, 0.15);`
      : ""
  }
}`}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/*  Observations section                        */}
        {/* ============================================ */}
        <section className="mb-16">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Findings
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Key Observations
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Blobs Are Essential",
                body: "Without colorful background elements, glass cards look identical to regular dark cards. The frosted effect is only visible when there is color variance behind the glass.",
              },
              {
                title: "Blur Sweet Spot: 16-24px",
                body: "Below 12px the frost is barely visible. Above 30px it becomes too opaque and defeats the purpose. The 16-24px range gives the best balance.",
              },
              {
                title: "Saturation Amplifies Warmth",
                body: "Increasing saturation above 120% makes the amber blobs more vivid through the glass, reinforcing the warm amber brand identity.",
              },
              {
                title: "Border Matters More Than Expected",
                body: "Without a border, glass panels blend into each other and lose definition. Even a subtle 12% opacity amber border creates essential edge contrast.",
              },
            ].map((finding) => (
              <div
                key={finding.title}
                className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6"
              >
                <h3 className="font-heading mb-2 text-sm font-bold text-text-primary">
                  {finding.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {finding.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/"
            className="rounded-full border border-warm-stroke px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:bg-amber/[0.04] hover:text-text-primary"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
