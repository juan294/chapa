# Research: Unified Scoring Integration

> Date: 2026-03-08
> Question: How can Craft Score signals from AI tool insights be integrated into the Impact scoring system to produce a single unified score with 4 or 5 dimensions?

## Current Architecture: Two Independent Systems

### System 1: Impact v5 (GitHub Activity)

**Entry point:** `apps/web/lib/impact/v4.ts:195` — `computeImpactV4(stats: StatsData)`

Four dimensions, each 0–100, equally weighted into a composite:

```
compositeScore = round((delivery + quality + consistency + breadth) / 4)
```

Pipeline: dimensions → composite → recency weighting → confidence adjustment → EMA smoothing → tier

| Dimension | What it measures | Key signals | Weights |
|-----------|-----------------|-------------|---------|
| **Delivery** | Shipping meaningful changes | PR weight (70%), issues closed (20%), commits (10%) | Equal (25% of composite) |
| **Quality** | Engineering discipline | Collab: reviews (60%), review ratio (25%), inverse micro (15%). Solo: PR descriptions (40%), branches (25%), linkage (20%), inverse micro (15%) | Equal (25% of composite) |
| **Consistency** | Sustained contributions | sqrt(activeDays/365) (45%), heatmap evenness (40%), inverse burst (15%) | Equal (25% of composite) |
| **Breadth** | Cross-project influence | Repos (40%), inverse concentration (25%), docs ratio (15%), stars (10%), forks (5%), reserved 5% | Equal (25% of composite) |

**Type:** `DimensionScores` (`packages/shared/src/types.ts:66-71`) — 4 keys: delivery, quality, consistency, breadth

**Normalization:** Log function `ln(1+min(x,cap))/ln(1+cap)` for most metrics (`apps/web/lib/impact/utils.ts:21-25`)

**Confidence:** 8 penalty flags, range 50–100, modulates composite by 0.85x–1.0x (`utils.ts:52-162`)

**Recency:** Activity in last 90 days vs total, multiplier 0.98x–1.06x (`recency.ts:45-59`)

**EMA smoothing:** `0.15 × current + 0.85 × previous` applied in badge/share page routes, NOT inside `computeImpactV4` (`smoothing.ts`)

**Archetypes:** 6 types derived from dimension shape: Builder, Quality Champion, Marathoner, Polymath, Balanced, Emerging (`v4.ts:158-189`)

**Tiers:** Emerging (0–29), Solid (30–69), High (70–84), Elite (85–100) (`utils.ts:168-173`)

---

### System 2: Craft Score (AI Tool Insights)

**Entry point:** `apps/web/lib/insights/scoring.ts:167` — `computeCraftScore(data: InsightsUpload)`

Three sub-dimensions, each 0–100, equally weighted:

```
craftScore = round((proficiency + effectiveness + sophistication) / 3)
```

| Sub-dimension | What it measures | Key signals | Weights |
|---------------|-----------------|-------------|---------|
| **Proficiency** | Tool mastery & feature adoption | Tool diversity entropy (30%), agent usage rate (25%), multi-clauding + session diversity (25%), engagement depth (20%) | Equal (33% of composite) |
| **Effectiveness** | Outcome quality | Achievement rate (40%), satisfaction rate (25%), inverse friction (20%), error recovery (15%) | Equal (33% of composite) |
| **Sophistication** | Workflow complexity | Complex session rate (30%), lines/session (25%), multi-clauding intensity (25%), files/session (20%) | Equal (33% of composite) |

**Type:** `CraftDimensions` (`packages/shared/src/types.ts:334-338`) — 3 keys: proficiency, effectiveness, sophistication

**Tiers:** Novice (0–29), Practitioner (30–54), Expert (55–79), Master (80–100) (`scoring.ts:35-40`)

**No confidence, recency, smoothing, or archetypes.**

---

## Signal Inventory: All Available Data

### From GitHub (StatsData — `types.ts:10-38`)

| Signal | Current dimension | Nature |
|--------|-------------------|--------|
| `prsMergedWeight` | Delivery (70%) | Output volume |
| `issuesClosedCount` | Delivery (20%) | Output volume |
| `commitsTotal` | Delivery (10%) | Output volume |
| `reviewsSubmittedCount` | Quality (60%) | Collaboration quality |
| review-to-PR ratio | Quality (25%) | Collaboration balance |
| `microCommitRatio` | Quality (15%) | Code quality signal |
| `prDescriptionRate` | Quality solo (40%) | Engineering discipline |
| `featureBranchRate` | Quality solo (25%) | Engineering discipline |
| `issueLinkageRate` | Quality solo (20%) | Engineering discipline |
| `activeDays` | Consistency (45%) | Temporal pattern |
| heatmap evenness | Consistency (40%) | Temporal pattern |
| `maxCommitsIn10Min` | Consistency (15%) | Temporal pattern |
| `reposContributed` | Breadth (40%) | Scope |
| `topRepoShare` | Breadth (25%) | Scope diversity |
| `docsOnlyPrRatio` | Breadth (15%) | Scope diversity |
| `totalStars` | Breadth (10%) | Community signal |
| `totalForks` | Breadth (5%) | Community signal |
| `linesAdded/Deleted` | Confidence only | Volume (unused in dimensions) |

