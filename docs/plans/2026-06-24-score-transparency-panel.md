# Plan: "How is my score calculated" transparency panel (#932)

> Date: 2026-06-24 · Branch target: `develop` · Issue: #932
> Research: `docs/research/2026-06-24-score-transparency-panel.md`

## Goal

Add a dedicated, collapsible **"How is my score calculated"** panel to the Impact Breakdown on the share page (`/u/:handle`) that explains, using the viewer's own data:

1. The **composite roll-up** — which dimensions average into the score, and the solo-profile Quality exclusion.
2. A **per-dimension breakdown** — formula, weights, and the user's actual normalized + raw values.
3. **Data sources & per-platform caveats** — which connected platforms contribute which signals, and which signals a platform cannot provide (the reason a GitLab/Bitbucket/Codeberg-primary profile shows a low Quality).
4. A **confidence section** — confidence % + penalty flags with non-accusatory reasons, **rendered only to the profile owner** (`isOwner`).

## Decisions (resolved with user, 2026-06-24)

| Decision | Choice |
|---|---|
| Confidence display | Show full confidence % **and** penalty list — **owner-only** |
| Formulas + per-platform caveats | Public (all viewers) |
| Form factor | **New dedicated panel** (not an extension of `SubMetricPanel`) |
| Per-platform caveats | **Included** in this issue |

Consequence captured in Phase 4: confidence is currently emitted publicly in the page's JSON-LD (`page.tsx:195`), and CLAUDE.md states confidence is "not shown to users." Both must be reconciled with the owner-only choice, otherwise the gate is cosmetic.

## Architecture overview

```
StatsData + ImpactV6Result  (already serialized to the client as props — no new fetch)
        │
        ▼
buildScoreExplanation(impact, stats)        ← Phase 1: pure, unit-tested (lib/dashboard)
   returns ScoreExplanation {
     composite { activeDims, formulaLabel, soloQualityExcluded, score, tier },
     dimensions: DimensionExplanation[]      ← reuses extracted getDimensionSubMetrics()
     dataSources: PlatformProvenance[]       ← from linkedPlatforms + which signal fields are defined
     confidence { value, penalties[] }       ← always built; gated at render
   }
        │
        ▼
<ScoreExplanationPanel explanation isOwner /> ← Phase 3: client component (dashboard)
   - collapsible (DimensionCard disclosure pattern)
   - i18n via useTranslation (Phase 2 keys)
   - confidence section rendered only when isOwner
        │
        ▼
wired into SharePageOwnerContent (passes isOwner) ← Phase 3
```

`buildScoreExplanation` is pure (project rule: pure functions for scoring/rendering) and is the TDD anchor — it is exercised with real-shaped fixtures including the mdburgos case (solo, GitLab-only, Quality=5).

## Phases

| # | Title | Depends on | Batch |
|---|---|---|---|
| 1 | Pure score-explanation builder + sub-metric extraction ✅ complete | — | `[batch-eligible]` with 2 |
| 2 | i18n keys (en + es) | — | `[batch-eligible]` with 1 |
| 3 | `ScoreExplanationPanel` component + wiring + owner gating | 1, 2 | — |
| 4 | Reconcile confidence exposure (JSON-LD + docs) | — | `[batch-eligible]` with 3 |

Batch notes: Phases 1 and 2 touch disjoint files (`lib/dashboard/*` vs `lib/i18n/dictionaries/*`) and can run in parallel. Phase 4 touches `app/u/[handle]/page.tsx` + docs, disjoint from Phase 3's component/`SharePageOwnerContent.tsx`, so it can run in parallel with Phase 3 — but its doc wording must describe Phase 3's final owner-only behavior (already fixed by the decisions above, so no real coupling). Phase 3 is the only phase that depends on others.

Detailed phase files:
- `2026-06-24-score-transparency-panel-phases/phase-1.md`
- `2026-06-24-score-transparency-panel-phases/phase-2.md`
- `2026-06-24-score-transparency-panel-phases/phase-3.md`
- `2026-06-24-score-transparency-panel-phases/phase-4.md`

## Global success criteria

### Automated
- `pnpm run test` green, including new `score-explanation.test.ts`, `ScoreExplanationPanel.test.tsx`, and `dictionaries/parity.test.ts`.
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:circular` clean.
- Bundle-size budget holds (largest chunk < 350 KB — the real CI gate; see memory `reference_bundle_size_gate`). Panel is rendered inside the already-lazy `SharePageOwnerContentLazy`, so it stays out of the initial chunk.
- Component test proves: owner sees the confidence section; visitor does **not**; formulas + caveats render for both.

### Manual
- Visual review on `/u/:handle` in light and dark themes: panel collapses/expands smoothly, tooltips fully visible (portal pattern), dimension colors correct.
- Owner vs visitor verified in a real session (sign in as the handle vs. anonymous).
- Spanish copy reviewed for tone (project language policy) and that no unreleased features are referenced.

## Out of scope (tracked separately)
- "Challenge my score" feedback feature — issue #933 (depends on this panel as its entry point).
- Computing PR-hygiene signals for GitLab/Bitbucket/Codeberg (would remove the caveat, not explain it) — not in #932.
