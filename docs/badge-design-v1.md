# Badge Design v1 Spec — React Component (Creator Studio)

> **Scope**: This spec covers the **React preview composition** (`BadgeContent.tsx`, `BadgePreviewCard.tsx`, and `PreviewFooter.tsx`) used in Creator Studio. It does **not** cover the embeddable SVG badge.
> For the **embeddable SVG badge** served at `/u/:handle/badge.svg`, see [`badge-svg-spec-v1.2.md`](./badge-svg-spec-v1.2.md).
>
> Implemented in `apps/web/components/badge/BadgeContent.tsx` and `apps/web/app/studio/`.

## Overview

The badge is a dark card (`bg-card #111118`) with `rounded-2xl p-6` padding. Default aspect ratio is unconstrained (content-driven), but the embeddable SVG renders at 1200×630.

The layout has five vertical sections: **Header**, **Body** (two columns), **Dimension Cards** (4-col grid), **Footer**, and conditional **Tier Sparkles**. `BadgePreviewCard` renders `BadgeContent` with `showFooter={false}`, then adds `PreviewFooter` so Studio can match the public badge's platform and verification metadata without duplicating the legacy content footer.

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
└──────────────────┴──────────────────────┘
```

Layout: `flex gap-6`.

### 2a. Left Column — Activity Heatmap

| Element | Classes | Details |
|---------|---------|---------|
| Container | `flex-1 min-w-0` | Flexible width. |
| Label | `text-[10px] tracking-widest uppercase text-text-primary/50 mb-2` | Text: "Activity". |
| HeatmapGrid | Component | 13 weeks × 7 days (91 cells). CSS Grid with `gap-[3px]`, `gridTemplateRows: repeat(7, 1fr)`, `gridAutoFlow: column`. Each cell: `aspect-square rounded-[3px]`. Colors by intensity level (0–4): `rgba(139,92,246,0.00)`, `rgba(139,92,246,0.15)`, `rgba(139,92,246,0.35)`, `rgba(139,92,246,0.55)`, `rgba(139,92,246,0.85)`. Animation: `heatmap-cell-in 0.4s ease-out` with variant-specific delays. |

### 2b. Right Column — Developer Profile

Container: `w-[40%] sm:w-[320px] flex-shrink-0 flex flex-col`.

| Element | Classes | Details |
|---------|---------|---------|
| Label | `text-[10px] tracking-widest uppercase text-text-primary/50 mb-1` | Text: "Developer Profile". |

#### Radar Chart (`my-3`, centered via `flex justify-center`)

SVG container: `w-[140px] h-[140px]`, `viewBox="0 0 140 140"`.

**Guide rings** (4 concentric diamonds at scales 0.25, 0.5, 0.75, 1.0):
- Points formula: `70,${70-55*s} ${70+55*s},70 70,${70+55*s} ${70-55*s},70`
- `fill="none" stroke="rgba(139,92,246,0.12)" strokeWidth="1"`

**Axes** (2 lines):
- Vertical: `x1=70 y1=15 x2=70 y2=125`
- Horizontal: `x1=15 y1=70 x2=125 y2=70`
- `stroke="rgba(139,92,246,0.08)" strokeWidth="1"`

**Data polygon**:
- Points derived from `impact.dimensions` (delivery=top, quality=right, consistency=bottom, breadth=left)
- Each vertex at `70 ± (dimension/100) * 55` along its axis
- `fill="rgba(139,92,246,0.20)" stroke="#8B5CF6" strokeWidth="1.5"`

**Vertex dots** (4 circles, `r="3" fill="#8B5CF6"`):
- Top: `cx=70, cy=70-(delivery/100)*55`
- Right: `cx=70+(quality/100)*55, cy=70`
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

#### Composite Score + Tier (`flex flex-col items-center gap-1`)

Score row (`flex items-baseline gap-2`):
- Score value: `ScoreEffectText` component with `text-3xl font-heading font-bold tracking-tighter leading-none`. Wrapped in `<div data-score-effect={scoreEffect}>`.
- Tier pill: `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border w-fit` + `tierPillClasses(tier)`.

---

## 3. Dimension Cards

Layout: `mt-5 grid grid-cols-4 gap-3`.

Each card (`AnimatedStatCard`):
- Container: `rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-center`
- Value: `block text-2xl font-heading font-bold tracking-tight text-text-primary leading-none`
- Label: `block text-[10px] uppercase tracking-wider text-text-secondary mt-1.5`

Cards in order: Delivery, Quality, Consistency, Breadth.

Values support animated counters via `useAnimatedCounter(value, 2000, easing, isAnimated)` where `easing` is `"spring"` for `animated-spring` and `"easeOut"` for `animated-ease`.

---

## 4. Footer

### Creator Studio preview footer

`BadgePreviewCard` suppresses the built-in footer with `showFooter={false}` and renders `PreviewFooter` after the badge content. The responsive layout uses `flex-col` on narrow cards and `sm:flex-row` when space allows.

| Element | Classes / source | Details |
|---------|------------------|---------|
| Platform logo pill | `h-3.5 w-3.5` logos in a rounded pill | GitHub is always present. Connected platforms follow canonical order: GitHub, Bitbucket, Codeberg, GitLab. Logo paths and ordering come from `apps/web/lib/badge-visual-metadata.ts`. |
| "Forged from purpose. Driven by curiosity." | Localized `studio.brandingTagline`; hidden on the narrowest cards | Adjacent to the logo pill. |
| Host text | `truncate font-heading` | Derived from `getBaseUrl()` so preview branding follows the active deployment host. |
| Verification row | Coral text below a divider | Shown only when a public verification hash and date exist. The color comes from `VERIFICATION_CORAL` in `badge-visual-metadata.ts`. |

### Built-in `BadgeContent` footer

`BadgeContent` keeps a small legacy footer for callers that do not provide a composed footer. It is enabled by default through `showFooter?: boolean` and contains GitHub attribution plus the Chapa production domain. Studio does not render this path.

---

## 5. Tier Sparkles (Conditional)

Rendered when `tierTreatment === "enhanced"` AND tier is `"High"` or `"Elite"`.

`SparkleDots` component — 3 absolutely positioned dots:

| Dot | Size | Color | Position | Delay |
|-----|------|-------|----------|-------|
| 1 | `w-1 h-1` | `bg-[#A78BFA]` | `top: 12%, right: 8%` | `0s` |
| 2 | `w-[3px] h-[3px]` | `bg-[#8B5CF6]` | `bottom: 18%, left: 6%` | `0.7s` |
| 3 | `w-1 h-1` | `bg-[#A78BFA]` | `top: 45%, right: 3%` | `1.4s` |

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
