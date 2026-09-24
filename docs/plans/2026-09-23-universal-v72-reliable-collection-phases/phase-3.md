# Phase 3: durable resumable collection

Parent plan: `../2026-09-23-universal-v72-reliable-collection.md`. Depends on phase 1 (stop kinds and diagnostics) and phase 2 (no consent gate on locks and appends). Not batch-eligible.

## Goal

Collection for any signed-up owner converges to a complete observation per connected provider across as many short runs as it needs. The runs survive crashes, deadlines and rate limits, and no run starts over from scratch.

## Files

| File | Change |
|---|---|
| `supabase/migrations/055_scoring_collection_queue.sql` (new) | tables `scoring_collection_jobs` and `scoring_collection_staged_events`; RPCs to enqueue, claim, checkpoint, finish and fail |
| `apps/web/lib/db/collection-queue.ts` (new, +`.contract.test.ts`) | typed wrappers, zod-validated checkpoint and progress |
| `apps/web/lib/collection/plan.ts` (new, +test) | `CollectorCheckpoint` type, operation plan model, the pure `nextBackoff(attempt)` |
| `apps/web/lib/collection/worker.ts` (new, +test) | `runCollectionSlice(job, deadline)` and `runCollectionTick(budgetMs)` |
| `apps/web/lib/github/evidence.ts` (+test) | slice API: `collectGitHubSlice(window, credential, checkpoint, budget)`; date-split merged search; rate-limit reads |
| `apps/web/lib/{bitbucket,gitlab,codeberg}/evidence.ts` (+tests) | the same slice API; `since`/date bounds on unbounded history pages |
| `apps/web/lib/platform/source-collectors.ts` (+test) | dispatch to the slice API |
| `apps/web/lib/platform/source-coordinator.ts` (+test) | becomes read-only for observations; `refresh` enqueues instead of collecting |
| `apps/web/app/api/cron/collect-evidence/route.ts` (new, +test) | cron worker, `maxDuration = 300` |
| `apps/web/vercel.json` | add `{ "path": "/api/cron/collect-evidence", "schedule": "*/5 * * * *" }` and `functions` maxDuration 300 |
| `scripts/check-vercel-config.ts` (+test) | expect the new cron |
| write-registration contract suite | register the new cron route |

## Data model (migration 055)

```sql
CREATE TYPE scoring_collection_state AS ENUM
  ('queued','running','waiting_rate_limit','retrying','complete','failed');

CREATE TABLE scoring_collection_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_handle text NOT NULL REFERENCES scoring_v7_subjects(owner_handle) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('github','bitbucket','gitlab','codeberg')),
  reference_date date NOT NULL,              -- UTC scoring day
  reference_time timestamptz NOT NULL,       -- frozen window anchor for every slice of this job
  state scoring_collection_state NOT NULL DEFAULT 'queued',
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,   -- validated by scoring_collection_valid_checkpoint()
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,     -- {operationsDone, operationsKnown, events, requests}
  attempt int NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid, lease_expires_at timestamptz,
  last_stop jsonb,                           -- SourceDiagnostic (phase 1), no URLs/bodies
  enqueue_reason text NOT NULL CHECK (enqueue_reason IN ('signup','refresh','daily','reconnect','admin','retry')),
  observation_id uuid,                       -- set by finish
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_handle, provider, reference_date)
);
CREATE INDEX ON scoring_collection_jobs (state, next_run_at);

CREATE TABLE scoring_collection_staged_events (
  job_id uuid NOT NULL REFERENCES scoring_collection_jobs(id) ON DELETE CASCADE,
  event_key text NOT NULL,                   -- engineeringEventKey (scoring-aggregation-v7.ts:68-70)
  event jsonb NOT NULL,
  PRIMARY KEY (job_id, event_key)
);
-- RLS forced, service_role only (same block as 039:299-318).
```

RPCs. Each is `SECURITY DEFINER`, granted to service_role only, and follows the campaign lease pattern (023/029-033):
- `scoring_collection_enqueue(owner, provider, reason, reference_time)`
  - Upserts on the day key.
  - A `failed` job re-enqueued with `reason in ('retry','reconnect','refresh')` resets to `queued`, `attempt=0`, `checkpoint={}` and clears its staged events.
  - A `complete` job is left alone unless the reason is `refresh`, which creates a fresh job for the same day (the checkpoint resets and the staged events clear).
