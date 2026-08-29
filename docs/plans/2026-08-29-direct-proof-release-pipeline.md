# Implementation Plan — Direct-Proof Release Pipeline

> **Status:** Planned
> **Date:** 2026-08-29
> **Research input:** `docs/research/2026-08-29-chapa-release-pipeline-coach-comparison.md`
> **Selected design:** Option 3 — direct-proof default with explicit deep verification

## 1. Goal

Replace Chapa's proof-of-proof release path with a small default release transaction that proves the candidate, deployment, rollback, migration, and publication facts directly.

The new default must preserve:

- the two existing authorization gates;
- a clean immutable `developCommit` and `candidateTreeDigest`;
- exact-head admission CI;
- a fail-closed release-PR pending-migration check;
- immutable Preview and exact production identity;
- squash-tree equality;
- a verified rollback reference before promotion;
- separately authorized rollback and production mutations; and
- tag-last publication with tag and GitHub Release readback.

Broad browser checks and fresh-context exploration remain available through explicit deep verification. They do not control every default release. The current evidence catalog, five schemas, fixtures, artifact importers, mergers, mandatory charters, pre-merge analyzer, final analyzer, and report renderer are retired after the direct path replaces them.

This addresses the current duplication and serial graph recorded in the research document. (`docs/research/2026-08-29-chapa-release-pipeline-coach-comparison.md:37-66`, `docs/research/2026-08-29-chapa-release-pipeline-coach-comparison.md:100-110`)

## 2. Selected design and alternatives

| Option | Trade-off | Decision |
|---|---|---|
| Repair the current evidence graph | Smallest immediate diff, but retains five artifact imports, mandatory charters, aggregation, and two analyzers. | Rejected |
| Keep the complete evidence graph as optional deep verification | Removes it from default authority, but leaves two apparent release systems and their maintenance cost. | Rejected |
| Direct proof by default; direct deep checks on request | Deletes duplicated release authority while preserving broad tests and exploration as engineering tools. | Selected |

The selected design follows the Coach recovery order: introduce direct proof, redirect release authority, then delete obsolete machinery. It does not delete normal CI, scheduled monitoring, deployed probes, or rollback procedures. (`docs/research/2026-08-29-chapa-release-pipeline-coach-comparison.md:19-25`, `docs/research/2026-08-29-chapa-release-pipeline-coach-comparison.md:127-137`)

## 3. Locked decisions

| ID | Decision | Implementation consequence |
|---|---|---|
| D01 | `docs/release/release-playbook.md` remains the single production release procedure. | `/release` delegates to it; no second controller or analyzer decides the release. |
| D02 | Keep Gate 1 and Gate 2 exactly as authorization boundaries. | Gate 1 approves version and diff. Gate 2 authorizes release mechanics. Migrations, data changes, messages, environment changes, rollback, and overrides retain separate authority. |
| D03 | The default release has one concurrent remote admission wave. | Create or reuse the release PR immediately after pushing the approved immutable candidate. Observe exact required PR checks, the release-PR migration check, and exact-SHA Preview proof concurrently. |
| D04 | The default required CI set is six exact-head checks. | Require `Lint & Typecheck`, `Test`, `Contract (real DB)`, `Build`, `E2E Tests`, and `Pending Migrations Check (release PR)`. Other checks continue to run but do not hold merge authority. |
| D05 | Missing production migration credentials fail closed. | The migration job exits nonzero instead of emitting a successful workflow with a skipped result. |
| D06 | Preview default proof contains five direct checks. | Require Preview identity, core dependency health, public badge read, public share read, and rollback readiness. |
| D07 | Production default proof contains four direct checks. | Require production identity, core dependency health, public badge read, and public share read. This resolves the current six-declared/four-collected contradiction by making four the deliberate default contract. (`docs/research/2026-08-29-chapa-release-pipeline-coach-comparison.md:139-156`) |
| D08 | Deep mode keeps the current broad deployed scenarios. | Deep Preview also runs login redirect, denied unauthenticated write, share verification, and locale checks. Deep production also runs share verification and locale checks. |
| D09 | `/explore-release` is explicit, risk-selected work. | It produces a concise report when requested. It no longer creates mandatory schema-bound charters or analyzer input. |
| D10 | One compact JSON result replaces the evidence graph. | A small typed module writes Preview and final release results. Direct command exit statuses decide pass or fail; the JSON record describes facts and does not analyze its own evidence. |
| D11 | Recovery is procedural, not a controller state machine. | Document `PAUSED`, `BLOCKED`, `ROLLED_BACK`, and `PUBLICATION_PENDING` outcomes without automatic redeployment or retry loops. |
| D12 | Obsolete evidence machinery is deleted after replacement tests pass. | Do not keep dormant schemas, catalog authority, importers, mergers, analyzers, renderers, fixtures, or CI evidence uploads. |
| D13 | Normal CI and monitoring keep their diagnostic scope. | Keep test jobs, built-artifact E2E, security checks, Lighthouse, bundle analysis, advisory deployment smoke, nightly production probes, and auto-backmerge. |
| D14 | Live branch protection is a separate authorized operation. | Local implementation prepares the intended required set. A later `gh api` mutation and readback occur only after explicit authorization. |

