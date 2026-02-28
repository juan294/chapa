# Phase 2: Hero Score Experiments (3 Variants)

## Goal

Build three distinct hero score visualization variants. User will review all three and pick one. The non-selected variants get deleted in Phase 6.

## Experiment Setup

All three variants share the same props interface and are rendered behind an experiment selector on the share page (a simple `?hero=ring|bold|rings` query param or a toggle in the breakdown header). This lets the user compare them on the live page with real data.

## Shared Props Interface

```typescript
interface HeroScoreProps {
  impact: ImpactV4Result;
  className?: string;
}
```

Each variant extracts what it needs from `impact`: `adjustedComposite`, `tier`, `archetype`, `dimensions`, `confidence`.

## Files

### New: `apps/web/components/dashboard/ScoreRingGauge.tsx` (Variant A)

WHOOP/Oura-inspired single ring gauge with centered score.

```
Layout (centered, stacked vertically):

    ╭──────────────╮
   │   ╭───────╮   │   ← Ring fills clockwise to score %
   │   │       │   │     Stroke color = tier color
   │   │  87   │   │   ← Animated counter (font-heading text-5xl)
   │   │       │   │     ScoreEffectText for Elite tier
   │   ╰───────╯   │
    ╰──────────────╯
                         ← Ring: 200px diameter, 10px stroke
       ELITE             ← Tier pill (tierPillClasses from TierVisuals)
      Builder            ← Archetype name (text-amber, font-heading text-2xl)

  "Your profile is driven by output..."  ← Archetype profile text (text-sm text-text-secondary)
```

Implementation:
- Uses `<ScoreRing>` from Phase 1 (size=200, strokeWidth=10)
- Ring color = tier color from existing tier color map
- Inside ring: animated counter using `useAnimatedCounter` hook
- Elite tier: apply `ScoreEffectText` with shimmer effect to the number
- Below ring: tier pill using `tierPillClasses()`, archetype name, profile text
- If Elite tier: render `<SparkleDots>` around the ring
- Fade-in-up entrance animation triggered by `useInView`

### New: `apps/web/components/dashboard/ScoreBoldNumber.tsx` (Variant B)

Oura-inspired minimalist giant number.

```
Layout (left-aligned):

  87  ┌────────┐
      │ ELITE  │    ← Tier pill inline with number
      └────────┘

  Builder           ← Archetype name (text-amber)
  ────────────────
  Your profile is driven    ← Profile text
  by output — you turn...
```

Implementation:
- Score number: `font-heading text-7xl sm:text-8xl font-extrabold` with animated counter
- Tier pill: inline-flex next to the number, using `tierPillClasses()`
- Elite: ScoreEffectText shimmer on the number
- Archetype: `font-heading text-xl text-amber tracking-tight`
- Divider: `border-t border-stroke` between archetype and profile text
- Profile text: `text-sm text-text-secondary leading-relaxed`
- Simple fade-in entrance, counter is the hero animation

### New: `apps/web/components/dashboard/ScoreConcentricRings.tsx` (Variant C)

Apple Fitness-inspired 4 nested rings.

```
Layout (centered):

    ╭─────────────────────╮
   │ ╭─────────────────╮ │  ← Delivery ring (green), outermost
   │ │ ╭─────────────╮ │ │  ← Quality ring (orange)
   │ │ │ ╭─────────╮ │ │ │  ← Consistency ring (cyan)
   │ │ │ │   87    │ │ │ │  ← Breadth ring (pink), innermost
   │ │ │ ╰─────────╯ │ │ │     Center: composite score
   │ │ ╰─────────────╯ │ │
   │ ╰─────────────────╯ │
    ╰─────────────────────╯

  ELITE · Builder

  Legend:
  ● Delivery 85  ● Quality 72  ● Consistency 91  ● Breadth 68
```

Implementation:
- 4 `<ScoreRing>` components nested (decreasing size: 200, 170, 140, 110px)
- Each ring uses its dimension color from `DIMENSION_COLORS`
- Each ring fills to its dimension score percentage
- Center: composite score with animated counter
- Rings stagger their fill animation (0ms, 200ms, 400ms, 600ms)
- Below: tier + archetype on one line
- Legend row: 4 colored dots with dimension name + score
- Each ring has `strokeWidth=8` and `gap` between rings (handled by size reduction)

### New: `apps/web/components/dashboard/HeroScoreZone.tsx`

Wrapper that renders the correct variant based on prop.

```typescript
// Props:
//   variant: "ring" | "bold" | "rings"
//   impact: ImpactV4Result
//
// Simply renders the corresponding component:
//   "ring" → <ScoreRingGauge impact={impact} />
//   "bold" → <ScoreBoldNumber impact={impact} />
//   "rings" → <ScoreConcentricRings impact={impact} />
```

### Modified: `apps/web/app/u/[handle]/page.tsx`

Temporarily add experiment toggle in the impact breakdown section.

```typescript
// In the Impact Breakdown owner section, ABOVE the existing archetype header:
//
// 1. Read ?hero= query param from URL (default "ring")
// 2. Render <HeroScoreZone variant={heroVariant} impact={impact} />
// 3. Render small experiment selector (3 buttons: Ring | Bold | Rings)
//    that updates the URL query param
// 4. Keep existing archetype header + ImpactBreakdown below for now
//    (hero zone replaces the archetype header visually, but old code stays
//    until Phase 6 assembly)
```

## Tests

### `apps/web/components/dashboard/ScoreRingGauge.test.tsx`
- Renders score ring with correct value
- Shows tier pill with correct tier text
- Shows archetype name
- Shows profile description text
- Applies ScoreEffectText for Elite tier

### `apps/web/components/dashboard/ScoreBoldNumber.test.tsx`
- Renders large score number
- Shows tier pill inline
- Shows archetype name and profile text

### `apps/web/components/dashboard/ScoreConcentricRings.test.tsx`
- Renders 4 nested rings
- Each ring has correct dimension color
- Shows composite score in center
- Shows legend with 4 dimensions and scores

### `apps/web/components/dashboard/HeroScoreZone.test.tsx`
- Renders ScoreRingGauge when variant="ring"
- Renders ScoreBoldNumber when variant="bold"
- Renders ScoreConcentricRings when variant="rings"

## Verification

```bash
pnpm run test -- --grep "ScoreRingGauge|ScoreBoldNumber|ScoreConcentricRings|HeroScoreZone"
pnpm run typecheck
pnpm run lint
```

## Dependencies

- Phase 1: `ScoreRing`, `useAnimatedCounter`, `useInView`

## Exit Criteria

- All 3 hero variants render correctly with mock impact data
- Experiment selector on share page lets user switch between variants
- Animations play on scroll-in (ring fill, counter count-up)
- Elite tier shows shimmer effect and sparkle dots (variant A)
- Light and dark themes both work
- User can visually compare and choose their preferred variant
