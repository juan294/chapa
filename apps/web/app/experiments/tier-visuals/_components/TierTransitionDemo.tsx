"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TIERS } from "./tier-data";
import { BadgeCard } from "./BadgeCard";

/* ── Tier transition demo ─────────────────────────────────── */

export function TierTransitionDemo() {
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
                ? "bg-amber text-white"
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
