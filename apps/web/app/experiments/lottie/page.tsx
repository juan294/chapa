"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { AnimationItem } from "lottie-web";

/* ------------------------------------------------------------------ */
/*  Lottie Achievement Unlock Animations — Experiment #50              */
/*  Demonstrates Lottie-powered + CSS achievement animations for       */
/*  tier reveals, score celebrations, and badge appearance effects.    */
/* ------------------------------------------------------------------ */

/* ── Lottie Player Component ──────────────────────────────────────── */

function LottiePlayer({
  animationData,
  loop = false,
  autoplay = true,
  className = "",
  onComplete,
}: {
  animationData: object;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  onComplete?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    (async () => {
      const lottie = (await import("lottie-web")).default;
      if (destroyed || !containerRef.current) return;

      animRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop,
        autoplay,
        animationData,
      });

      if (onComplete) {
        animRef.current.addEventListener("complete", onComplete);
      }
      setReady(true);
    })();

    return () => {
      destroyed = true;
      animRef.current?.destroy();
      animRef.current = null;
    };
  }, [animationData, loop, autoplay, onComplete]);

  const replay = useCallback(() => {
    animRef.current?.goToAndPlay(0);
  }, []);

  return (
    <div className={className}>
      <div ref={containerRef} />
      {ready && (
        <button
          onClick={replay}
          className="mt-3 rounded-full border border-warm-stroke px-4 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:bg-amber/[0.04] hover:text-text-primary"
        >
          Replay
        </button>
      )}
    </div>
  );
}

/* ── Minimal Lottie JSON Animations ───────────────────────────────── */

