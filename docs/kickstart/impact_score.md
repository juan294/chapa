# Impact Score v3 (Single Source of Truth)

## Window
- 365 days fixed ("12 months"), updated daily.

## Inputs required (StatsData)
- commitsTotal (cap 600)
- activeDays (0..365)
- prsMergedCount
- prsMergedWeight (cap 120)
- reviewsSubmittedCount (cap 180)
- issuesClosedCount (cap 80)
- linesAdded, linesDeleted (display/heuristics)
- reposContributed (cap 15 for collaboration)
- topRepoShare (0..1)
- maxCommitsIn10Min (derived)
- microCommitRatio? (optional)
- docsOnlyPrRatio? (optional)

## PR weight (per merged PR)
w = 0.5 + 0.25*ln(1+filesChanged) + 0.25*ln(1+additions+deletions)
- cap per PR: w <= 3.0
- if docs-only PR (paths in docs/ or *.md), multiply w by 0.5

prsMergedWeight = sum(w) capped at 120 for normalization.

## Normalization
Use log scaling to reduce volume gaming:
f(x, cap) = ln(1 + min(x, cap)) / ln(1 + cap)

## Base impact score (0–100)
Caps:
- commits cap: 600
- prWeight cap: 120
- reviews cap: 180
- issues cap: 80
- repos cap: 15

Signals:
- C = min(commitsTotal, 600)
- PRw = min(prsMergedWeight, 120)
- R = min(reviewsSubmittedCount, 180)
- I = min(issuesClosedCount, 80)
- S = activeDays / 365 (0..1)
- Co = min(reposContributed, 15) / 15 (0..1)

Weights:
- commits: 0.12
- prWeight: 0.33
- reviews: 0.22
- issues: 0.10
- streak: 0.13
- collaboration: 0.10

base =
100 * (0.12*f(C,600) + 0.33*f(PRw,120) + 0.22*f(R,180) + 0.10*f(I,80) + 0.13*S + 0.10*Co)

Round base to integer for display.

## Confidence (50–100)
Confidence measures "signal clarity," not morality.
Never accuse wrongdoing. Provide up to 2 neutral reasons.

Start at 100 and subtract:
- burst_activity: -15 if maxCommitsIn10Min >= 20
- micro_commit_pattern: -10 if microCommitRatio >= 0.6 (only if computed)
- generated_change_pattern: -15 if (linesAdded+linesDeleted >= 20000) AND low_review_flag
- low_collaboration_signal: -10 if prsMergedCount >= 10 AND reviewsSubmittedCount <= 1
- single_repo_concentration: -5 if topRepoShare >= 0.95 AND reposContributed <= 1

Clamp confidence to [50, 100].

Reason strings (examples)
- burst_activity: "Some activity appears in short bursts, which reduces timing confidence."
- micro_commit_pattern: "Many very small changes in this period reduce signal clarity."
- generated_change_pattern: "Large change volume with limited review signals reduces confidence."
- low_collaboration_signal: "Limited review and collaboration signals detected in this period."
- single_repo_concentration: "Most activity is concentrated in one repo (not bad—just less cross-repo signal)."

## Adjusted score (0–100)
Gentle confidence weighting:
adjusted = base * (0.85 + 0.15*(confidence/100))
Clamp to [0, 100] and round.

## Tier mapping (based on adjusted)
- 0–39 Emerging
- 40–69 Solid
- 70–84 High
- 85–100 Elite