## 4. Non-goals

- Do not change the `develop` to `main` squash topology.
- Do not add a release controller, queue, database, external service, retry engine, or automatic redeployment.
- Do not remove broad tests from normal CI or scheduled workflows.
- Do not make cron freshness, real OAuth, security scans, Lighthouse, bundle reports, or exploratory checks permanent default release vetoes.
- Do not perform a production release, deployment, migration, rollback, tag, GitHub Release, or branch-protection mutation during local implementation.
- Do not rewrite historical research, completed plans, or completed release reports.
- Do not edit the user's unrelated `.gitignore`, `.design-sync/`, or `apps/web/.ds-entry.tsx` work.

## 5. Target default release path

```text
clean release worktree
  -> exact production baseline and annotated rollback tag
  -> version/changelog/reference consistency
  -> bounded local release checks
  -> Gate 1: approve version and full diff
  -> Gate 2: authorize release mechanics
  -> push immutable developCommit
  -> create or reuse release PR immediately
  -> exact-head required PR checks -------------------+
  -> fail-closed pending-migration check -------------+ concurrent
  -> exact-SHA Preview identity and four direct probes +
  -> reconfirm PR head and rollback reference
  -> squash merge
  -> mainTreeDigest == candidateTreeDigest
  -> exact production identity and three direct probes
  -> tag-last publication
  -> tag, GitHub Release, and release-result readback
```

The bounded local sequence is intentionally smaller than normal CI:

```text
git diff --check
pnpm run release:validate-docs
pnpm run validate:migrations
pnpm run test:contract:local
pnpm run build
```

Typecheck, lint, full unit coverage, built-artifact E2E, and the real-database contract remain exact-head remote admission checks. Security, license, vulnerability, Lighthouse, bundle reporting, and advisory smoke continue to report outside the default release transaction. The existing path currently repeats broad local and remote checks. (`docs/research/2026-08-29-chapa-release-pipeline-coach-comparison.md:68-82`)

## 6. Default and deep deployed contracts

`apps/web/e2e/helpers/release-required-environments.ts` becomes the single executable scenario-selection authority. Remove the separate JSON catalog so a collector list cannot diverge from the tests again. The current helper has one broad environment mapping and no mode. (`apps/web/e2e/helpers/release-required-environments.ts:1-24`)

| Environment | Default | Deep additions |
|---|---|---|
| Preview | identity, core dependencies, public badge, public share, rollback readiness | GitHub login redirect, protected write denied, share verification, `en`/`es` locale behavior |
| Production | identity, core dependencies, public badge, public share | share verification, `en`/`es` locale behavior |

Pseudocode:

```text
releaseScenarioIds(environment, mode = "default"):
  selected = identityFor(environment) + corePublicReads
  if environment == preview:
    selected += rollbackReadiness
  if mode == deep:
    selected += deepSharedChecks
    if environment == preview:
      selected += previewDeepChecks
  return selected
```

`RELEASE_VERIFICATION_MODE=default|deep` is explicit and defaults to `default`. Unknown values fail before Playwright starts.

## 7. Compact result contract

Add `scripts/quality/release-result.ts` and `scripts/quality/release-result.test.ts`. Do not add a JSON schema. The TypeScript module validates and writes an allowlisted object.

Preview result shape:

