# Phase 3: Interactive Radar Chart

## Goal

Build a React SVG radar chart component with hover and click interactivity. This replaces the need for the badge's SVG-string radar renderer on the web — it's a new interactive component adapted from the same math but rendered as React elements.

## Files

### New: `apps/web/components/dashboard/RadarChartInteractive.tsx`

Interactive 4-axis diamond radar chart.

```
Visual Layout:

              Delivery
                 │
                 ●  85
                /|\
               / | \
              /  |  \
   Breadth ●────┼────● Quality
         68  \  |  / 72
              \ | /
               \|/
                ●  91
                 │
            Consistency

  Hover an axis → highlight that dimension
  Click an axis → expand sub-metric panel below
```

```typescript
"use client";

// Props:
//   dimensions: DimensionScores
//   activeDimension?: keyof DimensionScores | null  — externally controlled highlight
//   onDimensionHover?: (key: keyof DimensionScores | null) => void
//   onDimensionClick?: (key: keyof DimensionScores) => void
//   size?: number (default 280)
//   animated?: boolean (default true)
//   className?: string
//
// Rendering:
//   - SVG element with viewBox="0 0 {size} {size}"
//   - Center point: (size/2, size/2)
//   - Radius: size/2 - 40 (padding for labels)
//
//   Background:
//   - 4 concentric diamond guides at 25%, 50%, 75%, 100% (polygon elements)
//   - Guide strokes: var(--color-stroke) at increasing opacity (0.1, 0.15, 0.2, 0.3)
//   - 4 axis lines from center to each vertex (var(--color-stroke) at 0.2)
//
//   Data polygon:
//   - <polygon> with points computed from dimension values (same math as RadarChart.ts)
//   - Fill: var(--color-amber) at 12% opacity
//   - Stroke: var(--color-amber) at 70% opacity, strokeWidth=2
//   - Animated: polygon grows from center point to final shape over 1.0s ease-out
//     (achieved via CSS transition on points, or by interpolating values from 0→actual)
//
//   Vertex dots:
//   - <circle r=5> at each dimension's point on the polygon
//   - Fill: dimension color (DIMENSION_COLORS[key])
//   - Stroke: var(--color-bg) strokeWidth=2 (border effect)
//
//   Axis labels:
//   - <text> positioned outside each vertex with dimension name + score
//   - font-family: Plus Jakarta Sans
//   - font-size: 12px, fill: var(--color-text-secondary)
//   - Score displayed in bold (font-weight: 600)
//
//   Hover behavior:
//   - Each axis has an invisible <rect> or <path> hit area (extends along the axis)
//   - On mouseEnter: set activeDimension, fire onDimensionHover
//   - Active dimension: its vertex dot scales up (r=7), its axis label becomes text-amber,
//     its sector of the polygon gets a brighter fill (20% opacity)
//   - Non-active dimensions: slightly dimmed (opacity 0.5)
//   - On mouseLeave: clear active dimension
//
//   Click behavior:
//   - Clicking a vertex/axis fires onDimensionClick
//   - Parent handles expanding the sub-metric panel
//
//   Animation:
//   - Initial render: all dimension values start at 0, polygon is a point at center
//   - Over 1.0s ease-out, values interpolate to their actual scores
//   - Uses requestAnimationFrame for smooth interpolation
//   - Vertex dots fade in at the end of the polygon expansion (delay 0.8s)
//   - Labels fade in simultaneously with dots
//   - prefers-reduced-motion: show final state immediately
//
//   Accessibility:
//   - role="img" with aria-label describing the chart
//   - Each axis vertex is focusable (tabindex=0) with aria-label
//   - Focus triggers the same highlight as hover
//   - Enter/Space on focused vertex triggers onDimensionClick
```

### New: `apps/web/components/dashboard/SubMetricPanel.tsx`

Expandable panel showing sub-metrics for a dimension.

