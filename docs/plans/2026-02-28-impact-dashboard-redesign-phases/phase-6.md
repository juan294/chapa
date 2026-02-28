# Phase 6: Assembly, Heatmap, Stats Grid & Polish

## Goal

Wire all components into the final `ImpactDashboard` orchestrator, add the activity heatmap and redesigned stats grid, replace the old `ImpactBreakdown` on the share page, and polish animations/responsiveness/accessibility.

## Files

### New: `apps/web/components/dashboard/ActivityHeatmap.tsx`

Wrapper that renders the existing `HeatmapGrid` in the dashboard context.

```typescript
// Props:
//   heatmapData: HeatmapDay[]
//   activeDays: number
//
// Rendering:
//   Section header:
//   - "Activity" (font-heading text-xs uppercase tracking-wider)
//
//   Subheader:
//   - "{activeDays} active days in the last year" (text-sm text-text-secondary)
//
//   Container:
//   - rounded-xl border border-stroke bg-card p-4 overflow-hidden
//
//   Grid:
//   - <HeatmapGrid data={heatmapData} animation="wave" />
//   - Injects HEATMAP_GRID_CSS via <style> tag (already exists in HeatmapGrid)
//
//   Responsive:
//   - Full width, grid cells scale with container
//   - On mobile: horizontal scroll if needed (overflow-x-auto)
//
// Accessibility:
//   - Section has aria-label="Contribution activity heatmap"
```

### New: `apps/web/components/dashboard/StatsGrid.tsx`

Redesigned stats grid — groups stats by which dimension they contribute to.

```typescript
// Props:
//   stats: StatsData
//   diff: SnapshotDiff | null
//
// Layout:
//
// Section header: "Key Numbers"
//
// Responsive grid: grid-cols-2 sm:grid-cols-4 gap-3
//
// Stats displayed (same 8 as current, but with deltas):
//   [
//     { value: stats.totalStars, label: "Stars", delta: diff?.stats.totalStars },
//     { value: stats.totalForks, label: "Forks", delta: diff?.stats.totalForks },
//     { value: stats.totalWatchers, label: "Watchers", delta: diff?.stats.totalWatchers },
//     { value: stats.activeDays, label: "Active Days", delta: diff?.stats.activeDays },
//     { value: stats.commitsTotal, label: "Commits", delta: diff?.stats.commitsTotal },
//     { value: stats.prsMergedCount, label: "PRs Merged", delta: diff?.stats.prsMergedCount },
//     { value: stats.reviewsSubmittedCount, label: "Reviews", delta: diff?.stats.reviewsSubmittedCount },
//     { value: stats.reposContributed, label: "Repos", delta: diff?.stats.reposContributed },
//   ]
//
// Each stat card:
//   ┌─────────────────────┐
//   │       3.5k          │  ← Value (font-heading text-2xl, animated counter)
//   │     COMMITS ⓘ       │  ← Label + InfoTooltip
//   │       +47↑          │  ← DeltaIndicator (only if delta exists and != 0)
//   └─────────────────────┘
//
// Card styling:
//   - rounded-xl border border-stroke bg-card px-3 py-4 text-center
//   - animate-fade-in-up with staggered delays
//
// Delta display:
//   - <DeltaIndicator delta={delta} size="sm" /> below the label
//   - Only shown when diff data exists AND delta != 0
//   - Graceful degradation: no deltas for new users
//
// Reuses: formatCompact(), STAT_TOOLTIPS, InfoTooltip — all from current ImpactBreakdown
```

### New: `apps/web/components/dashboard/ImpactDashboard.tsx`

Main orchestrator — replaces `ImpactBreakdown` usage on the share page.

