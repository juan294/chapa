"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { BadgeContent, getBadgeContentCSS } from "@/components/badge/BadgeContent";
import { MOCK_STATS, MOCK_IMPACT } from "../__fixtures__/mock-data";

/* ------------------------------------------------------------------ */
/*  Pure tilt computation (hook is in use-tilt.ts, tested separately)  */
/* ------------------------------------------------------------------ */
import { computeTilt, type TiltState } from "@/lib/effects/interactions/use-tilt";

/* ------------------------------------------------------------------ */
/*  Badge Card                                                         */
/* ------------------------------------------------------------------ */
interface BadgeCardProps {
  glare: boolean;
  tilt: TiltState;
}

function BadgeCard({ glare, tilt }: BadgeCardProps) {
  return (
    <>
      {/* Glare overlay */}
      {glare && tilt.isHovering && (
        <div
          className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
          style={{
            background: `radial-gradient(circle at ${tilt.mouseX} ${tilt.mouseY}, rgba(255,255,255,0.12) 0%, transparent 60%)`,
          }}
          aria-hidden="true"
        />
      )}

      <div className="relative z-[1]">
        <BadgeContent stats={MOCK_STATS} impact={MOCK_IMPACT} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Controls                                                           */
/* ------------------------------------------------------------------ */
interface ControlsProps {
  maxTilt: number;
  setMaxTilt: (v: number) => void;
  glare: boolean;
  setGlare: (v: boolean) => void;
}

function Controls({
  maxTilt,
  setMaxTilt,
  glare,
  setGlare,
}: ControlsProps) {
  return (
    <div className="mx-auto mt-12 flex max-w-md flex-col gap-6 rounded-2xl border border-warm-stroke bg-warm-card/50 p-6">
      <h2 className="font-heading text-lg font-bold text-text-primary">
        Controls
      </h2>

      {/* Tilt sensitivity */}
      <label className="flex flex-col gap-2">
        <span className="text-sm text-text-secondary">
          Tilt sensitivity:{" "}
          <span className="font-heading text-amber">{maxTilt}&deg;</span>
        </span>
        <input
          type="range"
          min={5}
          max={25}
          step={1}
          value={maxTilt}
          onChange={(e) => setMaxTilt(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-warm-stroke accent-amber"
        />
        <div className="flex justify-between text-xs text-text-secondary">
          <span>5&deg;</span>
          <span>25&deg;</span>
        </div>
      </label>

      {/* Glare toggle */}
      <label className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={glare}
          onClick={() => setGlare(!glare)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            glare ? "bg-amber" : "bg-warm-stroke"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-warm-bg transition-transform ${
              glare ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-sm text-text-secondary">Glare effect</span>
      </label>

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function TiltExperimentPage() {
  const [maxTilt, setMaxTilt] = useState(15);
  const [glare, setGlare] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<TiltState>({
    rotateX: 0,
    rotateY: 0,
    mouseX: "50%",
    mouseY: "50%",
    isHovering: false,
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTilt(computeTilt(e.clientX, e.clientY, rect, maxTilt));
    },
    [maxTilt],
  );

  const handleMouseLeave = useCallback(() => {
    setTilt({
      rotateX: 0,
      rotateY: 0,
      mouseX: "50%",
      mouseY: "50%",
      isHovering: false,
    });
  }, []);

  const transformStyle = tilt.isHovering
    ? `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale3d(1.02, 1.02, 1.02)`
    : "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center bg-bg px-6 py-16"
    >
      <style>{getBadgeContentCSS({}).join("\n")}</style>
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber/[0.04] blur-[150px]"
        style={{ width: "600px", height: "400px" }}
        aria-hidden="true"
      />

      {/* Header */}
      <div className="relative z-10 mb-12 text-center">
        <p className="mb-4 text-sm uppercase tracking-widest text-amber">
          Experiment #42
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
          3D Tilt Effect
        </h1>
        <p className="mt-4 max-w-xl text-text-secondary leading-relaxed">
          Move your mouse over the badge card to see the 3D perspective tilt.
          The card responds to cursor position with smooth rotation, optional
          glare, and depth-based parallax layers.
        </p>
      </div>

      {/* Badge card with tilt */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative z-10 w-full max-w-2xl cursor-default overflow-hidden rounded-2xl border border-warm-stroke bg-warm-card p-8"
        style={{
          aspectRatio: "1200 / 630",
          transform: transformStyle,
          transition: tilt.isHovering
            ? "transform 0.1s ease-out"
            : "transform 0.5s ease-out",
          willChange: "transform",
          transformStyle: undefined,
        }}
      >
        <BadgeCard glare={glare} tilt={tilt} />
      </div>

      {/* Rotation readout */}
      <div className="relative z-10 mt-4 font-heading text-xs text-text-secondary">
        rotateX:{" "}
        <span className="text-amber">{tilt.rotateX.toFixed(1)}&deg;</span>
        &ensp;|&ensp;rotateY:{" "}
        <span className="text-amber">{tilt.rotateY.toFixed(1)}&deg;</span>
      </div>

      {/* Controls */}
      <Controls
        maxTilt={maxTilt}
        setMaxTilt={setMaxTilt}
        glare={glare}
        setGlare={setGlare}
      />

      {/* Variations section */}
      <section className="relative z-10 mt-20 w-full max-w-4xl">
        <p className="mb-4 text-sm uppercase tracking-widest text-amber">
          Variations
        </p>
        <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
          Effect Breakdown
        </h2>

        <div className="grid gap-8 sm:grid-cols-3">
          {/* Card 1: Base tilt only */}
          <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6">
            <h3 className="font-heading mb-2 text-sm font-bold text-text-primary">
              Base Tilt
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Pure perspective transform following cursor position. No glare, no
              depth layers. Clean rotation with spring-back easing on mouse
              leave.
            </p>
            <div className="mt-4 rounded-lg border border-warm-stroke bg-warm-bg/50 p-3">
              <code className="font-heading text-xs text-amber/70">
                perspective(1000px) rotateX() rotateY()
              </code>
            </div>
          </div>

          {/* Card 2: With glare */}
          <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6">
            <h3 className="font-heading mb-2 text-sm font-bold text-text-primary">
              + Glare
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Radial gradient overlay that follows the mouse position, simulating
              light reflection on a glossy surface. Uses CSS custom properties
              for real-time positioning.
            </p>
            <div className="mt-4 rounded-lg border border-warm-stroke bg-warm-bg/50 p-3">
              <code className="font-heading text-xs text-amber/70">
                radial-gradient(circle at mouseX mouseY)
              </code>
            </div>
          </div>

          {/* Card 3: With depth */}
          <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6">
            <h3 className="font-heading mb-2 text-sm font-bold text-text-primary">
              + Depth Layers
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Child elements use different translateZ values creating parallax
              within the card. The score floats forward, heatmap recedes, giving
              physical depth.
            </p>
            <div className="mt-4 rounded-lg border border-warm-stroke bg-warm-bg/50 p-3">
              <code className="font-heading text-xs text-amber/70">
                transform-style: preserve-3d
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Back link */}
      <div className="relative z-10 mt-16">
        <Link
          href="/"
          className="rounded-full border border-warm-stroke px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:bg-amber/[0.04] hover:text-text-primary"
        >
          &larr; Back to Home
        </Link>
      </div>
    </main>
  );
}
