# Phase 2: Fix Consistency Dimension

> `[batch-eligible]` — can run in parallel with Phase 1

## Goal

Fix two issues in the Consistency dimension:
1. Replace the crude burst sub-signal (15% weight) with **week coverage** — fraction of weeks with any activity
2. Make heatmap evenness robust to outlier weeks by clipping at 3× median

## Current Behavior

```
consistency = 0.45 * sqrt(activeDays / 365)   // streak
            + 0.40 * (1 / (1 + CV))           // evenness (raw CV)
            + 0.15 * (1 - min(burst, 30) / 30) // inverse burst
```

For juan294: streak=27.3 + evenness=12.6 + burst=0.0 = **40** (actual API: 46, due to slightly different data window)

## Changes

### 1. Add week coverage computation

**File**: `apps/web/lib/impact/heatmap-evenness.ts`

```pseudo
+ /**
+  * Fraction of weeks with at least one contribution.
+  * Captures "sustainable cadence" — did you show up regularly?
+  */
+ export function computeWeekCoverage(heatmapData: HeatmapDay[]): number {
+   if (heatmapData.length === 0) return 0;
+   const numWeeks = Math.ceil(heatmapData.length / 7);
+   const weeklyTotals = aggregateWeeklyTotals(heatmapData, numWeeks);
+   const activeWeeks = weeklyTotals.filter(w => w > 0).length;
+   return activeWeeks / numWeeks;
+ }
```

### 2. Extract weekly aggregation helper (DRY)

**File**: `apps/web/lib/impact/heatmap-evenness.ts`

```pseudo
+ /** Aggregate daily heatmap into weekly totals. */
+ function aggregateWeeklyTotals(heatmapData: HeatmapDay[], numWeeks: number): number[] {
+   const weeklyTotals = new Array(numWeeks).fill(0);
+   for (let i = 0; i < heatmapData.length; i++) {
+     const week = Math.floor(i / 7);
+     weeklyTotals[week] += heatmapData[i]!.count;
+   }
+   return weeklyTotals;
+ }
```

### 3. Clip outlier weeks in evenness computation

**File**: `apps/web/lib/impact/heatmap-evenness.ts:14-42`

```pseudo
  export function computeHeatmapEvenness(heatmapData: HeatmapDay[]): number {
    if (heatmapData.length === 0) return 0;

    const numWeeks = Math.ceil(heatmapData.length / 7);
-   const weeklyTotals: number[] = new Array(numWeeks).fill(0);
-   for (let i = 0; i < heatmapData.length; i++) {
-     const week = Math.floor(i / 7);
-     weeklyTotals[week] = (weeklyTotals[week] ?? 0) + heatmapData[i]!.count;
-   }
+   const weeklyTotals = aggregateWeeklyTotals(heatmapData, numWeeks);

    const total = weeklyTotals.reduce((sum, w) => sum + w, 0);
    if (total === 0) return 0;

+   // Clip outlier weeks at 3× median to prevent extreme weeks from
+   // dominating the coefficient of variation. This preserves the "are you
+   // spread across weeks?" signal while tolerating productive bursts.
+   const sorted = [...weeklyTotals].sort((a, b) => a - b);
+   const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
+   const clipCap = Math.max(median * 3, 1);
+   const clipped = weeklyTotals.map(w => Math.min(w, clipCap));
+
+   const clippedTotal = clipped.reduce((sum, w) => sum + w, 0);
+   const mean = clippedTotal / clipped.length;

-   const mean = total / weeklyTotals.length;
-   const variance =
-     weeklyTotals.reduce((sum, w) => sum + (w - mean) ** 2, 0) /
-     weeklyTotals.length;
+   const variance =
+     clipped.reduce((sum, w) => sum + (w - mean) ** 2, 0) /
+     clipped.length;
    const stdDev = Math.sqrt(variance);

    const cv = stdDev / mean;
    return 1 / (1 + cv);
  }
```

### 4. Replace burst sub-signal with week coverage in Consistency

**File**: `apps/web/lib/impact/v4.ts:130-143`

```pseudo
  export function computeConsistency(stats: StatsData): number {
    if (stats.activeDays === 0) return 0;

    const streak = Math.sqrt(Math.min(stats.activeDays, SCORING_WINDOW_DAYS) / SCORING_WINDOW_DAYS);
    const evenness = computeHeatmapEvenness(stats.heatmapData);
+   const weekCoverage = computeWeekCoverage(stats.heatmapData);

-   // Inverse burst: low maxCommitsIn10Min → steady work
-   // Cap at 30 for normalization; 0 bursts → 1.0, 30+ → 0.0
-   const burstCap = 30;
-   const inverseBurst = 1 - Math.min(stats.maxCommitsIn10Min, burstCap) / burstCap;
-
-   const raw = 100 * (0.45 * streak + 0.40 * evenness + 0.15 * inverseBurst);
+   const raw = 100 * (0.45 * streak + 0.40 * evenness + 0.15 * weekCoverage);
    return clampScore(raw);
  }
```

### 5. Update imports

**File**: `apps/web/lib/impact/v4.ts` (import line)

```pseudo
- import { computeHeatmapEvenness } from "./heatmap-evenness";
+ import { computeHeatmapEvenness, computeWeekCoverage } from "./heatmap-evenness";
```

## Expected Impact (juan294)

| Component | Weight | Before | After | Points |
|-----------|--------|--------|-------|--------|
| Streak | 45% | sqrt(134/365) = 0.606 | 0.606 (unchanged) | 27.3 |
| Evenness | 40% | CV=2.17 → 0.316 | CV≈0.8 → ~0.56 (clipped) | ~22.4 |
| Week coverage | 15% | (was burst = 0.0) | ~33/52 = 0.63 | ~9.5 |
| **Total** | | **40** | **~59** | **+19** |

## Tests

**File**: `apps/web/lib/impact/heatmap-evenness.test.ts`

### New tests

```pseudo
describe("computeWeekCoverage", () => {
  it("returns 0 for empty heatmap", ...)
  it("returns 1.0 when all weeks have activity", ...)
  it("returns 0.5 when half the weeks have activity", ...)
  it("counts weeks with any non-zero day as active", ...)
})

describe("computeHeatmapEvenness with clipping", () => {
  it("clips outlier weeks at 3× median", ...)
  it("produces higher evenness when one extreme week is clipped", ...)
  it("unchanged when no weeks exceed 3× median", ...)
  it("uses floor of 1 when median is 0", ...)
})
```

**File**: `apps/web/lib/impact/v4.test.ts`

### Updated tests

```pseudo
describe("computeConsistency", () => {
  // Update existing tests to use weekCoverage instead of inverseBurst
  it("scores higher when more weeks have activity", ...)
  it("no longer penalizes high daily contribution counts", ...)
  it("returns 0 when activeDays is 0", ...)
  // Remove tests referencing maxCommitsIn10Min in consistency formula
})
```

## Success Criteria

### Automated
- [ ] `pnpm run test` — all tests pass
- [ ] `pnpm run typecheck` — no type errors
- [ ] `computeHeatmapEvenness` with one 1000-count week among 10-count weeks produces evenness > 0.5 (was ~0.3)
- [ ] `computeWeekCoverage` with 30 active weeks out of 52 returns ~0.577
- [ ] `computeConsistency` with maxCommitsIn10Min=300 but 134 active days scores > 55 (was ~40)
- [ ] `computeConsistency` with uniform daily activity across 52 weeks returns > 90

### Manual
- None — all verifiable via tests
