# Phase 1: Insight Cards Redesign

> Replace the 4-stat generic grid with 3 contextual insight cards that each tell a mini-story.

## Changes

### 1. Extend `activity-insights.ts`

Add two new computed fields to `ActivityInsights`:

```pseudo
+ weekdayDistribution: number[]   // 7 entries (Sun–Sat), each = total contributions on that weekday
+ weeklyAverage: number           // mean of weekly totals across all complete weeks
+ thisWeekTotal: number           // total contributions in the most recent (possibly partial) week
+ last7DaysActive: boolean[]      // 7 entries (today minus 6 → today), true if count > 0
```

Compute `weeklyAverage` by bucketing heatmap data into 7-day chunks, summing each, then averaging.
Compute `last7DaysActive` from the last 7 entries of heatmapData.
Compute `weekdayDistribution` by summing contributions per `getDay()` (already partially done for `busiestDay`).

### 2. Replace InsightStat grid in `ActivityHeatmap.tsx`

Remove the current 4-column grid of `InsightStat` components. Replace with 3 cards:

#### Card A: Streak
```pseudo
<div class="flex items-center gap-3">
  <div>
    <span class="text-2xl font-heading font-bold">{currentStreak}d</span>
    <span class="text-[10px] text-secondary uppercase">Current streak</span>
  </div>
  <div class="flex gap-0.5">
    {last7DaysActive.map(active =>
      <div class="w-2 h-2 rounded-full"
           style={active ? "bg-amber" : "bg-track border border-stroke"} />
    )}
  </div>
  <div class="text-[10px] text-secondary">
    Best: {longestStreak}d
  </div>
</div>
// Tooltip on the streak number: "Days with 1+ contribution"
```

#### Card B: Rhythm
```pseudo
<div>
  <span class="text-lg font-heading font-semibold">{busiestDay}</span>
  <span class="text-[10px] text-secondary uppercase">Most active day</span>
  <div class="flex items-end gap-px h-4 mt-1">
    {["M","T","W","T","F","S","S"].map((label, i) =>
      <div class="flex-1 flex flex-col items-center gap-0.5">
        <div class="w-full rounded-sm animate-bar-fill"
             style={height: (weekdayDist[i] / maxWeekdayDist) * 16px,
                    bg: i === busiestDayIndex ? "bg-amber" : "bg-purple-tint"} />
        <span class="text-[7px] text-secondary">{label}</span>
      </div>
    )}
  </div>
</div>
```

Note: `weekdayDistribution` is indexed Sun=0 through Sat=6. The mini bars should display Mon–Sun (shift index: Mon=1, Tue=2, ..., Sun=0).

#### Card C: This Week
```pseudo
<div>
  <span class="text-lg font-heading font-semibold">{thisWeekTotal}</span>
  <span class="text-[10px] text-secondary uppercase">This week</span>
  <div class="flex items-center gap-1 mt-0.5">
    {weeklyAverage > 0 &&
      <DeltaIndicator
        value={thisWeekTotal}
        baseline={weeklyAverage}
        format="multiplier"  // shows "1.8x avg" or "0.6x avg"
      />
    }
  </div>
</div>
```

For the DeltaIndicator, check if it already supports a "multiplier" format. If not, compute the ratio inline and display as text with color: `text-terminal-green` if > 1, `text-terminal-red` if < 1.

### 3. Layout

```pseudo
<div class="grid grid-cols-3 gap-3 mb-4">
  <StreakCard />
  <RhythmCard />
  <ThisWeekCard />
</div>
```

Each card: `rounded-lg border border-stroke bg-card p-3`

## Files Changed
- `apps/web/components/dashboard/activity-insights.ts` — add new computed fields
- `apps/web/components/dashboard/ActivityHeatmap.tsx` — replace InsightStat grid with 3 cards

## Success Criteria
- **Automated:** typecheck + lint + existing tests pass
- **Manual:** 3 cards visible, streak shows day indicators, rhythm shows mini bars, this-week shows comparison to average
