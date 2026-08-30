"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  type GlassConfig,
  type GlassVariant,
  glassStyle,
  presetToStyle,
  PRESETS,
} from "./_components/glass-core";
import { BackgroundBlobs } from "./_components/BackgroundBlobs";
import { Toggle, Slider, StatCard } from "./_components/controls";
import { BadgeCard, CompactBadgeCard } from "./_components/BadgeCard";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function GlassmorphismExperimentPage() {
  // Controls state
  const [blur, setBlur] = useState(20);
  const [opacity, setOpacity] = useState(0.6);
  const [saturation, setSaturation] = useState(150);
  const [showBlobs, setShowBlobs] = useState(true);
  const [showBorder, setShowBorder] = useState(true);

  // Build dynamic glass config from controls
  const dynamicConfig: GlassConfig = {
    bgOpacity: opacity,
    blur,
    saturation,
    borderOpacity: 0.15,
    showBorder,
  };

  const handleResetControls = useCallback(() => {
    setBlur(20);
    setOpacity(0.6);
    setSaturation(150);
    setShowBlobs(true);
    setShowBorder(true);
  }, []);

  return (
    <main
      id="main-content"
      className="relative min-h-screen bg-bg"
    >
      {/* Background blobs — essential for glass to look like glass */}
      <BackgroundBlobs visible={showBlobs} />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        {/* ============================================ */}
        {/*  Header                                      */}
        {/* ============================================ */}
        <div className="mb-16 text-center">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Experiment #46
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
            Dark Glassmorphism
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-text-secondary leading-relaxed">
            Frosted glass containers with warm amber tint on a rich background.
            The key insight: glassmorphism only works when there is something
            colorful behind the glass. Toggle the background blobs off to see
            the difference.
          </p>
        </div>

        {/* ============================================ */}
        {/*  Section 1: Badge Card Showcase (4 variants) */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Glass Variants
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Four Levels of Frost
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {(Object.keys(PRESETS) as GlassVariant[]).map((variant) => {
              const preset = PRESETS[variant];
              return (
                <div key={variant} className="flex flex-col gap-3">
                  {/* Label */}
                  <div className="flex items-baseline justify-between">
                    <span className="font-heading text-sm font-bold text-text-primary">
                      {preset.label}
                    </span>
                    <span className="text-xs text-text-secondary">
                      blur: {preset.blur}px &middot; opacity:{" "}
                      {variant === "amber"
                        ? `amber ${preset.bgOpacity}`
                        : preset.bgOpacity}
                    </span>
                  </div>

                  {/* Glass card */}
                  <div
                    className="rounded-2xl p-6"
                    style={presetToStyle(variant, showBorder)}
                  >
                    <CompactBadgeCard />
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {preset.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ============================================ */}
        {/*  Section 2: Stacked Glass Panels (depth)     */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Depth &amp; Layering
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Stacked Glass Panels
          </h2>
          <p className="mb-8 max-w-xl text-text-secondary leading-relaxed">
            Multiple glass layers create a sense of depth. The lightest panel sits
            furthest back, the heaviest sits on top. Each layer picks up blur
            from the layers below it.
          </p>

          {/* Stacked container */}
          <div className="relative mx-auto" style={{ maxWidth: "40rem", height: "28rem" }}>
            {/* Layer 1: Light glass (background) */}
            <div
              className="absolute inset-0 rounded-2xl p-8"
              style={presetToStyle("light", showBorder)}
            >
              <p className="text-xs uppercase tracking-widest text-text-secondary">
                Layer 1 &mdash; Light Glass
              </p>
              <p className="mt-2 text-sm text-text-secondary/60 leading-relaxed">
                Background layer with subtle frosting. Content behind bleeds
                through softly, establishing ambient depth.
              </p>
            </div>

            {/* Layer 2: Medium glass (middle) */}
            <div
              className="absolute rounded-2xl p-6"
              style={{
                top: "3.5rem",
                left: "2rem",
                right: "2rem",
                bottom: "3.5rem",
                ...presetToStyle("medium", showBorder),
              }}
            >
              <p className="text-xs uppercase tracking-widest text-text-secondary">
                Layer 2 &mdash; Medium Glass
              </p>
              <p className="mt-2 text-sm text-text-secondary/60 leading-relaxed">
                Primary content layer. Balanced opacity provides readable
                contrast while preserving ambient blur.
              </p>
            </div>

            {/* Layer 3: Heavy glass (top) */}
            <div
              className="absolute rounded-2xl p-6"
              style={{
                top: "7rem",
                left: "4rem",
                right: "4rem",
                bottom: "7rem",
                ...presetToStyle("heavy", showBorder),
              }}
            >
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="font-heading text-5xl font-extrabold text-amber">
                  87
                </span>
                <span className="mt-2 rounded-full border border-amber/20 bg-amber/10 px-3 py-1 text-sm text-amber">
                  &#9733; Elite
                </span>
                <p className="mt-3 text-xs text-text-secondary">
                  Layer 3 &mdash; Heavy Glass
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/*  Section 3: Impact Breakdown in Glass Cards  */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Data Readability
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Impact Breakdown
          </h2>
          <p className="mb-8 max-w-xl text-text-secondary leading-relaxed">
            Testing data density inside glass containers. Each stat category
            lives in its own glass card, demonstrating that progress bars, text,
            and numbers remain readable through the frosted effect.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Delivery"
              value={34}
              maxValue={40}
              detail="Core code contributions across 12 repos. Consistent daily contribution pattern with weekend peaks."
              style={presetToStyle("medium", showBorder)}
            />
            <StatCard
              label="Quality"
              value={28}
              maxValue={30}
              detail="Code reviews, issue triage, and quality enforcement. Active reviewer with thoughtful feedback."
              style={presetToStyle("medium", showBorder)}
            />
            <StatCard
              label="Breadth"
              value={15}
              maxValue={20}
              detail="Contributions to 5 repos with 50K+ stars. Non-trivial changes across diverse codebases."
              style={presetToStyle("medium", showBorder)}
            />
            <StatCard
              label="Consistency"
              value={10}
              maxValue={10}
              detail="310 out of 365 days active. Strong sustained engagement over the full evaluation period."
              style={presetToStyle("medium", showBorder)}
            />
          </div>

          {/* Confidence row */}
          <div
            className="mt-4 rounded-2xl p-5"
            style={presetToStyle("amber", showBorder)}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-text-primary">
                Confidence
              </span>
              <span className="font-heading text-lg font-bold text-amber">
                92%
              </span>
            </div>
            <p className="mt-2 text-xs text-text-secondary leading-relaxed">
              High confidence. Public profile with consistent activity across
              multiple organizations. Contribution graph aligns with PR merge
              dates.
            </p>
          </div>
        </section>

        {/* ============================================ */}
        {/*  Section 4: Interactive Controls             */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Playground
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Customize the Glass
          </h2>

          <div className="grid gap-8 sm:grid-cols-2">
            {/* Controls panel */}
            <div className="flex flex-col gap-6 rounded-2xl border border-warm-stroke bg-warm-card/50 p-6">
              <h3 className="font-heading text-lg font-bold text-text-primary">
                Controls
              </h3>

              <Slider
                label="Blur amount"
                value={blur}
                min={0}
                max={40}
                step={1}
                unit="px"
                onChange={setBlur}
              />

              <Slider
                label="Background opacity"
                value={opacity}
                min={0.1}
                max={0.9}
                step={0.05}
                unit=""
                onChange={setOpacity}
              />

              <Slider
                label="Saturation"
                value={saturation}
                min={100}
                max={200}
                step={5}
                unit="%"
                onChange={setSaturation}
              />

              <Toggle
                checked={showBlobs}
                onChange={setShowBlobs}
                label="Background blobs (essential for glass effect)"
              />

              <Toggle
                checked={showBorder}
                onChange={setShowBorder}
                label="Border visibility"
              />

              <button
                type="button"
                onClick={handleResetControls}
                className="mt-2 self-start rounded-full border border-warm-stroke px-5 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:bg-amber/[0.04] hover:text-text-primary"
              >
                Reset defaults
              </button>
            </div>

            {/* Live preview card */}
            <div className="flex flex-col gap-4">
              <h3 className="font-heading text-lg font-bold text-text-primary">
                Live Preview
              </h3>
              <div
                className="rounded-2xl p-6"
                style={glassStyle(dynamicConfig)}
              >
                <BadgeCard />
              </div>

              {/* CSS output */}
              <div className="rounded-xl border border-warm-stroke bg-dark-section overflow-hidden">
                {/* Terminal header */}
                <div className="flex items-center gap-2 border-b border-warm-stroke px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-amber/20" />
                  <div className="h-3 w-3 rounded-full bg-amber/10" />
                  <div className="h-3 w-3 rounded-full bg-amber/[0.06]" />
                  <span className="ml-2 text-xs text-text-secondary">
                    Generated CSS
                  </span>
                </div>
                <pre className="overflow-x-auto p-4 font-heading text-xs leading-relaxed text-text-secondary">
                  <code>{`.glass-custom {
  background: rgba(19, 20, 30, ${opacity});
  backdrop-filter: blur(${blur}px) saturate(${saturation}%);
  -webkit-backdrop-filter: blur(${blur}px) saturate(${saturation}%);${
    showBorder
      ? `\n  border: 1px solid rgba(27, 208, 147, 0.15);`
      : ""
  }
}`}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/*  Observations section                        */}
        {/* ============================================ */}
        <section className="mb-16">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Findings
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Key Observations
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Blobs Are Essential",
                body: "Without colorful background elements, glass cards look identical to regular dark cards. The frosted effect is only visible when there is color variance behind the glass.",
              },
              {
                title: "Blur Sweet Spot: 16-24px",
                body: "Below 12px the frost is barely visible. Above 30px it becomes too opaque and defeats the purpose. The 16-24px range gives the best balance.",
              },
              {
                title: "Saturation Amplifies Warmth",
                body: "Increasing saturation above 120% makes the amber blobs more vivid through the glass, reinforcing the warm amber brand identity.",
              },
              {
                title: "Border Matters More Than Expected",
                body: "Without a border, glass panels blend into each other and lose definition. Even a subtle 12% opacity amber border creates essential edge contrast.",
              },
            ].map((finding) => (
              <div
                key={finding.title}
                className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6"
              >
                <h3 className="font-heading mb-2 text-sm font-bold text-text-primary">
                  {finding.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {finding.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/"
            className="rounded-full border border-warm-stroke px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:bg-amber/[0.04] hover:text-text-primary"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
