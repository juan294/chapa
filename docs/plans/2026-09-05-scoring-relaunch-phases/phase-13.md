# Phase 13: Badge, explanations and public methodology

Prerequisites: phase 12.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S16: Render the fixed core, separate Craft and exact evidence explanations

GitHub: [#1311](https://github.com/juan294/chapa/issues/1311).

Worker role: frontend. Depends on: S15.
Audit requirements: F29, F32, F34, F48, F53.

Problem and resulting behavior:
Use the existing single renderBadgeSvg path and the relaunch design team's shared view model. Display four core dimensions consistently, optional Craft distinctly, point/range/unknown status truthfully and evidence links/coverage accessibly. Explain actual intermediate receipt calculations rather than independently rebuilding formulas. Studio, embedded SVG, OG image and share page must agree.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/dashboard/dimension-sub-metrics.ts:122
- apps/web/lib/dashboard/score-explanation.ts
- apps/web/components/dashboard/*
- apps/web/lib/render/BadgeSvg.tsx
- apps/web/lib/render/RadarChart.tsx
- apps/web/app/u/[handle]/*
- apps/web/app/studio/* score presentation

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S16's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] The legacy Quality100/displayed54 mismatch has a matching v6 explanation or explicit legacy view; v7 explanation sums exactly.
- [ ] Missing/expired Craft renders not observed without lowering core or drawing a false zero axis.
- [ ] Range bounds are not presented as point tiers; unknown dimensions are not zero-length evidence of poor quality.
- [ ] Rasterized OG and scaled SVG preserve core/Craft/evidence distinction and meaningful accessible labels.
- [ ] No second badge renderer or conflicting design-system implementation is created.
- [ ] Owner/reviewer evidence workflow is reachable from settings/profile with explicit pending/accepted/withdrawn states; no-AI/no-report users can submit a Craft practice portfolio.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## S17: Publish accurate bilingual methodology, claims and worked examples

GitHub: [#1312](https://github.com/juan294/chapa/issues/1312).

Worker role: frontend. Depends on: S12, S14, S15, S16.
Audit requirements: F28, F29, F30, F31, F32, F37, F40, F44, F47, F50, F53.

Problem and resulting behavior:
Rewrite current claims around the v7 contract and real evidence; retain historically accurate versioned v6 docs. Generate worked figures from the independent calculator. Correct LOC/EMA/Quality/archetype/verification statements, remove unsupported percentile calibration and independence/mastery claims, distinguish PR cycle time from DORA lead time, and explain uncertainty and AI neutrality. Supersede contradictory accepted-risk entries explicitly.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/i18n/dictionaries/en.ts:850
- apps/web/lib/i18n/dictionaries/es.ts:839
- apps/web/app/[locale]/about/scoring/page.tsx
- apps/web/app/[locale]/archetypes/*
- apps/web/app/llms.txt/route.ts
- apps/web/app/llms-full.txt/route.ts
- docs/impact-v6.md
- docs/impact-v7.md
- docs/accepted-risks.md:247
- CLAUDE.md

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S17's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] Published arithmetic examples are executable and match both calculators in English and Spanish.
- [ ] No current claim equates issuance with source truth, core index with proven ability, or illustrative caps with measured percentiles.
- [ ] All active site/SEO/LLM/help/email/tool surfaces use the same version and semantics.
- [ ] Weights, missing-data ranges, exact window, sample coverage, tier/archetype rules and rounding are reproducible.
- [ ] AI usage is described positively without promising quality from tool volume alone.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
