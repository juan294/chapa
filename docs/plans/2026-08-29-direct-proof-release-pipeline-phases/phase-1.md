# Phase 1 — Lock Direct Contracts and Mode Selection

> **Master plan:** `docs/plans/2026-08-29-direct-proof-release-pipeline.md`
> **Depends on:** None
> **Batch:** No
> **Stop:** Stop after tests and review. Do not change workflow authority in this phase.

## Objective

Create executable contracts for the small default probe set, the explicit deep probe set, and one compact release result before replacing the current evidence workflow.

## Files

Modify:

- `apps/web/e2e/helpers/release-required-environments.ts`
- `apps/web/e2e/helpers/release-required-environments.test.ts`
- `apps/web/e2e/release-required.spec.ts`
- `package.json`

Add:

- `scripts/quality/release-result.ts`
- `scripts/quality/release-result.test.ts`

Do not modify or delete the current release-verification workflow, catalog, schemas, analyzers, or runbooks yet.

## 1. Write failing scenario-selection tests

Change `release-required-environments.test.ts` first. Assert the exact matrix:

```text
default preview:
  deployment.preview-identity
  health.core-dependencies
  profile.public-badge-read
  profile.public-share-read
  rollback.readiness

default production:
  deployment.production-identity
  health.core-dependencies
  profile.public-badge-read
  profile.public-share-read

deep preview:
  all default preview IDs
  profile.share-verification
  locales.en-es
  auth.github-login-redirect
  auth.protected-write-denied

deep production:
  all default production IDs
  profile.share-verification
  locales.en-es
```

Also assert that an unknown environment or mode throws a clear error. These tests must be red before implementation because the current selector accepts only an environment and always selects the broad shared set. (`apps/web/e2e/helpers/release-required-environments.ts:1-24`)

## 2. Implement one scenario authority

Use literal unions:

```text
type DeploymentEnvironment = "preview" | "production"
type ReleaseVerificationMode = "default" | "deep"

parseReleaseVerificationMode(raw):
  if raw is absent: return "default"
  if raw is "default" or "deep": return raw
  otherwise: throw

releaseRequiredScenarioIds(environment, mode):
  validate environment
  select the exact matrix pinned by the test
```

`release-required.spec.ts` reads `RELEASE_VERIFICATION_MODE`, parses it once, and registers only selected scenarios. Identity, health, badge, and share tests must also use the selector instead of being registered unconditionally. This makes test discovery itself prove the contract.

Do not duplicate scenario lists in a collector or documentation validator.

## 3. Write failing compact-result tests

Add `release-result.test.ts` before its implementation. Cover:

- a valid passed Preview result;
- a valid failed Preview result with one failed direct check;
- a valid final result with Preview source, main tree, production, tag, and release readback;
- malformed 40-hex commit or tree identity;
- malformed annotated release tag;
- non-HTTPS Preview or production URL;
- candidate/source SHA mismatch;
- main/candidate tree mismatch in a passed final result;
- missing direct check;
- a `passed` overall result containing a failed check;
- malformed workflow run ID or attempt;
- invalid ISO timestamp;
- unknown top-level or nested fields;
- recursive rejection of field names containing `authorization`, `cookie`, `secret`, or `token`;
- deterministic JSON serialization and atomic output replacement.

The tests use temporary directories only. They must not access GitHub, Vercel, Supabase, or production.

## 4. Implement the compact-result module

The module exports pure builders and a CLI writer:

```text
buildPreviewResult(input):
  validate allowlisted keys and primitives
  require candidate == source head
  require exact preview check IDs
  derive overall status from direct check statuses
  return frozen result

buildFinalResult(input):
  validate preview result
  require main tree == candidate tree for passed status
  require exact production check IDs
  require tag target == main commit
  require release target == tag
  derive overall status
  return frozen result

writeResult(path, result):
  write a sibling temporary file
  rename to the requested path
```

The module does not inspect workflow artifacts, count generic evidence, grant authorization, or decide whether a failed check may be overridden.

Add one package command:

```json
"release:write-result": "tsx scripts/quality/release-result.ts"
```

Keep the existing release-evidence commands until Phase 4.

## Automated success criteria

```bash
pnpm vitest run \
  apps/web/e2e/helpers/release-required-environments.test.ts \
  scripts/quality/release-result.test.ts
EXPECTED_DEPLOYMENT_ENV=preview RELEASE_VERIFICATION_MODE=default \
  pnpm --filter @chapa/web exec playwright test \
  e2e/release-required.spec.ts --list --project=chromium
EXPECTED_DEPLOYMENT_ENV=production RELEASE_VERIFICATION_MODE=default \
  pnpm --filter @chapa/web exec playwright test \
  e2e/release-required.spec.ts --list --project=chromium
EXPECTED_DEPLOYMENT_ENV=preview RELEASE_VERIFICATION_MODE=deep \
  pnpm --filter @chapa/web exec playwright test \
  e2e/release-required.spec.ts --list --project=chromium
EXPECTED_DEPLOYMENT_ENV=production RELEASE_VERIFICATION_MODE=deep \
  pnpm --filter @chapa/web exec playwright test \
  e2e/release-required.spec.ts --list --project=chromium
pnpm run typecheck
pnpm run lint
```

The Playwright list output must contain exactly the scenario IDs in the matrix for each environment and mode.

## Manual success criteria

- Review the result shape and confirm it contains facts only, not an analyzer decision or authorization field.
- Confirm the default scenario count is five for Preview and four for production.
- Confirm deep mode retains all current deployed checks.

## Handoff

Stop with the new contracts green. The old release workflow still controls releases until Phase 2 replaces it.