### From Insights Reports (InsightsUpload — `types.ts:288-331`)

| Signal | Current sub-dimension | Nature |
|--------|----------------------|--------|
| Tool usage distribution | Proficiency (30%) | Tool mastery |
| Agent usage rate | Proficiency (25%) | Orchestration |
| Multi-clauding % | Proficiency (25%) | Advanced feature |
| Session type diversity | Proficiency (25%) | Advanced feature |
| Messages per day | Proficiency (20%) | Engagement |
| Response time median | Proficiency (20%) | Engagement |
| Fully/mostly/partially achieved | Effectiveness (40%) | Outcome quality |
| Satisfaction counts | Effectiveness (25%) | Outcome quality |
| Friction counts | Effectiveness (20%) | Process quality |
| Tool error rate | Effectiveness (15%) | Process quality |
| Multi-task + iterative sessions | Sophistication (30%) | Workflow complexity |
| Lines per session | Sophistication (25%) | Output leverage |
| Multi-clauding overlap events | Sophistication (25%) | Parallelism |
| Files per session | Sophistication (20%) | Scope per session |

---

## Signal Overlap & Semantic Mapping

### Where the two systems measure similar things

| Concept | GitHub signal | Insights signal | Overlap |
|---------|--------------|-----------------|---------|
| **Output volume** | commits, PRs, issues | lines/session, files/session | Different perspective on same developer |
| **Code quality** | microCommitRatio, PR descriptions | achievement rate, friction rate | GitHub = structural; Insights = outcome |
| **Consistency/engagement** | activeDays, heatmap evenness | messages/day, response time | GitHub = contribution cadence; Insights = tool engagement |
| **Sophistication/breadth** | repos, concentration | session complexity, multi-clauding | GitHub = project scope; Insights = workflow scope |
| **Collaboration** | reviews submitted | (no direct parallel) | Insights lacks review signals |

### Where insights add unique signals (no GitHub equivalent)

| Signal | What it reveals |
|--------|----------------|
| **Tool diversity (entropy)** | Breadth of development workflow toolkit |
| **Agent orchestration rate** | Delegation and automation capability |
| **Session type distribution** | Strategic approach to work |
| **Achievement/satisfaction** | Outcome quality (impossible to measure from git alone) |
| **Friction analysis** | Process maturity — how well they communicate intent |
| **Multi-clauding** | Ability to parallelize work |
| **Response time** | Engagement quality |

### Where GitHub has unique signals (no insights equivalent)

| Signal | What it reveals |
|--------|----------------|
| **Code reviews** | Collaboration and mentorship |
| **Cross-repo contribution** | Organizational influence |
| **Stars/forks** | Community recognition |
| **PR structure** | Engineering discipline (branches, descriptions, linkage) |
| **Heatmap evenness** | Long-term consistency pattern |

---

## Rendering Constraints

### Badge SVG Radar Chart (`apps/web/lib/render/RadarChart.ts:16-92`)

- Currently renders a 4-point diamond (axes at 90° intervals)
- Axis array (`AXES`, line 25-30) is **not dynamically sized** — hardcoded to 4 entries
- Data points read from `DimensionScores` type using `dimensions[a.key]`
- Concentric guides are polygons (4-point → would become 5-point pentagons)
- Axis labels positioned by angle math — would work for any number of axes

### Interactive Radar Chart (`apps/web/components/dashboard/RadarChartInteractive.tsx:11-20`)

- Also hardcoded to 4 axes with same keys
- Uses `DimensionScores` type for data
- Has `DIMENSION_COLORS` mapping (line 22-27) — keyed by `DimensionScores` keys

### Dimension Cards (`apps/web/components/dashboard/DimensionCardsRow.tsx`)

- Iterates over dimension keys with labels, tooltips, colors
- Grid layout: currently 2×2, would need adjustment for 5

### Types Impact

- `DimensionScores` (`types.ts:66-71`) — would need a 5th key
- `DIMENSION_KEYS` and `SOLO_DIMENSION_KEYS` (`constants.ts`) — would need 5th entry
- `MetricsSnapshot` (`types.ts:168-211`) — would need 5th dimension field
- `ImpactV4Result` (`types.ts:83-94`) — composite calculation changes from /4 to /5
- Archetype derivation (`v4.ts:158-189`) — tie-breaking map needs 5th entry

