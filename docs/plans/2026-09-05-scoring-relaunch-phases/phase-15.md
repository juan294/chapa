# Phase 15: Migration rehearsal and relaunch handoff

Prerequisites: phase 14.
Policy authority: [policy.md](policy.md). Parent: [scoring relaunch](../2026-09-05-scoring-relaunch.md).
This phase is mandatory before relaunch. Stop after verified completion unless the user authorizes continuation. All implementation/review agents for this work must use GPT-6 Astra.

## S19: Rehearse version migration, cache transition and transparent score changes locally

GitHub: [#1314](https://github.com/juan294/chapa/issues/1314).

Worker role: backend. Depends on: S18.
Audit requirements: F16, F17, F26, F45, F46, F48.

Problem and resulting behavior:
Prepare additive reversible v7 rollout with new cache namespaces/receipt revisions, legacy compatibility, segmented history and explicit old/new score reasons. Build an idempotent dry-run migration/recompute tool and local rehearsal over representative existing records; old scores are neither silently overwritten nor fabricated as replayable. Coordinate numerical badge changes with the redesign's render version.

Exclusive implementation ownership (adjacent source tests included):
- apps/web/lib/cache/version.ts
- apps/web/lib/render/badge-render-variant.ts
- apps/web/lib/profile/post-write-invalidation.ts
- scripts/recalculate-handles.ts
- scripts/scoring/migrate-v7.ts (new)
- docs/runbooks/scoring-v7-transition.md (new)

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S19's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] Two dry runs mutate nothing; repeated local execution is idempotent.
- [ ] Mixed old/new cache and concurrent requests never publish a v7 label on v6 math or blend trend versions.
- [ ] Legacy receipt links and archived history survive; unavailable reconstruction stays explicitly unavailable.
- [ ] Rollback restores code/read selection without destructive DB rollback or deleting valid v7 receipts.
- [ ] Migration estimates, data-access scopes and bounded recompute counts are concrete before any production request.
- [ ] No production migration/recompute/deployment occurs without separate explicit authorization.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## S20: Close every scoring relaunch requirement and prepare the release handoff

GitHub: [#1315](https://github.com/juan294/chapa/issues/1315).

Worker role: qa-reliability. Depends on: S19.
Audit requirements: All findings through the final closure gate.

Problem and resulting behavior:
Audit the complete issue/requirement matrix, independent review findings, local checks and migration rehearsal. Prepare a concrete reviewable release packet. Reconcile the playbook's preview requirement with the user's prohibition through a documented local artifact-verification path; never create a Vercel preview or silently waive required checks. This ticket authorizes readiness work, not production release.

Exclusive implementation ownership (adjacent source tests included):
- docs/plans/2026-09-05-scoring-relaunch.md
- docs/release/release-playbook.md:1
- docs/runbooks/scoring-v7-transition.md (new)
- docs/research/scoring-v7-validation-results.md (new)

Pseudocode contract:
```text
read frozen v7 policy and prerequisite evidence/contracts
write failing fixtures for each acceptance criterion below
implement only S20's owned behavior against the shared contract
preserve immutable input identity, coverage and reference context
review; correct every finding; simplify; verify sequentially
record exact artifacts and stop; do not push or deploy
```

Automated/checkable acceptance:
- [ ] All child implementation issues and F01–F53 criteria are closed with evidence; no waived/deferred finding.
- [ ] Sequential local typecheck, lint, full tests, coverage, build, circular dependency and applicable schema/security/license checks pass.
- [ ] Local database contracts and actual SVG/PNG/browser paths pass against the release artifact.
- [ ] Read-only verification of remote triggers shows how future intentional publication avoids previews; any unresolved trigger blocks publishing.
- [ ] Release authorization, production migration/recompute authorization and final owner review remain explicit.
- [ ] No automated email, PR, deployment, workflow dispatch or production data mutation is triggered by closing planning tasks.

Manual/domain acceptance:
- [ ] An independent reviewer reconciles this task with policy.md and the cited audit cases.
- [ ] Any semantic/data-source limitation is visible in evidence coverage and public claims.
- [ ] No task criterion is moved past relaunch or closed with an unimplemented placeholder.


## Sequential local verification

Run the owned adjacent tests using `pnpm exec vitest run <explicit-owned-test-paths>`; record the exact paths in the implementation report. At phase integration run sequentially: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, and `pnpm run build`. For schema/write changes also run `pnpm run validate:migrations`, `pnpm run check:write-registration` and `pnpm run test:contract:local` against disposable local Supabase before build. Scoring changes additionally run `pnpm run test:coverage`; import changes run `pnpm run check:circular`. Do not run checks concurrently.

Final readiness also requires repository license/vulnerability and SVG/PNG/browser verification. No hosted CI or preview is a test environment. Missing prerequisites, failed checks and policy contradictions return to their owner before completion.
