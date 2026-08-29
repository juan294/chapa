# Phase 2 — Replace the Remote Critical Path

> **Master plan:** `docs/plans/2026-08-29-direct-proof-release-pipeline.md`
> **Depends on:** Phase 1
> **Batch:** No
> **Stop:** Stop after workflow and CI contract verification. Do not delete old quality modules yet.

## Objective

Replace the multi-job release evidence graph with one read-only Preview proof job. Remove normalized evidence production from ordinary CI while preserving the actual test and diagnostic jobs.

## Files

Modify:

- `.github/workflows/release-verification.yml`
- `.github/workflows/ci.yml`
- `scripts/quality/release-verification-workflow.test.ts`
- `scripts/quality/release-result.ts`
- `scripts/quality/release-result.test.ts`

Retain unchanged:

- `.github/workflows/nightly-prod-probe.yml`
- `scripts/quality/verify-deployment-identity.ts`
- `scripts/quality/verify-deployment-identity.test.ts`
- `scripts/quality/auto-backmerge-workflow.test.ts`
- all normal CI test, security, build, E2E, Lighthouse, bundle, and smoke jobs
- the Next.js build artifact used by E2E shards

## 1. Rewrite workflow-contract tests first

Replace assertions that require the current evidence graph with red assertions for the new workflow:

```text
inputs == baselineTag, developCommit, candidateTreeDigest, previewUrl, runId
checkout ref == developCommit
HEAD == developCommit
HEAD tree == candidateTreeDigest
baselineTag is annotated and resolves to current production rollback commit
Preview /api/version == developCommit and preview
RELEASE_VERIFICATION_MODE == default
default Preview Playwright probes run
one release-result.json is uploaded with if: always()
the direct check status is propagated after upload
no import-ci, import-release-pr, aggregate, merge, analyzer, renderer, or charter input
no release, deploy, database, Git, or publication mutation
```

Add producer tests for `.github/workflows/ci.yml`:

- no `.release-evidence` directory creation;
- no `release-evidence-*` upload;
- actual protected aggregate job names remain;
- the build artifact still exists for E2E;
- missing pending-migration credentials emit an error and exit nonzero;
- the migration job still runs `pnpm run check:pending-migrations` when credentials exist.

Keep the nightly runner/target identity separation assertions because nightly monitoring remains independent.

## 2. Replace `release-verification.yml`

Use one job, for example `preview-proof`, with read-only permissions and candidate-scoped concurrency.

Pseudocode:

```text
validate input formats
checkout developCommit with minimal history
assert HEAD == developCommit
assert HEAD tree == candidateTreeDigest
fetch baselineTag only
assert baselineTag is annotated
assert baselineTag commit == current production rollback commit
require VERCEL_AUTOMATION_BYPASS_SECRET

capture status:
  run release:verify-identity for Preview
  run default release-required Playwright suite

always:
  write release-result.json with exact workflow source
  upload one candidate-and-attempt-named artifact for 30 days

after upload:
  exit with captured direct-check status
```

Use an immutable Preview URL. Do not resolve a moving branch alias inside this workflow.

The workflow may install Playwright and cache its browser dependencies. It must not import whole CI results because the release procedure will read the exact required PR conclusions directly.

## 3. Remove ordinary-CI evidence producers

Delete only the `Write ... evidence` and `Upload ... evidence` steps associated with:

- lint/configuration;
- unit/coverage aggregation;
- contract/local journey;
- build;
- E2E aggregation;
- deployment smoke; and
- pending migrations.

Do not remove their real checks. Do not remove `nextjs-build-${{ github.run_id }}-${{ github.run_attempt }}`, which is consumed by E2E.

## 4. Make migration admission fail closed

Replace the missing-credential skip step:

```text
if either production read credential is missing:
  identify the missing secret name without printing a value
  emit ::error::
  exit 1
```

Remove conditional skips from the remaining setup and check steps. The failure step terminates the job before production access. The job name remains exactly `Pending Migrations Check (release PR)`.

The check remains read-only. Applying a pending migration is still a separate production authorization.

## Automated success criteria

```bash
pnpm vitest run \
  scripts/quality/release-result.test.ts \
  scripts/quality/release-verification-workflow.test.ts \
  scripts/quality/verify-deployment-identity.test.ts \
  scripts/quality/auto-backmerge-workflow.test.ts
actionlint .github/workflows/*.yml
pnpm run typecheck
pnpm run lint
```

Also run:

```bash
rg -n '\.release-evidence|release-evidence-' .github/workflows/ci.yml
```

Expected: no matches. `nextjs-build-*` remains present.

## Manual success criteria

- Inspect the workflow graph and confirm it contains one release proof job.
- Confirm the workflow can write a failed result before returning a failed conclusion.
- Confirm no step can push, merge, deploy, promote, mutate Supabase, tag, or publish.
- Confirm ordinary CI still runs all product-quality and diagnostic jobs.

## Handoff

Stop with the new direct workflow contract green. Do not dispatch it remotely in this phase. The old quality scripts remain temporarily available until release authority is rewritten in Phase 3.
