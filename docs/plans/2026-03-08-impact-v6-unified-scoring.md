# Impact v6 — Unified Scoring with 5th "Craft" Dimension

> Date: 2026-03-08
> Issue: TBD (create before implementation)
> Branch: `feature/impact-v6-unified-scoring`
> Research: `docs/research/2026-03-08-unified-scoring-integration.md`

## Overview

Evolve Impact from 4 dimensions to **5** by integrating AI tool insights as a first-class scoring dimension called **Craft**. The badge, radar chart, composite score, archetype system, and all UI components update to reflect a pentagon-based profile. The existing Craft Score system (3 sub-dimensions: Proficiency, Effectiveness, Sophistication) becomes the internal engine for the unified 5th dimension.

**Badge template version:** This constitutes **Badge v3** (v1 = original, v2 = branding + verification strip, v3 = pentagon radar + unified scoring).

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dimension count | 5 (add Craft) | Signals are orthogonal to existing 4; force-fitting would be semantically strained |
| Composite when no insights | avg(4 GitHub dims) | No score change for users without insights — backwards compatible |
| Composite with insights | avg(5 dims) | Honest average — uploading a low score can lower composite, but that's the truthful profile |
| Craft dimension source | `computeCraftScore()` output → `.craftScore` field | Reuse existing scoring engine; Craft dimension = the composite of 3 sub-dimensions |
| Craft archetype | "Artificer" | Developers whose strongest dimension is AI tool mastery |
| Archetype priority | Lowest (6th in tie-break) | New dimension shouldn't steal archetypes from established GitHub-based signals |
| Badge version | v3 | Pentagon radar, unified 5-dim score, Craft indicator pill removed |
| Radar geometry | Pentagon (72° per axis) | 5 equidistant axes; Delivery (top), Quality (72°), Consistency (144°), Breadth (216°), Craft (288°) |
| Craft color | `#F59E0B` (amber/gold) | Warm, distinctive — doesn't clash with existing dimension colors (green, orange, cyan, pink) |
| Scoring function name | Keep `computeImpactV4` internally | Rename would break too many imports for no user value; V6 is the product name, not the function name |
| CraftBreakdown | Superseded by unified dimension card | The 5th dimension card shows Craft score; sub-dimensions shown in SubMetricPanel |
| BadgeCraft pill | Removed | No longer needed — Craft is a full radar axis, not a separate indicator |

## Composite Score Formula

```
if (craftDimensionScore exists):
  composite = round((delivery + quality + consistency + breadth + craft) / 5)
else:
  composite = round((delivery + quality + consistency + breadth) / 4)
```

This means:
- Users without insights: **identical to current v5 scores**
- Users with insights: score reflects all 5 dimensions honestly

## Craft Dimension Computation

The 5th dimension value is the **composite craft score** (0–100) from the existing `computeCraftScore()` function:

```
craft = craftResult.craftScore  // avg(proficiency, effectiveness, sophistication)
```

This is NOT recomputed inside `computeImpactV4`. Instead:
1. `computeImpactV4()` accepts an optional `craftScore?: number` parameter
2. If provided, it's included as the 5th dimension
3. If absent, dimensions stay at 4 and composite divides by 4

## Archetype Updates

| Archetype | Dimension | Color | Priority |
|-----------|-----------|-------|----------|
| Polymath | breadth | `#EAB308` | 1st |
| Quality Champion | quality | `#EC4899` | 2nd |
| Marathoner | consistency | `#22C55E` | 3rd |
| Builder | delivery | `#8B5CF6` | 4th |
| **Artificer** | **craft** | **`#F59E0B`** | **5th** |
| Balanced | (shape) | `#0EA5E9` | — |
| Emerging | (gate) | `#F97316` | — |

Artificer triggers when: `craft >= 60 AND craft === max dimension` (same rules as other specialists).

## Badge v3 Visual Changes

### Radar: Diamond → Pentagon

```
v2 (current):           v3 (new):
    Delivery                Delivery
      ╱╲                      ╱╲
     ╱  ╲                    ╱  ╲
Breadth──Quality      Craft╱    ╲Quality
     ╲  ╱                  ╲    ╱
      ╲╱                    ╲  ╱
  Consistency            Breadth──Consistency
```

- Axes at 72° intervals: Delivery (-90°), Quality (-18°), Consistency (54°), Breadth (126°), Craft (198°)
- Concentric guide rings become pentagons
- Data polygon has 5 points instead of 4
- Axis labels positioned using existing angle-based math

### Craft Pill Removal

