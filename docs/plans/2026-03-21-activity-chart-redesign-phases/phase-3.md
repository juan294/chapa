# Phase 3: Summary Header

> Replace the generic "129 active days" paragraph with a natural-language summary sentence that tells the developer something meaningful at a glance.

## Changes

### 1. Add summary generation to `activity-insights.ts`

New function or field on `ActivityInsights`:

```pseudo
+ summary: string  // e.g. "Most active week: Mar 10–16 — 2.1x your weekly average"

function generateSummary(data: HeatmapDay[], insights: ActivityInsights, weeklyAvg: number): string {
  // Find the week with the highest total
  const weeks = bucketInto7DayChunks(data);
  const bestWeek = weeks.reduce((a, b) => a.total > b.total ? a : b);

  if (bestWeek.total === 0) return "No activity recorded yet";

  const multiplier = weeklyAvg > 0 ? (bestWeek.total / weeklyAvg).toFixed(1) : null;
  const weekLabel = formatWeekRange(bestWeek.startDate, bestWeek.endDate);

  if (multiplier && parseFloat(multiplier) > 1.2) {
    return `Most active week: ${weekLabel} — ${multiplier}x your weekly average`;
  }
  // Fallback: use peak day instead
  if (insights.peakDay.count > 0) {
    return `Peak day: ${formatIsoDate(insights.peakDay.date)} with ${insights.peakDay.count} contributions`;
  }
  return `${data.filter(d => d.count > 0).length} active days in the last ${Math.ceil(data.length / 7)} weeks`;
}
```

The summary picks the most interesting insight:
1. Best week if notably above average (> 1.2x)
2. Peak day as fallback
3. Active days count as last resort

### 2. Replace header in `ActivityHeatmap.tsx`

Remove:
```tsx
<p class="text-sm text-secondary mb-3">
  {activeDays} active days in the last year
</p>
```

Replace with:
```pseudo
<p class="text-sm text-secondary mb-3">
  {insights.summary}
</p>
```

The `activeDays` prop remains available (used by StatsGrid) but is no longer displayed here — it's already in StatsGrid below.

### 3. Helper: format a week range

```pseudo
function formatWeekRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.getDate()}`;
  }
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
```

## Files Changed
- `apps/web/components/dashboard/activity-insights.ts` — add `summary` field + generation logic
- `apps/web/components/dashboard/ActivityHeatmap.tsx` — swap header paragraph

## Success Criteria
- **Automated:** typecheck + lint pass
- **Manual:** summary sentence appears below "Activity" heading; sentence is contextual (mentions a specific week or peak day, not just a count); graceful fallback when data is sparse
