---
phase: 12G
release: v2.12.0
issues: ["#751", "#752", "#753"]
batch_eligible: true
depends_on: ["12A"]
effort: S
---

# Phase 12G — Devops batch (`#751`, `#752`, `#753`)

Three independent devops fixes.

## #751 — No Vercel Log Drain configured

Vercel can stream production logs to an external aggregator (Datadog,
Better Stack, Logtail, Axiom, etc.). Currently logs only live in the
Vercel dashboard with a short retention window.

This is a **manual configuration step** in the Vercel dashboard, not a
code change. The implementation work for this phase is:

1. Decide on a log destination
2. Set up the destination (free tier on Better Stack or Axiom is fine)
3. Configure the log drain in Vercel dashboard
4. Document the destination + retention in `docs/runbooks/observability.md`

For the closing comment, the agent records that the work is documented;
the user performs the dashboard step.

**Recommendation:** Better Stack free tier (up to 1GB/mo). If it fits,
use it. If not, evaluate Axiom (more generous free tier but more setup).

## #752 — Lighthouse CI is `continue-on-error` and doesn't cover `/u/:handle`

**Files:** `.github/workflows/*.yml` (the Lighthouse CI workflow).

```yaml
# Before:
- name: Lighthouse CI
  run: ...
  continue-on-error: true

# After:
- name: Lighthouse CI
  run: ...
  # No continue-on-error — failures block merge

# Add /u/:handle to the lighthouse config URL list:
urls:
  - http://localhost:3001/
  - http://localhost:3001/u/juan294
  - http://localhost:3001/about
  - http://localhost:3001/about/scoring
```

If running locally requires seeded data: use a fixture handle whose
profile is materialized at test-time, or seed Redis/Supabase from a
test-fixtures script run before Lighthouse.

## #753 — E2E tests run against build artifact, not Vercel preview

The current E2E suite spins up `next start` and runs Playwright against
localhost. This catches build-time bugs but misses production-only
behavior (Vercel Edge Network, ISR cache, CSP headers from middleware,
etc.).

```yaml
# .github/workflows/e2e-preview.yml (new)
on:
  pull_request:
    branches: [develop]
  workflow_run:
    workflows: ["Vercel Preview Comments"]
    types: [completed]

jobs:
  e2e-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - name: Get Vercel preview URL
        id: vercel-url
        # Read the Vercel deployment URL from the GitHub PR comment or via
        # the Vercel API
      - name: Run Playwright against preview
        env:
          BASE_URL: ${{ steps.vercel-url.outputs.url }}
        run: pnpm playwright test --grep "@preview"
```

Tag a subset of E2E specs with `@preview` (smoke-level: home, share page,
auth login redirect). Don't run the full E2E suite against preview to
keep cost down.

## Files

- New: `docs/runbooks/observability.md` (#751 documentation)
- Modified: existing Lighthouse CI workflow file (#752)
- Modified: Lighthouse config (URLs) (#752)
- New: `.github/workflows/e2e-preview.yml` (#753)
- Modified: ~3 E2E spec files to add `@preview` tags (#753)

## Acceptance criteria

### Automated
- [ ] Lighthouse CI runs on `/u/<handle>` and fails the workflow on
      regression (no more `continue-on-error`)
- [ ] E2E preview workflow runs on PR open and posts the result
- [ ] `pnpm run test`, `pnpm run typecheck`, `pnpm run lint` pass

### Manual (#751 — user action)
- User configures Better Stack (or chosen destination) and sets up the
  Vercel Log Drain in the dashboard. Once verified, agent closes #751.

## Closing the issues

```bash
gh issue close 752 --comment "Fixed in <sha>. Lighthouse CI now blocks on regressions and covers /u/<handle>."
gh issue close 753 --comment "Fixed in <sha>. New e2e-preview.yml workflow runs @preview-tagged specs against Vercel preview deployments on every PR."
# #751 closes only after the manual Vercel log drain config:
# gh issue close 751 --comment "Resolved. Vercel Log Drain configured to <destination>; runbook at docs/runbooks/observability.md."
```
