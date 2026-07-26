# Phase 4 — Transport and Aggregate Exact-Candidate Evidence

**Status:** Complete
**Depends on:** Phase 3
**Batch:** no; it wires the schemas and producers from Phases 2–3 into one release decision.
**Goal:** run a parameterized, non-deploying release-verification workflow that produces a durable candidate-bound manifest and one aggregate `Release Evidence` result.

## Files

### Create

- `.github/workflows/release-verification.yml`

### Modify

- `.github/workflows/ci.yml`
- `.github/workflows/nightly-prod-probe.yml`
- `scripts/quality/prepare-release-run.ts`
- `scripts/quality/collect-playwright-evidence.ts`
- `scripts/quality/analyze-release-run.ts`
- `scripts/quality/render-release-report.ts`
- `quality/evidence/README.md`
- `package.json`

The current CI already provides separate coverage, contract/journey, build, built-artifact E2E, deployed smoke, and migration evidence. The new workflow imports or references those outputs instead of repeating equivalent work. (`.github/workflows/ci.yml:30-152`, `.github/workflows/ci.yml:205-381`, `.github/workflows/ci.yml:383-492`)

## Implementation

### 1. Define a non-deploying workflow contract

`release-verification.yml` supports `workflow_dispatch` and `workflow_call` inputs:

```text
baselineTag
developCommit
candidateTreeDigest
previewUrl
runId
```

It does not push, merge, deploy, mutate an alias, invoke a production cron, apply a migration, tag, or publish.

### 2. Prepare and validate the run

First job:

```text
checkout developCommit
validate catalog and schemas
require git rev-parse HEAD == developCommit
require git rev-parse HEAD^{tree} == candidateTreeDigest
prepare run directory
record workflow run ID and repository
```

Fail when any identity input is absent or the checkout/tree differs.

### 3. Import deterministic evidence

Consume exact-SHA evidence from the existing CI run:

- aggregate coverage;
- contract/local-Supabase journey;
- build artifact;
- aggregate E2E;
- Vercel configuration check;
- pending migration result when applicable.

Use GitHub run ID, job name, commit SHA, conclusion, and artifact URL/path as evidence. Never convert a skipped required job into a pass.

Preserve current check names; add the release evidence result rather than renaming branch-protection inputs. Existing aggregate nodes are `Coverage` and `E2E Tests`. (`.github/workflows/ci.yml:88-152`, `.github/workflows/ci.yml:366-381`)

### 4. Run exact-preview required probes

Execute:

```text
EXPECTED_DEPLOYMENT_COMMIT = developCommit
EXPECTED_DEPLOYMENT_ENV = preview
PLAYWRIGHT_BASE_URL = previewUrl
DEPLOYMENT_SMOKE_STRICT = true
E2E_PRO_RUN_ID = runId
playwright test e2e/release-required.spec.ts --grep @release-required
```

The first probe calls `/api/version`; a stale `DEPLOYMENT_SMOKE_BASE_URL` therefore blocks rather than producing evidence for the wrong candidate. The current deployment-smoke workflow only checks whether a URL is configured, so identity becomes an additional mechanical requirement. (`.github/workflows/ci.yml:383-449`)

### 5. Merge, analyze, and render

Final job:

```text
download deterministic and preview fragments
merge by stable scenario ID
reject duplicates
run release:analyze
run release:render-report
upload candidate.json, release-run.json, evidence-manifest.json,
       release-report.md, Playwright JSON, traces/screenshots, cleanup proof
set aggregate Release Evidence conclusion
```

Artifact retention:

- final manifest and report: 90 days in Actions and later attached to the GitHub release;
- raw Playwright and contract evidence: 30 days;
- build artifacts: preserve the current one-day retention unless the manifest needs a digest/reference.

### 6. Make nightly output manifest-compatible

Keep nightly production smoke as monitoring, not release authorization. Add candidate/environment/timestamp and normalized scenario fragments so a nightly result can be inspected through the same evidence vocabulary without being silently substituted for a release candidate run. The current nightly workflow is a strict scheduled Chromium probe with failure artifacts. (`.github/workflows/nightly-prod-probe.yml:1-64`)

### 7. Prevent skip-as-pass

Every required workflow producer writes one of:

```text
passed
failed
skipped with reason
missing
```

Only `passed` satisfies a required obligation. Job cancellation, missing credentials, absent preview URL, missing artifact, or expired artifact becomes a blocking result.

## Automated success criteria

Run sequentially:

```text
pnpm vitest run scripts/quality/prepare-release-run.test.ts
pnpm vitest run scripts/quality/collect-playwright-evidence.test.ts
pnpm vitest run scripts/quality/analyze-release-run.test.ts
pnpm vitest run scripts/quality/render-release-report.test.ts
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
git diff --check
```

Validate workflow syntax and use fixture GitHub-run payloads to prove:

- exact SHA evidence imports;
- a skipped required job blocks;
- an artifact from another SHA blocks;
- a stale preview blocks;
- duplicate scenario fragments block;
- the aggregate result reflects analyzer exit status.

## Manual success criteria

- Dispatch the workflow against a local or already-existing non-production preview only after the implementation phase receives authorization for the external CI run.
- Confirm no deployment was created by the workflow.
- Download the artifact and independently trace every required result to a raw job or probe.
- Confirm nightly evidence cannot authorize a release.

## Authorization and containment

Local tests and static workflow validation are within the phase. Dispatching GitHub Actions costs CI resources and requires phase authorization. Any new deployment, merge, production request beyond read-only probes, environment change, migration, cron, tag, or release is outside this phase.

## Stop condition

Stop when an exact-candidate workflow fixture yields one aggregate decision and every skip/mismatch case fails closed.
