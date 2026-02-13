# Badge Design v1 Spec

> Single source of truth for the Chapa badge visual layout.
> Implemented in `apps/web/components/badge/BadgeContent.tsx`.

## Overview

The badge is a dark card (`bg-card #111118`) with `rounded-2xl p-6` padding. Default aspect ratio is unconstrained (content-driven), but the embeddable SVG renders at 1200×630.

The layout has five vertical sections: **Header**, **Body** (two columns), **Dimension Cards** (4-col grid), **Footer**, and conditional **Tier Sparkles**.

---

## 1. Header

```
┌─────────────────────────────────────────────────┐
│  [avatar] DisplayName ✓   Last 12 months  Chapa_│
└─────────────────────────────────────────────────┘
```

### Left group (`flex items-center gap-3`)

| Element | Classes / Attributes | Details |
|---------|---------------------|---------|
| Avatar image | `w-8 h-8 rounded-full ring-2 ring-amber/30` | 32×32px, `<img>` with `alt=""` (decorative). Falls back to `bg-amber/20 ring-2 ring-amber/30` div when no `avatarUrl`. |
| Name container | `flex-1 min-w-0` | Prevents overflow. |
| Display name | `text-text-primary font-heading font-bold text-sm truncate` | Shows `stats.displayName ?? @${stats.handle}`. |
| Verified shield | `w-3.5 h-3.5 text-amber opacity-40 flex-shrink-0` | SVG `fill="currentColor"`. Path: `M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z`. |
| Subtitle | `text-text-secondary text-xs` | Static text: "Last 12 months". |

### Right group

| Element | Classes | Details |
|---------|---------|---------|
| Logo text | `text-sm font-heading text-text-secondary/50 tracking-tight` | `Chapa` + `<span className="text-amber">_</span>`. |

### Spacing

- Header bottom margin: `mb-5`.
- Layout: `flex items-center justify-between`.

---

## 2. Body (Two Columns)

```
┌──────────────────┬──────────────────────┐
│  Activity         │  Developer Profile   │
│  ┌──┬──┬──┬──┐   │  ┌────────────────┐  │
│  │  │  │  │  │   │  │  Radar Chart   │  │
│  │ Heatmap Grid│   │  │  (140×140 SVG) │  │
│  │  │  │  │  │   │  └────────────────┘  │
│  └──┴──┴──┴──┘   │  [Archetype Pill]    │
│                   │  [Score] [Tier Pill] │
│                   │  [Confidence %]      │
└──────────────────┴──────────────────────┘
```

Layout: `flex gap-6`.

### 2a. Left Column — Activity Heatmap

| Element | Classes | Details |
|---------|---------|---------|
| Container | `flex-1 min-w-0` | Flexible width. |
| Label | `text-[10px] tracking-widest uppercase text-text-primary/50 mb-2` | Text: "Activity". |
| HeatmapGrid | Component | 13 weeks × 7 days (91 cells). CSS Grid with `gap-[3px]`, `gridTemplateRows: repeat(7, 1fr)`, `gridAutoFlow: column`. Each cell: `aspect-square rounded-[3px]`. Colors by intensity level (0–4): `rgba(124,106,239,0.00)`, `rgba(124,106,239,0.15)`, `rgba(124,106,239,0.35)`, `rgba(124,106,239,0.55)`, `rgba(124,106,239,0.85)`. Animation: `heatmap-cell-in 0.4s ease-out` with variant-specific delays. |

### 2b. Right Column — Developer Profile

Container: `w-[40%] sm:w-[320px] flex-shrink-0 flex flex-col`.

| Element | Classes | Details |
|---------|---------|---------|
| Label | `text-[10px] tracking-widest uppercase text-text-primary/50 mb-1` | Text: "Developer Profile". |

#### Radar Chart (`my-3`, centered via `flex justify-center`)

SVG container: `w-[140px] h-[140px]`, `viewBox="0 0 140 140"`.

**Guide rings** (4 concentric diamonds at scales 0.25, 0.5, 0.75, 1.0):
- Points formula: `70,${70-55*s} ${70+55*s},70 70,${70+55*s} ${70-55*s},70`
- `fill="none" stroke="rgba(124,106,239,0.12)" strokeWidth="1"`

**Axes** (2 lines):
- Vertical: `x1=70 y1=15 x2=70 y2=125`
- Horizontal: `x1=15 y1=70 x2=125 y2=70`
- `stroke="rgba(124,106,239,0.08)" strokeWidth="1"`

**Data polygon**:
- Points derived from `impact.dimensions` (building=top, guarding=right, consistency=bottom, breadth=left)
- Each vertex at `70 ± (dimension/100) * 55` along its axis
- `fill="rgba(124,106,239,0.20)" stroke="#7C6AEF" strokeWidth="1.5"`

**Vertex dots** (4 circles, `r="3" fill="#7C6AEF"`):
- Top: `cx=70, cy=70-(building/100)*55`
- Right: `cx=70+(guarding/100)*55, cy=70`
- Bottom: `cx=70, cy=70+(consistency/100)*55`
- Left: `cx=70-(breadth/100)*55, cy=70`

