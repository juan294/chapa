# Phase 4 — Automated browser suite

Goal: the runnable Playwright specs pass on desktop and on the Pixel 5
mobile project, against both the dev server and the production build.
Requires Phase 1.

## What runs and what does not

Export `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `NEXTAUTH_SECRET` from
`.env.local` into the Playwright process (values never printed), and leave
`REDESIGN_DISPOSABLE_PROJECT` unset. Then:
- `journey.spec.ts` runs. It creates three `chapa-e2e-<runId>-*` users with
  snapshots, Studio configs and a Bitbucket `user_platforms` row, exercises
  generate → badge → Studio save → share → offline save → refresh, deletes
  everything in `finally`, and asserts zero residue. It also sets
  `studio_enabled` and `bitbucket_integration` to true and restores their
  prior value; both are already true in production, so the write is a no-op.
  Its synthetic handles do not exist on GitHub, so their renders produce the
  fallback SVG and no snapshot is written by the route.
- `redesign-surfaces.spec.ts` self-skips (no `REDESIGN_DISPOSABLE_PROJECT`);
  its fixture helper deletes and re-inserts `octocat` and `juan294` and
  refuses a non-loopback Supabase URL anyway.
- `release-required.spec.ts` is ignored (no `EXPECTED_DEPLOYMENT_ENV`).
- The other 13 specs run, including `redesign-reflow.spec.ts` (landing
  only, aborts every non-loopback browser request) and every spec that reads
  `/u/octocat`.

Coverage moved to Phase 5 because of the one exclusion: the owner-Studio /
settings / admin / CLI / verify / demo surface matrix at EN/ES × light/dark ×
1440/390 (redesign-surfaces).

## 4.1 Dev server (3001)

```bash
cd /Users/juan/code/chapa/apps/web
export SUPABASE_URL=$(grep '^SUPABASE_URL=' .env.local | cut -d= -f2-)
export SUPABASE_SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)
export NEXTAUTH_SECRET=$(grep '^NEXTAUTH_SECRET=' .env.local | cut -d= -f2-)
E2E_PRO_RUN_ID=<runId> \
pnpm exec playwright test --project=chromium --project=mobile --reporter=list \
  --output=test-results/dev 2>&1 | tee ../../logs/local-e2e/playwright-dev.log
```

`reuseExistingServer` picks up the running dev server. Confirm in the log
that exactly one spec reports skipped (redesign-surfaces) and that the
journey spec's attached `release-evidence.json` records `residueCount: 0`
and restored flags.

## 4.2 Production build (3002)

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3002 E2E_PRO_RUN_ID=<runId>-prod \
pnpm exec playwright test --project=chromium --project=mobile --reporter=list \
  --output=test-results/prod 2>&1 | tee ../../logs/local-e2e/playwright-prod.log
```

Differences between 4.1 and 4.2 are findings in their own right: the nine
locale-segmented content pages are SSG in the build, `force-static` landing
revalidates hourly, and `loading.tsx` shells render only under `next start`.

## 4.3 Triage

Any failure: re-run the single test with `--trace on`, reproduce by hand in
Chrome, record as a finding with spec, project and step. A test that is
wrong about the redesigned UI is fixed in the test only when the UI matches
`docs/design-system.md`; otherwise the UI is the bug.

## Exit criteria

0 failures on both projects against both servers; exactly one documented
skip; journey residue 0 on both runs; counts per project recorded; HTML reports copied to
`evidence/phase4/`.
