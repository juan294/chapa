"use client";

import { useRef } from "react";
import { useParticles, type ParticleConfig } from "./particle-core";
import { MockBadgeCard } from "./MockBadgeCard";

/* ------------------------------------------------------------------ */
/*  Particle canvas with badge overlay                                 */
/* ------------------------------------------------------------------ */

/**
 * A particle-animated canvas with the mock badge centered on top.
 * Used for preset demos, the interactive section, and the playground —
 * the only difference between call sites is the wrapper height.
 */
export function ParticleCanvas({
  config,
  height = "h-[420px]",
}: {
  config: ParticleConfig;
  height?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useParticles(canvasRef, config);

  return (
    <div className={`relative ${height} bg-bg`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <MockBadgeCard />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section with particles behind badge                                */
/* ------------------------------------------------------------------ */

export function ParticleSection({
  title,
  description,
  config,
  height = "h-[420px]",
}: {
  title: string;
  description: string;
  config: ParticleConfig;
  height?: string;
}) {
  return (
    <section className="rounded-2xl border border-stroke bg-card/50 overflow-hidden">
      <div className="p-6 border-b border-stroke">
        <h2 className="text-lg font-bold font-heading text-text-primary tracking-tight mb-1">
          {title}
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
      </div>
      <ParticleCanvas config={config} height={height} />
    </section>
  );
}
