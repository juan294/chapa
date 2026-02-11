"use client";

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Intensity = "low" | "medium" | "high";
type ColorVariant = "amber" | "amber-white" | "amber-deep";
type Speed = "slow" | "medium" | "fast";

/* ------------------------------------------------------------------ */
/*  Aurora Background                                                  */
/* ------------------------------------------------------------------ */

const INTENSITY_OPACITY: Record<Intensity, string> = {
  low: "opacity-[0.03]",
  medium: "opacity-[0.06]",
  high: "opacity-[0.10]",
};

const SPEED_DURATIONS: Record<Speed, { a1: string; a2: string; a3: string }> = {
  slow: { a1: "25s", a2: "30s", a3: "35s" },
  medium: { a1: "15s", a2: "20s", a3: "25s" },
  fast: { a1: "8s", a2: "10s", a3: "12s" },
};

const COLOR_BLOBS: Record<ColorVariant, [string, string, string]> = {
  amber: ["#7C6AEF", "#9D8FFF", "#5E4FCC"],
  "amber-white": ["#7C6AEF", "#9D8FFF", "#E0DBFF"],
  "amber-deep": ["#7C6AEF", "#9D8FFF", "#3D2F8C"],
};

function AuroraBackground({
  intensity = "medium",
  colorVariant = "amber",
  speed = "medium",
}: {
  intensity?: Intensity;
  colorVariant?: ColorVariant;
  speed?: Speed;
}) {
  const opacity = INTENSITY_OPACITY[intensity];
  const durations = SPEED_DURATIONS[speed];
  const [c1, c2, c3] = COLOR_BLOBS[colorVariant];

  return (
    <>
      <style>{`
        @keyframes aurora-1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(150px, -80px) rotate(45deg); }
          50% { transform: translate(80px, 120px) rotate(90deg); }
          75% { transform: translate(-60px, 60px) rotate(135deg); }
        }
        @keyframes aurora-2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-120px, 80px) rotate(-60deg); }
          66% { transform: translate(60px, -100px) rotate(-120deg); }
        }
        @keyframes aurora-3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.3) rotate(30deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .aurora-blob { animation: none !important; }
        }
      `}</style>

      <div
        className="fixed inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        {/* Blob 1 -- top left */}
        <div
          className={`aurora-blob absolute -top-[200px] -left-[200px] w-[600px] h-[600px] rounded-full ${opacity} will-change-transform`}
          style={{
            backgroundColor: c1,
            filter: "blur(150px)",
            animation: `aurora-1 ${durations.a1} ease-in-out infinite`,
          }}
        />
        {/* Blob 2 -- bottom right */}
        <div
          className={`aurora-blob absolute -bottom-[200px] -right-[200px] w-[500px] h-[500px] rounded-full ${opacity} will-change-transform`}
          style={{
            backgroundColor: c2,
            filter: "blur(120px)",
            animation: `aurora-2 ${durations.a2} ease-in-out infinite`,
          }}
        />
        {/* Blob 3 -- center */}
        <div
          className={`aurora-blob absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full ${opacity} will-change-transform`}
          style={{
            backgroundColor: c3,
            filter: "blur(180px)",
            animation: `aurora-3 ${durations.a3} ease-in-out infinite`,
          }}
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock Badge Card                                                    */
/* ------------------------------------------------------------------ */

function MockHeatmapGrid() {
  // 7 rows x 13 cols = 91 cells (roughly 13 weeks)
  // Deterministic pseudo-random values (seeded) to avoid impure render
  const cells: number[] = [];
  let seed = 42;
  for (let i = 0; i < 91; i++) {
    seed = (seed * 16807 + 0) % 2147483647;
    cells.push(seed / 2147483647);
  }

  return (
    <div
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: "repeat(13, 1fr)" }}
      aria-label="Activity heatmap"
    >
      {cells.map((v, i) => {
        let bg: string;
        if (v < 0.2) bg = "bg-[#7C6AEF]/5";
        else if (v < 0.4) bg = "bg-[#7C6AEF]/15";
        else if (v < 0.6) bg = "bg-[#7C6AEF]/30";
        else if (v < 0.8) bg = "bg-[#7C6AEF]/50";
        else bg = "bg-[#7C6AEF]/80";

        return (
          <div
            key={i}
            className={`w-[10px] h-[10px] rounded-[2px] ${bg}`}
          />
        );
      })}
    </div>
  );
}

