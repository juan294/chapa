# Scoring Fairness & High-Efficiency Signals

> Created: 2026-03-28 | Branch: `develop` | Status: DRAFT

## Problem Statement

Audit of the `juan294` profile revealed three concrete scoring fairness issues that suppress scores for high-output solo developers. Additionally, the high-efficiency developer scorecard research (`docs/research/high-efficiency-developer-scorecard.md`) identifies two scoring signals that Chapa doesn't capture today but could with minimal data changes.

### Verified Raw Stats (juan294, 365-day window)

| Metric | Value |
|--------|-------|
| Total contributions | 5,559 |
| Active days | 134 / 365 |
| PRs merged | ~67 |
| Reviews submitted | **0** |
| PR description rate | **100%** |
| Feature branch rate | **52%** |
| Issue linkage rate | **31%** |
| Max daily contributions | **296** |
| Issues closed | 256 |

### Current Scores vs. Expected

| Dimension | Current | Expected (after fixes) | Delta |
|-----------|---------|----------------------|-------|
| Delivery | 100 | 100 | — |
| Quality | 40 (wrong path) | 73 (solo, display-only) | +33 display |
| Consistency | 46 | ~63 | +17 |
| Breadth | 69 | 69 | — |
| Craft | 73 | 73 | — |
| **Composite** | **66** | **~76** | **+10** |
| **Adjusted** | **68** | **~79** | **+11** |
| **Tier** | **Solid** | **High** | upgrade |

## Research Findings

Source: `docs/research/high-efficiency-developer-scorecard.md` (DORA, SPACE, DX Core 4, Google Engineering Practices)

### Gaps Between Research & Current Chapa Model

| Research Signal | Weight in Scorecard | Chapa Status | Action |
|----------------|-------------------|--------------|--------|
| Shipping Consistency | 20% | **Exists** — but broken (burst/evenness) | Fix (Phase 2) |
| Reviewability / Batch Size | 15% | **Partial** — only penalizes micro PRs, doesn't reward sweet spot | Add (Phase 3) |
| Lead Time / Flow Efficiency | 15% | **Missing** — no PR open-to-merge measurement | Add (Phase 4) |
| Production Quality / Rework | 20% | **Not feasible** — requires deployment data | Defer |
| Recovery / Ops Maturity | 10% | **Not feasible** — requires incident management data | Defer |
| Code Health / Maintainability | 20% | **Partial proxy** — Quality dimension covers PR hygiene | No change |

### Key Research Principles Informing This Plan

1. **"Consistency matters more than bursts"** (DX benchmarks) — validates fixing Consistency but also validates having a burst signal; the implementation, not the concept, is wrong.

2. **"Work in small batches"** (DORA, Google) — Chapa penalizes tiny PRs but treats 100-line and 5,000-line PRs identically. The research says the sweet spot (20-500 lines) should be explicitly rewarded.

3. **"Optimize for feedback loops / shorter lead times"** (DORA) — PR open-to-merge duration is a cheap, powerful signal that Chapa doesn't collect. Two timestamp fields in the GraphQL query would enable it.

4. **"What not to overvalue: raw commit count, lines of code, PR count alone"** (SPACE) — Chapa's Delivery uses these but they're log-normalized with caps, which partially mitigates. Adding lead time as a complementary signal further reduces over-reliance on volume metrics.

## Fairness Issues (Detailed)

### Issue 1: Profile Type Misclassification

**Root cause**: `detectProfileType()` at `v4.ts:210-212` uses `reviewsSubmittedCount === 0` as a binary threshold. Any non-zero review count triggers the collaborative path.

**Effect**: A developer with 6 reviews out of 67 PRs (ratio 0.09) gets scored on the collaborative path where Quality is dominated by review volume (60% weight, cap 80). Their Quality drops from 73 (solo path) to 40 (collaborative path), and this suppressed Quality score is included in their composite.

**Fix**: Use a ratio threshold. If `reviewsSubmittedCount / max(prsMergedCount, 1) < 0.15`, treat as solo. This means a developer needs roughly 1 review per 7 PRs to be treated as collaborative — a threshold that indicates genuine review participation.

### Issue 2: Burst Detection Too Aggressive

