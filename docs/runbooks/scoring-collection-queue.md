# Runbook: the v7.2 collection queue

Replaces the retired flag-only v6/v7.2 rendering runbook. There is one
current policy now (`SCORING_POLICY = "v7.2"`), no legacy render and no
selector to flip; see `docs/decisions/2026-09-23-universal-v72-no-consent.md`
for why. This runbook covers the durable evidence-collection queue instead:
reading its health, diagnosing stuck or failed jobs, and retrying them.

## What the queue is

Every signed-up subject's evidence collection runs as one or more rows in
`scoring_collection_jobs` (migration 055), one row per `(owner, provider,
reference_date)`. The `collect-evidence` cron (`/api/cron/collect-evidence`,
every 5 minutes, `maxDuration` 300s) claims leased jobs and runs one
checkpointed collector slice per job per tick. When every one of an owner's
connected providers finishes a day, fan-in (migration 056,
`scoring_issuance_attempts`) issues the receipt.

A job's `state` is one of:

| State | Meaning |
|---|---|
| `queued` | Waiting for a worker tick to claim it. |
| `running` | A worker holds the lease and is collecting. |
| `waiting_rate_limit` | The provider rate-limited the collector; it resumes automatically at the provider's own reset time. |
| `retrying` | A transient error (5xx, 429, network, GraphQL protocol/parse) is backing off across up to 8 attempts. |
| `complete` | This provider's day is fully collected (allowing partial coverage from absorbed per-item 401/403/404s). |
| `failed` | Terminal: either the identity check itself failed (401/403 on the credential, fixed by reconnecting) or retries were exhausted. |

## GitHub operation kinds

A GitHub job's checkpoint tracks these operation keys (#1351): `profile`,
`repositories`, `contributed`, `merged:<start>..<end>` (one per month of the
window, and split further on a search page over 1,000 matches), `files:<id>`,
`reviewDiscovery`, `reviews:<id>` and `commits:<repositoryId>`. GitHub issue
closures are not collected: the `issues:`/`closures:` operations, and the
`V7Issues`/`V7Closures` queries, were removed. Every `issue_work` event they
produced was inadmissible for scoring (`acceptedKind` in
`lib/impact/v7-evidence.ts` never accepts one without a `linked_issue_result`
GitHub never supplies), so this did not change the displayed score, and it
removed the largest single cost from the shared GraphQL allowance: on
2026-09-24, `closures:` operations were 203,544 of about 206,000 known
operations across unfinished jobs. A job resumed from a checkpoint written
before this change drops any remaining `issues:`/`closures:` operations the
first time it loads that checkpoint; nothing needs to be done by hand.

## Incremental daily reuse

A fresh job seeds its checkpoint from yesterday's complete observation of the
same source, staging in-window events immediately and marking their
`files:`/`reviews:` operations done when they cannot change further (#1335
phase 3). Seeding never pre-registers the seeded events' repositories (#1352):
every engine's `registerRepo` returns early for an already-known repository
id, so pre-registering one would suppress the per-repository operations
(`commits:`, `pullrequests:`, `merge_requests:`, `issues:`, `pulls:`, ...)
that discovery creates for it, and new activity there since the prior
observation would never be collected. Discovery always re-finds every
repository, because the worker always runs `owned_and_contributed` scope, and
every retained merge or review event already registers its own repository as
a side effect of processing it. If you suspect a stale seed effect
(new activity missing in an already-known repository) on a production job
enqueued before 2026-09-25, no operator action is needed: the next daily job
after that release date seeds without pre-registered repositories.

## Retry and attempt policy

