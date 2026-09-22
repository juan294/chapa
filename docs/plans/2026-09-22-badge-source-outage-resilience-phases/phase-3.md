# Phase 3 — Release-proof hardening, documentation, and candidate qualification

Parent plan: `../2026-09-22-badge-source-outage-resilience.md`. Depends on phases 1 and 2. Not batch-eligible because it asserts their final SVG contract.

## Goal

A 200 load-error SVG cannot satisfy release verification. The completed patch is documented, frozen at an exact local commit/tree, and fully qualified without pushing or creating a Preview deployment.

## Files

| file | change |
|---|---|
| `apps/web/e2e/helpers/deployment-probes.ts` | pure badge-body state assertion; release badge probe requires rendered state |
| `apps/web/e2e/helpers/deployment-probes.test.ts` | **new** — rendered/current, rendered/stale, EN/ES fallback rejection |
| `apps/web/e2e/release-required.spec.ts` | keep existing scenario wiring; update only if helper signature needs it |
| `apps/web/e2e/helpers/release-required-environments.ts` | confirm the public badge scenario remains required locally and in production default |
| `CHANGELOG.md` | patch entry covering incident cause and fail-soft behavior |
| package version files named by the release playbook | patch version at release preparation, not during early implementation |
| `docs/runbooks/incident-response.md` or a dedicated incident record | add the machine-state probe and link the eventual issue/evidence |
| `docs/decisions/2026-08-30-scoring-cache-seam-flag-combinations.md` | final consistency review after phase 1 implementation |

## Steps

### 3.1 Red: prove the release gate accepts the broken artifact today

Extract a pure assertion from `assertBadgeSvg` and add fixtures:

```ts
assertRenderableBadgeBody('<svg data-chapa-state="rendered" data-chapa-freshness="current">...</svg>') // pass
assertRenderableBadgeBody('<svg data-chapa-state="rendered" data-chapa-freshness="stale">...</svg>')   // pass product availability check
assertRenderableBadgeBody('<svg data-chapa-state="fallback">Could not load data...</svg>')               // fail
assertRenderableBadgeBody('<svg data-chapa-state="fallback">No se pudieron cargar...</svg>')             // fail
```

The integration helper still asserts status 200, SVG content type, and wrapper bytes, then calls the pure state assertion. Do not key correctness to localized text.

The generic release scenario accepts an explicitly stale rendered badge as an available product artifact. The incident-specific production proof is stricter and requires `data-chapa-freshness="current"` for `juan294` before declaring complete recovery.

### 3.2 Review all affected consumers

Search all `BadgeSvg` renderers and confirm the new option defaults preserve current behavior. Check badge route, share page, OG image, Studio preview, warm-cache, and tests. Update only consumers that must expose the new machine attributes; do not invent degraded behavior for unrelated surfaces in this patch.

Run the repository's final simplify/reuse review after implementation. Consolidate duplicated stored-profile projection logic with the public profile API where doing so preserves route contracts.

### 3.3 Document the incident and patch

Record:

- failed production commit/deployment and exact observed route;
- unresolved Bitbucket refresh claim as trigger, without claim ID or credential material;
- why the claim barrier remains unchanged;
- exact-bound stale aggregate and stored badge fallback semantics;
- release-probe gap and its executable correction;
- operational requirement that the current stuck grant still needs explicit disconnect/reconnect for fully current status;
- rollback and account mutation as separate authorization gates.

Do not place secrets, raw provider responses, service-role values, or user token material in tracked evidence.

## Verification

### 3.4 Targeted verification

Run sequentially:

```sh
pnpm exec vitest run apps/web/e2e/helpers/deployment-probes.test.ts --no-file-parallelism
pnpm exec vitest run apps/web/lib/cache/stats-cache.test.ts apps/web/lib/github/client.test.ts --no-file-parallelism
pnpm exec vitest run apps/web/lib/profile/stored-badge-profile.test.ts apps/web/lib/render/BadgeSvg.test.tsx 'apps/web/app/u/[handle]/badge.svg/route.test.ts' --no-file-parallelism
pnpm run typecheck
pnpm run lint
pnpm run check:circular
```

### 3.5 Freeze and qualify the exact local candidate

Commit the complete patch in its isolated worktree, record exact commit/tree, and run the canonical checks sequentially:

```sh
git diff --check
pnpm run typecheck
pnpm run lint
pnpm run test:contract:local
pnpm run test:coverage
bash scripts/check-craft-propagation.sh
pnpm run release:validate-docs
pnpm run check:vercel-config
pnpm run check:circular
pnpm run validate:migrations
pnpm run check:write-registration
pnpm run check:licenses
pnpm run check:vulnerabilities
pnpm exec tsx scripts/quality/candidate-artifact-manifest.ts --root "$candidateRoot" --output "$manifestPath"
bash scripts/check-bundle-size.sh
pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/scoring/reference-calculator.ts packages/shared/src/__fixtures__/observed-owner-envelope.json
```

Then run the production-mode local browser proof with no hosted Preview:

```sh
EXPECTED_DEPLOYMENT_ENV=local RELEASE_VERIFICATION_MODE=local-candidate \
EXPECTED_DEPLOYMENT_COMMIT="$developCommit" \
EXPECTED_CANDIDATE_TREE_DIGEST="$candidateTreeDigest" \
RELEASE_BUILD_MANIFEST="$manifestPath" \
PLAYWRIGHT_JSON_OUTPUT_NAME="$runDir/release-probes.json" \
  pnpm --filter @chapa/web exec playwright test \
    e2e/release-required.spec.ts --grep @release-required --project=chromium
```

Every discovered applicable test must execute with zero skips/failures. The manifest helper performs the one production build; do not run a duplicate build first.

### 3.6 Later authorized release and production proof

Stop at the release gates. After separate explicit release/production authorization:

1. Prove `origin/develop`, candidate commit/tree, prospective `main` tree, and rollback reference exactly match the qualified evidence.
2. Release through the merge-commit `develop` to `main` path.
3. Wait for `/api/version` to identify the actual production deployment and exact `main` commit.
4. Run default production release-required probes against that deployment.
5. Run an additional read-only canonical badge check:

```text
HTTP 200
Content-Type contains image/svg+xml
body contains @juan294
body contains data-chapa-state="rendered"
body contains data-chapa-freshness="current"
body does not contain data-chapa-state="fallback"
body does not contain the EN or ES load-error copy
```

If production proof fails, record that production changed and stop. Rollback requires a separate explicit authorization under `docs/runbooks/rollback.md`.

## Done when

- The release probe fails on the exact class of 200 fallback that escaped v3.0.0 verification.
- Full local schema2 qualification is bound to one clean commit/tree with real evidence.
- No feature branch was pushed and no Preview deployment was created during implementation.
- Release and production actions remain pending explicit authorization.