**Root cause**: Two compounding issues:
1. `maxCommitsIn10Min` at `stats-aggregation.ts:87-88` is actually max daily contributions (misnomer). Threshold of ≥30 is absurdly low — GitHub counts commits, PRs, issues, and reviews as contributions.
2. Consistency's burst penalty at `v4.ts:136-139` fully zeroes out 15% of the score at 30 daily contributions.
3. Confidence penalty at `utils.ts:124-131` fires at ≥20, applying -15 confidence.

**Effect**: Any developer with a productive day (30+ contributions) loses 15% of Consistency AND takes a -15 confidence penalty. Agent-driven workflows routinely hit 100-300 daily contributions.

**Fix**:
- Raise burst thresholds from 30→100 (consistency) and 20→100 (confidence)
- Replace the burst sub-signal (15% of Consistency) with **week coverage** — fraction of weeks with any activity. This better captures "sustainable cadence" per the research.

### Issue 3: Evenness Over-Sensitive to Outliers

**Root cause**: `computeHeatmapEvenness()` at `heatmap-evenness.ts:14-42` uses raw coefficient of variation (CV = stdDev/mean) on weekly totals. One week with 1,110 contributions and another with 2 produces CV = 2.17, giving evenness = 0.316.

**Effect**: A developer who codes every week but with variable intensity looks "inconsistent." The metric conflates *presence* (did you show up?) with *uniformity* (did you produce the same output every week?). The research says sustainable cadence matters, not uniform output.

**Fix**: Clip weekly totals at 3× median before computing CV. This preserves the "are you spread across weeks?" signal while preventing a single extreme week from dominating.

## Design Decisions

### D1: Solo threshold at 0.15 review-to-PR ratio

Rationale: 0.15 means roughly 1 review per 7 PRs. Below this, reviews are incidental (e.g., reviewing a bot PR, responding to a dependency update), not systematic code review participation. Above this, the developer is actively participating in review culture.

### D2: Replace burst sub-signal with week coverage

Rationale: The research says "maintain sustainable cadence" — which is about showing up regularly, not about limiting daily output. Week coverage (active weeks / total weeks) captures cadence directly. The burst concept is already partially captured by the (now-clipped) evenness metric.

### D3: Clip evenness at 3× median (not 2×)

Rationale: 2× median is too aggressive — it clips legitimate "heavy week" patterns. 3× median preserves most natural variation while clipping the extreme outliers (10× median) that dominate CV. The floor of 1 prevents division-by-zero when median is 0.

### D4: Batch size sweet spot: 20-500 lines

Rationale: Aligns with industry consensus (Google code review guidelines, DX benchmarks). Under 20 is trivial (typo fix, config tweak). Over 500 is hard to review thoroughly. The 20-500 range is where most meaningful, reviewable changes live.

### D5: Lead time as Delivery modifier (±5%), not weighted sub-signal

Rationale: Replacing an existing sub-signal weight in Delivery would change scores for all users. A ±5% modifier is additive — it can only shift Delivery by a few points, preventing regression for users without lead time data while rewarding fast flow.

## Phase Summary

| Phase | Description | Batch | Est. Files |
|-------|-------------|-------|-----------|
| **1** | Fix Profile Type Detection | `[batch-eligible]` | 4 |
| **2** | Fix Consistency Dimension | `[batch-eligible]` | 5 |
| **3** | Add Batch Size Signal | sequential (after 1+2) | 6 |
| **4** | Add Flow Efficiency Proxy | sequential (after 3) | 7 |
| **5** | Update Impact Spec & Docs | sequential (after 4) | 4 |

Phases 1 and 2 are `[batch-eligible]` — they touch different functions in v4.ts and different test sections. They can be developed in parallel worktrees and merged sequentially.

Phase files: `docs/plans/2026-03-28-scoring-fairness-phases/phase-{1..5}.md`

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Score regression for other users | Medium | Run scoring simulation on test fixtures before/after. Ensure no user drops more than 5 points from fixes alone. |
| GraphQL query payload increase (Phase 4) | Low | Only adds two timestamp fields per PR node. Negligible bandwidth. |
| EMA smoothing delays score updates | Low | After implementing fixes, force-refresh affected profiles to bypass EMA lag. |
| Breaking snapshot schema | Medium | New fields (batchSizeScore, medianPrLeadTimeHours) are optional. Existing snapshots remain valid. |
| Test breakage from threshold changes | Medium | Update all boundary tests. Run full suite after each phase. |