The `renderBadgeCraft()` pill in the footer is **removed**. Craft is now a full radar axis — no need for a separate indicator.

### No Layout Changes

Badge dimensions (1200×630), heatmap position, score ring position, header, footer, branding — all unchanged. Only the radar chart geometry changes (4-point → 5-point) within the same bounding box.

## Files Changed (by phase)

### Phase 1: Types, Constants, Scoring Engine
- `packages/shared/src/types.ts` — Add `craft?` to `DimensionScores`, add `"Artificer"` to `DeveloperArchetype`, add `craft` to `MetricsSnapshot`
- `packages/shared/src/constants.ts` — Add `"craft"` to `DIMENSION_KEYS` and `SOLO_DIMENSION_KEYS`
- `apps/web/lib/impact/v4.ts` — Accept optional `craftScore`, add to dimensions, update composite, add Artificer to archetype map
- `apps/web/lib/impact/utils.ts` — No changes needed (confidence, tier, normalize are dimension-agnostic)

### Phase 2: History, Snapshots, Trend
- `apps/web/lib/history/snapshot.ts` — Add `craft` field extraction
- `apps/web/lib/history/trend.ts` — Add `craft` to `TrendSummary`
- `apps/web/lib/history/diff.ts` — Add `craft` to `SnapshotDiff`

### Phase 3: Badge SVG v3 (Radar + Craft Pill Removal)
- `apps/web/lib/render/RadarChart.ts` — Pentagon geometry, 5 axes
- `apps/web/lib/render/BadgeSvg.tsx` — Remove craft pill, pass craft dimension to radar
- `apps/web/lib/render/BadgeCraft.tsx` — Delete file (dead code)
- `docs/svg-design.md` — Update to v3 spec

### Phase 4: Badge Route + Share Page Integration
- `apps/web/app/u/[handle]/badge.svg/route.ts` — Pass craft score into `computeImpactV4()`
- `apps/web/app/u/[handle]/page.tsx` — Pass craft score, remove standalone CraftBreakdown
- `apps/web/components/CraftBreakdown.tsx` — Delete file (superseded by dimension card)

### Phase 5: UI Components (Dashboard, Cards, Radar Interactive)
- `apps/web/components/dashboard/DimensionCardsRow.tsx` — Add craft
- `apps/web/components/dashboard/DimensionCard.tsx` — Add craft labels/colors/tooltips
- `apps/web/components/dashboard/SubMetricPanel.tsx` — Add craft sub-metrics case
- `apps/web/components/dashboard/RadarChartInteractive.tsx` — 5-axis pentagon
- `apps/web/components/ImpactBreakdown.tsx` — Add craft labels/colors/tooltips
- `apps/web/lib/dashboard/generate-insights.ts` — Add craft tips
- `apps/web/styles/globals.css` — Add `--color-dimension-craft` variables
- `apps/web/lib/render/theme.ts` — Add Artificer color

### Phase 6: Documentation + Cleanup
- `docs/impact-v6.md` — New spec document
- `docs/svg-design.md` — Final v3 update
- `docs/impact-v4.md` — Add deprecation note pointing to v6
- `docs/impact-v5.md` — Add deprecation note pointing to v6
- Remove any remaining dead code flagged by Knip

## Phase Summary

| # | Phase | Depends on | Batch-eligible |
|---|-------|------------|----------------|
| 1 | Types, Constants, Scoring Engine | — | No (foundation) |
| 2 | History, Snapshots, Trend | Phase 1 | No |
| 3 | Badge SVG v3 | Phase 1 | Yes (with Phase 2) |
| 4 | Badge Route + Share Page | Phases 1, 2, 3 | No |
| 5 | UI Components | Phases 1, 4 | No |
| 6 | Documentation + Cleanup | Phases 1–5 | No |

**Phases 2 and 3 are batch-eligible** — they both depend on Phase 1 but share zero files between them.

## Verification Commands

```bash
pnpm run typecheck 2>&1; pnpm run lint 2>&1; pnpm run test 2>&1
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Score regression for users without insights | Composite formula uses `/4` when craft is absent — identical to v5 |
| Archetype shifts for users with insights | Artificer has lowest priority (5th in tie-break) — only triggers when craft genuinely dominates |
| Snapshot migration | New `craft` field is optional in MetricsSnapshot — existing records don't need migration |
| Badge cache staleness | Badge cache TTL is 6h; after deploy, badges auto-refresh within 6 hours |
| EMA smoothing jump | First badge render after v6 deploy may show a score shift if craft is included; EMA dampens to ~15% of the delta |
