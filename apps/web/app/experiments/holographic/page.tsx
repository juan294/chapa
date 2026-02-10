"use client";

import { useState, useCallback, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Variant = "amber" | "rainbow" | "mouse";

/* ------------------------------------------------------------------ */
/*  Mock heatmap data (13 weeks x 7 days)                              */
/* ------------------------------------------------------------------ */

function generateHeatmap(): number[][] {
  const seed = 42;
  let s = seed;
  const next = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
  return Array.from({ length: 13 }, () =>
    Array.from({ length: 7 }, () => {
      const v = next();
      if (v < 0.25) return 0;
      if (v < 0.5) return 0.2;
      if (v < 0.7) return 0.45;
      if (v < 0.85) return 0.7;
      return 1;
    }),
  );
}

const HEATMAP = generateHeatmap();

/* ------------------------------------------------------------------ */
/*  HoloCard                                                           */
/* ------------------------------------------------------------------ */

interface HoloCardProps {
  variant: Variant;
  intensity: number; // 0.2 – 0.8
  speed: number; // 1 – 6 (seconds for one cycle)
  autoAnimate: boolean;
}

function HoloCard({ variant, intensity, speed, autoAnimate }: HoloCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  /* Mouse-tracking handler */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (variant !== "mouse" || autoAnimate) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const angle =
        Math.atan2(y - 50, x - 50) * (180 / Math.PI) + 90;
      e.currentTarget.style.setProperty("--holo-angle", `${angle}deg`);
      e.currentTarget.style.setProperty("--holo-x", `${x}%`);
      e.currentTarget.style.setProperty("--holo-y", `${y}%`);
    },
    [variant, autoAnimate],
  );

  const handleMouseEnter = useCallback(() => setHovering(true), []);
  const handleMouseLeave = useCallback(() => {
    setHovering(false);
    if (cardRef.current) {
      cardRef.current.style.setProperty("--holo-angle", "115deg");
      cardRef.current.style.setProperty("--holo-x", "50%");
      cardRef.current.style.setProperty("--holo-y", "50%");
    }
  }, []);

  /* Determine CSS class for overlay gradient */
  const overlayClass =
    variant === "rainbow" ? "holo-overlay holo-rainbow" : "holo-overlay holo-amber";

  return (
    <div
      ref={cardRef}
      className="holo-card group relative"
      style={
        {
          "--holo-intensity": intensity,
          "--holo-speed": `${speed}s`,
          "--holo-angle": "115deg",
          "--holo-x": "50%",
          "--holo-y": "50%",
        } as React.CSSProperties
      }
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Holographic overlay */}
      <div
        className={`${overlayClass} ${hovering || autoAnimate ? "active" : ""} ${autoAnimate ? "auto-animate" : ""}`}
        aria-hidden="true"
      />

      {/* Card content */}
      <div className="relative z-[5] flex h-full flex-col justify-between p-6 sm:p-8">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className="font-heading text-base font-bold text-[#E2A84B] sm:text-lg">
            @juan294
          </span>
          <span className="font-heading text-sm font-medium tracking-widest text-[#9AA4B2]">
            Chapa.
          </span>
        </div>

        {/* Middle: heatmap + score */}
        <div className="flex flex-1 items-center gap-6 py-4 sm:gap-10">
          {/* Heatmap grid */}
          <div className="flex gap-[3px]">
            {HEATMAP.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((val, di) => (
                  <div
                    key={di}
                    className="h-[6px] w-[6px] rounded-[1.5px] sm:h-[8px] sm:w-[8px] sm:rounded-[2px]"
                    style={{
                      backgroundColor:
                        val === 0
                          ? "rgba(226,168,75,0.06)"
                          : `rgba(226,168,75,${val})`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Score + Tier */}
          <div className="flex flex-col items-end ml-auto">
            <span className="font-heading text-5xl font-extrabold leading-none text-[#E6EDF3] sm:text-6xl">
              87
            </span>
            <span className="mt-2 inline-block rounded-full bg-[#E2A84B]/15 px-3 py-0.5 text-xs font-semibold tracking-wide text-[#E2A84B]">
              Elite
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-[#9AA4B2] sm:text-sm">
          <span>523 commits</span>
          <span className="text-[rgba(226,168,75,0.25)]">|</span>
          <span>47 PRs</span>
          <span className="text-[rgba(226,168,75,0.25)]">|</span>
          <span>89 reviews</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Controls                                                           */
/* ------------------------------------------------------------------ */

interface ControlsProps {
  intensity: number;
  setIntensity: (v: number) => void;
  speed: number;
  setSpeed: (v: number) => void;
  autoAnimate: boolean;
  setAutoAnimate: (v: boolean) => void;
}

function Controls({
  intensity,
  setIntensity,
  speed,
  setSpeed,
  autoAnimate,
  setAutoAnimate,
}: ControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-6 rounded-xl border border-[rgba(226,168,75,0.12)] bg-[#1A1610]/60 px-6 py-4">
      {/* Intensity */}
      <label className="flex items-center gap-3 text-sm text-[#9AA4B2]">
        <span className="min-w-[70px]">Intensity</span>
        <input
          type="range"
          min={0.1}
          max={0.9}
          step={0.05}
          value={intensity}
          onChange={(e) => setIntensity(parseFloat(e.target.value))}
          className="holo-slider w-28"
        />
        <span className="w-8 font-heading text-xs text-[#E2A84B]">
          {Math.round(intensity * 100)}%
        </span>
      </label>

      {/* Speed */}
      <label className="flex items-center gap-3 text-sm text-[#9AA4B2]">
        <span className="min-w-[50px]">Speed</span>
        <input
          type="range"
          min={1}
          max={8}
          step={0.5}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="holo-slider w-28"
        />
        <span className="w-8 font-heading text-xs text-[#E2A84B]">
          {speed}s
        </span>
      </label>

      {/* Auto-animate toggle */}
      <label className="flex cursor-pointer items-center gap-3 text-sm text-[#9AA4B2]">
        <span>Auto</span>
        <button
          type="button"
          role="switch"
          aria-checked={autoAnimate}
          onClick={() => setAutoAnimate(!autoAnimate)}
          className={`relative h-6 w-11 rounded-full border transition-colors ${
            autoAnimate
              ? "border-[#E2A84B]/40 bg-[#E2A84B]/25"
              : "border-[rgba(226,168,75,0.12)] bg-[#1A1610]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[#E2A84B] transition-transform ${
              autoAnimate ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HolographicExperimentPage() {
  const [intensity, setIntensity] = useState(0.45);
  const [speed, setSpeed] = useState(3);
  const [autoAnimate, setAutoAnimate] = useState(() => {
    /* Auto-detect touch devices to force auto-animate */
    if (typeof window !== "undefined" && "ontouchstart" in window) {
      return true;
    }
    return true;
  });

  const variants: { key: Variant; title: string; description: string }[] = [
    {
      key: "amber",
      title: "Warm Amber Holo",
      description:
        "Amber-only spectrum. Fits the Chapa brand palette. Recommended for production.",
    },
    {
      key: "rainbow",
      title: "Full Rainbow Holo",
      description:
        "Full prismatic spectrum for a classic trading card feel.",
    },
    {
      key: "mouse",
      title: "Mouse-Tracking Holo",
      description:
        "Gradient angle follows your cursor. Toggle auto-animate off to see the effect.",
    },
  ];

  return (
    <>
      {/* Inline styles for the holographic effect (self-contained) */}
      <style>{`
        /* ---- Holographic card base ---- */
        .holo-card {
          position: relative;
          overflow: hidden;
          aspect-ratio: 1200 / 630;
          width: 100%;
          max-width: 560px;
          border-radius: 1rem;
          border: 1px solid rgba(226, 168, 75, 0.12);
          background: #1A1610;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .holo-card:hover {
          border-color: rgba(226, 168, 75, 0.25);
          box-shadow: 0 0 40px rgba(226, 168, 75, 0.06);
        }

        /* ---- Holographic overlay ---- */
        .holo-overlay {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background-size: 200% 200%;
          mix-blend-mode: color-dodge;
          opacity: 0;
          transition: opacity 0.4s ease;
          pointer-events: none;
          z-index: 8;
        }

        /* Amber gradient */
        .holo-amber {
          background: linear-gradient(
            var(--holo-angle, 115deg),
            transparent 20%,
            rgba(226, 168, 75, 0.3) 36%,
            rgba(240, 201, 125, 0.3) 42%,
            rgba(255, 255, 255, 0.2) 48%,
            rgba(240, 201, 125, 0.3) 54%,
            rgba(194, 138, 46, 0.3) 60%,
            transparent 80%
          );
          background-size: 200% 200%;
        }

        /* Rainbow gradient */
        .holo-rainbow {
          background: linear-gradient(
            var(--holo-angle, 115deg),
            transparent 20%,
            rgba(255, 0, 100, 0.25) 30%,
            rgba(255, 150, 0, 0.25) 38%,
            rgba(255, 255, 0, 0.25) 44%,
            rgba(0, 255, 100, 0.25) 50%,
            rgba(0, 100, 255, 0.25) 56%,
            rgba(150, 0, 255, 0.25) 64%,
            transparent 80%
          );
          background-size: 200% 200%;
        }

        /* Active states */
        .holo-overlay.active {
          opacity: var(--holo-intensity, 0.45);
        }

        .holo-overlay.auto-animate.active {
          animation: holo-shift var(--holo-speed, 3s) ease infinite;
        }

        @keyframes holo-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        /* ---- prefers-reduced-motion ---- */
        @media (prefers-reduced-motion: reduce) {
          .holo-overlay {
            opacity: calc(var(--holo-intensity, 0.45) * 0.4) !important;
            animation: none !important;
            background-position: 50% 50%;
          }
        }

        /* ---- Slider styling ---- */
        .holo-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          background: rgba(226, 168, 75, 0.15);
          outline: none;
        }

        .holo-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #E2A84B;
          cursor: pointer;
          border: 2px solid #12100D;
        }

        .holo-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #E2A84B;
          cursor: pointer;
          border: 2px solid #12100D;
        }

        .holo-slider:focus-visible::-webkit-slider-thumb {
          outline: 2px solid #E2A84B;
          outline-offset: 2px;
        }
      `}</style>

      <div className="min-h-screen bg-[#12100D] px-6 py-16">
        <div className="mx-auto max-w-5xl">
          {/* Page header */}
          <header className="mb-4">
            <p className="mb-3 text-sm tracking-widest text-[#E2A84B] uppercase">
              Experiment #43
            </p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-[#E6EDF3] sm:text-4xl">
              Holographic / Iridescent Effect
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#9AA4B2]">
              A trading-card-style holographic shimmer that plays on hover. Three
              variants: warm amber (on-brand), full rainbow, and
              mouse-tracking. Adjust intensity and speed below.
            </p>
          </header>

          {/* Shared controls */}
          <div className="mb-12 mt-8">
            <Controls
              intensity={intensity}
              setIntensity={setIntensity}
              speed={speed}
              setSpeed={setSpeed}
              autoAnimate={autoAnimate}
              setAutoAnimate={setAutoAnimate}
            />
          </div>

          {/* Variants */}
          <div className="space-y-16">
            {variants.map(({ key, title, description }) => (
              <section key={key}>
                <h2 className="font-heading text-xl font-semibold tracking-tight text-[#E6EDF3]">
                  {title}
                </h2>
                <p className="mt-1 mb-6 text-sm text-[#9AA4B2]">
                  {description}
                </p>
                <HoloCard
                  variant={key}
                  intensity={intensity}
                  speed={speed}
                  autoAnimate={autoAnimate}
                />
              </section>
            ))}
          </div>

          {/* Notes */}
          <footer className="mt-16 rounded-xl border border-[rgba(226,168,75,0.12)] bg-[#1A1610]/40 p-6">
            <h3 className="font-heading text-sm font-semibold text-[#E2A84B]">
              Implementation Notes
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-[#9AA4B2]">
              <li>
                Uses a <code className="text-[#E6EDF3]/70">{"::before"}</code>{" "}
                pseudo-element with{" "}
                <code className="text-[#E6EDF3]/70">mix-blend-mode: color-dodge</code>{" "}
                for the overlay.
              </li>
              <li>
                Mouse-tracking variant updates{" "}
                <code className="text-[#E6EDF3]/70">--holo-angle</code> CSS
                custom property via JS.
              </li>
              <li>
                <code className="text-[#E6EDF3]/70">pointer-events: none</code>{" "}
                on the overlay so content remains interactive.
              </li>
              <li>
                <code className="text-[#E6EDF3]/70">
                  prefers-reduced-motion
                </code>{" "}
                shows a static, low-opacity overlay with no animation.
              </li>
              <li>
                On touch devices, auto-animate is enabled by default since hover is unavailable.
              </li>
            </ul>
          </footer>
        </div>
      </div>
    </>
  );
}
