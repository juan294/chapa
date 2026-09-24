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
