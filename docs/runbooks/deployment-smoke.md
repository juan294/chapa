# Deployment Smoke Runbook

`docs/release/release-playbook.md` owns release ordering and authorization. This
runbook explains deployed read-only probes, identity, and failure evidence.

## Two deployed-smoke contexts

### General CI deployment smoke

The `deployment-smoke` job in `.github/workflows/ci.yml` runs
`apps/web/e2e/smoke.spec.ts` against `DEPLOYMENT_SMOKE_BASE_URL`. It is
conditional on a configured URL outside production refs and retains Playwright
failure artifacts.

This general job is useful deployment signal, but a conditional skip is not
release evidence. It does not authorize a release and cannot substitute for the
candidate-bound workflow.

### Direct release-required Preview proof

`.github/workflows/release-verification.yml` is one read-only job. It
receives an immutable `developCommit`, `candidateTreeDigest`, exact Preview
URL, `baselineTag`, and `runId`, verifies source/tree/baseline identity
directly, runs `apps/web/e2e/release-required.spec.ts` with:

```text
EXPECTED_DEPLOYMENT_COMMIT = developCommit
EXPECTED_DEPLOYMENT_ENV = preview
RELEASE_VERIFICATION_MODE = default
PLAYWRIGHT_BASE_URL = exact Preview URL
```

and writes/uploads one `release-result.json`. An absent URL, absent identity,
stale preview, wrong environment, missing artifact, cancelled producer, or a
failed check is blocking.

Production release-required smoke uses `mainCommit`, environment
`production`, and only the four default production-safe scenarios, run
directly by `/release` after promotion (`RELEASE_VERIFICATION_MODE=default`).
`RELEASE_VERIFICATION_MODE=deep` (via `/prodplaybook`, never a default-release
gate) adds broader scenarios to both environments.

## Identity proof

The first release-required request is `/api/version`.

| Environment | Required body |
|---|---|
| Preview | `commitSha` equals `developCommit`; `environment` equals `preview` |
| Production | `commitSha` equals `mainCommit`; `environment` equals `production` |

The release gate separately proves `mainTreeDigest == candidateTreeDigest`.
Reachability, a familiar URL, or a green run from another SHA never proves
candidate identity.

## Required deployed probes

`apps/web/e2e/helpers/release-required-environments.ts` is the single
executable authority for which of these run at which environment and mode —
see its `releaseRequiredScenarioIds(environment, mode)`.

| Stable scenario | Assertion | Preview default | Production default | Deep addition |
|---|---|:-:|:-:|:-:|
| `deployment.preview-identity` / `deployment.production-identity` | Exact `/api/version` commit and environment | yes | yes | -- |
| `health.core-dependencies` | `dependencies.redis`, `dependencies.supabase`, and `dependencies.github` are `ok` | yes | yes | -- |
| `profile.public-badge-read` | Smoke-only badge is HTTP 200, SVG content type, and contains valid SVG markers | yes | yes | -- |
| `profile.public-share-read` | Smoke-only share page is HTTP 200 and has a visible body | yes | yes | -- |
| `rollback.readiness` | Baseline tag is annotated and resolves to current production identity | yes | -- | -- |
| `profile.share-verification` | Share page verification link resolves and renders verified | -- | -- | both |
| `locales.en-es` | Share page renders correctly in `en` and `es` | -- | -- | both |
| `auth.github-login-redirect` | Preview login returns a redirect to GitHub | -- | -- | preview only |
| `auth.protected-write-denied` | Unauthenticated generation request is denied and does not report success | -- | -- | preview only |

The health probe deliberately does not require overall HTTP 200 or
`status == "ok"`. Overall health also includes cron-heartbeat freshness, which
describes environment scheduling rather than whether a new deployment's core
dependencies started correctly. Cron freshness remains visible, alerting, and a
manual operational readiness arc.

The `?__chapa_smoke=1` public profile and badge paths are read-only. Do not
replace them with an ordinary profile materialization path for production
release evidence.

## Reproduce against the exact target

```bash
cd apps/web
EXPECTED_DEPLOYMENT_COMMIT="$expectedCommit" \
EXPECTED_DEPLOYMENT_ENV="$expectedEnvironment" \
PLAYWRIGHT_BASE_URL="$exactDeploymentUrl" \
E2E_PRO_RUN_ID="$runId" \
pnpm exec playwright test e2e/release-required.spec.ts \
  --grep @release-required
```

For the older general smoke suite:

```bash
cd apps/web
PLAYWRIGHT_BASE_URL="$exactDeploymentUrl" \
DEPLOYMENT_SMOKE_STRICT=true \
pnpm exec playwright test e2e/smoke.spec.ts
```

## Failure evidence

Record:

- run ID, expected commit, tree, environment, and exact URL;
- workflow run and attempt;
- Playwright JSON result;
- trace, screenshot, or test output;
- actual `/api/version` response; and
- the failed `checks` entry in `release-result.json`.

Do not include secrets, bearer headers, OAuth tokens, service-role keys, or
personal data. `release-result.json` is the durable receipt (30-day artifact
retention); it never contains a field name matching `authorization`,
`cookie`, `secret`, or `token`.

## Common interpretations

| Symptom | Interpretation |
|---|---|
| Identity missing or mismatched | Wrong, stale, or not-yet-ready deployment |
| Core dependency not `ok` | Deployed Redis, Supabase, GitHub, credential, or scope problem |
| Overall health degraded with core dependencies `ok` | Inspect cron freshness separately; do not relabel it a deployment pass/fail |
| Badge non-200 or invalid SVG | Public badge path, GitHub, or Redis integration problem |
| Share non-200 | Public profile SSR or dependency problem |
| Login does not redirect | GitHub OAuth configuration problem |
| Protected write does not deny | Authentication or authorization regression |

Changing a deployment URL, secret, variable, or Vercel environment is an
external configuration action and remains separately authorized.
