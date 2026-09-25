# Phase 3: Retry and attempt policy (migration 058)

[batch-eligible] Depends on: none. Issue: #1351 (finding 1).
Branch: `fix/1351-attempt-policy`.

## Why

- `scoring_collection_fail` adds 1 to `attempt` on every non-terminal failure,
  including `rate_limited` (`supabase/migrations/055_scoring_collection_queue.sql:313-317`).
  The http budget (`worker.ts:423`) and the structural budget (`worker.ts:430`)
  read the same column. On 2026-09-24 at 18:45Z, jobs that only waited for the
  allowance were at attempt 1 to 4.
- Nothing resets `attempt` when a slice makes progress. A long job that sees
  one 502 per hour fails after 8, even while it advances.
- A `retry` enqueue on a failed job clears the checkpoint and staged events
  (`055:146-153`). juan294's retry would restart 2,251 operations.
- Phase 5 needs one more progress key, and `scoring_collection_valid_progress`
  (`055:48-58`) rejects extra keys.

## Rules after this phase

| Event | `attempt` |
|---|---|
| `fail` with `stopKind = rate_limited` | unchanged |
| `fail` with any other retryable stop | +1 (as today) |
| `checkpoint` whose `progress.operationsDone` is greater than the stored value | reset to 0 |
| `enqueue` `retry` on a `failed` job whose `last_stop.stopKind` is `http`, `network`, `deadline` or `budget` | reset to 0, keep checkpoint, staged events and progress |
| `enqueue` `retry` after any other stop kind, or `reconnect`/`refresh` | reset to 0 and clear, as today |

`attempt` then means "failures since the last progress". The owner copy
"(attempt {attempt})" (`en.ts:478`) stays correct.

## Step 1: failing contract tests

In `apps/web/lib/db/collection-queue.contract.test.ts` (local Supabase):

- "fail with rate_limited keeps attempt"
- "fail with http increments attempt" (keeps today's behavior)
- "checkpoint with more done operations resets attempt"
- "checkpoint with the same done count keeps attempt"
- "retry after http failure keeps checkpoint": checkpoint, staged events and
  progress survive; state `queued`; attempt 0.
- "retry after protocol failure clears checkpoint" (today's behavior)
- "progress accepts an optional boolean discovering key"; "progress rejects a
  non-boolean discovering"; "progress still rejects unknown keys".

In `apps/web/lib/collection/worker.test.ts`:

- "rate-limited stops never make a job terminal": a fake queue that applies
  the new rules; 20 rate-limited slices in a row; the job is never `failed`.

## Step 2: migration

New file `supabase/migrations/058_collection_attempt_policy.sql`. Pattern:
`CREATE OR REPLACE FUNCTION` with the same signatures, so existing grants
stay. Copy the current bodies from 055 (enqueue, fail) and 057 (checkpoint,
which 057 re-created) and change only:

```sql
-- scoring_collection_valid_progress
+ allow optional key 'discovering' whose jsonb_typeof is 'boolean'

-- scoring_collection_fail
~ attempt = CASE WHEN p_stop->>'stopKind' = 'rate_limited' THEN attempt ELSE attempt + 1 END

-- scoring_collection_checkpoint
+ attempt = CASE WHEN COALESCE((p_progress->>'operationsDone')::int, 0)
+                   > COALESCE((progress->>'operationsDone')::int, 0)
+              THEN 0 ELSE attempt END

-- scoring_collection_enqueue, failed branch
+ IF existing.state = 'failed' AND p_reason = 'retry'
+    AND existing.last_stop->>'stopKind' IN ('http','network','deadline','budget') THEN
+   UPDATE ... SET state='queued', attempt=0, next_run_at=now(), lease_token=NULL,
+     lease_expires_at=NULL, last_stop=NULL, enqueue_reason=p_reason, updated_at=now()
+   -- checkpoint, progress, staged events kept
+   RETURN result;
+ END IF;
  (existing clearing branch unchanged for the other cases)
```

If `scoring_collection_valid_progress` is used by a CHECK constraint, replace
the function in place (same signature) so the constraint picks it up. Confirm
this against 055 before writing.

Apply locally only: `supabase db reset` on the disposable local stack. Never
point at production.

## Step 3: worker and TypeScript

- `apps/web/lib/collection/worker.ts`: no rule change is needed for
  rate-limited stops (the SQL owns `attempt`). Update the comments at the
  http and structural branches to say "failures since last progress".
- `apps/web/lib/collection/backoff.ts`: update the `MAX_COLLECTION_ATTEMPTS`
  comment (rate limits no longer count).
- `apps/web/lib/db/collection-queue.ts`: no change. The SQL accepts the
  `discovering` key from this phase on; phase 5 adds it to the zod schema and
  starts writing it.
- `apps/web/app/api/scoring/status/route.ts`: update the doc comment near
  line 56 to say that a retry after a transient failure resumes.

## Step 4: renumber the held contract migration

On branch `hold/1335-contract-migration` (local only, never pushed without
authorization):

```bash
git switch hold/1335-contract-migration
git mv supabase/migrations/058_contract_v6_and_consent.sql supabase/migrations/059_contract_v6_and_consent.sql
git commit -m "chore(db): renumber held contract migration to 059 (Refs #1351)"
git switch develop
```

The hold branch lives in the main repository checkout, not in this phase's
worktree. Do this step from the main checkout after the phase's merge.

On `develop`, fix the stale references to the held file:
- `docs/decisions/2026-09-23-universal-v72-no-consent.md:145` (`057_contract_v6_and_consent.sql` to `059_...`)
- `docs/plans/2026-09-23-universal-v72-reliable-collection.md:75` (`058_...` to `059_...`)
- `docs/plans/2026-09-23-universal-v72-reliable-collection-notes.md:64` (`057_...` to `059_...`)
- Memory `project_v72_flag_needs_consent.md` if it names the file number.

## Step 5: documentation

Runbook and CHANGELOG text: written in phase 5 ("Documentation for phases 1
to 4"). Step 4's ADR and plan reference fixes stay in this phase; no other
batch phase edits those files.

## Success criteria

### Automated
- `pnpm run test:contract:local` (after `supabase db reset`)
- `pnpm vitest run apps/web/lib/collection apps/web/lib/db apps/web/app/api/scoring`
- `pnpm run typecheck && pnpm run lint`

### Manual
- None before release. Migration 058 reaches production only with the
  authorized release.
