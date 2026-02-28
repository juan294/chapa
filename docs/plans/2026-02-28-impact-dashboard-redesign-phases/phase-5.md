# Phase 5: Coaching & Insights Cards

## Goal

Build a dedicated coaching section with trend-based insights, per-dimension tips, and next-tier guidance. This transforms the current paragraph of archetype text into actionable, card-based coaching.

## Insight Generation Logic

Insights are generated from a pure function that takes impact + trend + diff data and returns an ordered list of insight objects. The function lives in a utility file (testable in isolation).

## Files

### New: `apps/web/lib/dashboard/generate-insights.ts`

Pure function that generates coaching insights from available data.

```typescript
// Types:

interface Insight {
  id: string;               // Unique key for React rendering
  type: "trend" | "tip" | "achievement" | "next-tier";
  icon: "trending-up" | "trending-down" | "target" | "trophy" | "lightbulb" | "arrow-up";
  headline: string;          // 1 line, bold
  body: string;              // 1-2 sentences, action-oriented
  dimension?: keyof DimensionScores;  // Which dimension this relates to (for color coding)
  priority: number;          // Lower = more important (for ordering)
}

// Function: generateInsights(impact, trend, diff) → Insight[]
//
// Input:
//   impact: ImpactV4Result
//   trend: TrendSummary | null (from useTrendData)
//   diff: SnapshotDiff | null (from useTrendData)
//
// Output:
//   Insight[] — ordered by priority (most important first)
//   Maximum 5 insights returned (avoid overwhelming the user)
//
// Insight generation rules (in priority order):
//
// 1. TIER CHANGE (priority 1, type: "achievement")
//    If diff?.tier is non-null:
//    - Upgrade: "You leveled up to {tier}!" / "Your consistent effort paid off — welcome to {tier} tier."
//    - Downgrade: "Your tier shifted to {tier}" / "Recent activity changes moved you to {tier}. Focus on your strongest dimension to climb back."
//
// 2. TREND-BASED (priority 2, type: "trend")
//    If trend exists and trend.direction !== "stable":
//    - Improving: "Your impact is trending upward" / "Score has improved by an average of +{avgDelta}/day over the last {window} days. Keep this momentum."
//    - Declining: "Your impact is trending downward" / "Score has declined by an average of {avgDelta}/day recently. The biggest drop is in {worstDimension}."
//
// 3. DIMENSION IMPROVEMENT (priority 3, type: "trend")
//    For each dimension where diff?.dimensions[key] > 5:
//    - "{Dimension} improved by +{delta}" / "Your {dimension} score jumped significantly. {context based on which stats changed}"
//
// 4. WEAKEST DIMENSION TIP (priority 4, type: "tip")
//    Find the weakest dimension (lowest score):
//    - Use existing DIMENSION_TIPS[weakest] text
//    - Headline: "Grow your {dimension}"
//    - Skip if archetype is "Balanced" or "Emerging"
//
// 5. NEXT TIER GUIDANCE (priority 5, type: "next-tier")
//    Calculate gap to next tier threshold:
//    - Emerging → Solid: need adjustedComposite >= 30
//    - Solid → High: need adjustedComposite >= 70
//    - High → Elite: need adjustedComposite >= 85
//    - Elite: skip (already at top)
//    - Headline: "{gap} points to {nextTier}"
//    - Body: "You're {gap} points away from {nextTier} tier. {strongest dimension tip for gaining points}"
//
// 6. ARCHETYPE CONTEXT (priority 6, type: "tip")
//    Always include the archetype profile text (shortened to 1 sentence):
//    - Headline: "You're a {archetype}"
//    - Body: First sentence of ARCHETYPE_PROFILES[archetype]
//
// Deduplication:
//    If a dimension appears in both "improvement" and "tip", keep only the improvement.
//    Max 5 insights total.
```

### New: `apps/web/components/dashboard/InsightCard.tsx`

Single coaching insight card.

