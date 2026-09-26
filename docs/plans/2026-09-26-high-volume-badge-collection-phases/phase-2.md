# Phase 2: Persist and finish an immutable event generation

Depends on: Phase 1. Batch: sequential. Create the next migration with `supabase migration new` after checking the live migration list; `060_allow_large_changed_file_lists.sql` is the latest file on the planning base.

## Red tests first

Extend `apps/web/lib/db/collection-queue.contract.test.ts` and `source-context.contract.test.ts` with real local Postgres cases for: 50,000 staged rows in bounded checkpoint calls under the current cap, with each call below the 8-second role timeout and no partial batch on failure; a finish response with IDs/counts only; finish without database backend termination or client disconnect at 50,000; a timed-out/raised finish publishing neither an observation nor a complete job; exact one-observation idempotency; stale lease; same-day refresh creating a new generation while an earlier observation's rows remain readable; linked-source version change/withdrawal; conflicting duplicate event key; and 50,001 events returning `event_limit`. Run targeted tests red before migration implementation. The existing atomicity and retry cases at `collection-queue.contract.test.ts:129-149,271-292` remain reference contracts. Phase 5 raises the cap after reads and issuance are ready.

## Migration and writer

```sql
+ scoring_collection_generations(id, owner_handle, job_id, created_at, ...)
+ scoring_collection_generation_events(generation_id, event_key, event, repository_id, ...)
+ scoring_v7_source_observations.event_generation_id NULL
~ scoring_collection_jobs gains current_generation_id

checkpoint_v2(job, lease, checkpoint, events, progress):
  lock and validate current job/lease/generation
  validate each event's structure, canonical time, job provider, and key
  reject same key with different JSON content
  insert only new rows into current generation
  update checkpoint/progress and return small count/status

finish_v2(job, lease, coverage, context, observationId):
  lock job and source/link authorization
  verify complete coverage, source identity, repository membership,
    exact generation count <= 100_000, and no invalid row
  insert immutable observation metadata pointing to current generation
  update job complete and observation_id in the same transaction
  return { status, observationId, eventCount } // no events JSON
```

Extract the existing event checks from `scoring_v7_validate_source_value` into an event validator called at checkpoint; preserve the final coverage/scope checks at finish (`supabase/migrations/057_raise_source_event_limit.sql:9-85`). Use typed repository/source columns for set checks rather than repeated JSON-array containment per event. No full `jsonb_agg`, per-event validation loop, 100k-row copy, or staging deletion may run in the finish transaction. The observation metadata row remains immutable, and its generation rows become immutable on publication. A new generation is allocated on reset; a transient retry retains its generation, matching migration 058's attempt policy (`supabase/migrations/058_collection_attempt_policy.sql:35-86,94-144`).

Keep the existing RPCs callable for old workers during migration/deploy. New app code calls versioned RPCs after the schema is present. A newly claimed legacy job imports its prior staged rows into its generation once, under the lease, checks key/count parity, then uses the new path. Test an in-flight 17,572-row job created before migration. Do not silently discard those staged bodies or recrawl the provider. Legacy observations retain their JSONB `payload`; new rows have an explicit storage mode and a small payload marker. Change the legacy read RPC to reject a selected row-mode observation rather than return the marker as an empty complete source; old app instances then fail closed during overlap.

Enable and force RLS on both new tables, revoke browser-role access, grant only the required service-role operations, restrict all security-definer RPCs, and keep a fixed `search_path` (`supabase/migrations/039_scoring_v7_foundation.sql:299-315`, `045_scoring_v7_source_context.sql:273-284`). Foreign keys and withdrawal must cascade to event rows. An unreferenced generation may be pruned only by a bounded cleanup with a direct contract test; never prune a generation referenced by an observation. Test migration from zero and from a local fixture with old staged jobs.

## Success criteria

### Automated

- Local migration reset plus contract suite passes; every bounded checkpoint call stays under the configured statement timeout, 50k staged events finish under that timeout with a small response, and the local database backend stays available throughout. Record database health and backend logs around the run; no partial publication occurs on any injected failure. Phase 5 re-runs the contract at 100k after lifting the cap.
- New and old workers can overlap safely across the migration boundary; lease and generation fences reject stale writes. A refresh cannot change any completed observation's event set.
- Grants, RLS, withdrawal, and user deletion leave no unauthorized read or orphaned private generation rows.
- Run targeted DB contracts, `pnpm run typecheck`, `pnpm run lint`, then `pnpm run test:contract:local` sequentially.

### Manual

- None before a separately authorized release.
