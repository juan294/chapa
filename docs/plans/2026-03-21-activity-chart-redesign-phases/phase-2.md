# Phase 2: Dot Grid Improvements

> Make the dot timeline self-documenting with headers, smarter labels, peak annotation, and a size legend.

## Changes

### 1. Day-of-week column headers

Add a header row above the first week row:

```pseudo
<div class="flex items-center gap-2 mb-1">
  <span class="w-12" />  {/* spacer matching week label width */}
  <div class="flex items-center gap-1 flex-1">
    {["M","T","W","T","F","S","S"].map(label =>
      <span class="flex-1 text-center text-[7px] text-secondary font-body">{label}</span>
    )}
  </div>
  <span class="w-8" />  {/* spacer matching right column width (or remove if totals removed) */}
</div>
```

### 2. Relative week labels

Change the left-side week labels from date-only to relative for recent rows:

```pseudo
// In bucketByWeek or a new helper:
function weekLabel(weekIndex: number, totalWeeks: number, firstDate: string): string {
  const weeksAgo = totalWeeks - 1 - weekIndex;
  if (weeksAgo === 0) return "This wk";
  if (weeksAgo === 1) return "Last wk";
  // Older weeks: "Mar 3" format (current behavior)
  return new Date(firstDate + "T12:00:00")
    .toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

### 3. Remove right-side weekly totals

Remove the `<span>` showing `week.total` on the right side of each row. The weekly insight is now covered by the "This Week" card (Phase 1) and tooltip hover shows per-day detail.

### 4. Highlight peak day

In `activity-insights.ts`, `peakDay` already returns the date + count. In the dot grid, when `day.date === peakDay.date`:

```pseudo
// Add a ring around the peak dot
<div
  class="rounded-full ..."
  style={{
    ...normalStyles,
    boxShadow: isPeak ? "0 0 0 2px var(--color-amber)" : undefined,
  }}
/>
```

Since dots use `border-radius: 50%` (not clip-path), `box-shadow` works correctly for a ring effect.

### 5. Size legend

Below the dimension legend, add a dot size key:

```pseudo
<div class="flex items-center gap-3 mt-2">
  <span class="text-[10px] text-secondary">Activity:</span>
  {[
    { label: "Low", size: 10 },
    { label: "Med", size: 18 },
    { label: "High", size: 28 },
  ].map(({ label, size }) =>
    <div class="flex items-center gap-1">
      <div class="rounded-full bg-amber/40" style={{ width: size/2, height: size/2 }} />
      <span class="text-[9px] text-secondary">{label}</span>
    </div>
  )}
</div>
```

Use proportional sizes to the actual dot calculation: `size = 8 + (count/max) * 24`, so Low ≈ 10px, Med ≈ 18px, High ≈ 28px → legend dots at half scale.

## Files Changed
- `apps/web/components/dashboard/ActivityHeatmap.tsx` — all changes in the `DotTimeline` component and `bucketByWeek`

## Success Criteria
- **Automated:** typecheck + lint pass
- **Manual:** M T W T F S S headers visible above the grid; recent weeks show "This wk" / "Last wk"; peak dot has a visible ring; size legend shows 3 sizes below the chart; no orphan numbers on the right side
