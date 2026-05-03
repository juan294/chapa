# Impact V6 Scoring Specification

> Source of truth for the V6 scoring system. Supersedes V5.

## Motivation

V5 measured developer impact through 4 GitHub-derived dimensions. But modern developers increasingly work *through* AI tools — the quality of that collaboration is itself a signal of developer sophistication. V6 adds a 5th "Craft" dimension that captures AI tool mastery, bringing the total profile to 5 dimensions.

## Changes from V5

### 1. Fifth Dimension: Craft (Optional)

A new optional dimension measuring AI tool proficiency, effectiveness, and workflow sophistication. Powered by the existing `computeCraftScore()` engine with 3 sub-dimensions:

| Sub-dimension | What it measures | Key signals |
|---------------|-----------------|-------------|
| **Proficiency** | Tool mastery & feature adoption | Tool diversity (entropy), agent usage rate, multi-clauding %, session type diversity, engagement depth |
| **Effectiveness** | Outcome quality | Achievement rate (55%), satisfaction rate (45%) — friction/errors excluded (AI tool's mistakes, not the developer's) |
| **Sophistication** | Workflow complexity | Complex session rate, lines/session, multi-clauding intensity, files/session |

`craft = round(avg(proficiency, effectiveness, sophistication))` — 0 to 100.

### 2. Dynamic Composite Score

```
if craft dimension exists:
  composite = round((delivery + quality + consistency + breadth + craft) / 5)
else:
  composite = round((delivery + quality + consistency + breadth) / 4)
```

Users without insights: **identical scores to V5**. No regression.

### 3. Artificer Archetype

New archetype for developers whose strongest dimension is Craft (AI tool mastery).

| Archetype | Dimension | Color | Tie-break Priority |
|-----------|-----------|-------|--------------------|
| Polymath | breadth | #EAB308 | 1st |
| Quality Champion | quality | #EC4899 | 2nd |
| Marathoner | consistency | #22C55E | 3rd |
| Builder | delivery | #8B5CF6 | 4th |
| **Artificer** | **craft** | **#F59E0B** | **5th** |
| Balanced | (shape) | #0EA5E9 | — |
| Emerging | (gate) | #F97316 | — |

Triggers when: `craft >= 60 AND craft === max dimension`. Lowest priority — only triggers when craft genuinely dominates.

### 4. Badge v3: Pentagon Radar

The badge radar chart renders as a 5-point pentagon when craft data exists, or falls back to a 4-point diamond (identical to v2) when absent.

- **Pentagon axes** (72° spacing): Delivery (top), Quality (upper-right), Consistency (lower-right), Breadth (lower-left), Craft (upper-left)
- **Diamond axes** (90° spacing, fallback): Delivery (top), Quality (right), Consistency (bottom), Breadth (left)
- The standalone "AI Craft" pill has been removed — Craft is now a full radar axis.

## Five Dimensions

### Delivery (0–100) — Shipping meaningful changes
| Signal | Weight | Cap | Normalization |
|--------|--------|-----|---------------|
| PR weight | 70% | 60 | Log |
| Issues closed | 20% | 40 | Log |
| Commits | 10% | 300 | Log |

### Quality (0–100) — Engineering discipline
**Collaborative path** (reviewsSubmittedCount > 0):
| Signal | Weight | Cap | Normalization |
|--------|--------|-----|---------------|
| Reviews submitted | 60% | 80 | Log |
| Review-to-PR ratio | 25% | 5:1 | Linear |
| Batch size score | 15% | — | Linear |

**Solo path** (reviewsSubmittedCount = 0):
| Signal | Weight |
|--------|--------|
| PR description rate | 40% |
| Feature branch rate | 25% |
| Issue linkage rate | 20% |
| Batch size score | 15% |

