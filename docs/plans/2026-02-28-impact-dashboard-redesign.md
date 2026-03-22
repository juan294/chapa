# Plan: Impact Breakdown Dashboard Redesign

> Created: 2026-02-28 | Research: `docs/research/2026-02-28-impact-breakdown-dashboard-redesign.md`

## Summary

Replace the current flat `ImpactBreakdown` component (4 dimension cards + 8 stat cards) with a professional, multi-section performance dashboard inspired by WHOOP, Oura, Strava, and Linear. The new dashboard introduces a hero score zone, interactive radar chart, sparkline trends, delta indicators, coaching insight cards, and a contribution heatmap — all built with custom SVG/CSS (no new dependencies).

## Design Decisions (Confirmed)

| Decision | Choice |
|----------|--------|
| Visibility | Owner-only (unchanged) |
| Hero score | Build 3 experiments; user picks after visual review |
| Chart library | None — custom SVG React components |
| Coaching level | Full insight cards with trend-based content |
| Radar interactivity | Hover to highlight, click to expand sub-metrics |

## Architecture

### New Component Tree

```
SharePage (page.tsx)
└── ImpactDashboard (new orchestrator — replaces ImpactBreakdown)
    ├── HeroScoreZone (one of 3 experiment variants)
    │   ├── ScoreRingGauge (variant A)
    │   ├── ScoreBoldNumber (variant B)
    │   └── ScoreConcentricRings (variant C)
    ├── DimensionCardsRow
    │   └── DimensionCard × 4
    │       ├── Sparkline (new SVG component)
    │       ├── DeltaIndicator (new)
    │       └── SubMetricPanel (expandable)
    ├── RadarChartInteractive (new React SVG component)
    ├── CoachingInsights
    │   └── InsightCard × N
    ├── ActivityHeatmap (reuses existing HeatmapGrid)
    └── StatsGrid (redesigned grouping)
```

### Data Flow

```
page.tsx (server) ── stats + impact ──► ImpactDashboard (client)
                                              │
                                              ├── useTrendData(handle) ──► /api/history/[handle]
                                              │   returns: { trend, diff, snapshots }
                                              │
                                              └── renders all sections with combined data
```

The `useTrendData` hook fetches trend + diff data client-side (the history API is public and rate-limited). Stats and impact are passed as server props (already computed). This avoids a waterfall — the page renders immediately with static data, then enhances with trend data when it arrives.

## File Plan

### New Files

| File | Purpose |
|------|---------|
| `components/dashboard/ImpactDashboard.tsx` | Main orchestrator (replaces ImpactBreakdown usage) |
| `components/dashboard/HeroScoreZone.tsx` | Hero section — wraps the chosen variant |
| `components/dashboard/ScoreRingGauge.tsx` | Experiment A: animated ring gauge |
| `components/dashboard/ScoreBoldNumber.tsx` | Experiment B: giant number + badge |
| `components/dashboard/ScoreConcentricRings.tsx` | Experiment C: 4 nested rings |
| `components/dashboard/DimensionCard.tsx` | Enhanced dimension card with sparkline + expandable |
| `components/dashboard/RadarChartInteractive.tsx` | Interactive 4-axis radar (React SVG) |
| `components/dashboard/Sparkline.tsx` | Tiny SVG sparkline component |
| `components/dashboard/DeltaIndicator.tsx` | +/-% with trend arrow |
| `components/dashboard/SubMetricPanel.tsx` | Expandable sub-metric breakdown |
| `components/dashboard/CoachingInsights.tsx` | Insight cards section |
| `components/dashboard/InsightCard.tsx` | Single insight card |
| `components/dashboard/ActivityHeatmap.tsx` | Heatmap wrapper for breakdown context |
| `components/dashboard/StatsGrid.tsx` | Redesigned stat cards |
| `lib/hooks/use-trend-data.ts` | Client hook to fetch /api/history/[handle] |

### Modified Files

| File | Change |
|------|--------|
| `app/u/[handle]/page.tsx` | Replace `<ImpactBreakdown>` with `<ImpactDashboard>`, pass handle for trend fetch |
| `styles/globals.css` | Add sparkline-trace, ring-draw keyframes if not already present |

### Preserved Files (no changes)

| File | Reason |
|------|--------|
| `components/ImpactBreakdown.tsx` | Keep as fallback until new dashboard is verified; delete in final phase |
| `lib/render/RadarChart.ts` | Badge SVG renderer stays untouched; new radar is a separate React component |
| `lib/effects/heatmap/HeatmapGrid.tsx` | Reused as-is |
| `lib/effects/counters/*` | Reused as-is |
| `lib/effects/tier/TierVisuals.tsx` | Reused as-is |

## Phases

