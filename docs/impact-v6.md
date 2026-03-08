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
| **Effectiveness** | Outcome quality | Achievement rate, satisfaction rate, inverse friction, error recovery |
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
| Inverse micro-commit | 15% | — | Linear |

**Solo path** (reviewsSubmittedCount = 0):
| Signal | Weight |
|--------|--------|
| PR description rate | 40% |
| Feature branch rate | 25% |
| Issue linkage rate | 20% |
| Inverse micro-commit | 15% |

### Consistency (0–100) — Sustained contributions
| Signal | Weight | Normalization |
|--------|--------|---------------|
| sqrt(activeDays/365) | 45% | Square root |
| Heatmap evenness | 40% | 1/(1+CV) |
| Inverse burst | 15% | Linear |

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
| Effectiveness | 33% | Achievement rate, satisfaction, friction, errors |
| Sophistication | 33% | Complex sessions, lines/session, parallelism, files/session |

Source: `computeCraftScore()` in `apps/web/lib/insights/scoring.ts`
Data: Claude Code `/insights` HTML report (future: Cursor, Copilot, etc.)

## Scoring Pipeline

```
StatsData (GitHub, 365 days)  +  CraftResult? (AI tool insights)
  ↓                                ↓
computeImpactV4(stats, craftScore?)
  ├→ 4 GitHub dimensions (0-100 each)
  ├→ Optional 5th craft dimension
  ├→ compositeScore = avg(active dimensions)
  ├→ Recency weighting (0.98x to 1.06x)
  ├→ Confidence (50-100, 8 penalty flags)
  ├→ adjustedComposite = composite × (0.85 + 0.15 × confidence/100)
  ├→ Archetype derivation (7 types)
  └→ Tier classification (Emerging/Solid/High/Elite)
  ↓
ImpactV4Result (with optional craft in dimensions)
  ↓
EMA smoothing (0.15 current + 0.85 previous)
  ↓
Badge SVG (pentagon or diamond radar) + Share page
```

## Type Compatibility

- `DimensionScores.craft` is optional (`craft?: number`) — zero migration needed
- `MetricsSnapshot.craft` is optional — existing snapshots remain valid
- All UI components render 4 or 5 dimensions dynamically
- `computeImpactV4(stats)` without craft returns identical results to V5

## Solo Profile Exception

Solo developers (zero code reviews) receive a modified composite calculation:

- **Composite**: `avg(Delivery, Consistency, Breadth [, Craft])` — Quality excluded
- **Quality dimension**: Computed via `computeSoloQuality()` (PR descriptions, branch strategy,
  issue linkage, micro-commit ratio) — displayed on radar/cards for informational purposes
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
| `apps/web/lib/impact/v4.ts` | Optional craftScore param, dynamic composite, Artificer archetype |
| `apps/web/lib/render/RadarChart.ts` | Pentagon (5-axis) with diamond (4-axis) fallback |
| `apps/web/lib/render/BadgeSvg.tsx` | Craft pill removed |
| `apps/web/lib/render/BadgeCraft.tsx` | Deleted (superseded by radar axis) |
| `apps/web/components/CraftBreakdown.tsx` | Deleted (superseded by dimension card) |
| `apps/web/components/dashboard/*` | Craft dimension in cards, radar, sub-metrics |
| `apps/web/styles/globals.css` | Craft/Artificer CSS color variables |
| `docs/svg-design.md` | Badge v3 spec |