**Cliff guard (v6.2, #827):** for collaborative profiles, Quality returns
`max(collaborativeFormula, soloFormula)`. This prevents a sharp drop when a
user with strong solo signals (descriptions, feature branches, issue linkage)
crosses the 0.15 review-to-PR threshold and switches scoring formulas. Without
the guard, picking up a few reviews could lower Quality by 30–40 points;
participation in code review must never be punished.

### Consistency (0–100) — Sustained contributions
| Signal | Weight | Normalization |
|--------|--------|---------------|
| sqrt(activeDays/365) | 45% | Square root |
| Heatmap evenness | 40% | 1/(1+CV) |
| Week coverage | 15% | Linear |

### Breadth (0–100) — Cross-project influence
| Signal | Weight | Cap | Normalization |
|--------|--------|-----|---------------|
| Repos contributed | 40% | 12 | Linear |
| Inverse concentration | 25% | — | Linear |
| Docs-only PR ratio | 15% | — | Linear |
| Stars | 10% | 150 | Log |
| Forks | 5% | 80 | Log |

### Craft (0–100, optional) — AI tool mastery
| Sub-dimension | Weight | Key signals |
|---------------|--------|-------------|
| Proficiency | 33% | Tool diversity, agent rate, multi-clauding, engagement |
| Effectiveness | 33% | Achievement rate (55%), satisfaction rate (45%) — friction/errors excluded |
| Sophistication | 33% | Complex sessions, lines/session, parallelism, files/session |

Source: `computeCraftScore()` in `apps/web/lib/insights/scoring.ts`
Data: Claude Code `/insights` HTML report (future: Cursor, Copilot, etc.)

## Scoring Pipeline

```
StatsData (GitHub, 365 days)  +  CraftResult? (AI tool insights)
  ↓                                ↓
computeImpactV6(stats, craftScore?)
  ├→ 4 GitHub dimensions (0-100 each)
  ├→ Optional 5th craft dimension
  ├→ compositeScore = avg(active dimensions)
  ├→ Recency weighting (0.98x to 1.06x)
  ├→ Confidence (50-100, 9 flag entries: 8 scored + 1 informational at 0 penalty)
  ├→ adjustedComposite = composite × (0.85 + 0.15 × confidence/100)
  ├→ Archetype derivation (7 types)
  └→ Tier classification (Emerging/Solid/High/Elite)
  ↓
ImpactV6Result (with optional craft in dimensions)
  ↓
EMA smoothing (0.15 current + 0.85 previous)
  ↓
Badge SVG (pentagon or diamond radar) + Share page
```

## Score Recalculation

Deliberate user actions (insights upload, platform connect) trigger immediate score recalculation via `POST /api/recalculate`. This endpoint:

1. Fetches stats (cache-first)
2. Reads craft score from DB (latest uploaded insights)
3. Computes fresh impact with `computeImpactV6(stats, craftScore)`
4. Uses the raw `adjustedComposite` — NO EMA smoothing (deliberate action bypass)
5. Replaces today's snapshot via `dbReplaceSnapshot` (upsert, not ignore-duplicate)
6. Updates the Redis snapshot cache

This ensures that after an insights upload, the badge and share page immediately reflect the new score. EMA smoothing continues to apply for passive badge views where GitHub stats change organically.

### Same-day refresh after a CLI supplemental upload (#826)

A CLI supplemental upload (`POST /api/supplemental`) follows a different path than an insights upload — it does not call `/api/recalculate` directly. Instead, it sets a Redis marker `stats:dirty:<handle>` (1h TTL) so the **next** page render does the recompute:

1. `materializeProfile` reads the marker via `isStatsDirty()` and threads `inputsChanged: true` through the impact pipeline.
2. `applyImpactScorePolicy` propagates that flag into `smoothScore`, where `bypassSameDayLock` switches behavior: instead of returning today's snapshot value verbatim (the feedback-loop guard), EMA is applied against today's snapshot — anchoring the new score to today's already-smoothed value while absorbing partial credit for the change.
3. `runPublicProfileSideEffects` routes today's snapshot through `dbReplaceSnapshot` (UPSERT), bypasses the per-day SETNX dedup guard so the legitimate refresh is not blocked, and clears the dirty marker after a successful write.

When the marker is absent (the default), all of the above is no-op and the existing same-day lock applies — the feedback-loop protection is preserved.

### Upload Flow

```
File selected → Toast: "Processing report…"
             → POST /api/insights (craft score computed + stored)
             → Toast: "Recalculating score…"
             → POST /api/recalculate (fresh impact, snapshot replaced)
             → Toast: "Craft: 69 Expert · Score updated to 61"
             → Page reloads (2.5s delay for user to read toast)
```

Rate limits: insights upload 10/day, recalculate 20/hour.

## Type Compatibility

- `DimensionScores.craft` is optional (`craft?: number`) — zero migration needed
- `MetricsSnapshot.craft` is optional — existing snapshots remain valid
- All UI components render 4 or 5 dimensions dynamically
- `computeImpactV6(stats)` without craft returns identical results to V5

## Solo Profile Exception

Solo developers (review-to-PR ratio below 0.15) receive a modified composite calculation:

- **Composite**: `avg(Delivery, Consistency, Breadth [, Craft])` — Quality excluded
- **Quality dimension**: Computed via `computeSoloQuality()` (PR descriptions, branch strategy,
  issue linkage, batch size score) — displayed on radar/cards for informational purposes
- **Archetype**: Quality Champion is excluded for solo profiles
- **Rationale**: Solo quality is a proxy metric based on engineering discipline signals,
  not peer review activity. Including it in the composite would unfairly penalize solo
  developers who lack the opportunity for code reviews.

This preserves v5 scoring parity for solo developers while adding v6 craft integration.

## Expected Score Distribution

| Profile | V5 Score | V6 w/o craft | V6 w/ craft (60) | V6 w/ craft (80) |
|---------|----------|-------------|-------------------|-------------------|
| P25 hobbyist (score ~36) | 36 | 36 | ~41 | ~45 |
| P50 solid IC (score ~60) | 60 | 60 | ~60 | ~64 |
| P75 senior IC (score ~75) | 75 | 75 | ~72 | ~76 |

## Future Extensibility

Adding a new AI tool (e.g., Cursor):
1. Create a new parser in `apps/web/lib/insights/` (e.g., `cursor-parser.ts`)
2. Map parsed data to the existing `InsightsUpload` interface
3. The same `computeCraftScore()` engine produces the Craft dimension score
4. No changes to the Impact scoring engine, badge, or UI components

## Files Modified in V6

| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | `craft?` in DimensionScores, Artificer in DeveloperArchetype |
| `packages/shared/src/constants.ts` | "craft" in DIMENSION_KEYS |
| `apps/web/lib/impact/v6.ts` | Optional craftScore param, dynamic composite, Artificer archetype |
| `apps/web/lib/render/RadarChart.ts` | Pentagon (5-axis) with diamond (4-axis) fallback |
| `apps/web/lib/render/BadgeSvg.tsx` | Craft pill removed |
| `apps/web/lib/render/BadgeCraft.tsx` | Deleted (superseded by radar axis) |
| `apps/web/components/CraftBreakdown.tsx` | Deleted (superseded by dimension card) |
| `apps/web/components/dashboard/*` | Craft dimension in cards, radar, sub-metrics |
| `apps/web/styles/globals.css` | Craft/Artificer CSS color variables |
| `docs/svg-design.md` | Badge v3 spec |

---

## V6.1 Changes (2026-03-28)

V6.1 fixes three scoring fairness issues and adds two new signals informed by high-efficiency developer research (DORA, SPACE, DX Core 4).

### Profile Type Detection
- Changed from binary (`reviewsSubmittedCount === 0` → solo) to ratio-based
- Solo threshold: `reviewsSubmittedCount / max(prsMergedCount, 1) < 0.15`
- Constant: `SOLO_REVIEW_RATIO_THRESHOLD = 0.15`
- `computeQuality()` now accepts an optional `profileType` parameter; `computeDimensions()` threads it through
- Rationale: Prevents a handful of incidental reviews from triggering the collaborative scoring path, which penalizes solo developers whose Quality is dominated by review volume (60% weight)

### Consistency Dimension
- Replaced inverse burst sub-signal (15%) with **week coverage**: `activeWeeks / totalWeeks`
- Week coverage captures "sustainable cadence" — did you show up regularly?
- Added outlier clipping to heatmap evenness: weekly totals capped at 3× median before computing CV
- Raised `burst_activity` confidence penalty threshold from 20 to 100
- Rationale: Old burst detection (threshold 30) penalized legitimately productive days common in agent-driven workflows

Updated formula:
| Signal | Weight | Normalization |
|--------|--------|---------------|
| sqrt(activeDays/365) | 45% | Square root |
| Heatmap evenness (clipped) | 40% | 1/(1+CV) on 3×median-clipped weekly totals |
| Week coverage | 15% | Linear (activeWeeks/totalWeeks) |

### Quality Dimension
- Replaced `inverseMicroCommitRatio` (15%) with **batch size score** in both collaborative and solo formulas
- `batchSizeScore` = fraction of merged PRs in the reviewable sweet spot (20-500 lines changed)
- Constants: `BATCH_SIZE_MIN = 20`, `BATCH_SIZE_MAX = 500`
- `microCommitRatio` still computed for the `micro_commit_pattern` confidence penalty (orthogonal)
- Rationale: Aligns with DORA/Google guidance that small, reviewable changes are a top quality signal; penalizes both micro PRs and oversized PRs

### Delivery Dimension
- Added **lead time modifier** (±5%) based on `medianPrLeadTimeHours`
- `computeLeadTimeModifier()`: ≤4h → 1.05x, 48h → 1.0x, ≥168h → 0.95x, undefined → 1.0x
- Applied after base delivery computation: `delivery = clamp(baseDelivery × modifier)`
- Rationale: Implements DORA lead time signal without changing existing dimension weights; rewards fast flow

### New StatsData Fields
| Field | Type | Source |
|-------|------|--------|
| `batchSizeScore` | `number?` (0-1) | Computed from merged PR line counts |
| `medianPrLeadTimeHours` | `number?` | Computed from PR `createdAt` → `mergedAt` |

### GraphQL Query Changes
- Added `createdAt` and `mergedAt` to the PR node in `CONTRIBUTION_QUERY`

### Files Modified in V6.1

| File | Change |
|------|--------|
| `packages/shared/src/constants.ts` | `SOLO_REVIEW_RATIO_THRESHOLD`, `BATCH_SIZE_MIN`, `BATCH_SIZE_MAX` |
| `packages/shared/src/types.ts` | `batchSizeScore`, `medianPrLeadTimeHours` in StatsData; `createdAt`/`mergedAt` in PR node |
| `packages/shared/src/stats-aggregation.ts` | Batch size and lead time computation |
| `packages/shared/src/github-query.ts` | `createdAt`, `mergedAt` in PR query |
| `apps/web/lib/impact/v6.ts` | Ratio-based `detectProfileType`, `computeLeadTimeModifier`, batch size in Quality |
| `apps/web/lib/impact/heatmap-evenness.ts` | Outlier clipping, `computeWeekCoverage` |
| `apps/web/lib/impact/utils.ts` | `burst_activity` threshold raised to 100 |
| `apps/web/lib/github/queries.ts` | Map `createdAt`/`mergedAt` from response |
| `apps/web/lib/github/merge.ts` | Weighted average merging for new fields |