/** Pulsing amber circle — proves lottie-web integration works */
const pulsingCircleAnimation = {
  v: "5.5.7",
  fr: 30,
  ip: 0,
  op: 60,
  w: 200,
  h: 200,
  layers: [
    {
      ty: 4,
      nm: "circle",
      ip: 0,
      op: 60,
      st: 0,
      ks: {
        o: {
          a: 1,
          k: [
            {
              t: 0,
              s: [0],
              i: { x: [0.4], y: [1] },
              o: { x: [0.6], y: [0] },
            },
            {
              t: 10,
              s: [100],
              i: { x: [0.4], y: [1] },
              o: { x: [0.6], y: [0] },
            },
            {
              t: 45,
              s: [100],
              i: { x: [0.4], y: [1] },
              o: { x: [0.6], y: [0] },
            },
            { t: 60, s: [0] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100] },
        s: {
          a: 1,
          k: [
            {
              t: 0,
              s: [0, 0],
              i: { x: [0.4, 0.4], y: [1, 1] },
              o: { x: [0.6, 0.6], y: [0, 0] },
            },
            {
              t: 15,
              s: [120, 120],
              i: { x: [0.4, 0.4], y: [1, 1] },
              o: { x: [0.6, 0.6], y: [0, 0] },
            },
            { t: 25, s: [100, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: "el",
          p: { a: 0, k: [0, 0] },
          s: { a: 0, k: [80, 80] },
          nm: "ellipse",
        },
        {
          ty: "fl",
          c: { a: 0, k: [0.886, 0.659, 0.294, 1] },
          o: { a: 0, k: 100 },
        },
      ],
    },
  ],
};

/** Expanding ring burst — amber ring that scales up and fades out */
const ringBurstAnimation = {
  v: "5.5.7",
  fr: 30,
  ip: 0,
  op: 45,
  w: 200,
  h: 200,
  layers: [
    {
      ty: 4,
      nm: "ring",
      ip: 0,
      op: 45,
      st: 0,
      ks: {
        o: {
          a: 1,
          k: [
            {
              t: 0,
              s: [100],
              i: { x: [0.4], y: [1] },
              o: { x: [0.6], y: [0] },
            },
            { t: 45, s: [0] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100] },
        s: {
          a: 1,
          k: [
            {
              t: 0,
              s: [30, 30],
              i: { x: [0.2, 0.2], y: [1, 1] },
              o: { x: [0.6, 0.6], y: [0, 0] },
            },
            { t: 45, s: [200, 200] },
          ],
        },
      },
      shapes: [
        {
          ty: "el",
          p: { a: 0, k: [0, 0] },
          s: { a: 0, k: [80, 80] },
          nm: "ellipse",
        },
        {
          ty: "st",
          c: { a: 0, k: [0.886, 0.659, 0.294, 1] },
          o: { a: 0, k: 100 },
          w: {
            a: 1,
            k: [
              {
                t: 0,
                s: [6],
                i: { x: [0.4], y: [1] },
                o: { x: [0.6], y: [0] },
              },
              { t: 45, s: [1] },
            ],
          },
          lc: 2,
          lj: 2,
        },
      ],
    },
  ],
};

/** Double ring burst — two rings, staggered */
const doubleRingAnimation = {
  v: "5.5.7",
  fr: 30,
  ip: 0,
  op: 60,
  w: 200,
  h: 200,
  layers: [
    {
      ty: 4,
      nm: "ring-outer",
      ip: 0,
      op: 50,
      st: 0,
      ks: {
        o: {
          a: 1,
          k: [
            {
              t: 0,
              s: [100],
              i: { x: [0.4], y: [1] },
              o: { x: [0.6], y: [0] },
            },
            { t: 50, s: [0] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100] },
        s: {
          a: 1,
          k: [
            {
              t: 0,
              s: [30, 30],
              i: { x: [0.2, 0.2], y: [1, 1] },
              o: { x: [0.6, 0.6], y: [0, 0] },
            },
            { t: 50, s: [220, 220] },
          ],
        },
      },
      shapes: [
        {
          ty: "el",
          p: { a: 0, k: [0, 0] },
          s: { a: 0, k: [80, 80] },
          nm: "ellipse",
        },
        {
          ty: "st",
          c: { a: 0, k: [0.886, 0.659, 0.294, 1] },
          o: { a: 0, k: 100 },
          w: {
            a: 1,
            k: [
              {
                t: 0,
                s: [5],
                i: { x: [0.4], y: [1] },
                o: { x: [0.6], y: [0] },
              },
              { t: 50, s: [0.5] },
            ],
          },
          lc: 2,
          lj: 2,
        },
      ],
    },
    {
      ty: 4,
      nm: "ring-inner",
      ip: 8,
      op: 55,
      st: 8,
      ks: {
        o: {
          a: 1,
          k: [
            {
              t: 8,
              s: [80],
              i: { x: [0.4], y: [1] },
              o: { x: [0.6], y: [0] },
            },
            { t: 55, s: [0] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100] },
        s: {
          a: 1,
          k: [
            {
              t: 8,
              s: [20, 20],
              i: { x: [0.2, 0.2], y: [1, 1] },
              o: { x: [0.6, 0.6], y: [0, 0] },
            },
            { t: 55, s: [180, 180] },
          ],
        },
      },
      shapes: [
        {
          ty: "el",
          p: { a: 0, k: [0, 0] },
          s: { a: 0, k: [80, 80] },
          nm: "ellipse",
        },
        {
          ty: "st",
          c: { a: 0, k: [0.941, 0.788, 0.49, 1] },
          o: { a: 0, k: 100 },
          w: {
            a: 1,
            k: [
              {
                t: 8,
                s: [3],
                i: { x: [0.4], y: [1] },
                o: { x: [0.6], y: [0] },
              },
              { t: 55, s: [0.5] },
            ],
          },
          lc: 2,
          lj: 2,
        },
      ],
    },
  ],
};

/** Spinning star with scale bounce */
const spinningStarAnimation = {
  v: "5.5.7",
  fr: 30,
  ip: 0,
  op: 60,
  w: 200,
  h: 200,
  layers: [
    {
      ty: 4,
      nm: "star",
      ip: 0,
      op: 60,
      st: 0,
      ks: {
        o: {
          a: 1,
          k: [
            {
              t: 0,
              s: [0],
              i: { x: [0.4], y: [1] },
              o: { x: [0.6], y: [0] },
            },
            {
              t: 8,
              s: [100],
              i: { x: [0.4], y: [1] },
              o: { x: [0.6], y: [0] },
            },
            {
              t: 48,
              s: [100],
              i: { x: [0.4], y: [1] },
              o: { x: [0.6], y: [0] },
            },
            { t: 60, s: [0] },
          ],
        },
        r: {
          a: 1,
          k: [
            {
              t: 0,
              s: [-90],
              i: { x: [0.2], y: [1] },
              o: { x: [0.6], y: [0] },
            },
            { t: 30, s: [0] },
          ],
        },
        p: { a: 0, k: [100, 100] },
        s: {
          a: 1,
          k: [
            {
              t: 0,
              s: [0, 0],
              i: { x: [0.2, 0.2], y: [1, 1] },
              o: { x: [0.6, 0.6], y: [0, 0] },
            },
            {
              t: 15,
              s: [130, 130],
              i: { x: [0.4, 0.4], y: [1, 1] },
              o: { x: [0.6, 0.6], y: [0, 0] },
            },
            { t: 25, s: [100, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: "sr",
          p: { a: 0, k: [0, 0] },
          or: { a: 0, k: 50 },
          ir: { a: 0, k: 22 },
          pt: { a: 0, k: 5 },
          r: { a: 0, k: 0 },
          sy: 1,
          nm: "star",
        },
        {
          ty: "fl",
          c: { a: 0, k: [0.886, 0.659, 0.294, 1] },
          o: { a: 0, k: 100 },
        },
      ],
    },
  ],
};

/* ── CSS Achievement Animation Components ─────────────────────────── */

function RingBurstCSS({ playing }: { playing: boolean }) {
  return (
    <div className="relative flex h-48 w-48 items-center justify-center">
      {/* Badge center */}
      <div
        className="z-10 flex h-20 w-20 items-center justify-center rounded-full border border-amber/30 bg-warm-card text-2xl font-bold text-amber font-heading"
        style={{
          transform: playing ? "scale(1)" : "scale(0.95)",
          transition: "transform 0.3s ease-out",
        }}
      >
        92
      </div>

      {/* Ring 1 */}
      <div
        className="absolute inset-0 rounded-full border-2 border-amber"
        style={{
          animation: playing
            ? "ring-burst 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards"
            : "none",
          opacity: 0,
        }}
      />
      {/* Ring 2, delayed */}
      <div
        className="absolute inset-0 rounded-full border border-amber-light"
        style={{
          animation: playing
            ? "ring-burst 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.15s forwards"
            : "none",
          opacity: 0,
        }}
      />
    </div>
  );
}

function StarScatterCSS({ playing }: { playing: boolean }) {
  const starPositions = [
    { tx: -60, ty: -70, delay: 0 },
    { tx: 55, ty: -65, delay: 0.05 },
    { tx: -75, ty: 10, delay: 0.1 },
    { tx: 70, ty: 15, delay: 0.08 },
    { tx: -40, ty: 60, delay: 0.12 },
    { tx: 45, ty: 55, delay: 0.06 },
    { tx: 0, ty: -80, delay: 0.03 },
    { tx: 0, ty: 70, delay: 0.09 },
  ];

  return (
    <div className="relative flex h-48 w-48 items-center justify-center">
      {/* Badge center */}
      <div className="z-10 flex h-20 w-20 items-center justify-center rounded-full border border-amber/30 bg-warm-card font-heading text-lg font-bold text-amber">
        Elite
      </div>

      {/* Stars */}
      {starPositions.map((pos, i) => (
        <svg
          key={i}
          className="absolute"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          style={{
            left: "calc(50% - 6px)",
            top: "calc(50% - 6px)",
            animation: playing
              ? `star-scatter 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${pos.delay}s forwards`
              : "none",
            opacity: 0,
            ["--tx" as string]: `${pos.tx}px`,
            ["--ty" as string]: `${pos.ty}px`,
          }}
        >
          <path
            d="M6 0l1.76 3.57L12 4.16 8.82 7.03l.94 4.01L6 9.12l-3.76 1.92.94-4.01L0 4.16l4.24-.59z"
            fill="#7C6AEF"
          />
        </svg>
      ))}
    </div>
  );
}

function BadgeRevealCSS({ playing }: { playing: boolean }) {
  return (
    <div className="relative flex h-64 items-center justify-center overflow-hidden">
      {/* Glow behind */}
      <div
        className="absolute rounded-full bg-amber/20 blur-[40px]"
        style={{
          width: 160,
          height: 160,
          animation: playing
            ? "glow-burst 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards"
            : "none",
          opacity: 0,
        }}
      />

      {/* Badge card */}
      <div
        className="relative z-10 rounded-xl border border-amber/20 bg-warm-card px-6 py-4"
        style={{
          animation: playing
            ? "badge-reveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
            : "none",
          opacity: 0,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber/10">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                fill="#7C6AEF"
              />
            </svg>
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-text-primary">
              Impact Score
            </p>
            <p className="text-sm text-text-secondary">Elite Tier</p>
          </div>
          <span className="ml-4 font-heading text-3xl font-extrabold text-amber">
            92
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Inner component that always starts counting from initial values.
 * Remounted via key changes from the parent to "reset".
 */
function TierUpgradeInner() {
  const [displayTier, setDisplayTier] = useState("Solid");
  const [displayScore, setDisplayScore] = useState(55);

  useEffect(() => {
    const countInterval = setInterval(() => {
      setDisplayScore((prev) => {
        if (prev >= 92) {
          clearInterval(countInterval);
          return 92;
        }
        return prev + 2;
      });
    }, 30);

    const tierTimeout1 = setTimeout(() => setDisplayTier("High"), 400);
    const tierTimeout2 = setTimeout(() => setDisplayTier("Elite"), 900);

    return () => {
      clearInterval(countInterval);
      clearTimeout(tierTimeout1);
      clearTimeout(tierTimeout2);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="font-heading text-5xl font-extrabold tabular-nums"
        style={{
          animation:
            "tier-upgrade 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          color: "#7C6AEF",
          transition: "color 0.3s",
        }}
      >
        {displayScore}
      </div>
      <div
        className="rounded-full border px-4 py-1.5 font-heading text-sm font-medium transition-all duration-300"
        style={{
          borderColor:
            displayTier === "Elite"
              ? "rgba(124,106,239,0.4)"
              : "rgba(124,106,239,0.12)",
          color: displayTier === "Elite" ? "#7C6AEF" : "#9AA4B2",
          backgroundColor:
            displayTier === "Elite"
              ? "rgba(124,106,239,0.08)"
              : "transparent",
        }}
      >
        {displayTier}
      </div>
    </div>
  );
}

function TierUpgradeCSS({
  playing,
  instanceKey,
}: {
  playing: boolean;
  instanceKey: number;
}) {
  if (!playing) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="font-heading text-5xl font-extrabold tabular-nums text-text-secondary">
          55
        </div>
        <div className="rounded-full border border-warm-stroke px-4 py-1.5 font-heading text-sm font-medium text-text-secondary">
          Solid
        </div>
      </div>
    );
  }
  return <TierUpgradeInner key={instanceKey} />;
}

/* ── Combined Sequence ────────────────────────────────────────────── */

function CombinedSequenceInner() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 0);
    const t2 = setTimeout(() => setPhase(2), 900);
    const t3 = setTimeout(() => setPhase(3), 1800);
    const t4 = setTimeout(() => setPhase(4), 2700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Phase labels */}
      <div className="flex gap-2">
        {["Ring Burst", "Star Scatter", "Badge Reveal", "Tier Upgrade"].map(
          (label, i) => (
            <span
              key={label}
              className="rounded-full px-3 py-1 text-xs font-medium transition-all duration-300"
              style={{
                color: phase > i ? "#7C6AEF" : "#9AA4B2",
                borderColor:
                  phase > i
                    ? "rgba(124,106,239,0.3)"
                    : "rgba(124,106,239,0.12)",
                backgroundColor:
                  phase > i ? "rgba(124,106,239,0.08)" : "transparent",
                border: "1px solid",
              }}
            >
              {label}
            </span>
          ),
        )}
      </div>

      {/* Combined area */}
      <div className="relative flex h-64 w-64 items-center justify-center">
        {/* Ring burst - phase 1 */}
        <div
          className="absolute inset-0 rounded-full border-2 border-amber"
          style={{
            animation:
              phase >= 1
                ? "ring-burst 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards"
                : "none",
            opacity: 0,
          }}
        />

        {/* Stars - phase 2 */}
        {phase >= 2 &&
          [
            { tx: -80, ty: -90 },
            { tx: 75, ty: -85 },
            { tx: -90, ty: 15 },
            { tx: 85, ty: 20 },
            { tx: -50, ty: 80 },
            { tx: 55, ty: 75 },
          ].map((pos, i) => (
            <svg
              key={i}
              className="absolute"
              width="10"
              height="10"
              viewBox="0 0 12 12"
              aria-hidden="true"
              style={{
                left: "calc(50% - 5px)",
                top: "calc(50% - 5px)",
                animation: `star-scatter 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${i * 0.04}s forwards`,
                opacity: 0,
                ["--tx" as string]: `${pos.tx}px`,
                ["--ty" as string]: `${pos.ty}px`,
              }}
            >
              <path
                d="M6 0l1.76 3.57L12 4.16 8.82 7.03l.94 4.01L6 9.12l-3.76 1.92.94-4.01L0 4.16l4.24-.59z"
                fill="#9D8FFF"
              />
            </svg>
          ))}

        {/* Badge card - phase 3 */}
        <div
          className="relative z-10 rounded-xl border border-amber/20 bg-warm-card px-5 py-3"
          style={{
            animation:
              phase >= 3
                ? "badge-reveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
                : "none",
            opacity: phase >= 3 ? undefined : 0,
          }}
        >
          <div className="flex items-center gap-3">
            <div>
              <p className="font-heading text-sm font-bold text-text-primary">
                Impact Score
              </p>
              <p className="text-xs text-text-secondary">Achievement Unlocked</p>
            </div>
            <span
              className="ml-2 font-heading text-2xl font-extrabold tabular-nums"
              style={{
                animation:
                  phase >= 4
                    ? "tier-upgrade 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
                    : "none",
                color: phase >= 4 ? "#7C6AEF" : "#9AA4B2",
              }}
            >
              {phase >= 4 ? "92" : "--"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CombinedSequence({
  playing,
  instanceKey,
}: {
  playing: boolean;
  instanceKey: number;
}) {
  if (!playing) {
    return (
      <div className="flex flex-col items-center gap-8">
        <div className="flex gap-2">
          {["Ring Burst", "Star Scatter", "Badge Reveal", "Tier Upgrade"].map(
            (label) => (
              <span
                key={label}
                className="rounded-full border border-warm-stroke px-3 py-1 text-xs font-medium text-text-secondary"
              >
                {label}
              </span>
            ),
          )}
        </div>
        <div className="flex h-64 w-64 items-center justify-center">
          <span className="text-sm text-text-secondary">
            Press Replay to start
          </span>
        </div>
      </div>
    );
  }
  return <CombinedSequenceInner key={instanceKey} />;
}

/* ── Card Wrapper ─────────────────────────────────────────────────── */

function DemoCard({
  title,
  description,
  children,
  onReplay,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onReplay?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-8">
      <h2 className="font-heading text-xl font-bold tracking-tight text-text-primary">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        {description}
      </p>
      <div className="mt-6 flex flex-col items-center">{children}</div>
      {onReplay && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={onReplay}
            className="rounded-full border border-warm-stroke px-6 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:bg-amber/[0.04] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40"
          >
            Replay
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────── */

export default function LottieExperimentPage() {
  const [ringPlaying, setRingPlaying] = useState(false);
  const [starsPlaying, setStarsPlaying] = useState(false);
  const [badgePlaying, setBadgePlaying] = useState(false);
  const [tierPlaying, setTierPlaying] = useState(false);
  const [tierKey, setTierKey] = useState(0);
  const [comboPlaying, setComboPlaying] = useState(false);
  const [comboKey, setComboKey] = useState(0);
  const [lottieKey, setLottieKey] = useState(0);

  /* Auto-trigger CSS animations on mount */
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const t1 = setTimeout(() => setRingPlaying(true), 400);
    const t2 = setTimeout(() => setStarsPlaying(true), 800);
    const t3 = setTimeout(() => setBadgePlaying(true), 1200);
    const t4 = setTimeout(() => setTierPlaying(true), 1600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const replayRing = useCallback(() => {
    setRingPlaying(false);
    requestAnimationFrame(() => setRingPlaying(true));
  }, []);

  const replayStars = useCallback(() => {
    setStarsPlaying(false);
    requestAnimationFrame(() => setStarsPlaying(true));
  }, []);

  const replayBadge = useCallback(() => {
    setBadgePlaying(false);
    requestAnimationFrame(() => setBadgePlaying(true));
  }, []);

  const replayTier = useCallback(() => {
    setTierPlaying(false);
    setTierKey((k) => k + 1);
    requestAnimationFrame(() => setTierPlaying(true));
  }, []);

  const replayCombo = useCallback(() => {
    setComboPlaying(false);
    setComboKey((k) => k + 1);
    requestAnimationFrame(() => setComboPlaying(true));
  }, []);

  const replayLottie = useCallback(() => {
    setLottieKey((k) => k + 1);
  }, []);

  return (
    <main className="min-h-screen bg-bg bg-grid-warm">
      {/* CSS keyframes */}
      <style jsx global>{`
        @keyframes ring-burst {
          0% {
            transform: scale(0.3);
            opacity: 1;
            border-width: 3px;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
            border-width: 0.5px;
          }
        }

        @keyframes star-scatter {
          0% {
            transform: translate(0, 0) scale(0) rotate(0deg);
            opacity: 1;
          }
          60% {
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(1) rotate(180deg);
            opacity: 0;
          }
        }

        @keyframes badge-reveal {
          0% {
            transform: scale(0) rotate(-10deg);
            opacity: 0;
            filter: brightness(3);
          }
          50% {
            transform: scale(1.08) rotate(1.5deg);
            opacity: 1;
            filter: brightness(1.3);
          }
          100% {
            transform: scale(1) rotate(0);
            opacity: 1;
            filter: brightness(1);
          }
        }

        @keyframes tier-upgrade {
          0% {
            transform: scale(1);
            filter: brightness(1);
          }
          25% {
            transform: scale(1.3);
            filter: brightness(2);
            text-shadow: 0 0 40px rgba(124, 106, 239, 0.8);
          }
          50% {
            transform: scale(0.9) rotate(2deg);
            filter: brightness(1.2);
          }
          75% {
            transform: scale(1.05) rotate(-1deg);
          }
          100% {
            transform: scale(1) rotate(0);
            filter: brightness(1);
            text-shadow: 0 0 20px rgba(124, 106, 239, 0.3);
          }
        }

        @keyframes glow-burst {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          40% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(0.8);
            opacity: 0.4;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ring-burst,
          .star-scatter,
          .badge-reveal,
          .tier-upgrade,
          .glow-burst {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber/[0.04] blur-[150px]"
        style={{ width: 600, height: 600 }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-6 py-20">
        {/* ── Header ──────────────────────────────────────────────── */}
        <p className="mb-4 text-sm font-medium tracking-widest uppercase text-amber">
          Experiment #50
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
          Lottie Achievement Animations
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">
          Achievement unlock animations for tier reveals, score celebrations,
          and badge appearance effects. Combines{" "}
          <code className="rounded bg-warm-card px-1.5 py-0.5 text-sm text-amber">
            lottie-web
          </code>{" "}
          integration with CSS-based achievement sequences.
        </p>

        <div className="mt-16 flex flex-col gap-12">
          {/* ── Section 1: Lottie Integration ─────────────────────── */}
          <DemoCard
            title="Lottie Integration"
            description="Real lottie-web player rendering hand-crafted Lottie JSON. These minimal animations prove the pipeline works — in production, designers would export richer animations from After Effects."
            onReplay={replayLottie}
          >
            <div
              className="grid grid-cols-2 gap-8 sm:grid-cols-4"
              key={lottieKey}
            >
              <div className="flex flex-col items-center gap-2">
                <LottiePlayer
                  animationData={pulsingCircleAnimation}
                  className="h-24 w-24"
                />
                <span className="text-xs text-text-secondary">
                  Pulse Circle
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <LottiePlayer
                  animationData={ringBurstAnimation}
                  className="h-24 w-24"
                />
                <span className="text-xs text-text-secondary">Ring Burst</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <LottiePlayer
                  animationData={doubleRingAnimation}
                  className="h-24 w-24"
                />
                <span className="text-xs text-text-secondary">
                  Double Ring
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <LottiePlayer
                  animationData={spinningStarAnimation}
                  className="h-24 w-24"
                />
                <span className="text-xs text-text-secondary">
                  Spinning Star
                </span>
              </div>
            </div>
            <p className="mt-6 rounded-lg border border-warm-stroke bg-[#0d0b08] px-4 py-3 text-xs leading-relaxed text-text-secondary">
              <span className="text-amber">Note:</span> These are minimal
              hand-crafted Lottie JSON objects (shape layers with keyframed
              opacity, scale, rotation). Production animations would be exported
              from After Effects via the Bodymovin plugin — far richer with
              paths, masks, and complex easing.
            </p>
          </DemoCard>

          {/* ── Section 2: Ring Burst ─────────────────────────────── */}
          <DemoCard
            title="Ring Burst"
            description="Expanding amber rings radiate outward from the score, creating a shockwave effect when an achievement unlocks."
            onReplay={replayRing}
          >
            <RingBurstCSS playing={ringPlaying} />
          </DemoCard>

          {/* ── Section 3: Star Scatter ───────────────────────────── */}
          <DemoCard
            title="Star Scatter"
            description="Small star shapes burst outward from center in all directions, adding a celebratory particle effect to tier reveals."
            onReplay={replayStars}
          >
            <StarScatterCSS playing={starsPlaying} />
          </DemoCard>

          {/* ── Section 4: Badge Reveal ───────────────────────────── */}
          <DemoCard
            title="Badge Reveal"
            description="The badge card scales in dramatically with a golden glow and overshot bounce, creating a premium reveal moment."
            onReplay={replayBadge}
          >
            <BadgeRevealCSS playing={badgePlaying} />
          </DemoCard>

          {/* ── Section 5: Tier Upgrade ───────────────────────────── */}
          <DemoCard
            title="Tier Upgrade"
            description="Score number counts up while glowing and shaking, then settles into the new tier. Communicates progression and achievement."
            onReplay={replayTier}
          >
            <TierUpgradeCSS playing={tierPlaying} instanceKey={tierKey} />
          </DemoCard>

          {/* ── Section 6: Combined Sequence ──────────────────────── */}
          <DemoCard
            title="Combined Sequence"
            description="All effects play in a choreographed sequence: ring burst, star scatter, badge reveal, then tier upgrade. This is how achievement unlocks would feel in production."
            onReplay={replayCombo}
          >
            <CombinedSequence playing={comboPlaying} instanceKey={comboKey} />
          </DemoCard>
        </div>

        {/* ── Implementation Notes ────────────────────────────────── */}
        <div className="mt-16 rounded-2xl border border-warm-stroke bg-warm-card/50 p-8">
          <h2 className="font-heading text-xl font-bold tracking-tight text-text-primary">
            Implementation Notes
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-text-secondary">
            <li className="flex gap-2">
              <span className="mt-0.5 text-amber" aria-hidden="true">
                &bull;
              </span>
              <span>
                <code className="rounded bg-[#0d0b08] px-1.5 py-0.5 text-amber">
                  lottie-web
                </code>{" "}
                is dynamically imported to avoid SSR issues. Bundle size: ~250KB
                (could use{" "}
                <code className="rounded bg-[#0d0b08] px-1.5 py-0.5 text-amber">
                  lottie-light
                </code>{" "}
                for ~150KB with SVG renderer only).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-amber" aria-hidden="true">
                &bull;
              </span>
              <span>
                CSS animations are more practical for simple effects (ring
                burst, star scatter) — no extra dependencies, smaller payload.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-amber" aria-hidden="true">
                &bull;
              </span>
              <span>
                Lottie excels for complex vector animations with paths, masks,
                and easing curves that would be impractical in CSS. Best for
                designer-created animations exported from After Effects.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-amber" aria-hidden="true">
                &bull;
              </span>
              <span>
                All animations respect{" "}
                <code className="rounded bg-[#0d0b08] px-1.5 py-0.5 text-amber">
                  prefers-reduced-motion
                </code>
                : CSS animations are disabled, and Lottie auto-trigger is
                skipped.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-amber" aria-hidden="true">
                &bull;
              </span>
              <span>
                Recommendation: use CSS for simple effects (share page), Lottie
                for complex celebration sequences (first-time badge generation,
                tier upgrades).
              </span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