function MockBadgeCard() {
  return (
    <div className="relative rounded-2xl border border-[rgba(124,106,239,0.12)] bg-[#13141E]/80 backdrop-blur-sm p-8 w-full max-w-[560px]">
      {/* Top shimmer edge */}
      <div className="absolute top-0 left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-[#7C6AEF]/40 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#7C6AEF]/20 flex items-center justify-center">
            <span className="text-[#7C6AEF] font-heading text-sm font-bold">
              JD
            </span>
          </div>
          <div>
            <p className="font-heading text-sm font-medium text-[#E6EDF3]">
              @juandeveloper
            </p>
            <p className="text-xs text-[#9AA4B2]">Last 90 days</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading text-2xl font-bold text-[#7C6AEF]">76</p>
          <p className="text-xs text-[#9AA4B2] uppercase tracking-wider">
            Impact
          </p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="mb-6">
        <MockHeatmapGrid />
      </div>

      {/* Tier badge */}
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center rounded-full bg-[#7C6AEF]/10 border border-[#7C6AEF]/20 px-3 py-1 text-xs font-semibold text-[#7C6AEF] uppercase tracking-wider">
          Standout
        </span>
        <span className="text-xs text-[#9AA4B2]">
          Confidence: <span className="text-[#E6EDF3]">82%</span>
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Commits", value: "247" },
          { label: "PRs Merged", value: "18" },
          { label: "Reviews", value: "32" },
          { label: "Issues", value: "14" },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="font-heading text-lg font-bold text-[#E6EDF3]">
              {stat.value}
            </p>
            <p className="text-[10px] text-[#9AA4B2] uppercase tracking-wider">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Control Panel                                                      */
/* ------------------------------------------------------------------ */

function ControlGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-xs text-[#9AA4B2] uppercase tracking-wider mb-2 font-body">
        {label}
      </p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              value === opt.value
                ? "bg-[#7C6AEF] text-[#0C0D14]"
                : "border border-[rgba(124,106,239,0.12)] text-[#9AA4B2] hover:border-[#7C6AEF]/20 hover:text-[#E6EDF3] hover:bg-[#7C6AEF]/[0.04]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AuroraExperimentPage() {
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [colorVariant, setColorVariant] = useState<ColorVariant>("amber");
  const [speed, setSpeed] = useState<Speed>("medium");

  return (
    <div className="relative min-h-screen bg-[#0C0D14]">
      {/* Aurora effect — always behind everything */}
      <AuroraBackground
        intensity={intensity}
        colorVariant={colorVariant}
        speed={speed}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="pt-12 pb-8 px-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-[#7C6AEF] text-sm tracking-widest uppercase mb-3 font-body">
              Experiment #48
            </p>
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-[#E6EDF3] tracking-tight mb-3">
              Aurora Borealis <span className="text-[#7C6AEF]">Background</span>
            </h1>
            <p className="text-[#9AA4B2] text-lg leading-relaxed max-w-2xl font-body">
              Large, slowly drifting amber glow blobs creating a living,
              atmospheric backdrop behind the badge card.
            </p>
          </div>
        </header>

        {/* Controls */}
        <section className="px-6 pb-12">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-[rgba(124,106,239,0.12)] bg-[#13141E]/60 backdrop-blur-sm p-6">
              <h2 className="font-heading text-lg font-bold text-[#E6EDF3] tracking-tight mb-5">
                Controls
              </h2>
              <div className="flex flex-wrap gap-8">
                <ControlGroup
                  label="Intensity"
                  value={intensity}
                  onChange={setIntensity}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                  ]}
                />
                <ControlGroup
                  label="Color Variant"
                  value={colorVariant}
                  onChange={setColorVariant}
                  options={[
                    { value: "amber", label: "Amber Only" },
                    { value: "amber-white", label: "Amber + White" },
                    { value: "amber-deep", label: "Amber + Deep" },
                  ]}
                />
                <ControlGroup
                  label="Speed"
                  value={speed}
                  onChange={setSpeed}
                  options={[
                    { value: "slow", label: "Slow" },
                    { value: "medium", label: "Medium" },
                    { value: "fast", label: "Fast" },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Badge card showcase */}
        <section className="px-6 pb-24">
          <div className="max-w-4xl mx-auto">
            <p className="text-[#7C6AEF] text-sm tracking-widest uppercase mb-4 font-body">
              Badge Preview
            </p>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#E6EDF3] tracking-tight mb-8">
              Card on Aurora
            </h2>
            <div className="flex justify-center">
              <MockBadgeCard />
            </div>
          </div>
        </section>

        {/* Aurora-only section (no badge card) */}
        <section className="px-6 pb-24">
          <div className="max-w-4xl mx-auto">
            <p className="text-[#7C6AEF] text-sm tracking-widest uppercase mb-4 font-body">
              Effect Only
            </p>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#E6EDF3] tracking-tight mb-8">
              Aurora Without Card
            </h2>
            <div className="relative rounded-2xl border border-[rgba(124,106,239,0.12)] overflow-hidden h-[400px] bg-[#0C0D14]">
              {/* Local aurora inside this box */}
              <AuroraBackgroundLocal
                intensity={intensity}
                colorVariant={colorVariant}
                speed={speed}
              />
              {/* Centered label */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <p className="text-[#9AA4B2] text-sm font-body tracking-wider uppercase">
                  Aurora effect in isolation
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Implementation notes */}
        <section className="px-6 pb-24">
          <div className="max-w-4xl mx-auto">
            <p className="text-[#7C6AEF] text-sm tracking-widest uppercase mb-4 font-body">
              Notes
            </p>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#E6EDF3] tracking-tight mb-6">
              Implementation Details
            </h2>
            <div className="rounded-2xl border border-[rgba(124,106,239,0.12)] bg-[#13141E]/60 p-6 space-y-4">
              <DetailRow
                title="Performance"
                text="3 blobs with CSS blur + will-change: transform for GPU compositing. No JS animation loop."
              />
              <DetailRow
                title="Accessibility"
                text="Blobs are aria-hidden, pointer-events: none. prefers-reduced-motion disables all animations."
              />
              <DetailRow
                title="Self-contained"
                text="No globals.css changes. Keyframes defined via inline <style> tag. Zero extra dependencies."
              />
              <DetailRow
                title="Bleed-through"
                text="Card uses bg-[#13141E]/80 + backdrop-blur-sm so the aurora subtly shows through."
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Aurora (position: absolute, contained in a parent)                 */
/* ------------------------------------------------------------------ */

function AuroraBackgroundLocal({
  intensity = "medium",
  colorVariant = "amber",
  speed = "medium",
}: {
  intensity?: Intensity;
  colorVariant?: ColorVariant;
  speed?: Speed;
}) {
  const opacity = INTENSITY_OPACITY[intensity];
  const durations = SPEED_DURATIONS[speed];
  const [c1, c2, c3] = COLOR_BLOBS[colorVariant];

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <div
        className={`aurora-blob absolute -top-[100px] -left-[100px] w-[400px] h-[400px] rounded-full ${opacity} will-change-transform`}
        style={{
          backgroundColor: c1,
          filter: "blur(100px)",
          animation: `aurora-1 ${durations.a1} ease-in-out infinite`,
        }}
      />
      <div
        className={`aurora-blob absolute -bottom-[100px] -right-[100px] w-[350px] h-[350px] rounded-full ${opacity} will-change-transform`}
        style={{
          backgroundColor: c2,
          filter: "blur(80px)",
          animation: `aurora-2 ${durations.a2} ease-in-out infinite`,
        }}
      />
      <div
        className={`aurora-blob absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full ${opacity} will-change-transform`}
        style={{
          backgroundColor: c3,
          filter: "blur(120px)",
          animation: `aurora-3 ${durations.a3} ease-in-out infinite`,
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Row                                                         */
/* ------------------------------------------------------------------ */

function DetailRow({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-heading text-sm font-bold text-[#7C6AEF] mb-1">
        {title}
      </h3>
      <p className="text-sm text-[#9AA4B2] leading-relaxed font-body">
        {text}
      </p>
    </div>
  );
}
