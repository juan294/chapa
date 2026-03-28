# Phase 5: Update Impact Spec & Documentation

> Sequential — after all previous phases

## Goal

Update the Impact scoring specification, CLAUDE.md references, and about/scoring page content to reflect all changes from Phases 1-4. This keeps documentation as the single source of truth for the scoring model.

## Changes

### 1. Update Impact spec

**File**: `docs/impact-v6.md`

Add a "V6.1 Changes" section (or create `docs/impact-v6.1.md` if the changes warrant a separate document):

```pseudo
## V6.1 Changes (2026-03-28)

### Profile Type Detection
- Changed from binary (reviews === 0 → solo) to ratio-based
- Solo threshold: review-to-PR ratio < 0.15
- Rationale: Prevents incidental reviews from triggering collaborative path

### Consistency Dimension
- Replaced inverse burst sub-signal (15%) with week coverage
- Week coverage = active weeks / total weeks (captures sustainable cadence)
- Added outlier clipping to heatmap evenness (3× median cap on weekly totals)
- Raised burst_activity confidence penalty threshold from 20 to 100
- Rationale: Old burst detection penalized productive days; new signals reward showing up regularly

### Quality Dimension
- Replaced micro-commit ratio (inverseMicro) with batch size score
- Batch size score = fraction of PRs in 20-500 line sweet spot
- Applies to both collaborative and solo quality formulas (15% weight)
- Rationale: Aligns with DORA/Google guidance that small, reviewable changes are a top quality signal

### Delivery Dimension
- Added lead time modifier (±5%) based on median PR lead time
- ≤ 4 hours → 1.05x boost, ≥ 168 hours → 0.95x penalty
- Neutral (1.0x) when no lead time data available
- Rationale: Implements DORA lead time signal without changing existing dimension weights

### New StatsData Fields
- batchSizeScore: fraction of PRs in 20-500 line range
- medianPrLeadTimeHours: median PR open-to-merge duration in hours

### GraphQL Query Changes
- Added createdAt and mergedAt to PR node query
```

### 2. Update CLAUDE.md

**File**: `CLAUDE.md`

Update the "Data & types" section to mention new StatsData fields:

```pseudo
  - `StatsData` — aggregated GitHub stats (23 fields)
  // Add note about new fields:
+ //   includes batchSizeScore (PR reviewability) and medianPrLeadTimeHours (flow efficiency)
```

Update the "Acceptance criteria" section:

```pseudo
  - Confidence is computed internally but not shown to users.
+ - Solo profile detection uses review-to-PR ratio threshold (0.15), not binary.
+ - Consistency dimension uses week coverage instead of inverse burst.
```

### 3. Update about/scoring page content

**File**: `apps/web/app/about/scoring/page.tsx` (or equivalent)

Update the dimension explanations to reflect:
- Quality now rewards "reviewable batch size" (20-500 lines) instead of just penalizing micro PRs
- Consistency now measures "week coverage" (how many weeks you're active) instead of penalizing daily spikes
- Delivery now includes a flow efficiency bonus for fast PR turnaround

### 4. Update the research doc with scoring alignment notes

**File**: `docs/research/high-efficiency-developer-scorecard.md`

Add a section at the end noting how the scorecard influenced Chapa's scoring:

```pseudo
## Alignment with Chapa Impact Scoring

This research informed the following changes to Chapa's Impact v6.1 scoring model:

| Scorecard Dimension | Chapa Integration | Status |
|--------------------|--------------------|--------|
| Shipping Consistency | Consistency dimension (week coverage) | Implemented |
| Reviewability / Batch Size | Quality dimension (batch size score) | Implemented |
| Lead Time / Flow | Delivery dimension (lead time modifier) | Implemented |
| Production Quality | Not feasible (needs deployment data) | Deferred |
| Recovery / Ops Maturity | Not feasible (needs incident data) | Deferred |
| Code Health | Partial proxy via Quality dimension | No change |
```

### 5. Update accepted-risks.md if needed

**File**: `docs/accepted-risks.md`

Add entry for new scoring design decisions if they constitute accepted risks:

```pseudo
## Profile type threshold (0.15 review-to-PR ratio)
A developer with exactly 15% review rate sits on the boundary. The threshold is intentionally
conservative (solo-favoring) because the collaborative path has a much stronger impact on scores.
Edge cases near the boundary will see modest score changes when crossing the threshold.
```

## Tests

No code tests — this phase is documentation only.

## Success Criteria

### Automated
- [ ] `pnpm run build` — docs pages build without errors
- [ ] All code references in docs match actual function names and file paths

### Manual
- [ ] Read through impact-v6.md (or v6.1.md) and verify all formulas match implemented code
- [ ] Verify about/scoring page renders correctly with updated content
- [ ] Verify CLAUDE.md reflects current scoring model