```typescript
// Props:
//   dimension: keyof DimensionScores
//   stats: StatsData
//   isOpen: boolean
//   onClose: () => void
//
// Rendering per dimension:
//
// Delivery:
//   ┌─────────────────────────────────────────────┐
//   │  DELIVERY BREAKDOWN                    [×]  │
//   │                                             │
//   │  PR Weight        ████████████░░  70%       │
//   │  47 PRs merged (weighted)                   │
//   │                                             │
//   │  Issues Closed    ███████░░░░░░░  20%       │
//   │  12 issues closed                           │
//   │                                             │
//   │  Commits          ██░░░░░░░░░░░░  10%       │
//   │  312 commits pushed                         │
//   └─────────────────────────────────────────────┘
//
// Each sub-metric shows:
//   - Name + weight percentage (what % it contributes to the dimension)
//   - Horizontal bar showing the normalized value (0-1 mapped to 0-100% width)
//   - Raw stat value below the bar
//
// Sub-metric definitions (from research doc):
//
// Delivery: [
//   { label: "PR Weight", weight: "70%", stat: stats.prsMergedWeight, rawLabel: `${stats.prsMergedCount} PRs merged`, cap: 60 },
//   { label: "Issues Closed", weight: "20%", stat: stats.issuesClosedCount, rawLabel: `${stats.issuesClosedCount} issues closed`, cap: 40 },
//   { label: "Commits", weight: "10%", stat: stats.commitsTotal, rawLabel: `${stats.commitsTotal} commits`, cap: 300 },
// ]
//
// Quality: [
//   { label: "Reviews", weight: "60%", stat: stats.reviewsSubmittedCount, rawLabel: `${stats.reviewsSubmittedCount} reviews`, cap: 80 },
//   { label: "Review Ratio", weight: "25%", computed: reviewRatio, rawLabel: `${reviewRatio.toFixed(1)}:1 reviews per PR` },
//   { label: "Code Cleanliness", weight: "15%", computed: 1 - microCommitRatio, rawLabel: `${((1 - microCommitRatio) * 100).toFixed(0)}% clean commits` },
// ]
//
// Consistency: [
//   { label: "Active Days", weight: "45%", stat: stats.activeDays, rawLabel: `${stats.activeDays} of 365 days`, cap: 365, normalize: "sqrt" },
//   { label: "Weekly Evenness", weight: "40%", computed: evenness, rawLabel: "Distribution across weeks" },
//   { label: "Low Burst Activity", weight: "15%", computed: 1 - burst, rawLabel: `Peak: ${stats.maxCommitsIn10Min} commits in 10min` },
// ]
//
// Breadth: [
//   { label: "Repos Contributed", weight: "40%", stat: stats.reposContributed, rawLabel: `${stats.reposContributed} repos`, cap: 12 },
//   { label: "Spread", weight: "25%", computed: 1 - topRepoShare, rawLabel: `Top repo: ${(stats.topRepoShare * 100).toFixed(0)}% of activity` },
//   { label: "Stars", weight: "10%", stat: stats.totalStars, rawLabel: `${stats.totalStars} stars earned`, cap: 150 },
//   { label: "Forks", weight: "5%", stat: stats.totalForks, rawLabel: `${stats.totalForks} forks`, cap: 80 },
//   { label: "Docs PRs", weight: "15%", computed: docsRatio, rawLabel: `${(docsRatio * 100).toFixed(0)}% docs-only PRs` },
// ]
//
// Panel styling:
//   - rounded-xl border border-stroke bg-card p-5
//   - Entrance: animate-scale-in (0.3s ease-out)
//   - Exit: scale 1→0.95 + fade out (0.2s)
//   - Close button in top-right corner
//
// Accessibility:
//   - role="region" with aria-label="Delivery dimension breakdown"
//   - Close button has aria-label="Close breakdown panel"
//   - Progress bars have role="progressbar" with aria-valuenow
//   - Escape key closes the panel
```

## Tests

### `apps/web/components/dashboard/RadarChartInteractive.test.tsx`
- Renders SVG with correct viewBox
- Renders 4 guide diamonds (polygons)
- Renders data polygon with correct points for given dimensions
- Renders 4 vertex dots with correct colors
- Renders 4 axis labels with dimension names
- Hover on axis area triggers onDimensionHover callback
- Click on axis area triggers onDimensionClick callback
- Keyboard focus on vertex triggers highlight
- Enter key on focused vertex triggers onDimensionClick
- Has role="img" with descriptive aria-label

### `apps/web/components/dashboard/SubMetricPanel.test.tsx`
- Renders correct sub-metrics for each dimension
- Shows weight percentage labels
- Shows raw stat values
- Renders progress bars with correct widths
- Close button fires onClose
- Escape key fires onClose
- Has correct ARIA attributes

## Verification

```bash
pnpm run test -- --grep "RadarChartInteractive|SubMetricPanel"
pnpm run typecheck
pnpm run lint
```

## Dependencies

- Phase 1: `useInView` hook (for scroll-triggered animation)
- Dimension colors from `globals.css` (`--color-dimension-*`)

## Exit Criteria

- Radar chart renders a 4-axis diamond with data polygon matching the dimension scores
- Hovering an axis highlights that dimension (dot scales, label brightens, others dim)
- Clicking an axis expands the SubMetricPanel showing weighted sub-components
- Polygon animates from center outward on first view
- Keyboard navigation works (Tab between vertices, Enter to expand)
- Reduced-motion: shows final state immediately
- Light and dark themes both render correctly