```json
{
  "schemaVersion": 1,
  "stage": "preview",
  "status": "passed",
  "mode": "default",
  "candidate": {
    "baselineTag": "vX.Y.Z",
    "rollbackReference": "vX.Y.Z",
    "developCommit": "<40-hex>",
    "candidateTreeDigest": "<40-hex>",
    "previewUrl": "https://immutable-preview"
  },
  "source": {
    "repository": "owner/repo",
    "workflowRunId": "<id>",
    "workflowRunAttempt": "<attempt>",
    "headSha": "<developCommit>"
  },
  "checks": {
    "sourceIdentity": "passed",
    "previewIdentity": "passed",
    "previewProbes": "passed",
    "rollbackReadiness": "passed"
  },
  "generatedAt": "<ISO-8601>"
}
```

The final result adds `mainCommit`, `mainTreeDigest`, production URL and identity, production probe status, tag target, GitHub Release target, and readback timestamps. It references the exact Preview workflow run and attempt. It must reject unknown fields, malformed identities, a failed or missing required check, candidate mismatch, and secret-bearing field names such as `authorization`, `cookie`, `secret`, and `token`.

Direct commands remain authoritative:

```text
run direct check
capture exit status
write allowlisted result even on failure
upload result
exit with the captured failure status
```

The result is an audit receipt, not an analyzer and not authorization.

## 8. Workflow changes

### `.github/workflows/release-verification.yml`

Replace the current multi-job import and aggregation graph with one read-only Preview proof job.

Inputs retained:

- `baselineTag`
- `developCommit`
- `candidateTreeDigest`
- `previewUrl`
- `runId`

Inputs removed:

- `releasePrRunId`
- `releasePrRunAttempt`
- `preMergeEvidence`

The job checks out `developCommit`, verifies `HEAD` and the tree, verifies the annotated baseline tag, runs `release:verify-identity`, runs default Preview Playwright probes, writes `release-result.json`, uploads that one artifact on success or failure, and then propagates the direct check status. It remains non-deploying and read-only.

Remove the bootstrap, push-CI import, release-PR import, Preview evidence normalization, cleanup proof, aggregate, merge, analyzer, and report-renderer stages. The current workflow contains this exact proof-of-proof chain. (`docs/research/2026-08-29-chapa-release-pipeline-coach-comparison.md:100-106`)

### `.github/workflows/ci.yml`

Keep every actual test and diagnostic job. Remove only the normalized release-evidence producer and upload steps that no longer have a consumer. Keep the Next.js build artifact used by E2E.

Change `Pending Migrations Check (release PR)` so missing `SUPABASE_ACCESS_TOKEN` or `SUPABASE_PROJECT_REF` fails the job. Stop creating its normalized evidence artifact; the exact check conclusion and PR head are direct proof.

## 9. Release and deep-mode procedures

### Default `/release`

- Keep exact production baseline resolution and two authorization gates.
- Create the PR immediately after the approved candidate push.
- Observe the exact PR head with `gh pr view` and `gh pr checks --required --watch --fail-fast`.
- Require the pending-migration check on the same PR head.
- Resolve and dispatch exact-SHA Preview proof concurrently with required CI.
- Download and validate the single Preview result.
- Reconfirm PR head, tree, rollback reference, and successful direct checks before squash merge.
- Verify production identity and the four default production scenarios directly.
- Publish the named annotated tag only after production proof.
- Verify tag target and GitHub Release target, then write and upload the final result.

### Explicit deep verification

`/prodplaybook` becomes a read-only exhaustive verification tool. It runs `RELEASE_VERIFICATION_MODE=deep` deployed checks against a fixed target and produces `docs/agents/prodplaybook-report.md`. It does not consume historical manifests, schemas, or analyzers and does not authorize release mechanics.

`/explore-release` becomes an explicit risk-selected workflow. It reads a fixed SHA and diff, runs fresh-context charters when requested, and writes one concise report. It does not require eight maneuvers for every release, produce JSON evidence for an analyzer, or gain release authority.

`.claude/rules/rpi-details.md` changes the outer `/pre-launch -> /remediate -> /update-docs -> /release` sequence from a universal prerequisite to an explicit milestone or high-risk readiness mode. Default `/release` remains independently executable.

## 10. Recovery outcomes

These labels are procedural report outcomes only:

| Outcome | Meaning | Allowed continuation |
|---|---|---|
| `PAUSED` | Candidate unchanged, production unchanged, and the failure is in observation, provider state, credentials, or a temporary environment condition. | Repair the observer or provider condition and rerun only the failed stage for the same SHA. |
| `BLOCKED` | Candidate admission, policy, identity, tree, migration, or direct product proof failed. | Stop. A source change creates a new candidate and requires new Gate 1 and Gate 2 approval. |
| `ROLLED_BACK` | Production changed, post-promotion proof failed, and a separately authorized rollback completed. | End the release attempt. Do not tag. A new attempt needs new authorization. |
| `PUBLICATION_PENDING` | Production proof passed, but tag, GitHub Release, receipt upload, or readback is incomplete. | Inspect remote state and resume publication only. Do not redeploy. |

