"use client";

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Effect types                                                       */
/* ------------------------------------------------------------------ */

type EffectName =
  | "gold-leaf"
  | "chrome"
  | "embossed"
  | "debossed"
  | "gold-shimmer"
  | "neon-amber"
  | "sparkle";

interface EffectInfo {
  key: EffectName;
  label: string;
  description: string;
}

const EFFECTS: EffectInfo[] = [
  {
    key: "gold-leaf",
    label: "Gold Leaf",
    description:
      "Rich warm gold gradient simulating hammered gold foil. Premium and classic.",
  },
  {
    key: "chrome",
    label: "Chrome / Silver",
    description:
      "Cool metallic silver for a polished, industrial feel. Contrasts the warm palette.",
  },
  {
    key: "embossed",
    label: "Embossed (Raised)",
    description:
      "Text appears to pop out of the surface using directional shadows.",
  },
  {
    key: "debossed",
    label: "Debossed (Pressed)",
    description:
      "Text appears pressed into the surface, like a letterpress stamp.",
  },
  {
    key: "gold-shimmer",
    label: "Gold Shimmer",
    description:
      "Animated highlight sweep across a gold gradient. Eye-catching hero effect.",
  },
  {
    key: "neon-amber",
    label: "Neon Glow",
    description:
      "Layered amber glow creating a soft neon sign effect on dark backgrounds.",
  },
  {
    key: "sparkle",
    label: "Sparkle Accents",
    description:
      "Pulsing sparkle characters orbit the text for a magical, celebratory feel.",
  },
];

/* ------------------------------------------------------------------ */
/*  Deterministic pseudo-random for heatmap                            */
/* ------------------------------------------------------------------ */

function pseudoRandom(seed: number): number {
  let x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  x = x - Math.floor(x);
  return x;
}

/* ------------------------------------------------------------------ */
/*  EffectText — renders text in the chosen material effect            */
/* ------------------------------------------------------------------ */

