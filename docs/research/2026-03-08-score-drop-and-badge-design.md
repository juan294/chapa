# Research: Score Drop (58→47) and Badge Design Not Showing

> Date: 2026-03-08
> Triggered by: User refreshed badge, score dropped from 58 to 47 without adding insights. Pentagon design visible on landing page but not on real badge.

## Finding 1: Score Drop — Solo Profile Composite Formula Changed in V6

### Root Cause

The v6 implementation **accidentally removed the solo profile composite formula exception**. This affects any user with `reviewsSubmittedCount === 0` (solo developer profile).

### Evidence: Main (production, v5) vs Develop (v6)

**`apps/web/lib/impact/v4.ts` on `main` (lines 196–207):**
```typescript
const compositeScore =
  profileType === "solo"
    ? Math.round(
        (dimensions.delivery + dimensions.consistency + dimensions.breadth) / 3
      )
    : Math.round(
        (dimensions.delivery + dimensions.quality +
         dimensions.consistency + dimensions.breadth) / 4
      );
```

**`apps/web/lib/impact/v4.ts` on `develop` (lines 206–211):**
```typescript
const activeDims = [dimensions.delivery, dimensions.quality,
  dimensions.consistency, dimensions.breadth];
if (dimensions.craft != null) activeDims.push(dimensions.craft);
const compositeScore = Math.round(
  activeDims.reduce((sum, v) => sum + v, 0) / activeDims.length
);
```

**Key differences:**
| Aspect | Main (v5) | Develop (v6) |
|--------|----------|--------------|
| Solo composite formula | `avg(delivery, consistency, breadth) / 3` | `avg(delivery, quality, consistency, breadth) / 4` |
| Quality for solo (no reviews) | `return 0` (line 39 on main) | `return computeSoloQuality(stats)` (line 41 on develop) |
| Quality included in solo composite? | **No** — excluded entirely | **Yes** — included (even if low) |

### Two Compounding Changes

**Change 1: Quality computation for solo profiles**

Main (`apps/web/lib/impact/v4.ts:39` on `main`):
```typescript
export function computeQuality(stats: StatsData): number {
  if (stats.reviewsSubmittedCount === 0) return 0;  // ← Hard zero
```

Develop (`apps/web/lib/impact/v4.ts:40-41` on `develop`):
```typescript
export function computeQuality(stats: StatsData): number {
  if (stats.reviewsSubmittedCount === 0) {
    return computeSoloQuality(stats);  // ← Non-zero computed value
  }
```

`computeSoloQuality` (`apps/web/lib/impact/v4.ts:72-83`) computes from:
- `prDescriptionRate` (40%) — typically low for solo devs
- `featureBranchRate` (25%) — may be low
- `issueLinkageRate` (20%) — often 0
- `inverseMicroCommitRatio` (15%) — varies

A solo developer might get Quality ≈ 15–35 from this function.

**Change 2: Solo composite no longer excludes Quality**

On main, `SOLO_DIMENSION_KEYS` excludes quality:
```typescript
// main — apps/web/lib/impact/v4.ts:135-138
const SOLO_DIMENSION_KEYS: (keyof DimensionScores)[] = [
  "delivery",
  "consistency",
  "breadth",
];
```

On develop, `SOLO_DIMENSION_KEYS` now includes quality AND craft:
```typescript
// develop — packages/shared/src/constants.ts:47-53
export const SOLO_DIMENSION_KEYS: (keyof DimensionScores)[] = [
  "delivery",
  "quality",
  "consistency",
  "breadth",
  "craft",
];
```

And the composite formula on develop no longer has a solo branch — it always averages all 4 (or 5) dimensions.

### Numerical Example (matches 58→47 drop)

For a solo developer with these dimensions:
- Delivery: 75
- Quality (v5/main): 0 (hard return) → **excluded from composite**
- Quality (v6/develop): ~20 (computeSoloQuality) → **included in composite**
- Consistency: 60
- Breadth: 40