No automatic redeployment, production retry loop, or hidden analyzer override is added.

## 11. Deletion inventory

Delete after the replacement workflow and tests are green:

```text
quality/release-required.json
quality/schemas/evidence-fragment.schema.json
quality/schemas/evidence-manifest.schema.json
quality/schemas/exploratory-charter.schema.json
quality/schemas/release-required.schema.json
quality/schemas/release-run.schema.json
quality/fixtures/blocked-candidate-mismatch.json
quality/fixtures/blocked-incomplete-charter.json
quality/fixtures/blocked-missing-cleanup.json
quality/fixtures/blocked-required-skip.json
quality/fixtures/blocked-zero-pass.json
quality/fixtures/passing-release-run.json
quality/evidence/README.md
scripts/quality/analyze-release-run.ts
scripts/quality/analyze-release-run.test.ts
scripts/quality/collect-playwright-evidence.ts
scripts/quality/collect-playwright-evidence.test.ts
scripts/quality/contracts.ts
scripts/quality/import-ci-evidence.ts
scripts/quality/import-ci-evidence.test.ts
scripts/quality/merge-release-evidence.ts
scripts/quality/merge-release-evidence.test.ts
scripts/quality/merge-scenario-results.ts
scripts/quality/prepare-release-run.ts
scripts/quality/prepare-release-run.test.ts
scripts/quality/release-artifact-contract.json
scripts/quality/render-release-report.ts
scripts/quality/render-release-report.test.ts
scripts/quality/validate-release-required.ts
scripts/quality/validate-release-required.test.ts
```

Remove the corresponding package scripts. Keep:

```text
scripts/quality/auto-backmerge-workflow.test.ts
scripts/quality/release-verification-workflow.test.ts
scripts/quality/validate-release-docs.ts
scripts/quality/validate-release-docs.test.ts
scripts/quality/verify-deployment-identity.ts
scripts/quality/verify-deployment-identity.test.ts
apps/web/e2e/release-required.spec.ts
apps/web/e2e/helpers/deployment-probes.ts
.github/workflows/nightly-prod-probe.yml
```

## 12. Phase overview

| Phase | Title | Depends on | Batch | Outcome |
|---|---|---|---|---|
| 1 | Lock direct contracts and mode selection | — | No | Failing tests, then green direct scenario and compact-result primitives |
| 2 | Replace the remote critical path | Phase 1 | No | One Preview proof job; no CI evidence producers; fail-closed migration check |
| 3 | Rewrite release authority and recovery | Phase 2 | No | Default direct release, explicit deep tools, synchronized validator and runbooks |
| 4 | Delete obsolete evidence machinery | Phase 3 | No | One apparent release contract and no proof-of-proof implementation |
| 5 | Validate locally and align live controls | Phase 4 | No | Sequential local proof, then separately authorized Preview canary and branch-rule update |

No phase is `[batch-eligible]`. Each phase changes contracts consumed by the next phase, and Phases 2 through 4 overlap workflow-contract tests, package scripts, and release documentation.

```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5
```

## 13. Global automated success criteria

- Default and deep scenario-selection tests assert exact Preview and production scenario IDs.
- Unknown verification modes fail closed.
- The production four-versus-six behavior is intentional and has one executable selector; no collector list can diverge.
- Compact-result tests reject malformed SHA/tree/tag/URL/time/source fields, candidate mismatch, missing or failed checks, unknown fields, and secret-bearing fields.
- The Preview workflow has one proof job, accepts only the five retained inputs, uploads one `release-result.json`, and contains no Git, Vercel, Supabase, deployment, release, or publication mutation.
- The Preview workflow verifies exact checkout SHA, exact tree, immutable Preview identity, baseline rollback identity, and default deployed probes.
- Ordinary CI contains no `.release-evidence` producer or release-evidence upload steps.
- Missing pending-migration credentials fail the release-PR job.
- Normal CI jobs and the Next.js build artifact used by E2E remain intact.
- Release-document tests enforce PR creation before the concurrent wait, exact-head checks and migrations before merge, tree and production proof before tag, tag-last publication, readback, and all four recovery outcomes.
- Release-document tests assert that the default procedure does not reference the retired catalog, charters, manifests, evidence importers, mergers, analyzers, or renderer.
- Retained identity, rollback, auto-backmerge, deployed-probe, and nightly identity tests remain green.
- `rg` finds no live references to deleted evidence machinery outside historical research and completed plans.
- `actionlint .github/workflows/*.yml`, typecheck, lint, tests, contract tests, and production build pass sequentially.

