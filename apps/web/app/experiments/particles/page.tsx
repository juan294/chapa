"use client";

import {
  DOTS_CONFIG,
  CONSTELLATION_CONFIG,
  DUST_CONFIG,
  SPARKLE_CONFIG,
  INTERACTIVE_CONFIG,
} from "./_components/particle-core";
import { ParticleSection, ParticleCanvas } from "./_components/ParticleCanvas";
import { PlaygroundSection } from "./_components/PlaygroundSection";
import { DetailRow } from "./_components/controls";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ParticlesExperimentPage() {
  return (
    <main id="main-content" className="min-h-screen bg-bg">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed top-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-amber/[0.03] blur-[150px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-amber/[0.04] blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <header className="mb-12 animate-fade-in-up">
          <p className="text-amber text-sm tracking-widest uppercase mb-4 font-semibold">
            Experiment #49
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-heading text-text-primary tracking-tight mb-4">
            Canvas <span className="text-amber">Particle System</span>
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed max-w-2xl">
            Lightweight, custom-built canvas particle system for ambient
            floating particles behind the badge card. Zero external
            dependencies.
          </p>
        </header>

        {/* Preset demos */}
        <div className="space-y-8 mb-12">
          {/* Section 1: Dots */}
          <ParticleSection
            title="1. Floating Dots"
            description="Simple floating amber dots drifting around the badge. Subtle and non-distracting. 60 particles, no connections."
            config={DOTS_CONFIG}
          />

          {/* Section 2: Constellation */}
          <ParticleSection
            title="2. Constellation"
            description="Particles connected by faint lines when close together, forming a web-like network. 40 particles with 150px connection distance."
            config={CONSTELLATION_CONFIG}
          />

          {/* Section 3: Dust Motes */}
          <ParticleSection
            title="3. Golden Dust"
            description="Larger, very transparent particles drifting at minimal speed. Like golden dust motes catching light. 25 particles, 2-5px radius."
            config={DUST_CONFIG}
          />

          {/* Section 4: Sparkles */}
          <ParticleSection
            title="4. Sparkles"
            description="Tiny particles with oscillating opacity creating a twinkling effect. Includes a few white particles for contrast. 80 particles, 0.5-1.5px radius."
            config={SPARKLE_CONFIG}
          />

          {/* Section 5: Mouse Interactive */}
          <section className="rounded-2xl border border-stroke bg-card/50 overflow-hidden">
            <div className="p-6 border-b border-stroke">
              <h2 className="text-lg font-bold font-heading text-text-primary tracking-tight mb-1">
                5. Mouse Interactive
              </h2>
              <p className="text-text-secondary text-sm leading-relaxed">
                Particles gently push away from the cursor. Move your mouse
                over the canvas to see the repulsion effect. 50 particles
                with connections and 120px repulsion radius.
              </p>
            </div>
            <ParticleCanvas config={INTERACTIVE_CONFIG} />
          </section>
        </div>

        {/* Playground */}
        <div className="mb-12">
          <p className="text-amber text-sm tracking-widest uppercase mb-4 font-semibold">
            Playground
          </p>
          <PlaygroundSection />
        </div>

        {/* Implementation notes */}
        <section className="mb-12">
          <p className="text-amber text-sm tracking-widest uppercase mb-4 font-semibold">
            Notes
          </p>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary tracking-tight mb-6">
            Implementation Details
          </h2>
          <div className="rounded-2xl border border-stroke bg-card/60 p-6 space-y-4">
            <DetailRow
              title="Zero Dependencies"
              text="Entirely custom canvas implementation. No tsParticles, no external libraries. Just requestAnimationFrame and the Canvas 2D API."
            />
            <DetailRow
              title="Retina Support"
              text="Canvas resolution scales with window.devicePixelRatio for crisp rendering on HiDPI displays."
            />
            <DetailRow
              title="Performance"
              text="Particle count capped at reasonable levels (< 150). O(n^2) connection check only runs when connections are enabled. requestAnimationFrame for smooth 60fps."
            />
            <DetailRow
              title="Accessibility"
              text="Canvas is aria-hidden and decorative only. prefers-reduced-motion: reduce renders particles once without animation."
            />
            <DetailRow
              title="Interaction"
              text="Mouse repulsion uses distance-based force with configurable radius. Particles wrap around edges for seamless movement."
            />
            <DetailRow
              title="Compositing"
              text="Canvas sits behind the badge card via absolute positioning. Badge card has pointer-events: none so mouse can reach canvas for interaction."
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-text-secondary text-sm">
          <p>
            Experiment #49 &middot;{" "}
            <span className="text-amber font-medium">
              Custom Canvas 2D
            </span>{" "}
            &middot; Zero external dependencies
          </p>
        </footer>
      </div>
    </main>
  );
}
