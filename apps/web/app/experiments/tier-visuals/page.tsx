"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MOCK_STATS, MOCK_IMPACT } from "../__fixtures__/mock-data";

/* ══════════════════════════════════════════════════════════════
   Experiment #47 — Tier-Specific Progressive Visual Treatment
   Shows 4 badge cards with escalating premium visual effects
   for each tier: Emerging, Solid, High, Elite.
   ══════════════════════════════════════════════════════════════ */

/* ── Tier definitions ─────────────────────────────────────── */

type TierName = "Emerging" | "Solid" | "High" | "Elite";

interface TierData {
  tier: TierName;
  score: number;
  handle: string;
  stars: string;
  forks: number;
  watchers: number;
  heatmapDensity: number;
}

const TIERS: TierData[] = [
  {
    tier: "Emerging",
    score: 32,
    handle: "@newdev",
    stars: "12",
    forks: 2,
    watchers: 1,
    heatmapDensity: 0.15,
  },
  {
    tier: "Solid",
    score: 62,
    handle: "@steadycoder",
    stars: "234",
    forks: 18,
    watchers: 8,
    heatmapDensity: 0.4,
  },
  {
    tier: "High",
    score: 81,
    handle: "@probuilder",
    stars: "890",
    forks: 45,
    watchers: 19,
    heatmapDensity: 0.65,
  },
  {
    tier: "Elite",
    score: MOCK_IMPACT.adjustedComposite,
    handle: `@${MOCK_STATS.handle}`,
    stars: `${(MOCK_STATS.totalStars / 1000).toFixed(1)}k`,
    forks: MOCK_STATS.totalForks,
    watchers: MOCK_STATS.totalWatchers,
    heatmapDensity: 0.85,
  },
];

/* ── Heatmap generation ───────────────────────────────────── */

const HEATMAP_COLS = 13;
const HEATMAP_ROWS = 7;

function generateHeatmap(density: number): number[][] {
  return Array.from({ length: HEATMAP_COLS }, (_, w) =>
    Array.from({ length: HEATMAP_ROWS }, (_, d) => {
      const seed = ((w * 7 + d) * 2654435761) >>> 0;
      return (seed % 100) < density * 100
        ? Math.min(4, Math.floor((seed % 20) / Math.max(1, 5 - density * 4)))
        : 0;
    }),
  );
}

function heatmapColor(level: number, tier: TierName): string {
  if (tier === "Emerging") {
    const colors = [
      "rgba(154,164,178,0.04)",
      "rgba(154,164,178,0.15)",
      "rgba(154,164,178,0.30)",
      "rgba(154,164,178,0.50)",
      "rgba(154,164,178,0.75)",
    ];
    return colors[level] ?? colors[0]!;
  }
  if (tier === "Solid") {
    const colors = [
      "rgba(230,237,243,0.04)",
      "rgba(230,237,243,0.15)",
      "rgba(230,237,243,0.30)",
      "rgba(230,237,243,0.50)",
      "rgba(230,237,243,0.75)",
    ];
    return colors[level] ?? colors[0]!;
  }
  // High and Elite use amber
  const colors = [
    "rgba(124,106,239,0.04)",
    "rgba(124,106,239,0.18)",
    "rgba(124,106,239,0.35)",
    "rgba(124,106,239,0.60)",
    "rgba(124,106,239,0.90)",
  ];
  return colors[level] ?? colors[0]!;
}

/* ── Tier visual config ───────────────────────────────────── */

function tierPillClasses(tier: TierName): string {
  switch (tier) {
    case "Emerging":
      return "bg-[rgba(154,164,178,0.08)] border-[rgba(154,164,178,0.20)] text-text-secondary";
    case "Solid":
      return "bg-[rgba(230,237,243,0.06)] border-[rgba(230,237,243,0.20)] text-text-primary";
    case "High":
      return "bg-amber/10 border-amber/25 text-amber";
    case "Elite":
      return "tier-elite-pill border-amber/30 text-[#0C0D14] font-bold";
  }
}

function tierLabel(tier: TierName): string {
  switch (tier) {
    case "Emerging":
      return "EMERGING";
    case "Solid":
      return "SOLID";
    case "High":
      return "HIGH";
    case "Elite":
      return "ELITE";
  }
}

/* ── Sparkle dot component (Elite only) ───────────────────── */

