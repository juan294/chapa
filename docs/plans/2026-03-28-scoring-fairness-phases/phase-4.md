# Phase 4: Add Flow Efficiency Proxy

> Sequential — after Phase 3

## Goal

Add PR lead time (time from PR creation to merge) as a flow efficiency signal in the Delivery dimension. This implements the DORA "lead time for changes" metric using data already available in the GitHub GraphQL API.

## Research Context

The high-efficiency developer scorecard weights lead time / flow efficiency at 15% of the total score. DORA identifies lead time as a key indicator that combines velocity with process health — fast lead times indicate good CI, clear review processes, and small batches.

## Design

### Data Collection

Add `createdAt` and `mergedAt` fields to the PR node in the GraphQL query. Compute median PR lead time in hours from merged PRs.

### Scoring Integration

Add as a **±5% modifier** on the Delivery score rather than a weighted sub-signal. This:
- Avoids changing existing Delivery weights (non-breaking)
- Provides a gentle boost for fast flow
- Doesn't penalize users without lead time data (modifier defaults to 1.0)
- Aligns with the research's emphasis without over-indexing on one metric

```
leadTimeModifier:
  median ≤ 4 hours  → 1.05 (fast flow bonus)
  median 4-48 hours → linear interpolation 1.05 → 1.0
  median 48-168 hours (2-7 days) → linear interpolation 1.0 → 0.95
  median > 168 hours → 0.95 (slow flow penalty)

delivery = clamp(baseDelivery × leadTimeModifier)
```

## Changes

### 1. Extend GraphQL query with PR timestamps

**File**: `packages/shared/src/github-query.ts`

```pseudo
  pullRequestContributions(first: 100) {
    totalCount
    nodes {
      pullRequest {
        additions
        deletions
        changedFiles
        merged
        body
        headRefName
+       createdAt
+       mergedAt
        closingIssuesReferences(first: 1) { totalCount }
      }
    }
  }
```

### 2. Update RawContributionData type

**File**: `packages/shared/src/types.ts`

```pseudo
  // In the PR node type within RawContributionData:
  interface PullRequestNode {
    additions: number;
    deletions: number;
    changedFiles: number;
    merged: boolean;
    body: string | null;
    headRefName: string;
+   createdAt: string;
+   mergedAt: string | null;
    closingIssuesCount: number;
  }
```

### 3. Add medianPrLeadTimeHours to StatsData

**File**: `packages/shared/src/types.ts`

```pseudo
  interface StatsData {
    ...
+   /** Median PR lead time in hours (creation → merge) for merged PRs. */
+   medianPrLeadTimeHours?: number;
    ...
  }
```

### 4. Compute median lead time in stats aggregation

**File**: `packages/shared/src/stats-aggregation.ts`

```pseudo
  // After batchSizeScore computation:
+ const leadTimes = mergedPRs
+   .filter((pr) => pr.createdAt && pr.mergedAt)
+   .map((pr) => {
+     const created = new Date(pr.createdAt).getTime();
+     const merged = new Date(pr.mergedAt).getTime();
+     return Math.max(0, (merged - created) / (1000 * 60 * 60)); // hours
+   })
+   .sort((a, b) => a - b);
+
+ const medianPrLeadTimeHours = leadTimes.length > 0
+   ? leadTimes[Math.floor(leadTimes.length / 2)]
+   : undefined;

  // In return object:
+   ...(medianPrLeadTimeHours !== undefined && { medianPrLeadTimeHours }),
```

### 5. Map new fields in query response

**File**: `apps/web/lib/github/queries.ts`

```pseudo
  .map((n) => ({
    additions: n.pullRequest.additions,
    deletions: n.pullRequest.deletions,
    changedFiles: n.pullRequest.changedFiles,
    merged: n.pullRequest.merged,
    body: n.pullRequest.body,
    headRefName: n.pullRequest.headRefName,
+   createdAt: n.pullRequest.createdAt,
+   mergedAt: n.pullRequest.mergedAt,
    closingIssuesCount: n.pullRequest.closingIssuesReferences?.totalCount ?? 0,
  })),
```

### 6. Add lead time modifier to Delivery

