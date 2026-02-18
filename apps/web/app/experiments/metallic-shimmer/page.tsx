"use client";

import { useState, useCallback, useRef, useEffect } from "react";

/* ------------------------------------------------------------------ */
/*  Metallic Gold Shimmer — Experiment #39                            */
/*  Demonstrates a metallic gold shimmer sweep on impact score text   */
/*  using CSS background-clip:text and SVG linearGradient + SMIL.     */
/* ------------------------------------------------------------------ */

const TIERS = [
  { label: "Elite", score: 92 },
  { label: "High", score: 74 },
  { label: "Solid", score: 55 },
  { label: "Emerging", score: 32 },
] as const;

export default function MetallicShimmerPage() {
  const [speed, setSpeed] = useState(3);
  const [intensity, setIntensity] = useState(100);
  const [replayKey, setReplayKey] = useState(0);

  const replay = useCallback(() => {
    setReplayKey((k) => k + 1);
  }, []);

  /* Bright highlight color based on intensity slider (50-100 maps opacity) */
  const highlightColor = `rgba(246, 242, 192, ${intensity / 100})`;

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
          Experiment #39
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
          Metallic Gold Shimmer
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">
          A moving metallic highlight sweeps across the impact score, creating a
          premium gold-foil feel. Shown in both CSS (for the share page) and SVG
          (for the embeddable badge).
        </p>

        {/* ── Controls ───────────────────────────────────────── */}
        <section className="mt-12 rounded-2xl border border-warm-stroke bg-warm-card/50 p-8">
          <h2 className="font-heading text-lg font-bold tracking-tight text-text-primary">
            Controls
          </h2>

          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            {/* Speed */}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text-secondary">
                Speed:{" "}
                <span className="text-amber">{speed.toFixed(1)}s</span>
              </span>
              <input
                type="range"
                min={1}
                max={5}
                step={0.5}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="accent-amber"
              />
            </label>

            {/* Intensity */}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text-secondary">
                Highlight intensity:{" "}
                <span className="text-amber">{intensity}%</span>
              </span>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="accent-amber"
              />
            </label>

            {/* Replay */}
            <div className="flex items-end">
              <button
                onClick={replay}
                className="rounded-lg bg-amber px-8 py-3.5 text-base font-semibold text-warm-bg transition-colors hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25"
              >
                Replay Animation
              </button>
            </div>
          </div>
        </section>

        {/* ── Before / After Comparison ──────────────────────── */}
        <section className="mt-16">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-text-primary">
            Before &amp; After
          </h2>
          <p className="mt-2 text-text-secondary">
            Side-by-side comparison of the plain amber score versus the metallic
            shimmer version.
          </p>

          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            {/* Before */}
            <ComparisonCard label="Before — Plain Amber">
              <span className="font-heading text-8xl font-extrabold text-amber sm:text-9xl">
                87
              </span>
              <span className="mt-2 text-sm font-medium uppercase tracking-widest text-text-secondary">
                Impact Score
              </span>
            </ComparisonCard>

            {/* After */}
            <ComparisonCard label="After — Metallic Shimmer">
              <MetallicText
                key={replayKey}
                text="87"
                className="font-heading text-8xl font-extrabold sm:text-9xl"
                speed={speed}
                highlightColor={highlightColor}
              />
              <span className="mt-2 text-sm font-medium uppercase tracking-widest text-text-secondary">
                Impact Score
              </span>
            </ComparisonCard>
          </div>
        </section>

        {/* ── Tier Labels ────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-text-primary">
            Tier Labels
          </h2>
          <p className="mt-2 text-text-secondary">
            The shimmer effect applied to each impact tier label and its score.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier) => (
              <div
                key={`${tier.label}-${replayKey}`}
                className="flex flex-col items-center gap-3 rounded-2xl border border-warm-stroke bg-warm-card/50 p-8 transition-colors hover:border-amber/20 hover:bg-warm-card"
              >
                <MetallicText
                  text={String(tier.score)}
                  className="font-heading text-5xl font-extrabold"
                  speed={speed}
                  highlightColor={highlightColor}
                />
                <MetallicText
                  text={tier.label}
                  className="font-heading text-lg font-bold uppercase tracking-widest"
                  speed={speed + 0.5}
                  highlightColor={highlightColor}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── SVG Version ────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-text-primary">
            SVG Version (SMIL)
          </h2>
          <p className="mt-2 text-text-secondary">
            Inline SVG using{" "}
            <code className="rounded border border-warm-stroke bg-warm-card px-1.5 py-0.5 font-heading text-sm text-amber">
              &lt;linearGradient&gt;
            </code>{" "}
            with animated stops via SMIL. This is what the embeddable badge would
            use.
          </p>

          <div className="mt-8 rounded-2xl border border-warm-stroke bg-warm-card/50 p-8">
            <SvgMetallicScore
              key={`svg-${replayKey}`}
              score={87}
              tier="Elite"
              speed={speed}
              intensity={intensity}
            />
          </div>
        </section>

        {/* ── CSS Source ──────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-text-primary">
            CSS Technique
          </h2>
          <p className="mt-2 text-text-secondary">
            The CSS approach using{" "}
            <code className="rounded border border-warm-stroke bg-warm-card px-1.5 py-0.5 font-heading text-sm text-amber">
              background-clip: text
            </code>{" "}
            with an animated gradient. Works in all modern browsers for the share
            page.
          </p>
          <CodeBlock
            code={`/* Metallic gold shimmer */
.metallic-gold {
  background: linear-gradient(
    90deg,
    #5E4FCC 0%,
    #7C6AEF 20%,
    #A99BFF 40%,
    #D0C9FF 50%,   /* bright highlight */
    #A99BFF 60%,
    #7C6AEF 80%,
    #5E4FCC 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer-sweep 3s ease-in-out infinite;
}

@keyframes shimmer-sweep {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}`}
          />
        </section>

        {/* ── Footer ─────────────────────────────────────────── */}
        <footer className="mt-20 border-t border-warm-stroke pt-8 text-sm text-text-secondary">
          <p>
            Experiment #39 — Metallic Gold Shimmer. Part of the Chapa visual
            experiments series.
          </p>
        </footer>
      </div>
    </main>
  );
}

/* ================================================================== */
/*  Components                                                        */
/* ================================================================== */

function ComparisonCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-warm-stroke bg-warm-card/50 p-10 transition-colors hover:border-amber/20 hover:bg-warm-card">
      <p className="mb-4 text-xs font-medium uppercase tracking-widest text-text-secondary">
        {label}
      </p>
      {children}
    </div>
  );
}

/* ── CSS Metallic Text ───────────────────────────────────────────── */

function MetallicText({
  text,
  className = "",
  speed,
  highlightColor,
}: {
  text: string;
  className?: string;
  speed: number;
  highlightColor: string;
}) {
  return (
    <span
      className={className}
      style={{
        background: `linear-gradient(
          90deg,
          #5E4FCC 0%,
          #7C6AEF 20%,
          #A99BFF 40%,
          ${highlightColor} 50%,
          #A99BFF 60%,
          #7C6AEF 80%,
          #5E4FCC 100%
        )`,
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        animation: `shimmer-sweep ${speed}s ease-in-out infinite`,
      }}
    >
      {text}
    </span>
  );
}

/* ── SVG Metallic Score (SMIL animation) ─────────────────────────── */

function SvgMetallicScore({
  score,
  tier,
  speed,
  intensity,
}: {
  score: number;
  tier: string;
  speed: number;
  intensity: number;
}) {
  const highlightOpacity = intensity / 100;

  return (
    <div className="flex items-center justify-center">
      <svg
        viewBox="0 0 400 200"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-md"
        role="img"
        aria-label={`Impact score ${score}, tier ${tier} with metallic shimmer effect`}
      >
        <defs>
          {/* Metallic gold gradient with animated sweep */}
          <linearGradient
            id="metallic-gold-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#5E4FCC">
              <animate
                attributeName="offset"
                values="-1;0;1"
                dur={`${speed}s`}
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="20%" stopColor="#7C6AEF">
              <animate
                attributeName="offset"
                values="-0.8;0.2;1.2"
                dur={`${speed}s`}
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="40%" stopColor="#A99BFF">
              <animate
                attributeName="offset"
                values="-0.6;0.4;1.4"
                dur={`${speed}s`}
                repeatCount="indefinite"
              />
            </stop>
            <stop
              offset="50%"
              stopColor="#D0C9FF"
              stopOpacity={highlightOpacity}
            >
              <animate
                attributeName="offset"
                values="-0.5;0.5;1.5"
                dur={`${speed}s`}
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="60%" stopColor="#A99BFF">
              <animate
                attributeName="offset"
                values="-0.4;0.6;1.6"
                dur={`${speed}s`}
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="80%" stopColor="#7C6AEF">
              <animate
                attributeName="offset"
                values="-0.2;0.8;1.8"
                dur={`${speed}s`}
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#5E4FCC">
              <animate
                attributeName="offset"
                values="0;1;2"
                dur={`${speed}s`}
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>

          {/* Tier label gradient — slightly offset timing */}
          <linearGradient
            id="metallic-gold-gradient-tier"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#5E4FCC">
              <animate
                attributeName="offset"
                values="-1;0;1"
                dur={`${speed + 0.5}s`}
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="30%" stopColor="#7C6AEF">
              <animate
                attributeName="offset"
                values="-0.7;0.3;1.3"
                dur={`${speed + 0.5}s`}
                repeatCount="indefinite"
              />
            </stop>
            <stop
              offset="50%"
              stopColor="#D0C9FF"
              stopOpacity={highlightOpacity}
            >
              <animate
                attributeName="offset"
                values="-0.5;0.5;1.5"
                dur={`${speed + 0.5}s`}
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="70%" stopColor="#7C6AEF">
              <animate
                attributeName="offset"
                values="-0.3;0.7;1.7"
                dur={`${speed + 0.5}s`}
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#5E4FCC">
              <animate
                attributeName="offset"
                values="0;1;2"
                dur={`${speed + 0.5}s`}
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>

        {/* Card background */}
        <rect
          x="0"
          y="0"
          width="400"
          height="200"
          rx="16"
          fill="#13141E"
          stroke="rgba(124,106,239,0.12)"
          strokeWidth="1"
        />

        {/* Score number */}
        <text
          x="200"
          y="115"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', 'Courier New', monospace"
          fontSize="96"
          fontWeight="800"
          fill="url(#metallic-gold-gradient)"
        >
          {score}
        </text>

        {/* Tier label */}
        <text
          x="200"
          y="160"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', 'Courier New', monospace"
          fontSize="18"
          fontWeight="700"
          letterSpacing="6"
          fill="url(#metallic-gold-gradient-tier)"
        >
          {tier.toUpperCase()}
        </text>

        {/* "Impact Score" label */}
        <text
          x="200"
          y="30"
          textAnchor="middle"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontSize="12"
          fontWeight="500"
          letterSpacing="4"
          fill="#9AA4B2"
        >
          IMPACT SCORE
        </text>
      </svg>
    </div>
  );
}

/* ── Code Block ──────────────────────────────────────────────────── */

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [code]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative mt-6 overflow-hidden rounded-xl border border-warm-stroke bg-[#0d0b08]">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-warm-stroke px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-amber/20" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-amber/10" aria-hidden="true" />
        <span
          className="h-3 w-3 rounded-full bg-amber/[0.06]"
          aria-hidden="true"
        />
        <span className="ml-auto text-xs text-text-secondary">CSS</span>
      </div>

      <div className="relative">
        <pre className="overflow-x-auto p-6 text-sm leading-relaxed text-text-secondary">
          <code>{code}</code>
        </pre>

        <button
          onClick={copy}
          className="absolute right-3 top-3 rounded-full border border-warm-stroke px-4 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