function SparkleDots() {
  return (
    <>
      <div
        className="sparkle-dot absolute w-1 h-1 rounded-full bg-[#9D8FFF]"
        style={{ top: "12%", right: "8%", animationDelay: "0s" }}
        aria-hidden="true"
      />
      <div
        className="sparkle-dot absolute w-[3px] h-[3px] rounded-full bg-[#7C6AEF]"
        style={{ bottom: "18%", left: "6%", animationDelay: "0.7s" }}
        aria-hidden="true"
      />
      <div
        className="sparkle-dot absolute w-1 h-1 rounded-full bg-[#9D8FFF]"
        style={{ top: "45%", right: "3%", animationDelay: "1.4s" }}
        aria-hidden="true"
      />
    </>
  );
}

/* ── Badge card component ─────────────────────────────────── */

interface BadgeCardProps {
  data: TierData;
  /** Override score for animated transitions */
  scoreOverride?: number;
  /** Override tier for animated transitions */
  tierOverride?: TierName;
}

function BadgeCard({ data, scoreOverride, tierOverride }: BadgeCardProps) {
  const activeTier = tierOverride ?? data.tier;
  const activeScore = scoreOverride ?? data.score;
  const heatmap = generateHeatmap(data.heatmapDensity);

  return (
    <div className="relative">
      {/* Tier label above card */}
      <div className="text-center mb-3">
        <span
          className={`text-xs tracking-[0.2em] font-semibold font-heading ${
            activeTier === "Emerging"
              ? "text-text-secondary"
              : activeTier === "Solid"
                ? "text-text-primary/70"
                : "text-amber"
          }`}
        >
          {tierLabel(activeTier)}
        </span>
      </div>

      {/* Card wrapper with tier-specific border/glow */}
      <div
        className={`tier-card tier-card-${activeTier.toLowerCase()} relative rounded-2xl`}
      >
        {/* Elite: animated border pseudo-element */}
        {activeTier === "Elite" && (
          <div
            className="elite-border-glow absolute -inset-[2px] rounded-[18px] pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Elite: sparkle dots */}
        {activeTier === "Elite" && <SparkleDots />}

        {/* High: warm ambient glow behind card */}
        {activeTier === "High" && (
          <div
            className="absolute -inset-4 rounded-3xl bg-amber/[0.04] blur-[20px] pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Card body */}
        <div className="relative z-10 rounded-2xl bg-[#13141E] p-4 sm:p-5 w-full aspect-[1200/630] flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="font-heading text-[10px] sm:text-xs text-text-secondary truncate">
              {data.handle}
            </span>
            <span className="font-heading text-[10px] sm:text-xs font-bold text-amber">
              Chapa.
            </span>
          </div>

          {/* Main: heatmap + score */}
          <div className="flex-1 flex items-center gap-3 sm:gap-5 py-2 sm:py-3">
            {/* Heatmap grid */}
            <div className="flex-1 min-w-0">
              <div
                className="grid gap-[1.5px] sm:gap-[2px]"
                style={{
                  gridTemplateColumns: `repeat(${HEATMAP_COLS}, 1fr)`,
                  gridTemplateRows: `repeat(${HEATMAP_ROWS}, 1fr)`,
                }}
                role="img"
                aria-label={`Activity heatmap for ${data.handle}`}
              >
                {heatmap.flat().map((level, i) => (
                  <div
                    key={i}
                    className="rounded-[1.5px] sm:rounded-[2px] aspect-square"
                    style={{ backgroundColor: heatmapColor(level, activeTier) }}
                  />
                ))}
              </div>
            </div>

            {/* Score + tier pill */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <span
                className={`font-heading text-2xl sm:text-3xl md:text-4xl font-extrabold leading-none tier-score tier-score-${activeTier.toLowerCase()}`}
              >
                {Math.round(activeScore)}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase ${tierPillClasses(activeTier)}`}
              >
                {activeTier}
              </span>
            </div>
          </div>

          {/* Footer stats */}
          <div className="flex items-center gap-1.5 sm:gap-3 text-text-secondary text-[8px] sm:text-[10px] font-medium">
            <span>{data.stars} stars</span>
            <span className="text-amber/30" aria-hidden="true">|</span>
            <span>{data.forks} forks</span>
            <span className="text-amber/30" aria-hidden="true">|</span>
            <span>{data.watchers} watchers</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tier transition demo ─────────────────────────────────── */

function TierTransitionDemo() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayScore, setDisplayScore] = useState(TIERS[0]!.score);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const currentTier = TIERS[currentIndex]!;

  // Animate score counting
  const animateScore = useCallback((from: number, to: number) => {
    const duration = 600;
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(from + (to - from) * eased);
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  const goToTier = useCallback(
    (index: number) => {
      const prevScore = TIERS[currentIndex]!.score;
      setCurrentIndex(index);
      animateScore(prevScore, TIERS[index]!.score);
    },
    [currentIndex, animateScore],
  );

  // Auto-play cycle
  useEffect(() => {
    if (!isAutoPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % TIERS.length;
        animateScore(TIERS[prev]!.score, TIERS[next]!.score);
        return next;
      });
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAutoPlaying, animateScore]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <section className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary tracking-tight mb-2">
          Tier Transition Demo
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          Watch the card morph between tiers. Score animates, border effects
          transition, and visual treatment upgrades progressively.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {TIERS.map((t, i) => (
          <button
            key={t.tier}
            onClick={() => {
              setIsAutoPlaying(false);
              goToTier(i);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              currentIndex === i
                ? "bg-amber text-[#0C0D14]"
                : "border border-warm-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary"
            }`}
          >
            {t.tier}
          </button>
        ))}
        <button
          onClick={() => setIsAutoPlaying((v) => !v)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ml-auto ${
            isAutoPlaying
              ? "bg-amber/15 text-amber border border-amber/25"
              : "border border-warm-stroke text-text-secondary hover:border-amber/20"
          }`}
        >
          {isAutoPlaying ? "Auto-cycling" : "Auto-play off"}
        </button>
      </div>

      {/* Transition card */}
      <div className="flex justify-center">
        <div className="w-full max-w-lg transition-all duration-500">
          <BadgeCard
            data={currentTier}
            scoreOverride={displayScore}
            tierOverride={currentTier.tier}
          />
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mt-6">
        {TIERS.map((t, i) => (
          <div
            key={t.tier}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              currentIndex === i
                ? "w-8 bg-amber"
                : "w-1.5 bg-warm-stroke"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </section>
  );
}

/* ── Visual escalation summary ────────────────────────────── */

const ESCALATION_ROWS: {
  tier: TierName;
  features: string[];
}[] = [
  {
    tier: "Emerging",
    features: [
      "Gray muted tones",
      "Static border",
      "No animations",
      "Simple fade-in",
    ],
  },
  {
    tier: "Solid",
    features: [
      "White/silver accents",
      "Subtle text shadow",
      "Clean static border",
      "Professional presence",
    ],
  },
  {
    tier: "High",
    features: [
      "Gold gradient score text",
      "Amber glow border",
      "Warm ambient light",
      "Premium warmth",
    ],
  },
  {
    tier: "Elite",
    features: [
      "Animated gold shimmer on score",
      "Rotating gradient border",
      "Sparkle accents",
      "Outer glow aura",
    ],
  },
];

function EscalationSummary() {
  return (
    <section className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary tracking-tight mb-2">
          Visual Escalation
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          Each tier adds progressive visual treatment. Higher tiers feel
          noticeably more premium and aspirational.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ESCALATION_ROWS.map((row, i) => {
          const isAmber = row.tier === "High" || row.tier === "Elite";
          const tierColor = row.tier === "Emerging"
            ? "text-text-secondary"
            : row.tier === "Solid"
              ? "text-text-primary"
              : "text-amber";
          const borderColor = row.tier === "Emerging"
            ? "border-[rgba(154,164,178,0.15)]"
            : row.tier === "Solid"
              ? "border-[rgba(230,237,243,0.12)]"
              : "border-amber/20";
          const bgColor = row.tier === "Elite"
            ? "bg-amber/[0.04]"
            : row.tier === "High"
              ? "bg-amber/[0.02]"
              : "bg-warm-card/30";

          return (
            <div
              key={row.tier}
              className={`rounded-xl border ${borderColor} ${bgColor} p-5`}
            >
              {/* Arrow connector */}
              {i > 0 && (
                <div className="hidden lg:block absolute -left-3 top-1/2 -translate-y-1/2 text-text-secondary/30" aria-hidden="true">
                </div>
              )}
              <p className={`${tierColor} font-bold font-heading text-base mb-1`}>
                {row.tier}
              </p>
              <p className="text-text-secondary text-[10px] mb-3">
                {row.tier === "Emerging"
                  ? "Score < 50"
                  : row.tier === "Solid"
                    ? "Score 50-74"
                    : row.tier === "High"
                      ? "Score 75-89"
                      : "Score 90+"}
              </p>
              <ul className="space-y-1.5">
                {row.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-text-secondary">
                    <span
                      className={`mt-1.5 block w-1 h-1 rounded-full shrink-0 ${
                        isAmber ? "bg-amber/60" : "bg-text-secondary/40"
                      }`}
                      aria-hidden="true"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Arrow progression */}
      <div className="mt-6 flex items-center justify-center gap-2 text-text-secondary/40">
        <span className="text-text-secondary text-xs">Understated</span>
        <svg width="120" height="12" viewBox="0 0 120 12" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="arrow-grad" x1="0" y1="6" x2="120" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#9AA4B2" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#7C6AEF" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <line x1="0" y1="6" x2="112" y2="6" stroke="url(#arrow-grad)" strokeWidth="1.5" />
          <polygon points="112,2 120,6 112,10" fill="#7C6AEF" fillOpacity="0.8" />
        </svg>
        <span className="text-amber text-xs font-semibold">Aspirational</span>
      </div>
    </section>
  );
}

/* ── Main page ────────────────────────────────────────────── */

export default function TierVisualsExperimentPage() {
  return (
    <>
      {/* Inline styles for tier-specific effects */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
/* ── Tier score text treatments ───────────────── */

/* Emerging: muted gray */
.tier-score-emerging {
  color: #9AA4B2;
}

/* Solid: white with subtle text shadow for depth */
.tier-score-solid {
  color: #E6EDF3;
  text-shadow: 0 1px 8px rgba(230,237,243,0.15);
}

/* High: static gold gradient text */
.tier-score-high {
  background: linear-gradient(135deg, #5E4FCC, #7C6AEF, #9D8FFF, #7C6AEF, #5E4FCC);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Elite: animated gold shimmer text */
.tier-score-elite {
  background: linear-gradient(
    90deg,
    #5E4FCC,
    #7C6AEF,
    #A99BFF,
    #D0C9FF,
    #A99BFF,
    #7C6AEF,
    #5E4FCC
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: tier-shimmer 3s ease-in-out infinite;
}

@keyframes tier-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Tier card border treatments ──────────────── */

/* Emerging: subtle gray static border */
.tier-card-emerging {
  border: 1px solid rgba(154,164,178,0.15);
}

/* Solid: subtle white static border */
.tier-card-solid {
  border: 1px solid rgba(230,237,243,0.12);
}

/* High: amber glow border */
.tier-card-high {
  border: 1px solid rgba(124,106,239,0.18);
  box-shadow: 0 0 20px rgba(124,106,239,0.10), 0 0 40px rgba(124,106,239,0.04);
}

/* Elite: outer glow only (border handled by pseudo-element) */
.tier-card-elite {
  box-shadow:
    0 0 40px rgba(124,106,239,0.15),
    0 0 80px rgba(124,106,239,0.05);
}

/* ── Elite animated gradient border ───────────── */

@property --elite-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.elite-border-glow {
  background: conic-gradient(
    from var(--elite-angle),
    #5E4FCC,
    #7C6AEF,
    #9D8FFF,
    #7C6AEF,
    #5E4FCC,
    #7C6AEF,
    #9D8FFF,
    #7C6AEF,
    #5E4FCC
  );
  animation: elite-border-rotate 4s linear infinite;
  filter: blur(3px);
  opacity: 0.7;
}

@keyframes elite-border-rotate {
  0% { --elite-angle: 0deg; }
  100% { --elite-angle: 360deg; }
}

/* Fallback for browsers without @property */
@supports not (background: conic-gradient(from var(--elite-angle), red, blue)) {
  .elite-border-glow {
    background: linear-gradient(90deg, #5E4FCC, #7C6AEF, #9D8FFF, #7C6AEF, #5E4FCC);
    background-size: 300% 300%;
    animation: elite-border-fallback 3s ease infinite;
    filter: blur(3px);
    opacity: 0.7;
  }

  @keyframes elite-border-fallback {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
}

/* ── Elite tier pill gradient ─────────────────── */

.tier-elite-pill {
  background: linear-gradient(135deg, #5E4FCC, #7C6AEF, #9D8FFF);
}

/* ── Sparkle dots ─────────────────────────────── */

.sparkle-dot {
  animation: sparkle-pulse 2s ease-in-out infinite;
}

@keyframes sparkle-pulse {
  0%, 100% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.2);
  }
}

/* ── Reduced motion ───────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .tier-score-elite {
    animation: none !important;
    background-position: 0% 0%;
  }

  .elite-border-glow {
    animation: none !important;
    background: conic-gradient(
      from 45deg,
      #5E4FCC,
      #7C6AEF,
      #9D8FFF,
      #7C6AEF,
      #5E4FCC
    );
  }

  .sparkle-dot {
    animation: none !important;
    opacity: 0.5;
    transform: scale(1);
  }
}
          `,
        }}
      />

      <div className="min-h-screen bg-bg bg-grid-warm">
        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-1/4 -left-32 h-[500px] w-[500px] rounded-full bg-amber/[0.03] blur-[150px]" />
          <div className="absolute bottom-1/3 -right-32 h-[400px] w-[400px] rounded-full bg-amber/[0.04] blur-[120px]" />
        </div>

        <main className="relative z-10 mx-auto max-w-7xl px-6 py-16 sm:py-24">
          {/* Header */}
          <header className="mb-12 sm:mb-16 max-w-3xl animate-fade-in-up">
            <p className="text-amber text-sm tracking-widest uppercase mb-4 font-semibold">
              Experiment #47
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-heading text-text-primary tracking-tight mb-4">
              Tier-Specific{" "}
              <span className="text-amber">Visual Treatment</span>
            </h1>
            <p className="text-text-secondary text-base sm:text-lg leading-relaxed">
              Progressive visual escalation across four tiers. Higher tiers earn
              more premium effects. Emerging is clean and professional. Elite is
              extraordinary, jewel-like, alive. The goal: when you see an Elite
              badge, you want to earn one.
            </p>
          </header>

          {/* ── Section 1: Four-card showcase ──────────────── */}
          <section className="mb-16 sm:mb-20 animate-fade-in-up [animation-delay:200ms]">
            <div className="mb-8">
              <p className="text-amber text-sm tracking-widest uppercase mb-2 font-medium">
                Showcase
              </p>
              <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary tracking-tight">
                All Four Tiers
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 sm:gap-8">
              {TIERS.map((data) => (
                <BadgeCard key={data.tier} data={data} />
              ))}
            </div>
          </section>

          {/* ── Section 2: Tier transition demo ────────────── */}
          <div className="mb-16 sm:mb-20 animate-fade-in-up [animation-delay:400ms]">
            <TierTransitionDemo />
          </div>

          {/* ── Section 3: Visual escalation summary ───────── */}
          <div className="mb-16 sm:mb-20 animate-fade-in-up [animation-delay:600ms]">
            <EscalationSummary />
          </div>

          {/* ── Implementation notes ───────────────────────── */}
          <section className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6 sm:p-8 animate-fade-in-up [animation-delay:800ms]">
            <h2 className="text-lg sm:text-xl font-bold font-heading text-text-primary tracking-tight mb-4">
              Implementation Notes
            </h2>
            <ul className="space-y-3 text-sm text-text-secondary leading-relaxed">
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">1.</span>
                <span>
                  <strong className="text-text-primary">Pure CSS effects</strong>{" "}
                  &mdash; All visual treatments use CSS only. No external animation
                  libraries. Elite border uses{" "}
                  <code className="font-heading text-amber/70 text-xs">@property</code>{" "}
                  for smooth conic-gradient rotation with a linear-gradient fallback.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">2.</span>
                <span>
                  <strong className="text-text-primary">Progressive treatment</strong>{" "}
                  &mdash; Emerging (gray, static) &rarr; Solid (white, shadow depth) &rarr;
                  High (gold gradient, warm glow) &rarr; Elite (shimmer, rotating
                  border, sparkles, outer glow). Each step is a clear visual upgrade.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">3.</span>
                <span>
                  <strong className="text-text-primary">Score animation</strong>{" "}
                  &mdash; Tier transition uses{" "}
                  <code className="font-heading text-amber/70 text-xs">requestAnimationFrame</code>{" "}
                  with cubic ease-out for smooth score counting between tiers.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">4.</span>
                <span>
                  <strong className="text-text-primary">Accessibility</strong>{" "}
                  &mdash; All animations respect{" "}
                  <code className="font-heading text-amber/70 text-xs">prefers-reduced-motion</code>.
                  Decorative elements have{" "}
                  <code className="font-heading text-amber/70 text-xs">aria-hidden</code>.
                  Heatmaps have descriptive aria labels.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">5.</span>
                <span>
                  <strong className="text-text-primary">Heatmap density</strong>{" "}
                  &mdash; Each tier generates deterministic heatmap data with
                  different fill densities. Elite has dense activity, Emerging is
                  sparse. Color palette shifts per tier (gray &rarr; white &rarr; amber).
                </span>
              </li>
            </ul>
          </section>

          {/* Footer */}
          <footer className="mt-12 text-center text-text-secondary text-sm">
            <p>
              Experiment #47 &middot;{" "}
              <span className="text-amber font-medium">Pure CSS</span>{" "}
              &middot; prefers-reduced-motion supported
            </p>
          </footer>
        </main>
      </div>
    </>
  );
}