```typescript
"use client";

// Props:
//   impact: ImpactV4Result
//   stats: StatsData
//   handle: string  (needed for useTrendData fetch)
//   heroVariant?: "ring" | "bold" | "rings"  (default "ring", experiment toggle)
//
// Internal state:
//   Uses useTrendData(handle) to fetch trend + diff data
//   activeDimension: keyof DimensionScores | null (shared between radar and cards)
//
// Layout (vertical stack, space-y-12):
//
// 1. <HeroScoreZone variant={heroVariant} impact={impact} />
//
// 2. <DimensionCardsRow
//       impact={impact}
//       stats={stats}
//       trend={trend}
//       diff={diff}
//       activeDimension={activeDimension}
//    />
//
// 3. <RadarChartInteractive
//       dimensions={impact.dimensions}
//       activeDimension={activeDimension}
//       onDimensionHover={setActiveDimension}
//       onDimensionClick={handleDimensionClick}
//    />
//    + SubMetricPanel (rendered below radar when a dimension is clicked)
//
// 4. <CoachingInsights impact={impact} trend={trend} diff={diff} />
//
// 5. <ActivityHeatmap heatmapData={stats.heatmapData} activeDays={stats.activeDays} />
//
// 6. <StatsGrid stats={stats} diff={diff} />
//
// Loading state for trend data:
//   - Dashboard renders immediately with stats + impact (SSR data)
//   - Sparklines and deltas show skeleton placeholders while trend loads
//   - When trend arrives, components update (no layout shift — placeholders same size)
//
// Dimension interaction flow:
//   - Hovering radar axis → setActiveDimension → highlights matching DimensionCard
//   - Hovering DimensionCard → setActiveDimension → highlights matching radar axis
//   - Clicking radar axis OR clicking DimensionCard footer → expands SubMetricPanel
//   - SubMetricPanel renders below the radar chart (not inside the card, to avoid layout shift)
//
// Section dividers:
//   - Subtle hr border-stroke between major sections (hero → cards → radar → coaching → heatmap → stats)
//   - OR: use space-y-12 with no explicit dividers (cleaner)
```

### Modified: `apps/web/app/u/[handle]/page.tsx`

Replace old `ImpactBreakdown` with new `ImpactDashboard`.

```typescript
// Changes:
//
// 1. Import ImpactDashboard instead of ImpactBreakdown:
//    - import { ImpactDashboard } from "@/components/dashboard/ImpactDashboard"
//    - Keep importing getArchetypeProfile and DataSources (still used)
//
// 2. In the owner section (lines ~297-345):
//    - Remove the archetype header block (lines 314-329)
//      → now rendered inside HeroScoreZone
//    - Replace <ImpactBreakdown impact={impact} stats={stats} />
//      with <ImpactDashboard impact={impact} stats={stats} handle={handle} />
//    - Read ?hero= query param and pass as heroVariant prop (experiment toggle)
//
// 3. Keep DataSources section above the dashboard (unchanged)
//
// 4. Keep embed snippets section below the dashboard (unchanged)
//
// 5. Keep old ImpactBreakdown.tsx file intact (not imported, but preserved
//    as reference until we're confident in the new dashboard)
```

### Modified: `apps/web/styles/globals.css`

Ensure all needed animation keyframes exist (most already do from Phase 1).

```css
/* Verify these exist (add if missing): */

/* Sparkline trace — added in Phase 1 */
/* gauge-fill — already exists */
/* fade-in-up — already exists */
/* bar-fill — already exists */
/* scale-in — already exists */

/* New: radar polygon expand */
@keyframes radar-expand {
  from { opacity: 0; transform: scale(0); }
  to { opacity: 1; transform: scale(1); }
}
```

## Interaction Wiring

### Radar ↔ Dimension Cards Sync

Both components share `activeDimension` state managed by `ImpactDashboard`:

```
User hovers radar axis "delivery"
  → RadarChartInteractive calls onDimensionHover("delivery")
  → ImpactDashboard sets activeDimension="delivery"
  → DimensionCardsRow receives activeDimension="delivery"
  → Delivery card gets highlight border, others dim

User moves mouse away from radar
  → onDimensionHover(null)
  → activeDimension=null
  → All cards return to normal
```