**V5 (main):** composite = (75 + 60 + 40) / 3 = **58.3 → 58**
**V6 (develop):** composite = (75 + 20 + 60 + 40) / 4 = **48.75 → 49**

After recency weighting and confidence adjustment → ~47.

### How the Plan Missed This

The v6 plan (`docs/plans/2026-03-08-impact-v6-unified-scoring-phases/phase-1.md:116-120`) showed the "BEFORE" composite as:

```typescript
const compositeScore = Math.round(
  (dimensions.delivery + dimensions.quality +
   dimensions.consistency + dimensions.breadth) / 4
);
```

This is the **collaborative** branch only. The solo branch (`profileType === "solo"` with 3 dimensions) was not shown in the plan's "BEFORE" code, so the implementation replaced the entire block (including the solo exception) with the dynamic version.

---

## Finding 2: Badge Pentagon Design — Working As Designed

### Current Behavior

The radar chart dynamically renders pentagon (5 axes) or diamond (4 axes) based on whether `dimensions.craft` exists.

**`apps/web/lib/render/RadarChart.ts:29`:**
```typescript
const hasCraft = dimensions.craft != null;
```

- `craft` present → pentagon (72° axis spacing)
- `craft` absent → diamond (90° axis spacing, identical to v2)

### Why Landing Page Shows Pentagon

The landing page demo data has craft hardcoded:

**`apps/web/lib/render/demoData.ts:73-90`:**
```typescript
export const DEMO_IMPACT: ImpactV4Result = {
  dimensions: {
    delivery: 88,
    quality: 72,
    consistency: 80,
    breadth: 65,
    craft: 72,  // ← Always present in demo
  },
  // ...
};
```

### Why Real Badge Shows Diamond

The user has not uploaded AI tool insights (Claude Code, Cursor, etc.). Without insights, `dbGetToolInsights()` returns `null`, so `craftResult?.craftScore` is `undefined`, and `dimensions.craft` is never set.

**`apps/web/app/u/[handle]/badge.svg/route.ts:99-110`:**
```typescript
const [craftResult, ...] = await Promise.all([
  dbGetToolInsights(handle),  // Returns null → no craft
  // ...
]);
const impact = computeImpactV4(stats, craftResult?.craftScore ?? undefined);
// → craftScore = undefined → dimensions.craft not set → diamond radar
```

**This is the intended behavior.** The pentagon only appears when users provide AI tool insights data. The diamond fallback is identical to the v2 badge design.

---

## Finding 3: V6 Code Is NOT Deployed to Production

### Deployment State

| Branch | Last Commit | V6 Features? |
|--------|------------|--------------|
| `main` (production) | `e91bf3c` (2026-02-26) | **No** — v5 code only |
| `develop` | `d3ac1c9` (2026-03-08) | **Yes** — full v6 |

Develop is **77 commits ahead** of main (221 files changed, 16157 insertions, 1440 deletions).

CLAUDE.md states: "Production deploys from `main` only."

### Implications

- If the user saw the score drop on **production** (chapa.thecreativetoken.com): The score change is from the 365-day rolling window (old contributions aged out), NOT from v6 code changes.
- If the user saw the score drop on a **develop preview or localhost**: The v6 solo profile composite change (Finding 1) is the cause.
- If the user sees the new landing page design: They are looking at a develop preview or localhost, not production.

---

## Summary

| Issue | Cause | Action Needed? |
|-------|-------|----------------|
| Score drop 58→47 | V6 removed solo profile composite exception (3 dims → 4 dims) | **Yes** — restore solo exception or intentionally redesign |
| Pentagon not on real badge | User has no craft insights uploaded → diamond renders (by design) | **No** — working as designed |
| Pentagon on landing page | Demo data has `craft: 72` hardcoded | **No** — working as designed |
| V6 not on production | 77 commits on develop, not merged to main | **No** — per deployment policy |
