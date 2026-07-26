# Release Capability Checklist

`docs/release/release-playbook.md` is the sole release-ordering authority. Use
this runbook when that procedure calls for manual, migration, cron-readiness,
rollback-readiness, or post-release detail. Completing this checklist never
authorizes PR creation, merge, production operations, tagging, or publishing.

## Candidate-bound preview arcs

Record the E2E Pro `runId`, `developCommit`, `candidateTreeDigest`, exact preview
URL, executor, time, result, and evidence for every applicable row. The preview
must first pass `/api/version` identity verification; do not use a stable alias
or older deployment.

| Flow | Evidence |
|---|---|
| GitHub login | Complete GitHub OAuth and confirm the authenticated redirect returns to the exact preview. This is an authorized preview interaction, not the read-only redirect probe. |
| Badge generation | Authenticate, generate or open the synthetic/test profile, and record visible badge evidence. |
| Public badge SVG | Open `/u/{handle}/badge.svg` without authentication; record status, content type, and rendering. |
| Share page | Open `/u/{handle}` and record badge preview, breakdown, and embed snippet. |
| Core dependency health | Record `dependencies.redis`, `dependencies.supabase`, and `dependencies.github` from `/api/health`; all must be `ok` for release-required deployed evidence. |
| Cron freshness | Record each cron component separately. Overall health may be degraded by stale cron heartbeats even when the candidate's core dependencies are healthy. |
| Verification | Follow the share-page verification link and record `/verify/{hash}` rendering. |
| Locale | Switch Spanish to English and back; record that the selected locale renders without untranslated release-sensitive copy. |

Recommended preview observation is 24 hours for caching, scoring, OAuth, cron, or
vendor-sensitive changes and at least one hour for documentation-only changes.
The run records the actual duration; elapsed time alone is not a pass.

## Alerting readiness

Record whether `CHAPA_ALERT_WEBHOOK_URL` is configured for production. It
receives the active signals documented in
`docs/runbooks/incident-response.md`. Reading configuration state is distinct
from changing it; environment changes require explicit authorization.

## Migration readiness

Use `docs/runbooks/migrations.md`.

- Review migrations between the release baseline and `developCommit`.
- Run `pnpm run validate:migrations`.
- Import the release-PR pending-migration CI result.
- If CI skipped because its read-only credentials are absent, attach explicit
  manual drift evidence; a skip is never a required pass.
- Applying a migration is a separately authorized production operation.

## Cron and schedule readiness

`apps/web/vercel.json` registers four jobs:

| Route | Schedule role | Duration budget |
|---|---|---:|
| `/api/cron/warm-cache` | Profile cache refresh | 300 seconds |
| `/api/cron/sync-audience` | Audience synchronization | 300 seconds |
| `/api/cron/process-campaigns` | Campaign processing | 300 seconds |
| `/api/cron/latency-check` | Badge latency probe | 60 seconds |

The release-required static gate is `pnpm run check:vercel-config`. Also record:

- the production Vercel plan supports the configured duration budgets;
- `CRON_SECRET` is configured;
- `/api/health` exposes a heartbeat component for each job; and
- the previous production execution state is understood.

Calling a cron route executes operational work. Do not invoke any cron merely to
complete this checklist. A separately authorized invocation records the route,
time, response, side effects, and resulting heartbeat.

## Release metadata

- Changelog entry matches the approved release diff.
- Application and lockfile versions match.
- Every current version reference was updated.
- The old-version scan contains only explained history.
- The release PR description links the run ID, candidate commit/tree, included
  commits, relevant issues, and pre-merge evidence report.

The release command owns PR creation and merge; this runbook contains no
alternative procedure.

## Rollback readiness

Before merge authorization:

- identify the previous evidence-approved production deployment and commit;
- confirm its evidence report and deployment are retrievable;
- distinguish application rollback from any required schema recovery;
- review `docs/runbooks/rollback.md`; and
- record the applicable rollback triggers.

Rollback triggers include core health failure, badge SVG 5xx, broken OAuth,
production identity mismatch, data loss, and a material error-rate spike.

## Post-release read-only verification

Within 15 minutes of the authorized release:

```bash
curl -fsS https://chapa.thecreativetoken.com/api/version
curl -sS https://chapa.thecreativetoken.com/api/health \
  | jq '{status, dependencies}'
curl -fsSI 'https://chapa.thecreativetoken.com/u/octocat/badge.svg?__chapa_smoke=1'
```

Record production identity, core dependencies, cron freshness, badge response,
Vercel logs/alerts, evidence report, and `runId`. On a rollback trigger, use
`docs/runbooks/rollback.md`; do not continue the release while investigating.
