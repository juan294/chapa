# Phase 1 — Scoring correctness & JSDoc alignment

**Source findings:** B1, B2, B3, B4 (§4A), §3.3
**Depends on:** none
**Blocks:** P4 (cache version bump), P11 (constants consolidation)

## Status

- [x] Implemented on 2026-04-22
- [x] Verified with `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest run apps/web/lib/impact/pipeline.test.ts`, and `pnpm run test`

## Goal

Fix four scoring-math defects that bias outputs today, and align the `burst_activity` JSDoc with its implementation (code stays, doc changes).

## Files touched

- `apps/web/lib/impact/heatmap-evenness.ts` (median, week-coverage, week-bucketing)
- `apps/web/lib/impact/recency.ts` (UTC alignment)
- `apps/web/lib/impact/utils.ts` (JSDoc at line 83 only)
- `packages/shared/src/stats-aggregation.ts` (median helper)
- Tests: `heatmap-evenness.test.ts`, `recency.test.ts`, `stats-aggregation.test.ts`, `utils.test.ts`

## TDD — Red tests first

```ts
// heatmap-evenness.test.ts
describe("median", () => {
  it("returns upper of two middle values for even-length sorted arrays", () => {
    // [1,2,3,4] → should be 2.5 or 3, NOT 2 (the current lower-bias output)
    expect(median([1,2,3,4])).toBe(2.5);
  });
  it("is stable for odd-length arrays", () => {
    expect(median([1,2,3])).toBe(2);
  });
});

describe("weekCoverage (B2)", () => {
  it("returns 0 when window is shorter than MIN_WEEKS_FOR_COVERAGE", () => {
    // 7-day window with 7 active days should NOT report 1.0 consistency
    const heatmap = Array.from({length: 7}, (_, i) => ({date: dayNUTC(i), count: 1}));
    expect(weekCoverage(heatmap)).toBeLessThan(1.0);
  });
  it("uses a floor denominator for short windows", () => {
    // MIN_WEEKS_FOR_COVERAGE = 4: denominator = max(ceil(days/7), 4)
    expect(weekCoverage(7daysActive)).toBe(1 / 4);
  });
});

describe("aggregateWeeklyTotals (B3)", () => {
  it("buckets by calendar week (ISO week) not positional index", () => {
    // heatmap where first day is a Wednesday should align week-0 correctly
    const wedStart = buildHeatmapStarting(wednesday);
    const buckets = aggregateWeeklyTotals(wedStart);
    expect(buckets[0].startOfWeek).toBe(sundayOfWednesday);
  });
});

// recency.test.ts (B4)
describe("recencyCutoff", () => {
  it("uses UTC midnight, independent of server TZ", () => {
    // Spy Date, assert cutoff.getUTCHours() === 0 regardless of process.env.TZ
    process.env.TZ = "America/Los_Angeles";
    expect(recencyCutoff().getUTCHours()).toBe(0);
    process.env.TZ = "Asia/Tokyo";
    expect(recencyCutoff().getUTCHours()).toBe(0);
  });
});

// utils.test.ts
describe("computeConfidence JSDoc", () => {
  it("documentation matches implementation (threshold 100)", () => {
    // Parse the JSDoc block, assert the burst_activity row says >= 100
    const source = readFileSync("apps/web/lib/impact/utils.ts", "utf8");
    expect(source).toMatch(/`burst_activity`\s+\|\s+-15\s+\|\s+>=\s*100 commits/);
  });
});
```

## Green — implementation pseudocode

```ts
// stats-aggregation.ts — median
export function median(xs: number[]): number {
  const sorted = [...xs].sort((a,b)=>a-b);
  const mid = sorted.length / 2;
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;   // arithmetic mean of two middles
  }
  return sorted[Math.floor(mid)];
}
```

```ts
// heatmap-evenness.ts — week coverage floor
const MIN_WEEKS_FOR_COVERAGE = 4;

export function weekCoverage(heatmap: HeatmapEntry[]): number {
  const activeWeeks = countActiveWeeks(heatmap);
  const denom = Math.max(Math.ceil(heatmap.length / 7), MIN_WEEKS_FOR_COVERAGE);
  return activeWeeks / denom;
}
```

```ts
// heatmap-evenness.ts — calendar week bucketing
export function aggregateWeeklyTotals(heatmap: HeatmapEntry[]): WeeklyBucket[] {
  // Bucket by Sunday-of-date (UTC) instead of Math.floor(i/7)
  const byWeek = new Map<string, number>();
  for (const entry of heatmap) {
    const d = new Date(entry.date + "T00:00:00Z");
    const sunday = startOfSundayUTC(d);
    const key = sunday.toISOString().slice(0,10);
    byWeek.set(key, (byWeek.get(key) ?? 0) + entry.count);
  }
  return [...byWeek.entries()]
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([startOfWeek, total]) => ({startOfWeek, total}));
}
```

```ts
// recency.ts — UTC midnight
export function recencyCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);   // was setHours(0,0,0,0) — local TZ
  return d;
}
```

```ts
// utils.ts:83 — JSDoc change only (no code change)
- * | `burst_activity`            | -15     | >= 20 commits in a 10-minute window            |
+ * | `burst_activity`            | -15     | >= 100 commits in a 10-minute window           |
```

## Automated success criteria

- New tests above all green.
- `pnpm run typecheck` clean.
- `pnpm run lint` clean.
- Full test suite (existing impact tests) passes — if `v6.test.ts` golden fixtures drift, update the fixtures in the same commit with a note in the commit body.
- `pnpm run test -- pipeline.test.ts` still green (the existing e2e in `impact/pipeline.test.ts:17` must not regress semantically — only numeric drift from the corrected median is acceptable).

## Manual success criteria

- For a demo handle, fetch `/u/:handle` share page before and after. Confirm dimension deltas match expectations (Quality score should not shift significantly; Consistency should not over-report from short windows).
- No visible badge breakage for handles with ≤ 7 days of activity (they should now legitimately show low Consistency, not 100).

## Notes

- Golden fixture drift is expected. Regenerate `apps/web/lib/impact/__fixtures__/*.json` if needed and commit with a short "scoring correctness: median/weekCoverage/weekBucket/recency fixes" rationale in the same phase.
- The JSDoc fix is part of this phase (not P11) because it's directly tied to the `>= 100` semantics.