### SubMetricPanel Positioning

When a dimension is clicked (from radar or card), the SubMetricPanel renders:
- **Desktop**: Below the radar chart, full-width
- **Mobile**: Below the clicked dimension card (or full-width below all cards)

The panel is rendered by ImpactDashboard (not inside DimensionCard) to avoid layout shift in the cards grid.

## Tests

### `apps/web/components/dashboard/ImpactDashboard.test.tsx`
- Renders all 6 sections (hero, dimensions, radar, coaching, heatmap, stats)
- Passes trend/diff data to child components when available
- Handles loading state (no trend data yet)
- Handles error state (trend fetch failed — renders without trends)
- activeDimension syncs between radar and dimension cards
- SubMetricPanel opens/closes on dimension click

### `apps/web/components/dashboard/ActivityHeatmap.test.tsx`
- Renders HeatmapGrid with provided data
- Shows active days count in subheader
- Has correct ARIA label

### `apps/web/components/dashboard/StatsGrid.test.tsx`
- Renders 8 stat cards with correct values
- Shows DeltaIndicator when diff data present
- Hides DeltaIndicator when diff data absent
- Values formatted via formatCompact()

## Verification

```bash
# Full test suite (all phases)
pnpm run test
pnpm run typecheck
pnpm run lint
```

## Polish Checklist

### Animations
- [ ] All animations triggered by useInView (not on page load) — manual verification
- [x] Animation choreography follows the timing spec (hero → cards → radar → coaching → heatmap → stats)
- [ ] prefers-reduced-motion: all animations skip to final state — manual verification
- [x] No layout shift during animation (elements sized before animation starts)

### Responsive
- [ ] Mobile (375px): single column, all sections stack vertically — manual verification
- [ ] Tablet (768px): dimension cards 2-col, radar full-width — manual verification
- [x] Desktop (1024px+): dimension cards 4-col, radar with side panel space
- [ ] No horizontal overflow at any breakpoint — manual verification

### Themes
- [x] Dark mode: all colors use CSS variables, backgrounds/text/borders correct
- [x] Light mode: same — no hardcoded hex colors
- [x] Badge SVG theme unaffected (always dark)

### Accessibility
- [x] All interactive elements focusable via Tab
- [x] Radar vertices navigable with keyboard
- [x] Expand/collapse panels work with Enter/Space
- [x] Escape closes expanded panels
- [x] Screen reader: all sections have descriptive ARIA labels
- [x] Progress bars have role="progressbar" with aria-valuenow
- [x] Decorative elements (sparklines, heatmap cells) have aria-hidden="true"

### Performance
- [x] Trend data fetch doesn't block initial render (client-side, not waterfall)
- [ ] Components lazy-render with useInView (below-fold sections don't render until scrolled) — future optimization
- [x] No new dependencies added to bundle
- [x] TypeScript strict mode passes

## Dependencies

- Phase 1: All primitives (Sparkline, DeltaIndicator, ScoreRing, useTrendData)
- Phase 2: Hero score variants (HeroScoreZone)
- Phase 3: RadarChartInteractive, SubMetricPanel
- Phase 4: DimensionCard, DimensionCardsRow
- Phase 5: CoachingInsights

## Exit Criteria

- `ImpactDashboard` renders the complete performance dashboard with all 6 sections
- Share page (`/u/:handle`) shows the new dashboard for owners
- Old `ImpactBreakdown` component preserved but no longer imported
- Trend data fetches client-side and enhances the dashboard progressively
- All 3 hero score experiments accessible via `?hero=ring|bold|rings` query param
- Full animation choreography plays smoothly on scroll
- Light and dark themes both render correctly
- Responsive at all breakpoints (375px → 1440px)
- All accessibility criteria met
- All tests pass (existing + new)
- TypeScript + lint clean
