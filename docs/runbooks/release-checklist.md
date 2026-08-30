# Release Capability Checklist

`docs/release/release-playbook.md` is the sole release-ordering authority. Use
this runbook when that procedure calls for manual, migration, cron-readiness,
rollback-readiness, or post-release detail. Completing this checklist never
authorizes PR creation, merge, production operations, tagging, or publishing.

## Candidate-bound preview arcs

Record the release `runId`, `developCommit`, `candidateTreeDigest`, exact
preview URL, executor, time, result, and the relevant `release-result.json`
check for every applicable row below. The immutable preview must first pass
`/api/version` identity verification. A stable alias is not candidate
evidence unless Vercel metadata proves it resolves to that exact immutable
deployment at the time of the interaction.

For the `develop` preview, verify that branch-scoped `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET` overrides select the dedicated preview OAuth app. Never
change the production OAuth callback to make a preview login pass.

Four of the arcs below (`health.core-dependencies`, `profile.public-badge-read`,
`profile.public-share-read`, `rollback.readiness`) are captured automatically
by the default release-required Playwright suite and populate the
corresponding `release-result.json` checks; manual capture is only the
fallback when CI could not run it here. Two arcs — a real GitHub OAuth flow
and an authenticated badge generation — are hard to automate reliably against
a preview app, so their absence never blocks a release; complete them by hand
whenever auth- or badge-generation-sensitive changes ship. `deep` mode (run on
request via `/prodplaybook`, never a default-release gate) additionally
automates `profile.share-verification` and `locales.en-es`.

| Flow | Evidence |
|---|---|
| GitHub login (manual, non-required) | After proving the `develop` alias resolves to the exact immutable deployment, begin and complete GitHub OAuth on that alias and confirm the authenticated redirect returns to the same alias. OAuth state cookies are host-scoped, so beginning on the immutable hostname and returning through the configured alias is invalid evidence. This is an authorized preview interaction, not the read-only redirect probe. |
| Badge generation (manual, non-required) | Authenticate, generate or open the synthetic/test profile, and record visible badge evidence. |
| Public badge SVG (automated, default) | Open `/u/{handle}/badge.svg` without authentication; record status, content type, and rendering. |
| Share page (automated, default) | Open `/u/{handle}` and record badge preview, breakdown, and embed snippet. |
| Core dependency health (automated, default) | Record `dependencies.redis`, `dependencies.supabase`, and `dependencies.github` from `/api/health`; all must be `ok`. |
| Cron freshness (manual) | Record each cron component separately. Overall health may be degraded by stale cron heartbeats even when the candidate's core dependencies are healthy. |
| Verification (automated, deep only) | `/prodplaybook` or `RELEASE_VERIFICATION_MODE=deep` follows the share-page verification link and records `/verify/{hash}` rendering. Not part of a default release; follow the link manually only when deep verification was requested and CI could not run it. |
| Locale (automated, deep only) | `/prodplaybook` or `RELEASE_VERIFICATION_MODE=deep` switches Spanish to English and back. Not part of a default release; repeat the switch manually only when deep verification was requested and CI could not run it. |

Recommended preview observation is 24 hours for caching, scoring, OAuth, cron, or
vendor-sensitive changes and at least one hour for documentation-only changes.
The run records the actual duration; elapsed time alone is not a pass.

## Alerting readiness

Record whether `CHAPA_ALERT_WEBHOOK_URL` is configured for production. When it
is unset — the current production default — active alert signals still
deliver via email (Resend, to `SUPPORT_FORWARD_EMAIL`) rather than a webhook;
record whether `RESEND_API_KEY` and `SUPPORT_FORWARD_EMAIL` are configured in
that case, since together they are what actually determines whether the
signals documented in `docs/runbooks/incident-response.md` reach anyone.
Reading configuration state is distinct from changing it; environment changes
require explicit authorization.

## Migration readiness

The required `Pending Migrations Check (release PR)` CI job result is the
release-PR admission gate for migrations directly — a separate manual review
obligation would only re-derive it. That job now fails closed when its
production read credentials are missing, so a missing, skipped, or failed
result always blocks the release and must be resolved, never waived. The
steps below document what that gate covers and remain the fallback if it
could not run. Use `docs/runbooks/migrations.md`.

- Review migrations between the release baseline and `developCommit`.
- Run `pnpm run validate:migrations`.
- Read the release-PR `Pending Migrations Check (release PR)` conclusion
  directly; it now fails the job (not a silent skip) when its production
  read credentials are absent, so there is no separate manual fallback for
  a missing credential.
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
  commits, relevant issues, and the Preview `release-result.json`.

The release command owns PR creation and merge; this runbook contains no
alternative procedure.

## Rollback readiness

`rollback.readiness` is captured by the default release-required Playwright
suite and its `release-result.json` check; the steps below are the fallback
when CI could not run it here, and document what the automation checks.
Before Gate 2 (authorize production):

- identify the previous production deployment and commit (the
  `rollbackReference`/`baselineTag`);
- confirm its `release-result.json` and deployment are retrievable;
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
Vercel logs/alerts, the final `release-result.json`, and `runId`. On a
rollback trigger, use `docs/runbooks/rollback.md`; do not continue the
release while investigating.
