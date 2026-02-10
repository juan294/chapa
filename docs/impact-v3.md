# Impact Score v3 (Single Source of Truth)

## Window
- 90 days fixed (“90d”), updated daily.

## Inputs required (Stats90d)
- commitsTotal (cap 200)
- activeDays (0..90)
- prsMergedCount
- prsMergedWeight (cap 40)
- reviewsSubmittedCount (cap 60)
- issuesClosedCount (cap 30)
- linesAdded, linesDeleted (display/heuristics)
- reposContributed (cap 10 for collaboration)
- topRepoShare (0..1)
- maxCommitsIn10Min (derived)
- microCommitRatio? (optional)
- docsOnlyPrRatio? (optional)

## PR weight (per merged PR)
w = 0.5 + 0.25*ln(1+filesChanged) + 0.25*ln(1+additions+deletions)
- cap per PR: w <= 3.0
- if docs-only PR (paths in docs/ or *.md), multiply w by 0.5

prsMergedWeight = sum(w) capped at 40 for normalization.

## Normalization
Use log scaling to reduce volume gaming:
f(x, cap) = ln(1 + min(x, cap)) / ln(1 + cap)

## Base impact score (0–100)
Caps:
- commits cap: 200
- prWeight cap: 40
- reviews cap: 60
- issues cap: 30
- repos cap: 10

Signals:
- C = min(commitsTotal, 200)
- PRw = min(prsMergedWeight, 40)
- R = min(reviewsSubmittedCount, 60)
- I = min(issuesClosedCount, 30)
- S = activeDays / 90 (0..1)
- Co = min(reposContributed, 10) / 10 (0..1)

Weights:
- commits: 0.12
- prWeight: 0.33
- reviews: 0.22
- issues: 0.10
- streak: 0.13
- collaboration: 0.10

base =
100 * (0.12*f(C,200) + 0.33*f(PRw,40) + 0.22*f(R,60) + 0.10*f(I,30) + 0.13*S + 0.10*Co)

Round base to integer for display.

## Confidence (50–100)
Confidence measures “signal clarity,” not morality.
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