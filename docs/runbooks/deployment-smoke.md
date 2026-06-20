# Deployment Smoke Runbook

## Overview

The `deployment-smoke` job in `.github/workflows/ci.yml` runs the Playwright
smoke suite (`apps/web/e2e/smoke.spec.ts`) against a **live deployment** rather
than the local CI build artifact. This catches problems that only surface in a
real Vercel environment — wrong env vars, broken Redis/Supabase wiring, edge
runtime differences, CDN/header misconfiguration — that the local-artifact E2E
job (`e2e`) cannot see.

The job runs in "strict" mode (`DEPLOYMENT_SMOKE_STRICT=true`), so it asserts
real success responses instead of accepting the graceful-degradation fallbacks
the local E2E run tolerates.

## When It Runs

The job is **conditionally skipped unless a target URL is configured.** Every
step is guarded with `if: env.DEPLOYMENT_SMOKE_BASE_URL != ''`, sourced from the
`DEPLOYMENT_SMOKE_BASE_URL` secret. When the secret is empty (the default), the
job logs a skip notice and no-ops — it never fails spuriously and costs no
Playwright runtime.

When the secret is set, the job:

1. Checks out the repo and installs dependencies.
2. Installs Playwright Chromium (cached across runs).
3. Runs `npx playwright test e2e/smoke.spec.ts` with
   `PLAYWRIGHT_BASE_URL` pointed at the deployment and
   `DEPLOYMENT_SMOKE_STRICT=true`.
4. On failure, uploads the Playwright report as an artifact
   (`deployment-smoke-report`, 7-day retention).

## What It Verifies (strict mode)

| Route | Assertion |
|-------|-----------|
| `/` | Landing page renders (`#main-content` visible) |
| `/api/health` | HTTP 200, `status: "ok"`, each dependency (redis/supabase/github) is `ok` or `skipped` |
| `/u/torvalds/badge.svg` | HTTP 200, `Content-Type: image/svg+xml`, body contains `<svg>…</svg>` |
| `/u/torvalds` | Share page returns HTTP 200, body visible |
| `/api/auth/login` | Redirects toward GitHub OAuth |

These are the same tests the local `e2e` job runs, but strict mode requires real
2xx responses, so a misconfigured preview deployment fails the job instead of
silently passing.

## How to Configure `DEPLOYMENT_SMOKE_BASE_URL`

The value is a base URL (no trailing path) pointing at a deployed Chapa
instance — typically a stable Vercel **preview** alias (never production, to
avoid load and rate-limit pressure on live traffic).

The workflow reads it from `secrets.DEPLOYMENT_SMOKE_BASE_URL`. Set it as a
repository secret (or environment secret) so the value is masked in logs:

```bash
# Via GitHub CLI — set a repo-level secret
gh secret set DEPLOYMENT_SMOKE_BASE_URL --body "https://chapa-git-develop-<org>.vercel.app"
```

Or via the GitHub UI: **Settings → Secrets and variables → Actions → New
repository secret**, name `DEPLOYMENT_SMOKE_BASE_URL`, value the preview URL.

To disable the job again, remove the secret:

```bash
gh secret delete DEPLOYMENT_SMOKE_BASE_URL
```

With the secret removed, the job reverts to its no-op skip behavior.

> Note: the workflow consumes the URL as a **secret**. If you prefer a
> non-masked GitHub Actions **variable** instead, change the `env` mapping in
> the `deployment-smoke` job from `secrets.DEPLOYMENT_SMOKE_BASE_URL` to
> `vars.DEPLOYMENT_SMOKE_BASE_URL` and set it with `gh variable set`.

## Reading Failures

1. Open the failed CI run → the **Deployment Smoke** job.
2. Find the failing step **Run deployment-shaped smoke tests** — the Playwright
   output names the failing route and the actual vs. expected response.
3. Download the **deployment-smoke-report** artifact for the full Playwright
   HTML report (traces, screenshots, network).
4. Reproduce locally against the same target:

   ```bash
   cd apps/web
   PLAYWRIGHT_BASE_URL="https://<preview-url>" DEPLOYMENT_SMOKE_STRICT=true \
     npx playwright test e2e/smoke.spec.ts
   ```

### Common causes

| Symptom | Likely cause |
|---------|--------------|
| `/api/health` not `ok` / dependency not `ok`/`skipped` | Missing or wrong Redis/Supabase/GitHub env vars on the deployment |
| Badge SVG non-200 or wrong content-type | GitHub token missing or rate-limited; Redis cache unreachable |
| Share page non-200 | SSR error on `/u/:handle` — check the deployment's runtime logs |
| Login does not redirect | GitHub OAuth client env vars missing on the deployment |

Because the target is a live deployment, failures usually point at the
deployment's **environment configuration**, not the application code. Verify the
Vercel project's env vars before assuming a code regression.
