# Phase 1 — Pure score-explanation builder + sub-metric extraction `[batch-eligible]`

> Depends on: nothing. Parallel-safe with Phase 2 (disjoint files).
> Files: `apps/web/lib/dashboard/score-explanation.ts` (new), `apps/web/lib/dashboard/score-explanation.test.ts` (new), `apps/web/lib/dashboard/dimension-sub-metrics.ts` (new, extracted), `apps/web/components/dashboard/SubMetricPanel.tsx` (refactor to import the extracted fn).

## Intent

Produce a single pure function `buildScoreExplanation(impact, stats)` that returns a fully-typed, render-ready description of how the score was computed — with NO i18n strings and NO owner gating inside it (those happen at render). This is the TDD anchor for the whole feature.

To avoid duplicating the per-dimension weight logic that already exists in `SubMetricPanel.getSubMetrics` (`components/dashboard/SubMetricPanel.tsx:30`), first extract it into a shared pure module, then have both `SubMetricPanel` and the new builder consume it.

## Step 1 — Extract `getSubMetrics` into a pure lib module (refactor under existing test cover)

`SubMetricPanel.tsx` currently has `getSubMetrics(dimension, stats, profileType)` returning `{ label, weight, normalizedValue, rawLabel }[]`. There is existing component test coverage for the panel; keep it green.

```
// apps/web/lib/dashboard/dimension-sub-metrics.ts  (NEW — pure, moved verbatim)
export interface DimensionSubMetric {
  key: string            // stable id for i18n + test (e.g. "prWeight", "reviews")
  weight: string         // "70%"
  normalizedValue: number // 0..1 contribution after normalization
  rawLabel: string       // e.g. "96.7 PR weight", "121 commits"
}
export function getDimensionSubMetrics(
  dimension: DimensionKey, stats: StatsData, profileType: ProfileType,
): DimensionSubMetric[] { /* moved from SubMetricPanel.getSubMetrics */ }
```

- ADD a stable `key` to each sub-metric (the current code returns a translated `label`; move the label lookup to the component, keep `key` here so the builder + tests are i18n-independent).
- `SubMetricPanel.tsx`: replace local `getSubMetrics` with an import of `getDimensionSubMetrics`, and map `key → t('...')` at render.

## Step 2 — The builder

```
// apps/web/lib/dashboard/score-explanation.ts  (NEW)
import { SCORING_CAPS, SOLO_DIMENSION_KEYS, DIMENSION_KEYS, ... } from "@chapa/shared"
import { getDimensionSubMetrics } from "./dimension-sub-metrics"

export interface DimensionExplanation {
  key: "delivery" | "quality" | "consistency" | "breadth" | "craft"
  score: number
  countsTowardComposite: boolean      // false for quality when profileType==="solo"
  subMetrics: DimensionSubMetric[]
}
export interface PlatformProvenance {
  platform: "github" | "gitlab" | "bitbucket" | "codeberg"
  login?: string
  providesQualitySignals: boolean     // true only for github
  providedSignalKeys: string[]        // e.g. ["commits","prs","issues","activity","stars"]
  missingSignalKeys: string[]         // e.g. ["prDescription","featureBranch","issueLinkage"]
}
export interface ConfidenceExplanation {
  value: number
  penalties: { flag: ConfidenceFlag; penalty: number }[]   // reason resolved via i18n at render
}
export interface ScoreExplanation {
  composite: {
    score: number                     // impact.compositeScore (pre-adjust display value)
    adjusted: number                  // impact.adjustedComposite
    tier: ImpactTier
    activeDimensionKeys: string[]     // dims averaged for THIS profile
    soloQualityExcluded: boolean
  }
  dimensions: DimensionExplanation[]
  dataSources: PlatformProvenance[]
  confidence: ConfidenceExplanation
}

export function buildScoreExplanation(
  impact: ImpactV6Result, stats: StatsData,
): ScoreExplanation {
  const isSolo = impact.profileType === "solo"
  const activeKeys = isSolo ? SOLO_DIMENSION_KEYS : DIMENSION_KEYS
  // dimensions: iterate the dims present on impact.dimensions (craft optional)
  // countsTowardComposite = activeKeys.includes(key) && score present
  // subMetrics via getDimensionSubMetrics(key, stats, impact.profileType)

  // dataSources: primary platform is always github (the handle);
  //   linked = stats.linkedPlatforms ?? []
  //   for each platform, derive provided/missing from PLATFORM_SIGNAL_MAP (below)
  //   providesQualitySignals === platform === "github"
  //   quality-signal presence is double-checked against stats fields actually defined
  //   (stats.prDescriptionRate !== undefined etc.) so the message is accurate even
  //   if a platform's behavior changes.

  // confidence: { value: impact.confidence, penalties: impact.confidencePenalties.map(p => ({flag,penalty})) }
}
```

```
// PLATFORM_SIGNAL_MAP — which signal categories each platform contributes.
// Source of truth: research §6 provenance table. Quality (PR-hygiene) signals
// are GitHub-only; stars/watchers vary.
const PLATFORM_SIGNAL_MAP = {
  github:   { quality: true,  stars: true,  watchers: true },
  gitlab:   { quality: false, stars: true,  watchers: false },
  bitbucket:{ quality: false, stars: false, watchers: false },
  codeberg: { quality: false, stars: true,  watchers: true },
}
```

## Pseudocode notes / edge cases
- Craft: include a `craft` `DimensionExplanation` only when `impact.dimensions.craft != null`.
- Solo: `composite.soloQualityExcluded = isSolo`; the `quality` dimension is still emitted (so the panel can show "shown but not counted") with `countsTowardComposite = false`.
- Empty/zero dims: builder must not throw on `activeDays===0` / `reposContributed===0` (scores already clamped upstream).
- The builder reads only `impact` + `stats`; it never touches Redis, network, or `Date`.

## Tests (write FIRST — `score-explanation.test.ts`)
Fixtures:
1. **mdburgos-like**: solo, `profileType:"solo"`, `linkedPlatforms:["gitlab"]`, quality-signal fields undefined, `dimensions {delivery:98,quality:5,consistency:40,breadth:3}`, `confidencePenalties:[single_repo_concentration -5, platform_linked 0]`. Assert:
   - `composite.activeDimensionKeys === ["delivery","consistency","breadth"]`, `soloQualityExcluded === true`.
   - quality dimension present with `countsTowardComposite === false`.
   - `dataSources` includes github (primary) + gitlab; gitlab `providesQualitySignals === false` and `missingSignalKeys` contains prDescription/featureBranch/issueLinkage.
   - `confidence.value === 95`, penalties length 2.
2. **collaborative GitHub**: reviews present, all quality fields defined → quality counts, github `providesQualitySignals true`, no missing quality keys.
3. **craft present**: 5 dimensions, craft in activeDimensionKeys.
4. **dimension-sub-metrics.test.ts** (moved/expanded): assert weights + `key`s per dimension and solo-vs-collaborative quality branch.

## Success criteria
- [x] Automated: new tests pass; existing `SubMetricPanel.test.tsx` stays green after the extraction; typecheck + circular-dep clean.
- [x] Manual: none.