| Phase | Name | Scope | Files Created/Modified |
|-------|------|-------|----------------------|
| 1 | Foundation | Data hook, Sparkline, DeltaIndicator, score ring SVG primitive | 4 new, 1 modified |
| 2 | Hero Score Experiments | 3 hero score variants + experiment toggle | 4 new, 1 modified |
| 3 | Interactive Radar Chart | React SVG radar with hover/click | 2 new |
| 4 | Enhanced Dimension Cards | Sparklines, deltas, expandable sub-metrics | 3 new |
| 5 | Coaching & Insights | Trend-based insight cards, per-dimension tips | 3 new |
| 6 | Assembly & Polish | Wire everything into ImpactDashboard, replace old component, heatmap, stats | 4 new, 2 modified |

See `docs/plans/2026-02-28-impact-dashboard-redesign-phases/phase-N.md` for detailed specs.

## Design Specifications

### Layout (Stratified F-Pattern)

```
┌─────────────────────────────────────────────────────┐
│  HERO SCORE ZONE                                     │
│  [Ring/Number/Rings]  +  Archetype  +  Tier          │
│                                                       │
├─────────┬─────────┬─────────┬─────────────────────────┤
│ DELIVERY│ QUALITY │ CONSIST │ BREADTH                  │
│   85    │   72    │   91    │   68                     │
│  ~~~~   │  ~~~~   │  ~~~~   │  ~~~~   (sparklines)     │
│  +12%↑  │  -3%↓   │  +5%↑   │  +8%↑   (deltas)        │
├─────────┴─────────┴─────────┴─────────────────────────┤
│                                                       │
│          INTERACTIVE RADAR CHART                      │
│          (4-axis diamond, hover/click)                │
│                                                       │
├───────────────────────────────────────────────────────┤
│  COACHING INSIGHTS                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ Trend insight │ │ Weak dim tip │ │ Next tier    │  │
│  └──────────────┘ └──────────────┘ └──────────────┘  │
├───────────────────────────────────────────────────────┤
│  ACTIVITY HEATMAP (13×7 grid)                         │
├───────────────────────────────────────────────────────┤
│  KEY NUMBERS                                          │
│  [PRs] [Commits] [Reviews] [Issues] ...               │
└───────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Mobile (<640px) | Single column. Hero stacked vertically. Dimension cards 1-col. Radar full-width. |
| Tablet (640-1024px) | Dimension cards 2-col. Radar with side panel for sub-metrics. |
| Desktop (1024px+) | Dimension cards 4-col row. Radar centered with floating detail panel. |

### Color Usage

- **Hero ring**: Tier color (gray → light gray → light purple → signature purple)
- **Dimension cards**: Each dimension's assigned color for progress bar, sparkline, and accent
- **Delta indicators**: Green (#22c55e) for positive, red (#F87171) for negative, gray for stable
- **Coaching cards**: Subtle bg tint per insight type (tip = purple-tint, warning = amber-tint, achievement = green-tint)
- **All colors via CSS variables** — light/dark theme compatible

### Animation Choreography

| Step | Animation | Delay | Duration |
|------|-----------|-------|----------|
| 1 | Hero score ring fill | 0ms | 1.5s ease-out |
| 2 | Hero counter count-up | 0ms (synced) | 1.5s |
| 3 | Archetype + tier fade-in | 200ms | 0.8s |
| 4 | Dimension cards stagger | 400ms + 100ms each | 0.8s |
| 5 | Sparklines trace-in | 800ms + 100ms each | 0.6s |
| 6 | Radar polygon expand | 1200ms | 1.0s |
| 7 | Coaching cards stagger | 1600ms + 150ms each | 0.8s |
| 8 | Heatmap wave | 2000ms | 0.4s per cell |
| 9 | Stats cards stagger | 2200ms + 60ms each | 0.8s |

All animations triggered by `useInView` — only play when scrolled into viewport. All respect `prefers-reduced-motion`.

## Testing Strategy

- **Unit tests** for: `useTrendData` hook, `Sparkline` point calculation, `DeltaIndicator` formatting, insight generation logic
- **Component tests** for: Each hero variant renders with mock data, radar chart renders polygon correctly, dimension card expandable behavior
- **Snapshot tests** for: SVG output stability of Sparkline and RadarChartInteractive
- **Accessibility tests** for: ARIA labels on interactive elements, keyboard navigation on radar and expandable cards, reduced-motion behavior

## Success Criteria

### Automated
- [x] All existing tests pass (zero regressions)
- [x] New component tests pass for each phase
- [x] TypeScript compiles with zero errors
- [x] Lint passes
- [ ] All animations skip gracefully with `prefers-reduced-motion: reduce`
- [x] History API hook handles error/loading/empty states

### Manual
- [ ] All 3 hero score experiments render correctly (user visual review)
- [ ] Light and dark themes both look correct
- [ ] Mobile layout (375px) is usable
- [ ] Radar hover/click works on touch devices
- [ ] Expandable dimension cards work with keyboard (Enter/Space to toggle)
- [ ] Sparklines show meaningful shapes with real trend data