Migration `058_collection_attempt_policy.sql` redefines `attempt` as
"failures since the last progress", not "failures ever" (#1351):

| Event | `attempt` |
|---|---|
| `fail` with `stopKind = rate_limited` | unchanged |
| `fail` with any other retryable stop | +1 |
| `checkpoint` whose `progress.operationsDone` is greater than the stored value | reset to 0 |
| `enqueue` `retry` on a `failed` job whose `last_stop.stopKind` is `http`, `network`, `deadline` or `budget` | reset to 0, keep checkpoint, staged events and progress |
| `enqueue` `retry` after any other stop kind, or `reconnect`/`refresh` | reset to 0 and clear, as before |

A job that only ever waits for the shared allowance can never spend its
retry budget on that alone, and a long job that makes steady progress with
an occasional 5xx in between never runs out of retries. A Retry after a
transient stop (`http`, `network`, `deadline`, `budget`) resumes from the
saved checkpoint instead of restarting the day's collection; a Retry after a
structural stop (`graphql`, `protocol`, `parse`) clears the checkpoint, since
a bad cursor should not repeat.

## Commit-history 5xx retry ladder

One repository's commit history can answer HTTP 5xx even at a page of 50,
when GitHub cannot compute line counts for one or more commits in the page
within its own gateway timeout (measured 2026-09-25,
`docs/plans/2026-09-25-v4-collection-stabilization-phases/evidence/phase-4-commits-502.md`:
juan294/paisaxe answered 502 at pages of 50 with line counts, and 200 at 20,
10, and without line counts). The GitHub engine retries a failing commits
page at 50, then 20, then 10, then at 10 without line counts, before giving
up that page as an ordinary `http` stop. After 3 separate failed ladders for
the same repository (tracked in `checkpoint.state.commitLadderFailures`),
that repository's `commits:` operation is marked done with a `source_error`
reason instead of blocking the job forever; `authored_commit` coverage for
that source reads `partial`. A success at any ladder size resets the failure
counter for that repository. To see this happening for a job, read its
checkpoint's `state.commitPageSize` and `state.commitLadderFailures` maps.

## Progress: discovering vs. percent

A job's checkpoint operation count is not fixed until discovery finishes: an
owner's `repositories`/`contributed` lists, GitHub's `merged:*` search ranges
and `reviewDiscovery`, and the equivalent per-provider discovery operations,
can still add more operations (a new `commits:`/`files:`/`reviews:` op per
item they find) while they are not yet done. `progress.discovering` (written
by the worker from the collector's own `discoveryComplete` flag) is `true`
while any such operation remains. While `discovering` is true for any
in-progress job, every owner-facing surface (`/settings`, the share page, the
badge and OG image, `/generating`) shows "discovering" with no percentage,
never a number that could later move backwards. A seeded job's very first
progress write is always `discovering: true`, since seeding never runs the
collector. A legacy progress row with no `discovering` key (written before
this field existed) reads as still discovering unless the job is `complete`.
Once every in-progress job has finished discovery, the aggregate percent
(operations done over operations known, capped at 99 until the job is
complete) can only go up, because each job's known count is fixed from that
point on.

## Reading `/api/health`'s `scoringQueue` block

```json
"scoringQueue": {
  "queued": 0,
  "running": 1,
  "retrying": 0,
  "waitingRateLimit": 0,
  "failedToday": 0,
  "oldestQueuedAgeMs": 12000,
  "expiredLeases": 0,
  "oldestExpiredLeaseAgeMs": 0,
  "collectEvidenceHeartbeat": { "lastRun": 1758000000000, "ageMs": 90000, "stale": false },
  "degraded": false
}
```

`degraded` is `true` when either of two thresholds trips (`lib/collection/queue-health.ts`,
the same numbers the worker's own `scoring_queue_stuck` alert uses, so the
two can never drift apart):

- the oldest queued job has waited more than **2 hours**, or
- a lease has been expired for more than **30 minutes** (the worker that
  held it crashed or timed out without releasing it).

`collectEvidenceHeartbeat.stale` is `true` when the cron itself has not run
in the last 15 minutes (outside the shared first-observation grace window for
a fresh deploy). This can be true even when the queue numbers above look
fine, and means the cron stopped being invoked at all, a distinct failure
from the queue being stuck.

`/api/health` reports `{ "status": "error" }` for this block instead of the
report above only when the health check's own read of the queue or the
heartbeat throws (a genuine DB error), not when the queue is merely
degraded.

## Stuck or failed jobs

**Oldest queued job is old (`oldestQueuedAgeMs` over 2h).** The cron is
running but not draining the backlog fast enough. Check the `collect-evidence`
cron's own logs for slow ticks (a provider rate limit affecting many owners
at once, or a raised `MAX_JOBS_PER_RUN` that increased contention). No manual
action moves an individual job faster; throughput is a cron-wide property.

**A lease is expired (`expiredLeases` over 0, `oldestExpiredLeaseAgeMs` over
30min).** A worker crashed or hit its own timeout while holding the lease.
No action needed: the next `collect-evidence` tick's claim query recovers any
`running` job whose `lease_expires_at` has passed and re-runs it from its
last checkpoint. If this keeps recurring for the same job, the checkpoint
itself may be wedged; read the job's row directly:

```sql
select owner_handle, provider, reference_date, state, attempt, checkpoint, last_stop
from scoring_collection_jobs
where state = 'running' and lease_expires_at < now();
```

**A job is `failed` because of a lost connection (401/403 on the identity
check).** The owner sees "reconnect" in `/settings`. Reconnecting the
platform enqueues a fresh job for it automatically (the connect callback
hook); no operator action is needed.

**A job is `failed` terminally for another reason (structural/parse error,
or retries exhausted).** This raises a `scoring_collection_failed` P2 alert
(deduped once per `owner/provider/day`) via `CHAPA_ALERT_WEBHOOK_URL`, or
email when that webhook is unset. The alert's `properties` carry `operation`,
`stopKind` and `httpStatus`, never a credential, an API body or a URL with
secrets. Read those to diagnose:

- a `parse`/`protocol` `stopKind` usually means a provider API shape changed
  and needs a code fix;
- a `structural` failure (an integrity check like `assessRawFetchIntegrity`
  rejecting the payload) needs the same investigation as any other scoring
  data-integrity rejection.

**Retrying a failed job.** The owner has a Retry action in `/settings` and on
the badge/share collecting state, which calls `POST /api/scoring/status`
with `{ "action": "retry", "provider": "<provider>" }`. This resets the
existing `failed` row back to `queued` (attempt 0, checkpoint cleared) and
runs one slice in the background immediately, rather than waiting for the
next 5-minute tick. An operator can do the same by calling that endpoint as
the owner, or by enqueuing directly:

```ts
import { enqueueCollection } from "@/lib/collection/enqueue";
await enqueueCollection(ownerHandle, "retry", provider);
```

**Issuance itself failed after collection completed** (a storage error, not
a collection error). This raises `scoring_issuance_failed`, a separate P2
alert from the job-level `scoring_collection_failed`. The job stays
`complete`; nothing needs re-enqueuing. The next `collect-evidence` tick
retries the fan-in for every complete-but-unissued day at the start of the
tick (`retryPendingFanIns`), so this self-heals without operator action once
the underlying storage issue is fixed.

**Queue backlog with no individual stuck job.** If `queued` is consistently
high but no single job trips the 2h/30min thresholds, throughput is the
constraint, not a bug. `MAX_JOBS_PER_RUN` bounds how many jobs one
`collect-evidence` tick claims; raising it trades cron run time for backlog
drain speed.

## Before assuming a fix is needed

Read the actual alert or health payload before acting: a `stopKind` of
`rate_limited` or `budget` is never a bug (the plan's invariant is that a
budget or timeout stop is never recorded as a genuine error), and a
`waiting_rate_limit` job is not "stuck", it is working as designed until the
provider's own reset time.

## Event limit per source

One source can hold at most 50,000 events (migration 057; it was 10,000). The
limit is checked when events are staged, when a job finishes and when a source
is read back. Above it, the job fails with operation `event_limit`. On
2026-09-24 one GitHub source reached 11,124 authored commits in the window.
Measured locally at 30,000 events of about 1.5 KB each: finish took 4.7 s and
read-back took 3.6 s.

## Enqueueing by hand

Prefer the app's own paths: owner refresh, admin bulk-recalculate, or the
`/api/scoring/status` retry. When an operator must call
`scoring_collection_enqueue` directly in SQL, pass a millisecond-precision
reference time, for example `date_trunc('milliseconds', now())`. A plain
`now()` has microsecond precision. The worker rebuilds the scoring window from
the stored reference time, rejects it, and fails the job at
`resolve_credential`, which raises one `scoring_collection_failed` alert per job
(2026-09-24: 23 jobs). A `retry` re-enqueue keeps the stored reference time. To
recover, delete the affected failed rows and enqueue them again.

## Related docs

[Current spec](../impact-v7.md), [the no-consent decision](../decisions/2026-09-23-universal-v72-no-consent.md),
[consumer inventory](../scoring-consumer-inventory.md) and
[the release playbook](../release/release-playbook.md).