function EffectText({
  effect,
  children,
  className = "",
}: {
  effect: EffectName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`te-${effect} ${className}`} aria-label={String(children)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Effect card for the grid                                           */
/* ------------------------------------------------------------------ */

function EffectCard({ info }: { info: EffectInfo }) {
  return (
    <div className="rounded-2xl border border-[rgba(124,106,239,0.12)] bg-[#13141E] p-8 flex flex-col items-center text-center gap-5 transition-colors hover:border-[rgba(124,106,239,0.2)] hover:bg-[#13141E]">
      {/* Effect name label */}
      <p className="text-[#9AA4B2] text-xs tracking-widest uppercase font-semibold">
        {info.label}
      </p>

      {/* Score in effect */}
      <EffectText
        effect={info.key}
        className="font-heading text-6xl font-extrabold tracking-tight leading-none"
      >
        87
      </EffectText>

      {/* Tier in effect */}
      <EffectText
        effect={info.key}
        className="font-heading text-lg font-bold tracking-wide"
      >
        Elite
      </EffectText>

      {/* Label in effect */}
      <EffectText
        effect={info.key}
        className="font-heading text-xs font-medium tracking-[0.25em] uppercase"
      >
        IMPACT SCORE
      </EffectText>

      {/* Description */}
      <p className="text-[#9AA4B2] text-sm leading-relaxed mt-2">
        {info.description}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Comparison row                                                     */
/* ------------------------------------------------------------------ */

function ComparisonSection() {
  const compared: { label: string; effect: EffectName | "plain" }[] = [
    { label: "Plain", effect: "plain" },
    { label: "Gold Leaf", effect: "gold-leaf" },
    { label: "Chrome", effect: "chrome" },
    { label: "Embossed", effect: "embossed" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {compared.map(({ label, effect }) => (
        <div
          key={label}
          className="rounded-2xl border border-[rgba(124,106,239,0.12)] bg-[#13141E] p-6 flex flex-col items-center text-center gap-3"
        >
          <p className="text-[#9AA4B2] text-xs tracking-widest uppercase font-semibold">
            {label}
          </p>
          {effect === "plain" ? (
            <span className="font-heading text-5xl font-extrabold tracking-tight leading-none text-[#E6EDF3]">
              87
            </span>
          ) : (
            <EffectText
              effect={effect}
              className="font-heading text-5xl font-extrabold tracking-tight leading-none"
            >
              87
            </EffectText>
          )}
          {effect === "plain" ? (
            <span className="font-heading text-sm font-bold tracking-wide text-[#E6EDF3]">
              Elite
            </span>
          ) : (
            <EffectText
              effect={effect}
              className="font-heading text-sm font-bold tracking-wide"
            >
              Elite
            </EffectText>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Application preview — mock badge with mixed effects                */
/* ------------------------------------------------------------------ */

function ApplicationPreview() {
  return (
    <div className="rounded-2xl border border-[rgba(124,106,239,0.12)] bg-[#13141E] p-8 sm:p-10 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[rgba(124,106,239,0.15)] flex items-center justify-center">
            <span className="font-heading text-sm font-bold text-[#7C6AEF]">
              C
            </span>
          </div>
          <div>
            <EffectText
              effect="embossed"
              className="font-heading text-base font-bold block"
            >
              @devhero
            </EffectText>
            <p className="text-[#9AA4B2] text-xs">Dev Impact Badge</p>
          </div>
        </div>
        <EffectText
          effect="gold-leaf"
          className="font-heading text-sm font-bold"
        >
          Elite
        </EffectText>
      </div>

      {/* Score center */}
      <div className="text-center mb-6">
        <EffectText
          effect="gold-shimmer"
          className="font-heading text-7xl font-extrabold tracking-tight leading-none"
        >
          87
        </EffectText>
        <EffectText
          effect="embossed"
          className="font-heading text-xs font-medium tracking-[0.25em] uppercase block mt-3"
        >
          IMPACT SCORE
        </EffectText>
      </div>

      {/* Heatmap */}
      <div className="grid grid-cols-13 gap-[2px] mb-6">
        {Array.from({ length: 91 }).map((_, i) => {
          const intensity = pseudoRandom(i + 87);
          const bg =
            intensity > 0.7
              ? "bg-[#7C6AEF]"
              : intensity > 0.4
                ? "bg-[rgba(124,106,239,0.4)]"
                : intensity > 0.15
                  ? "bg-[rgba(124,106,239,0.15)]"
                  : "bg-[rgba(124,106,239,0.04)]";
          return (
            <div
              key={i}
              className={`w-2 h-2 rounded-[2px] ${bg}`}
              aria-hidden="true"
            />
          );
        })}
      </div>

      {/* Stats row */}
      <div className="flex justify-between text-xs">
        <EffectText
          effect="neon-amber"
          className="font-heading text-xs font-semibold"
        >
          1.2k stars
        </EffectText>
        <EffectText
          effect="neon-amber"
          className="font-heading text-xs font-semibold"
        >
          89 forks
        </EffectText>
        <EffectText
          effect="neon-amber"
          className="font-heading text-xs font-semibold"
        >
          34 watchers
        </EffectText>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Active effect selector                                             */
/* ------------------------------------------------------------------ */

function EffectSelector({
  active,
  onChange,
}: {
  active: EffectName | null;
  onChange: (effect: EffectName | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
          active === null
            ? "bg-[#7C6AEF] text-[#0C0D14]"
            : "border border-[rgba(124,106,239,0.12)] text-[#9AA4B2] hover:border-[rgba(124,106,239,0.2)] hover:text-[#E6EDF3]"
        }`}
      >
        All
      </button>
      {EFFECTS.map((e) => (
        <button
          key={e.key}
          onClick={() => onChange(e.key)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            active === e.key
              ? "bg-[#7C6AEF] text-[#0C0D14]"
              : "border border-[rgba(124,106,239,0.12)] text-[#9AA4B2] hover:border-[rgba(124,106,239,0.2)] hover:text-[#E6EDF3]"
          }`}
        >
          {e.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TextEffectsExperimentPage() {
  const [activeFilter, setActiveFilter] = useState<EffectName | null>(null);

  const filteredEffects = activeFilter
    ? EFFECTS.filter((e) => e.key === activeFilter)
    : EFFECTS;

  return (
    <>
      {/* Self-contained styles for all text effects */}
      <style>{`
        /* ================================================ */
        /*  1. Gold Leaf                                     */
        /* ================================================ */
        .te-gold-leaf {
          display: inline-block;
          background: linear-gradient(
            to bottom,
            #1E1645 0%,
            #6355C0 22%,
            #A99BFF 45%,
            #D0C9FF 50%,
            #A99BFF 55%,
            #6355C0 78%,
            #1E1645 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
        }

        /* ================================================ */
        /*  2. Chrome / Silver                               */
        /* ================================================ */
        .te-chrome {
          display: inline-block;
          background: linear-gradient(
            to bottom,
            #7f8c8d 0%,
            #bdc3c7 25%,
            #ecf0f1 50%,
            #bdc3c7 75%,
            #7f8c8d 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
        }

        /* ================================================ */
        /*  3. Embossed (Raised)                             */
        /* ================================================ */
        .te-embossed {
          color: rgba(124, 106, 239, 0.8);
          text-shadow:
            -1px -1px 1px rgba(255, 255, 255, 0.2),
            1px 1px 2px rgba(0, 0, 0, 0.8);
        }

        /* ================================================ */
        /*  4. Debossed (Pressed In)                         */
        /* ================================================ */
        .te-debossed {
          color: rgba(124, 106, 239, 0.5);
          text-shadow:
            1px 1px 1px rgba(255, 255, 255, 0.1),
            -1px -1px 2px rgba(0, 0, 0, 0.9);
        }

        /* ================================================ */
        /*  5. Animated Gold Shimmer                         */
        /* ================================================ */
        .te-gold-shimmer {
          display: inline-block;
          background: linear-gradient(
            90deg,
            #5E4FCC 0%,
            #7C6AEF 20%,
            #A99BFF 40%,
            #D0C9FF 50%,
            #A99BFF 60%,
            #7C6AEF 80%,
            #5E4FCC 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: te-shimmer 3s ease-in-out infinite;
        }

        @keyframes te-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ================================================ */
        /*  6. Neon Glow (Amber)                             */
        /* ================================================ */
        .te-neon-amber {
          color: #7C6AEF;
          text-shadow:
            0 0 7px rgba(124, 106, 239, 0.5),
            0 0 10px rgba(124, 106, 239, 0.4),
            0 0 21px rgba(124, 106, 239, 0.3),
            0 0 42px rgba(124, 106, 239, 0.2);
        }

        /* ================================================ */
        /*  7. Sparkle Accents                               */
        /* ================================================ */
        .te-sparkle {
          position: relative;
          display: inline-block;
          color: #7C6AEF;
        }

        .te-sparkle::before,
        .te-sparkle::after {
          content: "\\2726";
          position: absolute;
          font-size: 0.4em;
          color: #9D8FFF;
          animation: te-sparkle-pulse 2s ease-in-out infinite;
          pointer-events: none;
        }

        .te-sparkle::before {
          top: -0.3em;
          right: -0.5em;
          animation-delay: 0s;
        }

        .te-sparkle::after {
          bottom: -0.2em;
          left: -0.4em;
          animation-delay: 1s;
        }

        @keyframes te-sparkle-pulse {
          0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
          50% { opacity: 1; transform: scale(1) rotate(180deg); }
        }

        /* ================================================ */
        /*  prefers-reduced-motion                           */
        /* ================================================ */
        @media (prefers-reduced-motion: reduce) {
          .te-gold-shimmer {
            animation: none !important;
            background-position: 50% 0;
          }

          .te-sparkle::before,
          .te-sparkle::after {
            animation: none !important;
            opacity: 0.6;
            transform: scale(0.8) rotate(0deg);
          }
        }
      `}</style>

      <div className="min-h-screen bg-[#0C0D14] bg-grid-warm">
        {/* Ambient glow */}
        <div
          className="pointer-events-none fixed top-1/4 left-1/3 h-[500px] w-[500px] rounded-full bg-[rgba(124,106,239,0.03)] blur-[150px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none fixed bottom-1/3 right-1/4 h-[400px] w-[400px] rounded-full bg-[rgba(124,106,239,0.04)] blur-[120px]"
          aria-hidden="true"
        />

        <main className="relative z-10 mx-auto max-w-5xl px-6 py-16">
          {/* ── Hero ─────────────────────────────────────────── */}
          <header className="mb-20 text-center animate-fade-in-up">
            <p className="text-[#7C6AEF] text-sm tracking-widest uppercase mb-4 font-semibold">
              Experiment #53
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-heading text-[#E6EDF3] tracking-tight mb-6">
              Premium Material Text Effects
            </h1>
            <p className="text-[#9AA4B2] text-lg leading-relaxed max-w-2xl mx-auto mb-12">
              Embossed, chrome, gold leaf, sparkle -- making text look crafted
              and luxurious on the dark background. Pure CSS, no JavaScript
              dependencies.
            </p>

            {/* Hero centerpiece — large shimmer score */}
            <div className="flex flex-col items-center gap-4">
              <EffectText
                effect="gold-shimmer"
                className="font-heading text-[8rem] sm:text-[10rem] md:text-[12rem] font-extrabold tracking-tight leading-none"
              >
                87
              </EffectText>
              <EffectText
                effect="gold-leaf"
                className="font-heading text-2xl sm:text-3xl font-bold tracking-wide"
              >
                Elite
              </EffectText>
              <EffectText
                effect="embossed"
                className="font-heading text-sm tracking-[0.3em] uppercase font-medium"
              >
                IMPACT SCORE
              </EffectText>
            </div>
          </header>

          {/* ── Filter ───────────────────────────────────────── */}
          <div className="mb-8 animate-fade-in-up [animation-delay:200ms]">
            <EffectSelector active={activeFilter} onChange={setActiveFilter} />
          </div>

          {/* ── Effects Grid ─────────────────────────────────── */}
          <section className="mb-20 animate-fade-in-up [animation-delay:300ms]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEffects.map((info) => (
                <EffectCard key={info.key} info={info} />
              ))}
            </div>
          </section>

          {/* ── Comparison ───────────────────────────────────── */}
          <section className="mb-20 animate-fade-in-up [animation-delay:400ms]">
            <p className="text-[#7C6AEF] text-sm tracking-widest uppercase mb-4 font-semibold">
              Comparison
            </p>
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#E6EDF3] tracking-tight mb-2">
              Plain vs. Effects
            </h2>
            <p className="text-[#9AA4B2] text-sm leading-relaxed mb-8 max-w-2xl">
              Side by side comparison showing how material effects elevate
              otherwise flat text. Each effect adds depth and character.
            </p>
            <ComparisonSection />
          </section>

          {/* ── Application Preview ──────────────────────────── */}
          <section className="mb-20 animate-fade-in-up [animation-delay:500ms]">
            <p className="text-[#7C6AEF] text-sm tracking-widest uppercase mb-4 font-semibold">
              Application
            </p>
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#E6EDF3] tracking-tight mb-2">
              Badge Mockup
            </h2>
            <p className="text-[#9AA4B2] text-sm leading-relaxed mb-8 max-w-2xl">
              How the effects look when applied to an actual badge card. Score
              in gold shimmer, tier in gold leaf, section labels embossed, stats
              in neon glow.
            </p>
            <ApplicationPreview />
          </section>

          {/* ── Implementation Notes ─────────────────────────── */}
          <footer className="rounded-xl border border-[rgba(124,106,239,0.12)] bg-[#13141E]/40 p-6 animate-fade-in-up [animation-delay:600ms]">
            <h3 className="font-heading text-sm font-semibold text-[#7C6AEF]">
              Implementation Notes
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-[#9AA4B2]">
              <li>
                All effects are <strong className="text-[#E6EDF3]/70">pure CSS</strong> --
                no JavaScript needed for rendering.
              </li>
              <li>
                Gradient-based effects (gold leaf, chrome, shimmer) use{" "}
                <code className="text-[#E6EDF3]/70">background-clip: text</code>{" "}
                with{" "}
                <code className="text-[#E6EDF3]/70">
                  -webkit-text-fill-color: transparent
                </code>
                .
              </li>
              <li>
                Embossed/debossed effects use directional{" "}
                <code className="text-[#E6EDF3]/70">text-shadow</code> to
                simulate depth on the{" "}
                <code className="text-[#E6EDF3]/70">#13141E</code> surface.
              </li>
              <li>
                Sparkle uses{" "}
                <code className="text-[#E6EDF3]/70">::before</code> and{" "}
                <code className="text-[#E6EDF3]/70">::after</code>{" "}
                pseudo-elements with rotating pulse animation.
              </li>
              <li>
                <code className="text-[#E6EDF3]/70">
                  prefers-reduced-motion
                </code>{" "}
                disables shimmer and sparkle animations, showing static
                fallbacks.
              </li>
              <li>
                All text remains readable on the{" "}
                <code className="text-[#E6EDF3]/70">#0C0D14</code> background.
                Effects enhance without sacrificing legibility.
              </li>
            </ul>
          </footer>

          {/* Footer marker */}
          <p className="text-center text-[#9AA4B2] text-sm mt-12">
            Experiment #53 &middot;{" "}
            <span className="text-[#7C6AEF] font-medium">
              Pure CSS text effects
            </span>{" "}
            &middot; prefers-reduced-motion supported
          </p>
        </main>
      </div>
    </>
  );
}