- `scoring_collection_claim(p_limit, p_lease_seconds)`
  - `UPDATE ... SET state='running', lease_token=gen_random_uuid(), lease_expires_at=now()+lease WHERE id IN (SELECT id ... WHERE (state IN ('queued','waiting_rate_limit','retrying') AND next_run_at <= now()) OR (state='running' AND lease_expires_at < now()) ORDER BY next_run_at LIMIT p_limit FOR UPDATE SKIP LOCKED) RETURNING *`.
- `scoring_collection_checkpoint(job_id, lease_token, checkpoint, events jsonb[], progress)`
  - Upserts the staged events with `ON CONFLICT (job_id,event_key) DO NOTHING`. A key collision with different content raises, which mirrors the immutable-identity rule.
  - Stores the checkpoint and progress, and extends the lease.
  - Any lease mismatch is rejected.
- `scoring_collection_finish(job_id, lease_token, coverage, observation_id)`
  - Calls the existing append path (`scoring_v7_append_source`) with the staged events as the payload.
  - Sets `complete` and `observation_id`, then deletes the staged rows.
  - Runs in one transaction.
- `scoring_collection_fail(job_id, lease_token, stop jsonb, retry_at timestamptz | null)`
  - `retry_at` null → `failed`.
  - Otherwise → `retrying` or `waiting_rate_limit` (chosen by `stop.stopKind`), `attempt+1`, `next_run_at = retry_at`.

The staged event count is limited by the existing ≤10000 events rule, checked at finish. Above that the job fails with `stopKind:"protocol"`, operation `event_limit`, and raises an alert (phase 4). The count is recorded in progress so an operator can see it.

## Collector slice contract

```ts
interface CollectorCheckpoint {           // pure data, validated by zod + SQL; no URLs with tokens
  version: 1;
  operations: Array<{ key: string; cursor: string | null; done: boolean }>;  // deterministic plan
  discovered: { repositoryIds: string[]; itemIds?: Record<string, string[]> };
}
interface SliceResult {
  events: NormalizedEngineeringEvent[];   // only new events from this slice
  checkpoint: CollectorCheckpoint;        // advanced
  done: boolean;                          // every operation complete
  coverage: SourceCoverage | null;        // only when done
  stop: SourceDiagnostic | null;          // why this slice ended early
}
collectXSlice(window, credential, checkpoint, { maxRequests, deadlineAt }): Promise<SliceResult>
```

- **Operation plan.** Operation order is the existing order (research §3.1-3.4). Fan-out operations such as per-PR files, per-repo commits and per-issue closures get stable keys like `files:<prNodeId>` and `commits:<repoId>`. They are appended to `operations` as discovery reveals them.
- **Pagination cursors.** Bitbucket, GitLab and Codeberg cursors are stored as provider cursor values (page number, or the `next` path without its host), never as full URLs.
- **GitHub merged search** is split into month ranges `merged:YYYY-MM-DD..YYYY-MM-DD` across the 365-day window. A range whose `issueCount > 1000` is halved recursively until each range fits. This removes the 1000-node cap at `evidence.ts:134-137`.
- **Rate limits:**
  - GitHub adds `rateLimit { remaining resetAt cost }` to each GraphQL query.
  - Below a floor of 200 remaining, the slice stops with `stopKind:"rate_limited"` and `retryAfterSeconds` set to the reset time.
  - REST providers read `retry-after` and `x-ratelimit-*` where present.
- **Unbounded history is bounded to the window:**
  - Bitbucket commits: `q=date>=<window start>`, or, if the API refuses the filter, newest-first paging that stops at the first commit older than the window.
  - GitLab `since=`, Codeberg `since=`.
  - Tests use recorded response shapes.
