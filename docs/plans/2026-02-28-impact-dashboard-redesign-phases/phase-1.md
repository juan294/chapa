# Phase 1: Foundation — Data Hook + Visualization Primitives

## Goal

Build the shared building blocks that all subsequent phases depend on: the trend data hook, sparkline component, delta indicator, and score ring SVG primitive.

## Files

### New: `apps/web/lib/hooks/use-trend-data.ts`

Client-side hook that fetches trend + diff from the history API.

```typescript
"use client";

// Hook: useTrendData(handle: string)
//
// Fetches from /api/history/[handle]?include=trend,diff&window=30
//
// Returns:
//   { trend: TrendSummary | null, diff: SnapshotDiff | null, isLoading: boolean, error: string | null }
//
// Behavior:
//   - Fetches once on mount (no polling)
//   - Caches in component state (SWR not needed — page is SSR + one fetch)
//   - Handles 429 (rate limit) gracefully — sets error, no retry
//   - Handles network errors — sets error, no retry
//   - Returns null trend/diff if user has no historical data (new user)
//
// Types to import:
//   - TrendSummary from "@/lib/history/trend"
//   - SnapshotDiff from "@/lib/history/diff"
//
// Implementation:
//   useState for { trend, diff, isLoading, error }
//   useEffect with fetch() call
//   Parse JSON response, extract trend + diff fields
//   Set isLoading=false when done
```

### New: `apps/web/components/dashboard/Sparkline.tsx`

Tiny SVG sparkline component — no axes, no labels, just a trend line.

```typescript
"use client";

// Props:
//   values: { date: string; value: number }[]  — from TrendSummary.dimensions[key].values
//   width?: number (default 80)
//   height?: number (default 24)
//   color: string — CSS color (use dimension color var)
//   className?: string
//
// Rendering:
//   - SVG element at width×height
//   - Map values to Y coordinates (min → bottom, max → top, with 2px padding)
//   - Render as <polyline> with stroke={color} strokeWidth=1.5 fill="none"
//   - Fill area below line with same color at 10% opacity (<polygon>)
//   - If values.length < 2, render nothing (too few data points)
//
// Animation:
//   - stroke-dasharray / stroke-dashoffset technique for trace-in effect
//   - Total path length calculated, dasharray set to total, dashoffset animates
//     from total → 0 over 0.6s ease-out
//   - Triggered by parent (via CSS class or inView prop)
//   - Respects prefers-reduced-motion (show line immediately, no trace)
//
// Accessibility:
//   - aria-hidden="true" (decorative — the numeric delta is the accessible value)
```

### New: `apps/web/components/dashboard/DeltaIndicator.tsx`

Shows score change with directional arrow and color.

```typescript
// Props:
//   delta: number — the numeric change (positive, negative, or zero)
//   label?: string — e.g., "vs last week" (optional suffix)
//   size?: "sm" | "md" (default "sm")
//
// Rendering:
//   - Positive delta: green text (#22c55e), "↑" arrow, "+{delta}" formatted
//   - Negative delta: red text (#F87171), "↓" arrow, "{delta}" formatted (already has minus)
//   - Zero/near-zero (abs < 0.5): gray text (text-text-secondary), "→" arrow, "—" text
//   - Delta formatted to 1 decimal if fractional, integer if whole
//   - font-heading text for the number (monospace alignment)
//   - font-body text for the label
//
// Sizing:
//   - sm: text-xs
//   - md: text-sm
//
// Accessibility:
//   - aria-label="Score changed by +12 points" (screen reader friendly)
```

### New: `apps/web/components/dashboard/ScoreRing.tsx`

Low-level SVG ring primitive used by hero variants.

```typescript
"use client";

// Props:
//   value: number — 0-100
//   maxValue?: number — default 100
//   size: number — diameter in px
//   strokeWidth?: number — default 8
//   color: string — stroke color for the filled arc
//   trackColor?: string — default "rgba(124,106,239,0.08)"
//   animated?: boolean — default true
//   className?: string
//   children?: React.ReactNode — rendered centered inside the ring
//
// Rendering:
//   - SVG with viewBox="0 0 {size} {size}"
//   - Background circle (track): full circumference, trackColor stroke
//   - Foreground circle (value): stroke-dasharray = circumference,
//     stroke-dashoffset = circumference * (1 - value/maxValue)
//   - transform="rotate(-90)" on the foreground circle to start from 12 o'clock
//   - strokeLinecap="round" for rounded ends
//   - Children rendered in a centered <foreignObject> or absolutely-positioned div overlay
//
// Animation:
//   - If animated=true: use gauge-fill keyframe (already exists in globals.css)
//     stroke-dashoffset transitions from circumference → target over 1.5s ease-out
//   - Triggered by useInView (only animate when scrolled into viewport)
//   - prefers-reduced-motion: show final state immediately
//
// Reuse:
//   - Used by ScoreRingGauge (Phase 2) for the main composite ring
//   - Used by ScoreConcentricRings (Phase 2) for each dimension ring
//   - Potentially used by dimension cards for mini gauges
```

### Modified: `apps/web/styles/globals.css`

Add sparkline trace animation keyframe if not already present.

```css
/* Add inside the existing @keyframes section: */

@keyframes sparkline-trace {
  from { stroke-dashoffset: var(--sparkline-length); }
  to { stroke-dashoffset: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .sparkline-animated polyline {
    animation: none !important;
    stroke-dashoffset: 0 !important;
  }
}
```

## Tests

### `apps/web/lib/hooks/use-trend-data.test.ts`
- Fetches from correct URL with correct params
- Returns trend + diff on success
- Handles 429 rate limit (sets error, no crash)
- Handles network error (sets error, no crash)
- Returns null trend/diff when API returns null (new user)
- Sets isLoading=true initially, false after fetch

### `apps/web/components/dashboard/Sparkline.test.tsx`
- Renders SVG with correct width/height
- Renders polyline with correct number of points
- Renders nothing when values.length < 2
- Applies correct color to stroke
- Applies animation class when animated

### `apps/web/components/dashboard/DeltaIndicator.test.tsx`
- Shows green + "↑" for positive delta
- Shows red + "↓" for negative delta
- Shows gray + "→" for zero delta
- Formats delta to 1 decimal
- Has correct aria-label

### `apps/web/components/dashboard/ScoreRing.test.tsx`
- Renders SVG at correct size
- Calculates stroke-dashoffset correctly for value=75 out of 100
- Renders children inside the ring
- Applies animation class when animated=true

## Verification

```bash
pnpm run test -- --grep "use-trend-data|Sparkline|DeltaIndicator|ScoreRing"
pnpm run typecheck
pnpm run lint
```

## Dependencies

None — this is the foundation phase.

## Exit Criteria

- All 4 new files created with tests passing
- `useTrendData` returns typed trend/diff data from the API
- `Sparkline` renders a smooth polyline from an array of date/value pairs
- `DeltaIndicator` shows colored directional change
- `ScoreRing` renders an animated circular progress ring
- `globals.css` has the sparkline-trace keyframe