**File**: `apps/web/lib/impact/v4.ts:33-40`

```pseudo
+ /** Compute lead time modifier (0.95 to 1.05) from median PR lead time. */
+ function computeLeadTimeModifier(medianHours?: number): number {
+   if (medianHours == null) return 1.0; // no data → neutral
+   if (medianHours <= 4) return 1.05;
+   if (medianHours <= 48) {
+     // 4h → 1.05, 48h → 1.0 (linear interpolation)
+     return 1.05 - 0.05 * ((medianHours - 4) / (48 - 4));
+   }
+   if (medianHours <= 168) {
+     // 48h → 1.0, 168h → 0.95 (linear interpolation)
+     return 1.0 - 0.05 * ((medianHours - 48) / (168 - 48));
+   }
+   return 0.95;
+ }

  export function computeDelivery(stats: StatsData): number {
    const pr = normalize(stats.prsMergedWeight, CAPS.prWeight);
    const issues = normalize(stats.issuesClosedCount, CAPS.issues);
    const commits = normalize(stats.commitsTotal, CAPS.commits);

    const raw = 100 * (0.7 * pr + 0.2 * issues + 0.1 * commits);
-   return clampScore(raw);
+   const modifier = computeLeadTimeModifier(stats.medianPrLeadTimeHours);
+   return clampScore(raw * modifier);
  }
```

### 7. Update stats merging

**File**: `apps/web/lib/github/merge.ts`

```pseudo
  // Add medianPrLeadTimeHours: use weighted average across platforms
+ medianPrLeadTimeHours: weightedAverage(
+   primary.medianPrLeadTimeHours, primary.prsMergedCount,
+   secondary.medianPrLeadTimeHours, secondary.prsMergedCount,
+ ),
```

### 8. Add to MetricsSnapshot (optional field)

**File**: Supabase migration or snapshot insertion code

```pseudo
  // medianPrLeadTimeHours is optional in the snapshot.
  // Existing snapshots remain valid — new field is additive.
```

## Impact Analysis

For juan294: Since Delivery is already 100 (maxed), the lead time modifier would either:
- Keep it at 100 if lead time ≤ 48 hours (likely — solo dev, fast merges)
- Slightly reduce if lead time > 48 hours (unlikely)

The primary beneficiaries are developers who merge quickly (CI-first workflows) vs. those with long-lived PRs. This signal rewards flow efficiency without changing absolute scoring levels.

## Tests

**File**: `apps/web/lib/impact/v4.test.ts`

```pseudo
describe("computeLeadTimeModifier", () => {
  it("returns 1.05 for median ≤ 4 hours", ...)
  it("returns 1.0 for median = 48 hours", ...)
  it("returns 0.95 for median ≥ 168 hours", ...)
  it("interpolates linearly between 4-48h", ...)
  it("interpolates linearly between 48-168h", ...)
  it("returns 1.0 when medianHours is undefined", ...)
})

describe("computeDelivery with lead time", () => {
  it("boosts delivery for fast lead time", ...)
  it("penalizes delivery for slow lead time", ...)
  it("leaves delivery unchanged when no lead time data", ...)
  it("does not exceed 100 even with boost", ...)
})
```

**File**: `packages/shared/src/stats-aggregation.test.ts`

```pseudo
describe("medianPrLeadTimeHours", () => {
  it("computes median from merged PRs with timestamps", ...)
  it("returns undefined when no merged PRs", ...)
  it("handles single PR", ...)
  it("ignores unmerged PRs", ...)
  it("handles zero-duration merges (instant)", ...)
})
```

## Success Criteria

### Automated
- [ ] `pnpm run test` — all tests pass
- [ ] `pnpm run typecheck` — no type errors
- [ ] GraphQL query successfully returns `createdAt` and `mergedAt` for PRs
- [ ] `buildStatsFromRaw` produces correct `medianPrLeadTimeHours`
- [ ] `computeDelivery` applies modifier correctly (1.05 at 4h, 1.0 at 48h, 0.95 at 168h)
- [ ] Delivery stays at 100 for maxed profiles with fast lead times

### Manual
- [ ] Verify GraphQL query works against live GitHub API (may need rate limit check)
