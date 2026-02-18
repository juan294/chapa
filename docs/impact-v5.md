# Impact V5 Scoring Specification

> Source of truth for the V5 scoring system. Supersedes V4 calibration values.

## Motivation

V4 scoring was mathematically correct but calibrated for top-1% developers. Most active developers scored "Emerging" — undermining the core product goal of developers proudly sharing their badge.

V5 recalibrates the same system (no new types, no new tiers, no new archetypes) to produce scores that match developer intuition about their own impact.

## Changes from V4

### 1. Normalization Caps (P50-P75 Calibration)

`packages/shared/src/constants.ts`

| Metric | V4 | V5 | Rationale |
|--------|-----|-----|-----------|
| prWeight | 120 | 60 | 30 PRs/year is solid; at 60, 25 weight normalizes to 83% |
| issues | 80 | 40 | 10 issues/year = 70% |
| commits | 600 | 300 | 150 commits = 81% |
| reviews | 180 | 80 | 30 reviews = 78% |
| repos | 15 | 12 | 5 repos = 42% |
| stars | 500 | 150 | Removes "fame tax"; 10 stars = 49% |
| forks | 200 | 80 | 10 forks = 55% |
| watchers | 100 | 50 | Kept for compat but dropped from Breadth weights |

`PR_WEIGHT_AGG_CAP` remains 120 (raw data cap, not scoring cap).

### 2. Consistency: Square Root Curve

`apps/web/lib/impact/v4.ts` — `computeConsistency()`

```
V4: streak = activeDays / 365           (linear)
V5: streak = sqrt(activeDays / 365)     (concave)
```

| Active Days | V4 | V5 | Delta |
|------------|-----|-----|-------|
| 50 | 13.7% | 37.0% | +23.3 |
| 120 | 32.9% | 57.3% | +24.4 |
| 200 | 54.8% | 74.0% | +19.2 |
| 365 | 100% | 100% | 0 |

Weight rebalance: streak 50% -> 45%, evenness 35% -> 40%, burst 15% (unchanged).

### 3. Breadth: Controllable Metrics First

`apps/web/lib/impact/v4.ts` — `computeBreadth()`

| Component | V4 | V5 |
|-----------|-----|-----|
| repos | 35% | 40% |
| inverseConcentration | 25% | 25% |
| stars | 15% | 10% |
| forks | 10% | 5% |
| watchers | 5% | 0% (dropped) |
| docsOnlyPrRatio | 10% | 15% |
| reserved | — | 5% (zeros) |

Watchers removed from scoring — weight shifted to repos and docs.

### 4. Archetype Thresholds

`apps/web/lib/impact/v4.ts` — `deriveArchetype()`

| Rule | V4 | V5 |
|------|-----|-----|
| Emerging gate | avg < 40 OR no dim >= 50 | avg < 25 OR no dim >= 40 |
| Balanced | range <= 15, avg >= 60 | range <= 20, avg >= 50 |
| Specialist | dim >= 70 | dim >= 60 |

No new archetypes. Same 6: Builder, Guardian, Marathoner, Polymath, Balanced, Emerging.

### 5. Tier Boundaries

`apps/web/lib/impact/utils.ts` — `getTier()`

| Tier | V4 | V5 |
|------|-----|-----|
| Emerging | 0-39 | 0-29 |
| Solid | 40-69 | 30-69 |
| High | 70-84 | 70-84 |
| Elite | 85-100 | 85-100 |

### 6. Recency Weighting

`apps/web/lib/impact/recency.ts` — NEW

Fraction of heatmap activity in last 90 days vs full window. Applied as a multiplier to composite score before confidence adjustment.

- 25% recent (proportional) -> 1.0x (neutral)
- 100% recent -> 1.06x (+6% max boost)
- 0% recent -> 0.98x (-2% max penalty)

Pipeline: dimensions -> composite -> **recency** -> confidence -> EMA -> tier

### 7. EMA Score Smoothing

`apps/web/lib/impact/smoothing.ts` — NEW

Exponential moving average applied as the LAST step in the badge/share page pipeline:

```
smoothed = 0.15 * currentRawScore + 0.85 * previousSmoothedScore
```

- Half-life ~4.3 days
- First visit (no previous snapshot) -> raw score passes through
- Applied in badge route and share page, NOT inside `computeImpactV4`
- Reads `adjustedComposite` from existing `MetricsSnapshot` via `dbGetLatestSnapshot`

## Expected Score Distribution

| Profile | Score | Tier | Was (V4) |
|---------|-------|------|----------|
| P25 hobbyist (60 commits, 30 days, 2 repos) | ~36 | Solid | Emerging |
| P50 solid IC (150 commits, 120 days, 5 repos) | ~60 | Solid | Low Solid |
| P75 senior IC (300 commits, 200 days, 8 repos) | ~75 | High | Borderline |
| P90 power dev | ~85 | Elite | Mid-High |

## Type Compatibility

Zero changes to shared types:
- `ImpactTier` — unchanged
- `DeveloperArchetype` — unchanged
- `ImpactV4Result` — unchanged
- `MetricsSnapshot` — unchanged
- `StatsData` — unchanged

Zero database migrations. Zero interface changes.

## Files Modified

| File | Change |
|------|--------|
| `packages/shared/src/constants.ts` | Recalibrated SCORING_CAPS |
| `packages/shared/src/constants.test.ts` | Updated expected values |
| `apps/web/lib/impact/v4.ts` | Consistency sqrt, Breadth reweight, archetype gates, recency |
| `apps/web/lib/impact/v4.test.ts` | Updated dimension/archetype tests |
| `apps/web/lib/impact/utils.ts` | Solid tier 40 -> 30 |
| `apps/web/lib/impact/utils.test.ts` | Updated tier tests |
| `apps/web/lib/impact/recency.ts` | NEW: recency ratio + weight |
| `apps/web/lib/impact/recency.test.ts` | NEW: recency tests |
| `apps/web/lib/impact/smoothing.ts` | NEW: EMA smoothing |
| `apps/web/lib/impact/smoothing.test.ts` | NEW: EMA tests |
| `apps/web/app/u/[handle]/badge.svg/route.ts` | EMA integration |
| `apps/web/app/u/[handle]/badge.svg/route.test.ts` | Mock updates |
| `apps/web/app/u/[handle]/page.tsx` | EMA integration |
