"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import {
  fireSingleBurst,
  fireMultiBurst,
  fireFireworks,
  fireSubtleSparkle,
  type ConfettiPalette,
} from "@/lib/effects/celebrations/confetti";
import { BadgeContent, getBadgeContentCSS } from "@/components/badge/BadgeContent";
import { MOCK_STATS, MOCK_IMPACT } from "../__fixtures__/mock-data";

type Palette = ConfettiPalette;

/* ── Mock badge card ─────────────────────────────────────── */

function MockBadgeCard() {
  return (
    <div className="rounded-2xl border border-warm-stroke bg-warm-card p-6 w-full max-w-sm mx-auto">
      <BadgeContent stats={MOCK_STATS} impact={MOCK_IMPACT} />
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────────────── */

function DemoSection({
  title,
  description,
  children,
  badge,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  badge: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold font-heading text-text-primary tracking-tight mb-1">
          {title}
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          {description}
        </p>
      </div>
      <div className="mb-6">{badge}</div>
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );
}

/* ── Main page ───────────────────────────────────────────── */

export default function ConfettiExperimentPage() {
  const [particleCount, setParticleCount] = useState(100);
  const [speed, setSpeed] = useState(1);
  const [palette, setPalette] = useState<Palette>("amber");
  const sparkleRef = useRef<(() => void) | null>(null);
  const [sparkleActive, setSparkleActive] = useState(false);

  // Fire a single burst on mount to demonstrate
  useEffect(() => {
    const timer = setTimeout(() => {
      fireSingleBurst(80, "amber");
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleSingleBurst = useCallback(() => {
    fireSingleBurst(particleCount, palette);
  }, [particleCount, palette]);

  const handleMultiBurst = useCallback(() => {
    fireMultiBurst(particleCount, palette);
  }, [particleCount, palette]);

  const handleFireworks = useCallback(() => {
    fireFireworks(particleCount, palette, speed);
  }, [particleCount, palette, speed]);

  const toggleSparkle = useCallback(async () => {
    if (sparkleRef.current) {
      sparkleRef.current();
      sparkleRef.current = null;
      setSparkleActive(false);
    } else {
      sparkleRef.current = await fireSubtleSparkle(palette, speed);
      setSparkleActive(true);
    }
  }, [palette, speed]);

  // Cleanup sparkle on unmount
  useEffect(() => {
    return () => {
      if (sparkleRef.current) sparkleRef.current();
    };
  }, []);

  const handleReplayAll = useCallback(() => {
    fireSingleBurst(particleCount, palette);
    setTimeout(() => fireMultiBurst(particleCount, palette), 800);
    setTimeout(() => fireFireworks(particleCount, palette, speed), 2000);
  }, [particleCount, palette, speed]);

  return (
    <div className="min-h-screen bg-bg bg-grid-warm">
      <style>{getBadgeContentCSS({}).join("\n")}</style>
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed top-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-amber/[0.03] blur-[150px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-amber/[0.04] blur-[120px]"
        aria-hidden="true"
      />

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <header className="mb-12 animate-fade-in-up">
          <p className="text-amber text-sm tracking-widest uppercase mb-4 font-semibold">
            Experiment #45
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-heading text-text-primary tracking-tight mb-4">
            Confetti Burst
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed max-w-2xl">
            Celebratory effects for Elite-tier badges. When a developer reaches
            the Elite tier, the page erupts with amber-themed confetti to
            celebrate their achievement.
          </p>
        </header>

        {/* Controls panel */}
        <div className="mb-10 rounded-2xl border border-warm-stroke bg-warm-card/50 p-6 animate-fade-in-up [animation-delay:200ms]">
          <h2 className="text-lg font-bold font-heading text-text-primary tracking-tight mb-4">
            Controls
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Particle count */}
            <div>
              <label
                htmlFor="particle-count"
                className="block text-text-secondary text-sm mb-2"
              >
                Particles:{" "}
                <span className="text-amber font-semibold">{particleCount}</span>
              </label>
              <input
                id="particle-count"
                type="range"
                min={20}
                max={200}
                value={particleCount}
                onChange={(e) => setParticleCount(Number(e.target.value))}
                className="w-full accent-amber"
              />
              <div className="flex justify-between text-xs text-text-secondary mt-1">
                <span>20</span>
                <span>200</span>
              </div>
            </div>

            {/* Speed */}
            <div>
              <label
                htmlFor="speed"
                className="block text-text-secondary text-sm mb-2"
              >
                Speed:{" "}
                <span className="text-amber font-semibold">{speed.toFixed(1)}x</span>
              </label>
              <input
                id="speed"
                type="range"
                min={0.5}
                max={3}
                step={0.1}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-amber"
              />
              <div className="flex justify-between text-xs text-text-secondary mt-1">
                <span>0.5x</span>
                <span>3x</span>
              </div>
            </div>

            {/* Palette */}
            <div>
              <p className="text-text-secondary text-sm mb-2">Color Palette</p>
              <div className="flex gap-2">
                {(["amber", "gold", "rainbow"] as Palette[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPalette(p)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      palette === p
                        ? "bg-amber text-warm-bg"
                        : "border border-warm-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary"
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Replay all */}
            <div className="flex items-end">
              <button
                onClick={handleReplayAll}
                className="rounded-lg bg-amber px-8 py-3 text-sm font-semibold text-warm-bg hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 transition-all w-full"
              >
                Replay All
              </button>
            </div>
          </div>
        </div>

        {/* Demo sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Section A: Single Burst */}
          <DemoSection
            title="A. Single Burst"
            description="Fires once on initial badge view. Clean and celebratory."
            badge={<MockBadgeCard />}
          >
            <button
              onClick={handleSingleBurst}
              className="rounded-lg bg-amber px-6 py-2.5 text-sm font-semibold text-warm-bg hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 transition-all"
            >
              Fire Burst
            </button>
          </DemoSection>

          {/* Section B: Multi-Burst */}
          <DemoSection
            title="B. Multi-Burst"
            description="Three staggered bursts from different origins. Party-like feel."
            badge={<MockBadgeCard />}
          >
            <button
              onClick={handleMultiBurst}
              className="rounded-lg bg-amber px-6 py-2.5 text-sm font-semibold text-warm-bg hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 transition-all"
            >
              Fire Multi-Burst
            </button>
          </DemoSection>

          {/* Section C: Fireworks */}
          <DemoSection
            title="C. Fireworks"
            description="Continuous firework-style pops for 2 seconds. Most dramatic option."
            badge={<MockBadgeCard />}
          >
            <button
              onClick={handleFireworks}
              className="rounded-lg bg-amber px-6 py-2.5 text-sm font-semibold text-warm-bg hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 transition-all"
            >
              Launch Fireworks
            </button>
          </DemoSection>

          {/* Section D: Subtle Sparkle */}
          <DemoSection
            title="D. Subtle Sparkle"
            description="Very light ambient particles. Best for 'always on' celebration."
            badge={<MockBadgeCard />}
          >
            <button
              onClick={toggleSparkle}
              className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
                sparkleActive
                  ? "bg-amber-dark text-warm-bg hover:bg-amber"
                  : "bg-amber text-warm-bg hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25"
              }`}
            >
              {sparkleActive ? "Stop Sparkle" : "Start Sparkle"}
            </button>
          </DemoSection>
        </div>

        {/* Tier comparison */}
        <section className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-8 mb-12 animate-fade-in-up [animation-delay:400ms]">
          <h2 className="text-xl font-bold font-heading text-text-primary tracking-tight mb-2">
            Tier Mapping
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed mb-6">
            Which effect triggers at each tier level.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Elite */}
            <div className="rounded-xl border border-amber/30 bg-amber/[0.06] p-5 text-center">
              <p className="text-amber font-bold font-heading text-lg mb-1">
                Elite
              </p>
              <p className="text-text-secondary text-xs mb-3">Score 90+</p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1 text-xs text-amber font-medium">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Full confetti burst
              </div>
            </div>

            {/* High */}
            <div className="rounded-xl border border-amber-light/20 bg-amber-light/[0.04] p-5 text-center">
              <p className="text-amber-light font-bold font-heading text-lg mb-1">
                High
              </p>
              <p className="text-text-secondary text-xs mb-3">Score 75-89</p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-light/10 px-3 py-1 text-xs text-amber-light font-medium">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
                Subtle sparkle
              </div>
            </div>

            {/* Solid */}
            <div className="rounded-xl border border-warm-stroke bg-warm-card/30 p-5 text-center">
              <p className="text-text-secondary font-bold font-heading text-lg mb-1">
                Solid
              </p>
              <p className="text-text-secondary text-xs mb-3">Score 50-74</p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-text-secondary/5 px-3 py-1 text-xs text-text-secondary font-medium">
                No effect
              </div>
            </div>

            {/* Emerging */}
            <div className="rounded-xl border border-warm-stroke bg-warm-card/30 p-5 text-center">
              <p className="text-text-secondary font-bold font-heading text-lg mb-1">
                Emerging
              </p>
              <p className="text-text-secondary text-xs mb-3">Score &lt; 50</p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-text-secondary/5 px-3 py-1 text-xs text-text-secondary font-medium">
                No effect
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-text-secondary text-sm">
          <p>
            Experiment #45 &middot;{" "}
            <span className="text-amber font-medium">canvas-confetti</span>{" "}
            &middot; disableForReducedMotion enabled
          </p>
        </footer>
      </main>
    </div>
  );
}