```typescript
// Props:
//   insight: Insight
//   animationDelay?: number
//
// Layout:
//
// ┌──────────────────────────────────────────────┐
// │  [icon]  Headline text here               │
// │                                              │
// │  Body text with actionable advice that       │
// │  tells the developer what to do next.        │
// └──────────────────────────────────────────────┘
//
// Styling by type:
//   - trend (improving): left border in green (--color-terminal-green)
//   - trend (declining): left border in amber (--color-terminal-yellow)
//   - tip: left border in dimension color (or purple if no dimension)
//   - achievement: left border in green + subtle green bg tint
//   - next-tier: left border in tier color of the NEXT tier
//
// Card styling:
//   - rounded-xl border border-stroke bg-card p-4
//   - border-l-4 border-l-{type-color}  (thick left accent border)
//   - animate-fade-in-up with animationDelay
//
// Icon:
//   - Inline SVG, 20×20, stroke style
//   - Color matches the left border color
//   - Icons: trending-up (↗), trending-down (↘), target (◎), trophy (🏆),
//     lightbulb (💡), arrow-up (↑) — all as simple SVG paths
//
// Typography:
//   - Headline: font-heading text-sm font-semibold text-text-primary
//   - Body: text-sm text-text-secondary leading-relaxed
//
// Accessibility:
//   - role="article"
//   - aria-label combining headline + body for screen readers
```

### New: `apps/web/components/dashboard/CoachingInsights.tsx`

Section container for insight cards.

```typescript
// Props:
//   impact: ImpactV4Result
//   trend: TrendSummary | null
//   diff: SnapshotDiff | null
//
// Rendering:
//   Section header:
//   - "Insights & Coaching" (font-heading text-xs uppercase tracking-wider)
//
//   Generate insights:
//   - Call generateInsights(impact, trend, diff)
//   - Render each as <InsightCard> with staggered animation delays
//
//   Layout:
//   - Vertical stack: space-y-3
//   - Each card gets animationDelay = baseDelay + i * 150ms
//
//   Empty state:
//   - If no insights generated (shouldn't happen — archetype context always exists):
//     show nothing (don't render the section)
```

## Tests

### `apps/web/lib/dashboard/generate-insights.test.ts`
- Returns archetype context insight for any impact data
- Returns next-tier insight with correct gap calculation
- Returns weakest dimension tip (skips Balanced/Emerging)
- Returns trend-based insight when direction is "improving"
- Returns trend-based insight when direction is "declining"
- Returns no trend insight when direction is "stable"
- Returns dimension improvement insight when diff dimension > 5
- Returns tier change achievement when diff.tier is non-null
- Returns max 5 insights
- Orders insights by priority
- Does not duplicate a dimension in both improvement and tip

### `apps/web/components/dashboard/InsightCard.test.tsx`
- Renders headline and body text
- Renders correct icon for each type
- Applies correct left border color for each type
- Has correct ARIA attributes

### `apps/web/components/dashboard/CoachingInsights.test.tsx`
- Renders InsightCards for generated insights
- Handles null trend/diff (generates insights from impact only)
- Renders section header

## Verification

```bash
pnpm run test -- --grep "generate-insights|InsightCard|CoachingInsights"
pnpm run typecheck
pnpm run lint
```

## Dependencies

- Phase 1: (none directly, but insights use trend/diff types)
- Existing: `ARCHETYPE_PROFILES`, `DIMENSION_TIPS` from `ImpactBreakdown.tsx` (extract to shared location or import)

## Exit Criteria

- `generateInsights()` produces 1-5 actionable insights from any combination of impact + trend + diff
- Tier change shows as a prominent achievement card
- Trend direction (improving/declining) generates contextual insight
- Weakest dimension gets a coaching tip with specific advice
- Next-tier gap calculated correctly for all tier transitions
- Cards render with type-appropriate styling (colors, icons, borders)
- Works with null trend/diff (new users get archetype + next-tier + weakest dim insights)
