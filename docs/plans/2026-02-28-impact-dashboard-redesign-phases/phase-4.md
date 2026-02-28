# Phase 4: Enhanced Dimension Cards

## Goal

Redesign the 4 dimension cards with sparkline trends, delta indicators, and expandable sub-metric details. Each card becomes a mini-dashboard for its dimension.

## Files

### New: `apps/web/components/dashboard/DimensionCard.tsx`

Enhanced dimension card with all visual upgrades.

```
Layout:

┌──────────────────────────────────────────────┐
│  DELIVERY ⓘ                           85    │  ← Label + score (large)
│                                              │
│  ████████████████████████████████░░░░  ────  │  ← Progress bar (gradient fill)
│                                              │
│  ~~~~~~~~~~~~~~~~~~~~  +12↑  vs last week   │  ← Sparkline + delta indicator
│                                              │
│  PRs merged · issues closed · commits   ▾   │  ← Subtitle + expand chevron
├──────────────────────────────────────────────┤
│  DELIVERY BREAKDOWN (expanded)               │  ← SubMetricPanel (from Phase 3)
│  PR Weight   ████████████░░  70%             │
│  47 PRs merged                               │
│  ...                                         │
└──────────────────────────────────────────────┘
```

```typescript
"use client";

// Props:
//   dimension: "delivery" | "quality" | "consistency" | "breadth"
//   score: number (0-100)
//   stats: StatsData
//   trend?: DimensionTrend | null  — from useTrendData
//   delta?: number | null  — from SnapshotDiff.dimensions[key]
//   animationDelay?: number (ms)
//   className?: string
//
// State:
//   isExpanded: boolean (default false) — controls SubMetricPanel visibility
//
// Rendering:
//   Container:
//   - rounded-xl border border-stroke bg-card overflow-hidden
//   - hover: border-{dimension-color}/20 transition
//   - animate-fade-in-up with animationDelay
//
//   Header row (flex between):
//   - Left: dimension label (text-xs uppercase tracking-wider text-text-secondary)
//     + InfoTooltip (existing component, existing tooltip text)
//   - Right: score number (font-heading text-3xl font-extrabold text-text-primary)
//     + animated counter (useAnimatedCounter, triggered by useInView)
//
//   Progress bar:
//   - h-1.5 rounded-full bg-track (same as current)
//   - Gradient fill from DIMENSION_COLORS[dimension]
//   - animate-bar-fill (existing keyframe)
//
//   Trend row (flex between, only shown if trend data exists):
//   - Left: <Sparkline> from Phase 1 (values from trend.values, color from dimension)
//   - Right: <DeltaIndicator> from Phase 1 (delta from props, label="vs last week")
//   - If no trend data: row hidden (graceful degradation for new users)
//
//   Footer row:
//   - Left: subtitle text (existing DIMENSION_SUBTITLES[key])
//   - Right: expand chevron button (▾ when collapsed, ▴ when expanded)
//   - Chevron: cursor-pointer, rotates 180° on expand (CSS transition)
//   - Click anywhere on footer row toggles isExpanded
//
//   Expanded panel:
//   - <SubMetricPanel> from Phase 3
//   - Slides down with max-height transition (0 → auto workaround via grid rows)
//   - Border-top separator when expanded
//
// Accessibility:
//   - Card container: role="article" with aria-label="{Dimension} dimension score: {score}"
//   - Progress bar: role="progressbar" (existing pattern)
//   - Expand button: aria-expanded, aria-controls pointing to panel id
//   - Panel: role="region" aria-labelledby pointing to dimension label
//   - Keyboard: Enter/Space toggles expand on the footer row
```

### New: `apps/web/components/dashboard/DimensionCardsRow.tsx`

Row container for 4 dimension cards with responsive layout.

```typescript
// Props:
//   impact: ImpactV4Result
//   stats: StatsData
//   trend?: TrendSummary | null
//   diff?: SnapshotDiff | null
//
// Rendering:
//   Section header:
//   - "Performance Dimensions" (font-heading text-xs uppercase tracking-wider)
//   - Same style as current ImpactBreakdown section headers
//
//   Grid:
//   - grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3
//   - Responsive: 1 col on mobile, 2 on tablet, 4 on desktop
//
//   4 × DimensionCard:
//   - dimension="delivery" score={impact.dimensions.delivery}
//     trend={trend?.dimensions.delivery} delta={diff?.dimensions.delivery}
//     animationDelay={400 + i * 100}
//   - Same for quality, consistency, breadth
//
//   When radar hover is active (future integration):
//   - Accept optional activeDimension prop
//   - Highlighted card gets a subtle border glow in its dimension color
//   - Non-highlighted cards dim slightly (opacity 0.7)
//   - This creates a visual link between radar and cards
```

### Modified: (none in this phase — assembly happens in Phase 6)

## Tests

### `apps/web/components/dashboard/DimensionCard.test.tsx`
- Renders dimension label and score
- Renders progress bar with correct width percentage
- Renders sparkline when trend data provided
- Hides sparkline when no trend data
- Renders delta indicator when diff data provided
- Hides delta indicator when no diff data
- Expand/collapse toggles SubMetricPanel visibility
- Chevron rotates on expand
- Keyboard Enter toggles expand
- Has correct ARIA attributes (role, aria-expanded, aria-controls)
- Animated counter triggers on mount

### `apps/web/components/dashboard/DimensionCardsRow.test.tsx`
- Renders 4 DimensionCards
- Passes correct dimension data to each card
- Passes trend/diff data when available
- Handles null trend/diff gracefully

## Verification

```bash
pnpm run test -- --grep "DimensionCard|DimensionCardsRow"
pnpm run typecheck
pnpm run lint
```

## Dependencies

- Phase 1: `Sparkline`, `DeltaIndicator`, `useAnimatedCounter`, `useInView`
- Phase 3: `SubMetricPanel`
- Existing: `InfoTooltip`, `DIMENSION_LABELS`, `DIMENSION_COLORS`, `DIMENSION_TOOLTIPS`, `DIMENSION_SUBTITLES`

## Exit Criteria

- 4 dimension cards render in responsive grid (1/2/4 columns)
- Each card shows: label, animated score, progress bar, sparkline (if data), delta (if data)
- Clicking footer expands sub-metric breakdown panel
- Cards gracefully degrade when no trend data (new users see cards without sparklines)
- All interactive elements keyboard accessible
- Staggered entrance animations