**Axis labels** (absolute positioned spans, `text-[9px] text-text-secondary`):
| Label | Position |
|-------|----------|
| "Build" | `absolute -top-1 left-1/2 -translate-x-1/2` |
| "Guard" | `absolute top-1/2 -right-2 -translate-y-1/2` |
| "Consist" | `absolute -bottom-1 left-1/2 -translate-x-1/2` |
| "Breadth" | `absolute top-1/2 -left-3 -translate-y-1/2` |

#### Archetype Pill (`flex justify-center mb-2`)

- Container: `inline-flex items-center gap-1.5 rounded-full bg-amber/10 border border-amber/25 px-3 py-1`
- Text: `text-xs font-semibold text-amber`
- Content: `{TIER_SYMBOL} {impact.archetype}` where symbols: Emerging=○, Solid=◉, High=◆, Elite=★

#### Composite Score + Tier + Confidence (`flex flex-col items-center gap-1`)

Score row (`flex items-baseline gap-2`):
- Score value: `ScoreEffectText` component with `text-3xl font-heading font-bold tracking-tighter leading-none`. Wrapped in `<div data-score-effect={scoreEffect}>`.
- Tier pill: `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border w-fit` + `tierPillClasses(tier)`.

Confidence: `text-xs text-text-secondary`. Content: `{confidence}% Confidence`.

---

## 3. Dimension Cards

Layout: `mt-5 grid grid-cols-4 gap-3`.

Each card (`AnimatedStatCard`):
- Container: `rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-center`
- Value: `block text-2xl font-heading font-bold tracking-tight text-text-primary leading-none`
- Label: `block text-[10px] uppercase tracking-wider text-text-secondary mt-1.5`

Cards in order: Building, Guarding, Consistency, Breadth.

Values support animated counters via `useAnimatedCounter(value, 2000, easing, isAnimated)` where `easing` is `"spring"` for `animated-spring` and `"easeOut"` for `animated-ease`.

---

## 4. Footer

Layout: `mt-4 pt-3 border-t border-stroke/50 flex items-center justify-between`.

| Element | Classes | Details |
|---------|---------|---------|
| GitHub icon | `w-3.5 h-3.5` fill SVG | Standard GitHub octocat path. |
| "Powered by GitHub" | `text-xs text-text-secondary/60` with `flex items-center gap-2` | Adjacent to icon. |
| Domain text | `text-xs text-text-secondary/60 font-heading` | `chapa.thecreativetoken.com`. |

---

## 5. Tier Sparkles (Conditional)

Rendered when `tierTreatment === "enhanced"` AND tier is `"High"` or `"Elite"`.

`SparkleDots` component — 3 absolutely positioned dots:

| Dot | Size | Color | Position | Delay |
|-----|------|-------|----------|-------|
| 1 | `w-1 h-1` | `bg-[#9D8FFF]` | `top: 12%, right: 8%` | `0s` |
| 2 | `w-[3px] h-[3px]` | `bg-[#7C6AEF]` | `bottom: 18%, left: 6%` | `0.7s` |
| 3 | `w-1 h-1` | `bg-[#9D8FFF]` | `top: 45%, right: 3%` | `1.4s` |

All have `sparkle-dot` class (pulsing animation), `rounded-full`, `aria-hidden="true"`.

---

## Required CSS

The badge requires these CSS strings injected via `<style>`:

| CSS constant | When needed |
|--------------|-------------|
| `HEATMAP_GRID_CSS` | Always (heatmap cell animation keyframes) |
| `SCORE_EFFECT_CSS` | When `scoreEffect !== "standard"` |
| `TIER_VISUALS_CSS` | When `tierTreatment === "enhanced"` |

---

## Effect Config Props (content-level)

These effects modify how badge **content** renders (as opposed to wrapper effects like background, border, interaction):

| Prop | Type | Default | Effect |
|------|------|---------|--------|
| `scoreEffect` | `BadgeScoreEffect` | `"standard"` | CSS text treatment on composite score number |
| `heatmapAnimation` | `BadgeHeatmapAnimation` | `"fade-in"` | Cell reveal pattern for heatmap grid |
| `statsDisplay` | `BadgeStatsDisplay` | `"static"` | Counter animation on dimension cards |
| `tierTreatment` | `BadgeTierTreatment` | `"standard"` | Sparkle dots + tier-specific styling |

## Wrapper-Level Effects (NOT part of BadgeContent)

These are applied by `BadgePreviewCard` as wrappers around the content:

| Category | Options | Implementation |
|----------|---------|----------------|
| Background | solid, aurora, particles | `AuroraBackground`, `ParticleCanvas` behind card |
| Card Style | flat, frost, smoke, crystal, aurora-glass | `glassStyle()` inline styles |
| Border | solid-amber, gradient-rotating, none | `GradientBorder` wrapper |
| Interaction | static, tilt-3d, holographic | `useTilt` hook, `HolographicOverlay` wrapper |
| Celebration | none, confetti | `fireSingleBurst()` on mount |
