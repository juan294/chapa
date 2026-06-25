# Phase 2 — i18n keys (en + es) `[batch-eligible]`

> Depends on: nothing. Parallel-safe with Phase 1 (disjoint files).
> Files: `apps/web/lib/i18n/dictionaries/en.ts`, `apps/web/lib/i18n/dictionaries/es.ts`.

## Intent

Add every user-facing string the panel needs, to BOTH dictionaries at identical key paths (parity-enforced by `dictionaries/parity.test.ts`). Spanish is the default locale and must be reviewed for tone (project language policy). Mirror the existing `about.scoring.*` block (`en.ts:665-833`) for terminology consistency.

## New key section: `scoreExplanation`

Place a new top-level `scoreExplanation` object (sibling of `dashboard`). Structure (leaf values shown for en; es mirrors with Spanish):

```
scoreExplanation: {
  title: "How is my score calculated?",
  intro: "Your score is built from your own activity. Here is exactly how.",

  composite: {
    headingCollaborative: "Your composite score",
    headingSolo: "Your composite score (solo profile)",
    // interpolated: {score}, {tier}, {dims}
    formula: "{score} ({tier}) = average of {dims}",
    soloNote: "You work mostly solo, so Quality is shown for context but is not counted in your composite — solo developers are never penalized for lacking code reviews.",
    adjustedNote: "A small confidence adjustment is applied: adjusted = composite × (0.85 + 0.15 × confidence/100).",
  },

  dimensions: {
    // per-dimension one-line formula descriptors (mirror about.scoring tables)
    deliveryFormula: "70% PR weight + 20% issues closed + 10% commits, with a ±5% lead-time modifier.",
    qualityCollaborativeFormula: "60% reviews + 25% review-to-PR ratio + 15% batch size.",
    qualitySoloFormula: "40% PR descriptions + 25% feature branches + 20% issue linkage + 15% batch size.",
    consistencyFormula: "45% active-day curve + 40% heatmap evenness + 15% week coverage.",
    breadthFormula: "40% repos + 25% spread across repos + 15% docs PRs + 10% stars + 5% forks.",
    craftFormula: "Average of AI-tool proficiency, effectiveness, and sophistication.",
    notCounted: "shown, not counted",
    normalizationNote: "Counts are log-normalized against a cap, so early activity counts most and volume past the cap adds nothing.",
  },

  // sub-metric labels keyed by the stable `key` from getDimensionSubMetrics
  subMetrics: {
    prWeight: "PR weight", issues: "Issues closed", commits: "Commits",
    reviews: "Reviews", reviewRatio: "Review-to-PR ratio", batchSize: "Batch size",
    prDescription: "PR descriptions", featureBranch: "Feature branches",
    issueLinkage: "Issue linkage",
    activeDays: "Active days", evenness: "Heatmap evenness", weekCoverage: "Week coverage",
    repos: "Repos contributed", spread: "Spread across repos", docs: "Docs PRs",
    stars: "Stars", forks: "Forks",
  },

  dataSources: {
    heading: "Where your data comes from",
    // interpolated {platform}, {login}
    platformLine: "{platform} ({login})",
    provides: "Measured",
    missing: "Not available on this platform",
    qualityCaveat: "{platform} does not expose PR-description, branch, or issue-link signals, so your Quality dimension is based on limited data here.",
    signalLabels: {
      commits: "commits", prs: "merged PRs", issues: "issues",
      activity: "activity calendar", reviews: "code reviews",
      stars: "stars", watchers: "watchers",
      prDescription: "PR descriptions", featureBranch: "branch strategy",
      issueLinkage: "issue linkage",
    },
  },

  confidence: {
    heading: "Confidence",
    // interpolated {value}
    valueLine: "Confidence: {value}%",
    explainer: "Confidence measures how clear the signal is — never wrongdoing. A lower value just means less data to assess impact precisely. At minimum (50) the score is reduced by only 7.5%.",
    ownerOnlyNote: "This section is only visible to you.",
    noPenalties: "No adjustments were applied.",
    // reason strings keyed by ConfidenceFlag (mirror CONFIDENCE_REASONS, translated)
    reasons: {
      burst_activity: "Some activity appears in short bursts, which reduces timing confidence.",
      micro_commit_pattern: "Many very small changes in this period reduce signal clarity.",
      generated_change_pattern: "Large change volume with limited review signals reduces confidence.",
      low_collaboration_signal: "Limited review and collaboration signals detected in this period.",
      single_repo_concentration: "Most activity is concentrated in one repo — not bad, just less cross-repo signal.",
      supplemental_unverified: "Includes activity from a linked account that cannot be independently verified.",
      low_activity_signal: "Very limited activity in this period reduces the signal available for scoring.",
      review_volume_imbalance: "High review volume with very few merged changes reduces confidence in the activity mix.",
      platform_linked: "Includes verified data from a linked platform account.",
    },
  },

  toggle: "How is my score calculated?",  // accordion trigger label
}
```

Also add aria keys if needed:
```
aria: { ...existing..., toggleScoreExplanation: "Toggle how your score is calculated" }
```

## Pseudocode notes
- Keep penalty `reasons` here as the single i18n source; the component maps `penalty.flag → t('scoreExplanation.confidence.reasons.<flag>')` (ignoring the English `reason` already on `impact.confidencePenalties`).
- Use the `…Prefix/Highlight/Suffix` split convention (as in `about.scoring`) only where a `<strong>` must sit mid-sentence; otherwise plain strings + `interpolate()`.

## Tests
- `dictionaries/parity.test.ts` must pass: identical key trees, no empty leaves, array lengths matched. (Run `pnpm run test apps/web/lib/i18n`.)

## Success criteria
- [x] Automated: parity test green; typecheck clean (dictionaries are typed).
- [x] Manual: native-speaker tone check of the Spanish copy; confirm no unreleased features referenced.
