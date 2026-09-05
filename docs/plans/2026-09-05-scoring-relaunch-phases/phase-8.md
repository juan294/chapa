# Phase 8: Durable aging and source integrity

Prerequisites: phase 2, phase 3, phase 4, phase 5, phase 6.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S07: Age supplemental evidence correctly and migrate the upload contract

GitHub: [#1302](https://github.com/juan294/chapa/issues/1302).

Worker role: backend. Depends on: S01, S06.
Audit requirements: F16, F13.

Problem and resulting behavior:
Store dated versioned evidence, recompute it for each reference window and retain observed-through/coverage metadata. Reuploads must not rejuvenate old events; overlapping uploads deduplicate. Scalar-only legacy reports remain labeled historical/legacy and cannot be prorated into a current year. Provide an executable fixture client and producer protocol because the historical CLI source is not present here. Preserve the local durable-before-cache fix tracked by #1287.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/db/supplemental.ts:35
- apps/web/app/api/supplemental/route.ts:17
- apps/web/lib/validation.ts:290
- apps/web/lib/platform/evidence-aging.ts (new)
- docs/supplemental-evidence-v2.md (new)

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S07's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [x] An event exiting the window removes its exact contribution, denominator observation and repo-depth effect.
- [x] Redis-hit and DB-fallback produce identical aged results.
- [x] Changing uploadedAt without changing event dates cannot revive old work.
- [x] Identity mismatch/source=primary cannot fabricate double-counted evidence.
- [x] Real local Supabase failure matrix preserves durable-first publication and honest cacheRefreshed semantics.
- [x] Legacy upload response explains eligibility and current coverage without silent deletion.

Manual/domain acceptance:
- [x] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [x] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [x] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## S08: Replace productivity-based corruption guards with source-coverage integrity

GitHub: [#1303](https://github.com/juan294/chapa/issues/1303).

Worker role: backend. Depends on: S02, S03, S04, S05, S06, S07.
Audit requirements: F18, F19, F20, F21, F23.

Problem and resulting behavior:
Select and cache evidence by subject/window/access context and explicit per-signal coverage, not public/authenticated rank. Keep compatible in-flight work separate across principals. Accept legitimate measured zeros and annual expiration. Preserve dates/status in stale fallbacks; no low-PR heuristic may reject evidence or authorize destructive history repair. Compose source overlays after source-level checks.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/github/client.ts:39
- apps/web/lib/github/stats-integrity.ts:64
- apps/web/lib/platform/fetch-linked-platform.ts:83
- scripts/heal-poisoned-stats.ts
- apps/web/lib/github/client*.test.ts
- apps/web/lib/github/stats-integrity.test.ts

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S08's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] Direct-push-only, issue-only and genuinely empty complete profiles remain valid.
- [ ] Same-context last PR aging from one to zero writes through.
- [ ] One hundred open sampled PRs plus a merge elsewhere is not corruption.
- [ ] Different PAT principals cannot share unauthorized results or claim universal private completeness.
- [ ] Explicit missing pages cannot overwrite compatible complete evidence as complete; unsupported and unlinked are distinct.
- [ ] Read-only cold paths perform no provider fetch or cache mutation.
- [ ] History repair is dry-run and requires recorded corruption evidence rather than activity assumptions.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
