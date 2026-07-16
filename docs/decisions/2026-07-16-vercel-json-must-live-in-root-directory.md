# vercel.json must live in the Vercel Root Directory (apps/web)

- **Date**: 2026-07-16
- **Status**: Accepted
- **Issue**: #1052
- **Supersedes**: nothing. Corrects a latent misconfiguration present since the project was created.

## Context

The Vercel project `chapa` has its **Root Directory** setting pointed at `apps/web`
(Settings → General → Root Directory). Vercel resolves `vercel.json` relative to that
Root Directory, not to the repository root.

`vercel.json` lived at the **repository root**. It was therefore never read — for the
entire life of the project.

Nothing failed. There is no error, warning, or log line for configuration that is simply
never loaded. The file looked correct in review, was version-controlled, and was edited
several times by people who believed it was live.

### What was actually broken

All four cron jobs were never registered and never ran once:

| cron | intended schedule | actual |
|---|---|---|
| `warm-cache` | `0 * * * *` (hourly) | never ran |
| `sync-audience` | `30 3 * * *` | never ran |
| `process-campaigns` | `0 8 * * *` | never ran |
| `latency-check` | `15 6 * * *` | never ran |

Confirmed two ways: `/api/health` reported `lastRun: null` for all four despite a 48h
heartbeat TTL and an hourly schedule; and Vercel's dashboard (Settings → Cron Jobs)
displayed the "Get Started with Cron Jobs" onboarding screen, which only renders for a
project with **zero** registered crons. The feature toggle was Enabled and the team is on
Pro, so neither plan nor feature gating was involved.

The `functions` block was ignored on the same grounds, including the `maxDuration: 300`
that #942 documented as a Pro requirement.

### Downstream damage

1. **#1045's cache poisoning survived three days.** `warm-cache` is what re-fetches stats
   with the server `GITHUB_TOKEN`, which holds `repo` scope and can see private merges.
   With it dead, the badge cache was only ever populated by whichever request arrived
   first after a TTL expiry — so a single scope-blinded write simply sat there. The
   self-healing mechanism the caching design depends on did not exist in production.
2. **The #974/#1018 badge latency SLO monitor never ran.** Its synthetic check, heartbeat,
   and P2 breach alert were dead code in production from the day they shipped.
3. **Silent no-op commits.** `b24d9033` ("bump warm-cache cron from daily to hourly to
   shrink staleness gap") changed nothing. So did the cron portions of `ba66bea1`,
   `c9ca16a8`, and `699cc9bc`.
4. Campaign processing and audience sync never ran on schedule.

### Why monitoring did not catch it

`/api/health` did monitor the heartbeats (#1018), but excused a `null` via a grace window
measured from `PROCESS_STARTED_AT` — a module-load timestamp. On serverless every cold
start reloads the module, so that window could never elapse and the null branch reported
`stale: false` permanently. The one state that mattered was the one state it could not
report. #1047 corrected the reporting, which is what surfaced this.

## Decision

1. **`vercel.json` moves to `apps/web/vercel.json`** — inside the deployed Root Directory.
   Paths within it are already relative to `apps/web` (`app/api/cron/.../route.ts`), so
   its contents are unchanged.
2. **A CI gate (`pnpm run check:vercel-config`) asserts the invariant.** It fails when the
   config is missing from the Root Directory, when a stray copy exists at the repo root
   (a decoy reads as authoritative while having no effect), when a `crons[].path` maps to
   no route file, or when a `functions` key matches no file. `VERCEL_ROOT_DIRECTORY` is
   pinned in the script and asserted by test, so a dashboard change cannot drift away from
   the file layout unnoticed.
3. **The missing-heartbeat grace is re-introduced, anchored durably.** A freshly-registered
   daily cron legitimately has no heartbeat for ~24h, and degrading then would report a fix
   as an outage. The anchor (`cron:health:first-seen`) lives in Redis, which survives cold
   starts and deploys, so unlike the `PROCESS_STARTED_AT` version the window genuinely
   expires and the check can still fail.

### Alternative considered: move the Root Directory to the repo root

Rejected. It would fix the config resolution but change the build root for the whole
project — install, build command, output directory, and every framework-detection default
— to fix a file-location bug. Far larger blast radius than moving one file.

## Consequences

- Registering the crons requires a production deploy; they will not exist until `main`
  deploys. Verify afterwards in Settings → Cron Jobs and via `/api/health`.
- `warm-cache` running hourly will now do what the caching design always assumed: refresh
  stats with a `repo`-scoped server token, which independently repairs the class of
  scope-blinded cache writes described in #1045 and #1050.
- The `functions.maxDuration` settings take effect for the first time. Cron routes that
  previously would have run at the default limit now get their intended budget — this is
  the first time that code path has ever executed on a schedule, so watch the first runs.
- The grace window means a genuine cron outage is now reported at most ~26h after the
  anchor is set, rather than immediately. This is the honest trade: within one cron cycle
  of a fresh deploy, "has not run yet" and "is broken" are genuinely indistinguishable.

## Lesson

Configuration that is never read fails silently and looks correct forever. Guards that
assert *behavior* cannot catch it — only a guard that asserts *location* can. The general
form: when a file's effect depends on where it sits relative to a setting stored in
another system, pin that setting in the repo and test the relationship.
