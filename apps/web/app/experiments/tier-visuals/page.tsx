"use client";

import { TIERS } from "./_components/tier-data";
import { TIER_VISUALS_CSS } from "./_components/tier-styles";
import { BadgeCard } from "./_components/BadgeCard";
import { TierTransitionDemo } from "./_components/TierTransitionDemo";
import { EscalationSummary } from "./_components/EscalationSummary";

/* ══════════════════════════════════════════════════════════════
   Experiment #47 — Tier-Specific Progressive Visual Treatment
   Shows 4 badge cards with escalating premium visual effects
   for each tier: Emerging, Solid, High, Elite.
   ══════════════════════════════════════════════════════════════ */

export default function TierVisualsExperimentPage() {
  return (
    <>
      {/* Inline styles for tier-specific effects */}
      {/* SAFETY: CSS-only string literal with no user input — used for @keyframes and tier-specific styles that cannot be expressed in Tailwind. */}
      <style
        dangerouslySetInnerHTML={{
          __html: TIER_VISUALS_CSS,
        }}
      />

      <main id="main-content" className="min-h-screen bg-bg bg-grid-warm">
        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-1/4 -left-32 h-[500px] w-[500px] rounded-full bg-amber/[0.03] blur-[150px]" />
          <div className="absolute bottom-1/3 -right-32 h-[400px] w-[400px] rounded-full bg-amber/[0.04] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 sm:py-24">
          {/* Header */}
          <header className="mb-12 sm:mb-16 animate-fade-in-up">
            <p className="text-amber text-sm tracking-widest uppercase mb-4 font-semibold">
              Experiment #47
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-heading text-text-primary tracking-tight mb-4">
              Tier-Specific{" "}
              <span className="text-amber">Visual Treatment</span>
            </h1>
            <p className="text-text-secondary text-base sm:text-lg leading-relaxed">
              Progressive visual escalation across four tiers. Higher tiers earn
              more premium effects. Emerging is clean and professional. Elite is
              extraordinary, jewel-like, alive. The goal: when you see an Elite
              badge, you want to earn one.
            </p>
          </header>

          {/* ── Section 1: Four-card showcase ──────────────── */}
          <section className="mb-16 sm:mb-20 animate-fade-in-up [animation-delay:200ms]">
            <div className="mb-8">
              <p className="text-amber text-sm tracking-widest uppercase mb-2 font-medium">
                Showcase
              </p>
              <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary tracking-tight">
                All Four Tiers
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 sm:gap-8">
              {TIERS.map((data) => (
                <BadgeCard key={data.tier} data={data} />
              ))}
            </div>
          </section>

          {/* ── Section 2: Tier transition demo ────────────── */}
          <div className="mb-16 sm:mb-20 animate-fade-in-up [animation-delay:400ms]">
            <TierTransitionDemo />
          </div>

          {/* ── Section 3: Visual escalation summary ───────── */}
          <div className="mb-16 sm:mb-20 animate-fade-in-up [animation-delay:600ms]">
            <EscalationSummary />
          </div>

          {/* ── Implementation notes ───────────────────────── */}
          <section className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6 sm:p-8 animate-fade-in-up [animation-delay:800ms]">
            <h2 className="text-lg sm:text-xl font-bold font-heading text-text-primary tracking-tight mb-4">
              Implementation Notes
            </h2>
            <ul className="space-y-3 text-sm text-text-secondary leading-relaxed">
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">1.</span>
                <span>
                  <strong className="text-text-primary">Pure CSS effects</strong>{" "}
                  &mdash; All visual treatments use CSS only. No external animation
                  libraries. Elite border uses{" "}
                  <code className="font-heading text-amber/70 text-xs">@property</code>{" "}
                  for smooth conic-gradient rotation with a linear-gradient fallback.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">2.</span>
                <span>
                  <strong className="text-text-primary">Progressive treatment</strong>{" "}
                  &mdash; Emerging (gray, static) &rarr; Solid (white, shadow depth) &rarr;
                  High (gold gradient, warm glow) &rarr; Elite (shimmer, rotating
                  border, sparkles, outer glow). Each step is a clear visual upgrade.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">3.</span>
                <span>
                  <strong className="text-text-primary">Score animation</strong>{" "}
                  &mdash; Tier transition uses{" "}
                  <code className="font-heading text-amber/70 text-xs">requestAnimationFrame</code>{" "}
                  with cubic ease-out for smooth score counting between tiers.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">4.</span>
                <span>
                  <strong className="text-text-primary">Accessibility</strong>{" "}
                  &mdash; All animations respect{" "}
                  <code className="font-heading text-amber/70 text-xs">prefers-reduced-motion</code>.
                  Decorative elements have{" "}
                  <code className="font-heading text-amber/70 text-xs">aria-hidden</code>.
                  Heatmaps have descriptive aria labels.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber shrink-0" aria-hidden="true">5.</span>
                <span>
                  <strong className="text-text-primary">Heatmap density</strong>{" "}
                  &mdash; Each tier generates deterministic heatmap data with
                  different fill densities. Elite has dense activity, Emerging is
                  sparse. Color palette shifts per tier (gray &rarr; white &rarr; amber).
                </span>
              </li>
            </ul>
          </section>

          {/* Footer */}
          <footer className="mt-12 text-center text-text-secondary text-sm">
            <p>
              Experiment #47 &middot;{" "}
              <span className="text-amber font-medium">Pure CSS</span>{" "}
              &middot; prefers-reduced-motion supported
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
