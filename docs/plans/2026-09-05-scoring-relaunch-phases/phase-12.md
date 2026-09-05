# Phase 12: Unified materialization and APIs

Prerequisites: phase 8, phase 11.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S15: Materialize one scoring receipt across APIs, badges and simulations

GitHub: [#1310](https://github.com/juan294/chapa/issues/1310).

Worker role: backend. Depends on: S08, S09, S10, S11, S13, S14.
Audit requirements: F18, F27, F34, F45, F48.

Problem and resulting behavior:
Thread one captured reference time and one immutable receipt through materialization, public/private projections, recalculation, history and all score consumers. Eliminate fresh-score/stored-dimension mixtures and duplicated scoring logic in what-if tools. Preserve the already implemented #1294 recency regression until v7 replaces that policy, then test v7 equivalence. Propagate unsupported/partial/stale states without inventing complete results.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/profile/materialize-profile.ts:95
- apps/web/lib/profile/public-profile.ts
- apps/web/lib/profile/persist-guard.ts
- apps/web/app/api/profile/[handle]/route.ts:109
- apps/web/app/api/recalculate/route.ts
- apps/web/app/studio/useStudioWebMcpTools.ts:280
- apps/web/app/api/insights/[handle]/route.ts
- apps/web/lib/profile/orchestrated-profile.ts
- apps/web/app/api/refresh/route.ts
- apps/web/app/api/generate/route.ts
- apps/web/app/api/admin/bulk-recalculate/route.ts
- apps/web/app/api/cron/warm-cache/route.ts
- apps/web/app/api/history/[handle]/route.ts
- apps/web/lib/email/score-bump.ts
- apps/web/lib/history/* numeric consumers
- docs/scoring-consumer-inventory.md (new)

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S15's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] Badge/share/API/explanation/simulation agree on receipt ID, window, dimensions, Craft and core for the same revision.
- [ ] Unchanged simulation returns zero delta; optional Craft changes only Craft.
- [ ] A report upload or source error cannot inadvertently trigger a different core denominator or remove unknown flags.
- [ ] Legitimate zero profiles persist and can verify truthful empty evidence.
- [ ] Owner/private projections and visitor aggregates remain permission-correct.
- [ ] Recalculate, dirty-marker, stale fallback and explicit refresh seams pass real local persistence tests.
- [ ] A checked scored-consumer inventory covers every impact import/score field reader, including badge/OG/studio, refresh/generate, admin bulk, cron/history, email, SEO/LLM/WebMCP and caches; each has a named owner and shared-receipt regression.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