---

## Existing Patterns for Merging Data Sources

### SupplementalStats Merge Pattern (`apps/web/lib/github/merge.ts`)

The existing `mergeStats()` function merges EMU/linked platform stats INTO `StatsData`:
- Numeric fields are summed (commits, PRs, reviews)
- Heatmaps merged by date
- Identity fields (handle, avatar) kept from primary
- Sets `hasSupplementalData: true` flag
- Triggers confidence penalty: `supplemental_unverified` (-5)

This is a **data-level merge** — supplemental stats become part of the StatsData BEFORE dimensions are computed. The scoring engine never knows the data came from two sources.

### Breadth Reserved Weight (`v4.ts:121`)

V5 Breadth has a **5% reserved weight** that currently scores as zero:
```typescript
const raw = 100 * (0.40 * repos + 0.25 * inverseConc + 0.10 * stars + 0.05 * forks + 0.15 * docsRatio);
// Note: adds to 95% — 5% is undocumented/reserved
```

This 5% gap exists in the current implementation (confirmed in `docs/impact-v5.md:60`).

---

## Archetype System Inventory

Current 6 archetypes (`v4.ts:151-156`):

| Archetype | Trigger | Tied to dimension |
|-----------|---------|-------------------|
| Builder | Delivery highest, ≥60 | delivery |
| Quality Champion | Quality highest, ≥60 | quality |
| Marathoner | Consistency highest, ≥60 | consistency |
| Polymath | Breadth highest, ≥60 | breadth |
| Balanced | Range ≤20, avg ≥50 | (none — shape-based) |
| Emerging | avg <25 OR max <40 | (none — gate) |

Tie-breaking priority: Polymath > Quality Champion > Marathoner > Builder

If a 5th dimension is added, it would need:
- A new archetype mapped to it (or reuse existing ones)
- A position in the tie-breaking priority list
- Threshold compatibility (≥60 to qualify as specialist)

---

## Confidence System Inventory

8 penalty flags, all driven by StatsData fields (`utils.ts:52-150`):

| Flag | Penalty | Trigger |
|------|---------|---------|
| `burst_activity` | -15 | maxCommitsIn10Min ≥ 20 |
| `micro_commit_pattern` | -10 | microCommitRatio ≥ 0.6 |
| `generated_change_pattern` | -15 | totalLines ≥ 20000 AND reviews ≤ 2 |
| `low_collaboration_signal` | -10 | PRs ≥ 10 AND reviews ≤ 1 |
| `single_repo_concentration` | -5 | topRepoShare ≥ 0.95 AND repos ≤ 1 |
| `supplemental_unverified` | -5 | hasSupplementalData |
| `low_activity_signal` | -10 | activeDays < 30 AND commits < 50 |
| `review_volume_imbalance` | -10 | reviews ≥ 50 AND PRs < 3 |

None of these currently use insights data. If insights were integrated, new confidence flags could theoretically detect AI-generated-but-unreviewed code more precisely.

---

## Test Coverage

| File | Tests | Focus |
|------|-------|-------|
| `v4.test.ts` | ~80 tests | All 4 dimensions, archetype, composite, integration |
| `utils.test.ts` | ~30 tests | Confidence, tier, adjusted score |
| `heatmap-evenness.test.ts` | ~10 tests | Evenness calculation |
| `recency.test.ts` | ~15 tests | Recency weighting |
| `scoring.test.ts` | ~40 tests | All 3 craft sub-dimensions, composite, tiers |
| `parser.test.ts` | ~25 tests | HTML extraction accuracy |
| `constants.test.ts` | ~10 tests | Caps, keys consistency |

Total: ~210 scoring-related tests across both systems.

---

## Key Constraints for Integration

1. **Output must be a single 0–100 composite score** — currently `adjustedComposite` in `ImpactV4Result`
2. **4 or 5 dimensions displayed on radar chart** — currently 4 (diamond shape)
3. **Insights data is optional** — many users will never upload. Score must work without it.
4. **Multiple AI tools planned** — architecture must handle Claude Code + future Cursor/Copilot
5. **Existing EMA smoothing** — score changes must be gradual, not jarring
6. **Pure function requirement** — scoring must remain deterministic and testable
7. **MetricsSnapshot** — daily snapshots must capture any new dimension for history tracking
8. **Confidence system** — insights data could inform confidence (or be subject to it)
9. **Badge SVG is always dark** — rendering changes must work in the fixed badge theme
10. **Backward compatibility** — users without insights should see scores comparable to current v5
