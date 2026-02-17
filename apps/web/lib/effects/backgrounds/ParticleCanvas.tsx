"use client";

import { useRef } from "react";
import { useParticles, PARTICLE_PRESETS } from "./ParticleBackground";

/**
 * Standalone ParticleCanvas component for dynamic import.
 * Wraps the useParticles hook with a canvas element using the sparkle preset.
 */
export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useParticles(canvasRef, PARTICLE_PRESETS.sparkle);
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full"
    />
  );
}
