# Activity Chart Redesign

> **Created:** 2026-03-21
> **Status:** Draft
> **Goal:** Redesign the Activity section of the share-page dashboard so every element is immediately understandable, contextual, and actionable — no orphan numbers, no ambiguous labels.

## Problem Statement

The current Activity section has several UX issues:

1. **Numbers without context** — weekly totals (274, 1110) appear in a right column with no label. Users don't know what they represent.
2. **Streak is confusing** — "3d current streak" doesn't explain what counts as an "active day" or why the number feels wrong.
3. **Stats are generic** — "129 active days" and "36.3 avg/active day" are raw numbers without baselines or comparisons.
4. **No relative context** — is 274 contributions in a week good or bad? Without comparison to the user's own average, the number is meaningless.
5. **Dot sizing is opaque** — no legend showing what small vs large dots mean.
6. **Redundancy** — "active days" appears in both the Activity section AND the StatsGrid below it.
7. **Peak callout is disconnected** — "Peak: 222 contributions on Fri, Feb 13" floats below the chart with no visual connection to the actual peak in the grid.

## Research Summary

Based on analysis of GitHub, GitLab, Vercel, Duolingo, and data visualization best practices:

- **Every number needs at least one comparator** — personal average, trend direction, or gap to target
- **Streaks need visual reinforcement** — a row of filled/hollow indicators for recent days, not just a number
- **Natural language > raw stats** — "2.1x your weekly average" beats "274 contributions"
- **Direct labeling > axis tracing** — label data near the data point, not in a separate legend
- **Max 4-5 KPIs** — more exceeds working memory; pick the most actionable

## Design Decisions

### What stays
- Dot timeline layout (rows = weeks, columns = days) — it's unique to Chapa and works well
- Dimension coloring on dots (delivery/quality/consistency/breadth)
- Portaled tooltip on hover with dimension breakdown
- Dimension legend below the chart

### What changes

| Element | Current | Proposed |
|---------|---------|----------|
| Header | "129 active days in the last year" | Natural-language summary: "Most active week: Mar 10–16 (2.1x your avg)" |
| Stats strip | 4 generic stats (streak, longest, busiest, avg) | 3 contextual insight cards with visual reinforcement |
| Streak display | Plain "3d" number | Number + row of 7 day indicators (filled/hollow) + "what counts" tooltip |
| Busiest day | Plain "Fri" | Mini 7-bar weekday distribution chart |
| Weekly totals | Unlabeled numbers in right column | Remove — weekly info available via hover on any dot in that row |
| Peak callout | Disconnected text below | Highlighted peak dot in the grid (ring/glow) + inline annotation |
| Dot grid | No column headers, date labels on left | Day-of-week headers (M T W T F S S) at top; relative labels ("This week", "Last week") for recent rows |
| Size legend | None | Small 3-dot legend below chart showing size scale |

### What's removed
- "129 active days in the last year" paragraph — already shown in StatsGrid below
- Right-side weekly total numbers — confusing without context; replaced by hover info
- Separate "Peak:" text line — integrated into the grid visually

## Reusable Components

| Component | Location | Usage |
|-----------|----------|-------|
| `Sparkline` | `components/dashboard/Sparkline.tsx` | Weekly trend mini-chart in insight cards |
| `DeltaIndicator` | `components/dashboard/DeltaIndicator.tsx` | Trend arrow on "this week vs avg" |
| `formatIsoDate` | `lib/utils/date.ts` | Tooltip date formatting |
| `animate-bar-fill` | `globals.css` | Weekday distribution bars |
| `animate-fade-in-up` | `globals.css` | Section entrance |

## Phases

### Phase 1: Insight cards redesign
Replace the 4-stat generic grid with 3 contextual insight cards:

1. **Streak card** — current streak number + row of 7 filled/hollow circles for last 7 days + tooltip explaining "1+ contribution = active day"
2. **Rhythm card** — busiest day name + mini 7-bar weekday distribution showing relative activity per day
3. **Trend card** — this week's total + comparison to weekly average ("1.8x avg" with arrow) using existing `DeltaIndicator` pattern

**Files:** `ActivityHeatmap.tsx`, `activity-insights.ts` (add weekday distribution + weekly avg computations)

### Phase 2: Dot grid improvements
- Add day-of-week column headers (M T W T F S S) at top of grid
- Change left labels to relative for recent weeks: "This week", "Last week", then date for older
- Remove right-side weekly total numbers
- Highlight peak day dot with a subtle ring/glow
- Add a 3-dot size legend below the grid ("Low", "Med", "High")

**Files:** `ActivityHeatmap.tsx`

### Phase 3: Summary header
Replace "129 active days in the last year" with a natural-language summary generated from the data:
- "Most active week: Mar 10–16 with 1,110 contributions (2.1x your weekly average)"
- Falls back gracefully when data is sparse

**Files:** `ActivityHeatmap.tsx`, `activity-insights.ts` (add summary generation)

### Phase 4: Tests update
Update `ActivityHeatmap.test.tsx` to cover:
- New insight cards render correctly
- Day-of-week headers present
- Relative week labels
- Peak dot annotation
- Size legend
- Summary sentence
- Remove tests for removed elements (weekly totals column, "active days" paragraph)

**Files:** `ActivityHeatmap.test.tsx`

## Phase details

- [Phase 1: Insight cards redesign](2026-03-21-activity-chart-redesign-phases/phase-1.md)
- [Phase 2: Dot grid improvements](2026-03-21-activity-chart-redesign-phases/phase-2.md)
- [Phase 3: Summary header](2026-03-21-activity-chart-redesign-phases/phase-3.md)
- [Phase 4: Tests update](2026-03-21-activity-chart-redesign-phases/phase-4.md)

## Success Criteria

### Automated
- `pnpm run typecheck` passes
- `pnpm run lint` passes
- `pnpm run test` — all tests pass including new coverage
- No new lint warnings

### Manual
- Every visible number has a label or contextual comparison
- Streak display is immediately understandable without reading a tooltip
- Dot grid has clear column headers and the peak dot is visually distinct
- Hovering any dot shows the full dimension breakdown tooltip
- The activity section tells a story at a glance — a developer landing on this page should understand their activity pattern in 3 seconds
