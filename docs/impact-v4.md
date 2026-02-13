# Impact v4: Developer Impact Profile

> Source of truth for scoring. Implementation: `apps/web/lib/impact/v4.ts`

## Philosophy

AI-assisted development makes traditional volume metrics (commits, LOC, PR counts) increasingly meaningless. Impact v4 replaces a single 0-100 score with a **multi-dimensional Developer Impact Profile** — four independent dimensions and a developer archetype label.

## Four Dimensions (each 0-100)

| Dimension | What it measures | Primary signals | Weights |
|-----------|-----------------|-----------------|---------|
| **Building** | Shipping meaningful changes | `prsMergedWeight` (70%), `issuesClosedCount` (20%), `commitsTotal` (10%) | Log-normalized with caps |
| **Guarding** | Reviewing & quality gatekeeping | `reviewsSubmittedCount` (60%), review-to-PR ratio (25%), inverse `microCommitRatio` (15%) | Reviews log-normalized; ratio capped at 5:1 |
| **Consistency** | Reliable, sustained contributions | `activeDays/365` (50%), heatmap evenness (35%), inverse burst activity (15%) | Linear for streak; CV-based for evenness |
| **Breadth** | Cross-project influence | `reposContributed` (35%), inverse `topRepoShare` (25%), `totalStars` (15%), `totalForks` (10%), `totalWatchers` (5%), `docsOnlyPrRatio` (10%) | Linear with caps; community metrics log-normalized (stars cap 500, forks cap 200, watchers cap 100) |

### Guards

Each dimension returns 0 when the primary signal is absent:
- Building: always has activity if any stats present
- Guarding: returns 0 if `reviewsSubmittedCount === 0`
- Consistency: returns 0 if `activeDays === 0`
- Breadth: returns 0 if `reposContributed === 0`

### Heatmap Evenness

New metric derived from `heatmapData[]`. Measures how evenly activity is distributed across weeks using inverted coefficient of variation:

```
weeklyTotals = sum(dailyCounts) per 7-day chunk
CV = stdDev(weeklyTotals) / mean(weeklyTotals)
evenness = 1 / (1 + CV)
```

- Perfectly uniform → 1.0
- Single-burst → ~0.2
- No activity → 0

## Developer Archetypes

Derived from the dimension profile shape. Priority order for tie-breaking: Polymath > Guardian > Marathoner > Builder.

| Archetype | Rule |
|-----------|------|
| **Emerging** | avg < 40 OR no dimension >= 50 |
| **Balanced** | All dimensions within 15 pts AND avg >= 60 |
| **Polymath** | Breadth is highest AND >= 70 |
| **Guardian** | Guarding is highest AND >= 70 |
| **Marathoner** | Consistency is highest AND >= 70 |
| **Builder** | Building is highest AND >= 70 |

Evaluation order: Emerging → Balanced → specific archetypes (by tie-breaking priority) → fallback to Emerging.

## Composite Score & Tiers

- `compositeScore = round(avg(building, guarding, consistency, breadth))`
- Confidence system unchanged from v3 (same 6 penalty flags, same 50-100 range)
- `adjustedComposite = compositeScore × (0.85 + 0.15 × confidence/100)`
- Tiers: Emerging (0-39), Solid (40-69), High (70-84), Elite (85-100)

## Normalization

Reuses v3 log-normalization: `f(x, cap) = ln(1 + min(x, cap)) / ln(1 + cap)`

Applied to: commits, PRs, reviews, issues. Streak, repos, and other ratios use linear normalization.