## 14. Manual and operational success criteria

- A timed warm-cache bounded local release check completes within five minutes on the release operator's machine. Record the measurement; do not weaken direct checks only to meet the target.
- The default remote admission has one concurrent wait wave, not a serial push-CI, Preview, PR-CI, import, and analyzer chain.
- A separately authorized immutable Preview canary produces one compact result and performs no deployment or repository mutation.
- A deliberately failed Preview probe uploads a failed result and returns a failed workflow conclusion.
- Deep mode runs the additional auth, verification, locale, and optional exploration checks without becoming default release authority.
- After separate authorization, live `main` branch protection requires exactly:
  - `Lint & Typecheck`
  - `Test`
  - `Contract (real DB)`
  - `Build`
  - `E2E Tests`
  - `Pending Migrations Check (release PR)`
- All other current checks still run and report but do not block merge.
- Read back the live branch rule after mutation. A settings write is not complete until the returned contexts match the intended set.
- No production release, promotion, tag, publication, migration, or rollback is part of this plan's validation.

## 15. Verification sequence

Run sequentially from the isolated implementation worktree:

```bash
pnpm vitest run \
  apps/web/e2e/helpers/release-required-environments.test.ts \
  scripts/quality/release-result.test.ts \
  scripts/quality/release-verification-workflow.test.ts \
  scripts/quality/validate-release-docs.test.ts
pnpm vitest run \
  scripts/quality/verify-deployment-identity.test.ts \
  scripts/quality/auto-backmerge-workflow.test.ts
EXPECTED_DEPLOYMENT_ENV=preview RELEASE_VERIFICATION_MODE=default \
  pnpm --filter @chapa/web exec playwright test \
  e2e/release-required.spec.ts --list --project=chromium
EXPECTED_DEPLOYMENT_ENV=production RELEASE_VERIFICATION_MODE=default \
  pnpm --filter @chapa/web exec playwright test \
  e2e/release-required.spec.ts --list --project=chromium
EXPECTED_DEPLOYMENT_ENV=preview RELEASE_VERIFICATION_MODE=deep \
  pnpm --filter @chapa/web exec playwright test \
  e2e/release-required.spec.ts --list --project=chromium
pnpm run release:validate-docs
actionlint .github/workflows/*.yml
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run test:contract:local
pnpm run build
```

Then run a reference audit:

```bash
rg --hidden -n \
  'release-required.json|release:prepare-run|release:analyze|release:render-report|release:collect-evidence|release:merge-evidence|pre-merge analyzer|final analyzer|pre-merge-evidence.json|evidence-manifest.json' \
  .github .claude docs scripts quality package.json CLAUDE.md \
  --glob '!docs/plans/**' --glob '!docs/research/**'
```

The expected result is no live operational reference. Historical research and completed plans may retain historical names.

## 16. Authority and stop conditions

- Implement each phase in one isolated worktree or temporary branch.
- Run the phase's named verification sequentially.
- Stop after each implementation phase unless the user explicitly authorizes continuation.
- A plan mismatch uses the repository's Expected / Found / Why it matters stop.
- Phase 5 local verification is authorized by a later `/implement`; Preview dispatch, branch-protection mutation, push, merge, deployment, tag, publication, production probe, and rollback still need their own explicit authority.
- A failed post-promotion production proof does not authorize a fix-forward deployment. Report the exact state and request rollback authority.

## 17. Phase files

- `docs/plans/2026-08-29-direct-proof-release-pipeline-phases/phase-1.md`
- `docs/plans/2026-08-29-direct-proof-release-pipeline-phases/phase-2.md`
- `docs/plans/2026-08-29-direct-proof-release-pipeline-phases/phase-3.md`
- `docs/plans/2026-08-29-direct-proof-release-pipeline-phases/phase-4.md`
- `docs/plans/2026-08-29-direct-proof-release-pipeline-phases/phase-5.md`
