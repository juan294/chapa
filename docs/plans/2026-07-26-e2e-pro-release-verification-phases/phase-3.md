# Phase 3 — Prove Candidate Identity and Initial Required Probes

**Status:** Complete
**Depends on:** Phase 2
**Batch:** no; it implements the scenario producers registered by Phase 2.
**Goal:** bind preview and production evidence to Chapa's squash-preserving candidate identity and emit multi-layer results from existing smoke and journey coverage.

## Files

### Create

- `apps/web/app/api/version/route.ts`
- `apps/web/app/api/version/route.test.ts`
- `apps/web/e2e/release-required.spec.ts`
- `scripts/quality/collect-playwright-evidence.ts`
- `scripts/quality/collect-playwright-evidence.test.ts`
- `scripts/quality/verify-deployment-identity.ts`
- `scripts/quality/verify-deployment-identity.test.ts`

### Modify

- `apps/web/lib/env.ts`
- `apps/web/lib/env.test.ts`
- `apps/web/e2e/smoke.spec.ts`
- `apps/web/e2e/journey.spec.ts`
- `apps/web/playwright.config.ts`
- `quality/release-required.json`
- `package.json`

The current Playwright configuration already supports local or external targets, desktop and Pixel 5 projects, Spanish locale, and retry traces. (`apps/web/playwright.config.ts:3-40`)

## TDD sequence

### 1. Add deployment identity route tests

Tests precede the route:

- trims and returns `VERCEL_GIT_COMMIT_SHA`;
- returns `VERCEL_ENV`;
- returns a deliberate `commitSha: null` outside Vercel rather than inventing an identity;
- sets `Cache-Control: no-store`;
- returns no environment variables beyond the allowlisted deployment fields.

Add `getVercelGitCommitSha()` to the centralized environment module. The repository bans scattered direct environment reads and currently centralizes runtime values in `apps/web/lib/env.ts`. (`apps/web/lib/env.ts:1-20`, `apps/web/lib/env.ts:270-282`)

`GET /api/version` returns:

```json
{
  "commitSha": "40-character deployment source commit or null",
  "environment": "preview, production, development, or null"
}
```

### 2. Add identity-chain tests

`verify-deployment-identity.ts` exposes pure checks plus CLI orchestration.

```text
verifyPreview(expectedDevelopCommit, versionResponse):
  require non-null reported commit
  require reported commit == expectedDevelopCommit

verifyPromotion(candidateTreeDigest, mainCommit, mainTreeDigest):
  require mainCommit is a 40-character SHA
  require mainTreeDigest == candidateTreeDigest

verifyProduction(mainCommit, versionResponse):
  require non-null reported commit
  require reported commit == mainCommit
```

CLI behavior:

```text
read candidate.json
GET previewUrl/api/version with timeout and no redirects across origins
run git rev-parse mainCommit^{tree} locally after merge
GET productionUrl/api/version
write identity evidence into the existing run directory
```

Tests use fixture responses and a fake Git command adapter. They cover missing URL, network failure, malformed JSON, null identity, stale preview, changed main tree, stale production alias, and valid identity.

### 3. Create stable release-required Playwright producers

`release-required.spec.ts` covers deployed, read-only obligations:

- `deployment.preview-identity`;
- `deployment.production-identity`;
- `health.core-dependencies`;
- `profile.public-badge-read`;
- `profile.public-share-read`;
- `auth.github-login-redirect`;
- `auth.protected-write-denied`.

Every test title contains its stable scenario ID plus `@release-required`. Expected commit and environment come from explicit test inputs; absent prerequisites call `test.fail` through a setup assertion rather than `test.skip`.

Reuse current smoke assertions rather than duplicate behavior. The existing suite already covers health dependencies, SVG integrity, share rendering, OAuth redirect, and 404 behavior. (`apps/web/e2e/smoke.spec.ts:15-125`)

The protected-write denial probe uses an unauthenticated request and verifies both denial status and absence of a success body. It does not create data.

### 4. Make journey evidence run-scoped and cleanup-safe

Update `journey.spec.ts`:

```text
runId = sanitized E2E_PRO_RUN_ID or generated local test ID
handles = chapa-e2e-{runId}-{project}-{shape}

try:
  seed only handles owned by this run
  execute current journey
  read back snapshots, Studio config, and linked platform rows
  emit scenario evidence fragments
finally:
  delete only run-owned rows
  query each table for run-owned residue
  emit cleanup evidence with remainingCount
```

The current journey creates three persistence shapes, exercises offline recovery, reads Supabase state, and deletes fixture rows; retain those semantics while guaranteeing cleanup on thrown failure. (`apps/web/e2e/journey.spec.ts:35-136`, `apps/web/e2e/journey.spec.ts:162-176`)

Map its evidence to:

- `studio.config-persistence`;
- `profile.snapshot-integrity`.

### 5. Normalize Playwright JSON

Configure the JSON reporter for release-required runs without changing normal developer output.

`collect-playwright-evidence.ts`:

```text
read Playwright JSON
map test title stable ID -> catalog scenario
reject duplicate, unknown, or absent selected IDs
map passed/failed/skipped to evidence status
attach report, trace, screenshot, HTTP, datastore, and cleanup paths
write one manifest fragment
```

The normalizer never changes requiredness; it reads that from `quality/release-required.json`.

## Automated success criteria

Run sequentially:

```text
pnpm vitest run apps/web/app/api/version/route.test.ts
pnpm vitest run scripts/quality/verify-deployment-identity.test.ts
pnpm vitest run scripts/quality/collect-playwright-evidence.test.ts
pnpm --filter @chapa/web exec playwright test e2e/release-required.spec.ts
pnpm run test:contract:local
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
git diff --check
```

The local deployed test may use an explicit test commit identity; preview/production assertions use fixture responses in automated unit tests until the non-deploying release workflow is available.

## Manual success criteria

- Start the built app with a test Vercel commit value and confirm `/api/version` returns only the allowlisted fields.
- Inspect one journey evidence fragment and confirm its fixture IDs, Supabase readbacks, and zero-residue cleanup are run-scoped.
- Confirm a stale preview and a tree-changing squash both produce distinct blocking reasons.

## Authorization and containment

All state-changing tests use local Supabase fixtures. Deployed probes are read-only. This phase does not create a preview, merge, deploy, invoke crons, apply migrations, send messages, or change production.

## Stop condition

Stop when every initial required scenario has an executable producer and identity mismatch cannot pass.
