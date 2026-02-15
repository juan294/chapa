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
- Confidence: 8 penalty flags, range 50-100 (see Anti-Gaming Hardening below)
- `adjustedComposite = compositeScore × (0.85 + 0.15 × confidence/100)`
- Tiers: Emerging (0-39), Solid (40-69), High (70-84), Elite (85-100)

## Normalization

Reuses v3 log-normalization: `f(x, cap) = ln(1 + min(x, cap)) / ln(1 + cap)`

Applied to: commits, PRs, reviews, issues. Streak, repos, and other ratios use linear normalization.

## Anti-Gaming Hardening

Five surgical fixes to close the worst gaming vectors without redesigning the formula. All backward-compatible with cached `StatsData` objects.

### 1. PR size multiplier (anti-trivial-PR spam)

The PR weight formula now includes a size multiplier that ramps 0→1 as `totalChanges` grows from 0→10:

```
totalChanges = changedFiles + additions + deletions
sizeMultiplier = min(1, totalChanges / 10)
weight = rawWeight * sizeMultiplier
```

- Empty PRs (0 files, 0 lines) → weight 0 (was 0.5)
- Normal PRs (10+ total changes) → unaffected (multiplier = 1.0)
- Prevents inflating Building score by spamming trivial/empty PRs

Implementation: `packages/shared/src/scoring.ts`

### 2. Repo depth threshold (anti-shallow-breadth)

Only repos with >= `REPO_DEPTH_THRESHOLD` (3) commits count toward `reposContributed`. This prevents gaming Breadth by making single-commit drive-by contributions across many repos.

- `topRepoShare` still uses ALL active repos (1+ commits) for honest concentration measurement
- Constant defined in `packages/shared/src/constants.ts`

Implementation: `packages/shared/src/stats-aggregation.ts`

### 3. Unknown microCommitRatio default (no free points)

When `microCommitRatio` is `undefined` (the common case — data not available), the default is now `0.3` instead of `0`. This means `inverseMicro = 0.7` instead of `1.0`, costing ~4.5 Guarding points for profiles without this data. Profiles with an explicitly measured `microCommitRatio` of 0 still get full inverseMicro.

Implementation: `apps/web/lib/impact/v4.ts` (line 54)

### 4. Confidence penalty: low_activity_signal (-10)

Triggers when `activeDays < 30 AND commitsTotal < 50`. Catches thin-signal profiles that somehow score high through concentration in a few metrics.

Reason: "Very limited activity in this period reduces the signal available for scoring."

### 5. Confidence penalty: review_volume_imbalance (-10)

Triggers when `reviewsSubmittedCount >= 50 AND prsMergedCount < 3`. Catches the pattern of submitting many reviews (e.g. rubber-stamp LGTMs) without shipping any code. Mutually exclusive with `low_collaboration_signal` (which requires reviews ≤ 1).

Reason: "High review volume with very few merged changes reduces confidence in the activity mix."

### Updated confidence penalties (8 flags)

| Flag | Penalty | Trigger |
|------|---------|---------|
| `burst_activity` | -15 | `maxCommitsIn10Min >= 20` |
| `micro_commit_pattern` | -10 | `microCommitRatio >= 0.6` |
| `generated_change_pattern` | -15 | `totalLines >= 20000 AND reviews <= 2` (collaborative only) |
| `low_collaboration_signal` | -10 | `prsMergedCount >= 10 AND reviews <= 1` (collaborative only) |
| `single_repo_concentration` | -5 | `topRepoShare >= 0.95 AND repos <= 1` |
| `supplemental_unverified` | -5 | `hasSupplementalData === true` |
| `low_activity_signal` | -10 | `activeDays < 30 AND commitsTotal < 50` |
| `review_volume_imbalance` | -10 | `reviews >= 50 AND prsMergedCount < 3` |

Maximum simultaneous penalties: 7 (review_volume_imbalance and low_collaboration_signal are mutually exclusive). Floor: 50.