- **Coverage.** When the slice is done, coverage is computed exactly as today, from the full staged event set plus the discovery results. So `status`, `reasonCodes` and `unknownPeriods` keep their current semantics. A budget or deadline stop never reaches coverage, because the job continues instead.
- **Incremental daily reuse:**
  - When a job starts on day D and the owner has a complete observation from day D-1 for the same source, the plan is seeded with the prior events that are inside the new window. Those events are immutable by identity.
  - Operations whose outputs are immutable once seen are skipped when the prior observation already covered them: files of an already-merged PR, and reviews of a PR merged more than 30 days ago.
  - Time-filterable operations only fetch since the prior `dataThrough`.
  - Seeding is a pure function `seedFromPrior(prior, window)` with its own tests.

## Worker

```ts
runCollectionTick(budgetMs = 240_000):
  deadline = now + budgetMs
  while now < deadline - 20s:
    jobs = claim(limit = 4, leaseSeconds = 120)
    if none: break
    parallel(jobs, job => runCollectionSlice(job, min(deadline, now + 60s)))

runCollectionSlice(job, deadlineAt):
  credential = resolveCredential(job.owner, job.provider)   // existing source-context + refresh path
  if credential unavailable -> fail(job, {stopKind: "not_accessible"}, retry_at=null)   // reconnect needed
  result = collectXSlice(window(job.reference_time), credential, job.checkpoint, {maxRequests: 150, deadlineAt})
  checkpoint(job, result.checkpoint, result.events, progress)
  if result.done -> finish(job, result.coverage); onJobComplete(job)        // phase 4 fan-in hook
  else if result.stop?.stopKind in {budget, deadline} -> checkpoint only; release to queued with next_run_at = now()
  else if result.stop?.stopKind == rate_limited -> fail(job, stop, retry_at = resetAt)
  else if result.stop?.stopKind in {http(5xx/429), network} -> fail(job, stop, retry_at = now + nextBackoff(attempt))   // 1m,2m,4m..64m, 8 attempts
  else -> fail(job, stop, retry_at = attempt < 3 ? now + nextBackoff(attempt) : null)  // protocol/parse: 3 tries then failed
```

- `onJobComplete` is a no-op hook in this phase. Phase 4 fills it in.
- `source-coordinator.ts` stops collecting inline. Its read path returns the latest complete observation, plus `inProgress: true` when a job for today is not complete.

## Steps (TDD order)

1. **3.1 Red (unit).** `nextBackoff` schedule and checkpoint zod schema round-trip.
2. **3.2 Red (contract, local Supabase).**
   - enqueue idempotency
   - claim with `SKIP LOCKED` across two concurrent claimers
   - recovery of an expired lease
   - lease mismatch rejection
   - staged-event conflict raising
   - finish appending exactly one observation and clearing the staged rows
   - fail/retry state transitions
   - Green: migration 055 plus `lib/db/collection-queue.ts`.
3. **3.3 Red (collector).**
   - GitHub slice run with `maxRequests: 5` repeatedly over a fixture of 1,800 merged PRs and 36 repos. It converges in N slices to the same event set as one unbounded run, with no duplicate event keys.
   - A search range with 1,200 results splits.
   - A rate-limit fixture stops with `resetAt`.
   - Green: the slice API. Then repeat for the other three providers with fixtures, including the juan294 Bitbucket single-repo shape.
4. **3.4 Red.** `seedFromPrior` keeps in-window prior events and drops out-of-window ones, and skips immutable operations. Green.
5. **3.5 Red (worker).**
   - A crash mid-slice (throw after checkpoint) is resumed by the next tick from the saved checkpoint.
   - The deadline releases the job as `queued`.
   - 5xx → `retrying` with backoff.
   - 401 → `failed` `not_accessible`.
   - Green.
6. **3.6 Cron route.** Uses `verifyCronSecret`, writes heartbeat `cron:lastrun:collect-evidence` (48 h TTL), sends `withErrorCapture`, and returns a JSON summary. Tests follow the warm-cache route test pattern.
7. **3.7** Coordinator read-only change plus tests: refresh no longer collects inline; the observation read reports `inProgress`.

## Success criteria

**Automated**
- The contract suite covers every RPC.
- The convergence test proves identical output between sliced and unbounded collection.
- `check:vercel-config` passes.
- `check:write-registration` passes.
- The global verification list passes.

**Manual**
- In the local candidate, enqueue the fixture owner and run the cron route 3-4 times by hand. Watch the job rows move through the states in the local database.
