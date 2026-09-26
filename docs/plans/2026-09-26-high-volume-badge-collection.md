# High-volume badge collection: implementation plan

Date: 2026-09-26. Research: `docs/research/2026-09-26-high-volume-badge-collection.md`.
Planning base: `develop` at `118d315c5cd4117e405e5089483cd490073a1c47`.
Phase files: `docs/plans/2026-09-26-high-volume-badge-collection-phases/`.

## Goal and scale contract

Complete collection and issue a v7.2 receipt for an owner with **100,000 normalized events in one provider**, without a database statement timeout, oversized RPC response, or an indefinitely repeating 99% state. This is the planning scale assumption for the open-ended phrase “high-volume”; the current 50,000-per-source bound is insufficient for that target. Prove a second fixture with 100,000 events distributed across providers. Preserve event fidelity, authorization, exact score, semantic receipt identity, and existing partial-coverage rules. A 100,001st event fails visibly with an actionable `event_limit` result; it is never silently dropped.

The production observation is narrower: 17,572 staged events, a timeout in `scoring_collection_finish`, and repeated lease reclaim. The log does not identify the expensive internal operation (research, “Production observation”). Phase 1 measures that operation before changing it. A faster SQL finish alone is not a complete scale result: source reads, prior-day seed, and issuance also load whole arrays (`apps/web/lib/db/source-context.ts:44-69`, `apps/web/lib/collection/worker.ts:215-244`, `apps/web/lib/profile/score-receipt-v7.ts:62-102`, `apps/web/lib/profile/score-receipt-observed.ts:175-206`).

## Design decision

| Option | Benefit | Limit | Decision |
|---|---|---|---|
| Raise the PostgREST statement timeout | Small operational change | Leaves the full aggregate, validation, return, read, and memory shape in place; production has no inner-step timing | Reject as the fix |
| Keep one JSONB observation and optimize `finish` | Could recover the observed 17.5k case with less code | One transaction and one response/read still grow with the full source; cannot promise 100k | Use only as a measured, temporary recovery if Phase 1 shows an independently safe change; it does not satisfy this plan |
| Store immutable event rows per collection generation; publish a small observation manifest; read and score pages | Bounds each write, finish, and transport operation while retaining all evidence | Requires a migration and parity work across seed, scoring, and private digest | Chosen |

The collection generation is separate from `job_id`: same-day refresh reuses a job row and clears its staged data today (`supabase/migrations/058_collection_attempt_policy.sql:35-86`). A completed observation must continue to identify immutable events after that refresh. The new observation row points to its published generation; an abandoned generation is eligible for bounded cleanup only when no observation references it. Existing JSONB observations and the supplemental writer remain readable (`supabase/migrations/039_scoring_v7_foundation.sql:27-44`, `supabase/migrations/042_supplemental_evidence_v2.sql:82-93`).

Keep the current owner/source/link lock and service-role-only RPC boundary (`supabase/migrations/045_scoring_v7_source_context.sql:60-84,187-210,273-284`). A lease token fences checkpoint and finish; a generation ID fences rows. Validate each event as it enters storage, then validate final coverage and source/repository membership before a single atomic manifest insert plus job `complete` update. The finish response contains IDs and counts only. A failed finish leaves the job claimable and publishes no observation. The old one-row path is retained for existing observations and the small supplemental path; no production data backfill is required.

The scoring policy and public receipt schema do not change. The new paged reducer must match `aggregateEngineeringEvidence` and `deriveCoreEvidenceV7`, including cross-provider work selection, unclear attribution, quality support, and uncapped observed totals (`packages/shared/src/scoring-aggregation-v7.ts:232-310`, `apps/web/lib/impact/v7-evidence.ts:159-180`). The private semantic digest must remain byte-for-byte equal for the same canonical evidence, regardless of page boundaries or arrival order (`apps/web/lib/profile/receipt-semantic-identity.ts:3-17,29-46`). If that exact digest cannot be streamed under the measured function budget, stop at the Phase 4 gate and revise the design; do not silently publish a new identity for unchanged evidence.

## Phases

| # | Phase | Depends on | Batch |
|---|---|---|---|
| 1 | [Reproduce and budget the complete path](2026-09-26-high-volume-badge-collection-phases/phase-1.md) | none | sequential |
| 2 | [Persist and finish an immutable event generation](2026-09-26-high-volume-badge-collection-phases/phase-2.md) | 1 | sequential |
| 3 | [Page source reads and prior-day reuse](2026-09-26-high-volume-badge-collection-phases/phase-3.md) | 2 | sequential |
| 4 | [Reduce and identify large evidence without whole-source arrays](2026-09-26-high-volume-badge-collection-phases/phase-4.md) | 3 | sequential |
| 5 | [Recover, disclose, and prove 100k end to end](2026-09-26-high-volume-badge-collection-phases/phase-5.md) | 4 | sequential |

There are no `[batch-eligible]` phases: each consumes the schema, read API, reducer, or scale evidence produced by its predecessor. Do not split an implementation phase across independently released partial contracts. The `/implement` phase stop applies after each phase.

## Pseudocode notation

`+` adds, `-` removes, `~` changes, and `...` leaves surrounding code intact. Each phase file names the executable parity, contract, or fault test that fixes the intended behavior before the implementation.

## Whole-plan success criteria

### Automated

- A disposable local Supabase run applies every migration, including the new one, from zero and passes `pnpm run test:contract:local`. The real database tests prove a 100,000-event single source and a mixed-provider 100,000-event owner can stage, finish, read, score, and issue a receipt. The 100,001st event is rejected without a published observation.
- The benchmark records fixture bytes, SQL stage timings, RPC response bytes, wall times, and peak Node RSS for 17,572, 50,000, and 100,000 events. At the target, no individual database RPC reaches its configured statement timeout; the collection tick and issuance finish within their configured execution budgets, and peak RSS is at most 70% of the configured function memory. Capture those deployment budgets at Phase 1 from checked-in/runtime configuration; do not invent a larger allowance.
- Existing-array and paged implementations produce identical normalized event set, observed counts, exact/display score, tier, limitations, public receipt projection, and private semantic digest across shuffled page/order, duplicates, mirrored acceptances, unclear attribution, multiple providers, legacy JSONB rows, and a prior-day seed.
- Lease loss, retry, same-day refresh, withdrawal, link-version change, a mid-page read failure, and a finish timeout publish no partial receipt, do not mix generations, and have a verified recovery or disclosed action.
- Run `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run test:coverage`, `pnpm run check:circular`, `pnpm run test:contract:local`, and the relevant local-candidate E2E checks **sequentially**, recording every exit status. Run `supabase db reset` only against the disposable local project (`CLAUDE.md:459-470`; `.claude/rules/testing.md:25-37`).

### Manual, after a separately authorized release

- Query the production queue and Postgres logs for the previously timed-out owner/day: the job reaches `complete`, the observation ID is populated, fan-in issues a v7.2 receipt, and the public profile shows the matching receipt rather than 99% collection. Bind this check to the deployed commit and migration version; a successful HTTP response alone is insufficient.
- Inspect one production large job's stage/finish duration and owner status plus `/api/health` and alert history. There is no repeating finish timeout without an operator signal. Do not copy production user data into local qualification; `CLAUDE.md:459-470` requires synthetic local fixtures.

## Stuck states and recovery

| State | Who sees what | How it ends | Recovery or disclosure test |
|---|---|---|---|
| Finish RPC times out or storage is unavailable | Owner sees collecting with a retry time, then action needed if the bounded retry budget is exhausted; operator sees job failure count and a P2 alert | Lease-fenced retry resumes the same generation after backoff; terminal state offers owner Retry and operator diagnostic | Phase 5 fault injection: repeated finish failure leaves no observation, moves out of silent 99%, signals operator, and later succeeds without recollection |
| Worker dies after checkpoint or during finish | Owner sees collection in progress; operator sees expired lease if recovery is delayed | Next cron reclaims the lease; atomic finish is idempotent and cannot publish twice | Phases 2/5 crash-after-commit and stale-lease contracts |
| Generation reaches 100,001 events | Owner sees action needed with event-limit explanation and support path; operator gets `event_limit` alert | A later capacity change or an operator-led correction requeues a new generation; plain Retry cannot promise success at the same limit | Phase 5 limit and owner-copy test; retry at unchanged limit never claims success |
| Read page fails or observation is incomplete/corrupt | Owner retains the previous receipt as stale, or sees unavailable if none exists; operator sees read/issuance error | Automatic pending fan-in retry after storage recovers; corruption needs an operator repair with owner-visible status | Phases 3/5 page-fault and fan-in tests |
| All provider jobs complete but fan-in fails | Owner sees collecting or action needed until a receipt exists; operator sees `scoring_issuance_failed` | Existing pending fan-in sweep retries (`apps/web/lib/collection/fan-in.ts:143-154`) | Phase 5 failure then successful sweep test |
| Rate-limited provider | Owner sees rate-limit wait and resume time | Existing `next_run_at` reclaims automatically without spending retry budget | Existing worker/status tests plus Phase 5 large-job regression |
| Source grant is revoked or linked version changes | Owner sees reconnect/action needed; earlier receipt remains authoritative only under current policy | Reconnect creates a new authorized generation | Phase 2 lock/version race contract and Phase 5 owner state test |

## Consumer sweep

Commands run from repository root on the planning base (untruncated file lists):

```bash
rg -l 'readSourceObservation|appendSourceObservation|collectSources\(|finishCollectionJob|listStagedEventKeys|seedFromPrior|scoring_v7_read_source|scoring_v7_append_source|scoring_collection_finish|scoring_collection_staged_events' apps packages scripts supabase -g '!*.snap' | sort
rg -l 'canonicalizeReceiptEvidence|receiptSemanticIdentity|computeObservedImpactV7|aggregateEngineeringEvidence|deriveCoreEvidenceV7|StoredSourceObservation|readScoringStatus\(' apps packages scripts -g '!*.snap' | sort
rg -l 'event_limit|scoring_collection_failed|runCollectionTick|finishCollectionJob|ScoringStatusPanel|GeneratingProgress' apps scripts docs/runbooks -g '!*.snap' | sort
```

| Consumer or writer | Coverage |
|---|---|
| `supabase/migrations/045_scoring_v7_source_context.sql:187-235`, `055_scoring_collection_queue.sql:101-116`, `057_raise_source_event_limit.sql:134-166`, `058_collection_attempt_policy.sql:94-144`; observation foundation `039_scoring_v7_foundation.sql:27-44` | Phase 2 writes a new migration; historical migrations remain immutable. Phase 3 adds page reads. |
| `apps/web/lib/db/collection-queue.ts:187-284`, `apps/web/lib/collection/worker.ts:215-244,297-382`, `apps/web/lib/collection/seed.ts:18-63` | Phases 2 and 3: generation, checkpoint/finish, key dedup, paged seed. Phase 5: bounded failure transitions. |
| `apps/web/lib/db/source-context.ts:22-110`, `apps/web/lib/platform/source-collectors.ts:15-21`, `apps/web/lib/platform/source-coordinator.ts:83-102` | Phase 3: manifest/page API and legacy adapter; authorization before every page. |
| `apps/web/lib/profile/score-receipt-v7.ts:62-102`, `score-receipt-observed.ts:155-206`, `receipt-semantic-identity.ts:3-46`, `apps/web/lib/impact/observed-v7.ts:70-76`, `v7-evidence.ts:159-180`, `packages/shared/src/scoring-aggregation-v7.ts:232-310` | Phase 4: paged reduction and exact semantic identity parity. Existing pure scorer remains a reference oracle for smaller fixtures. |
| `apps/web/lib/collection/fan-in.ts:75-154`, `read-scoring-status.ts:39-75`, `status.ts:36-108`, owner status route, settings/share/generating screens, profile/insights/badge/OG/WebMCP readers | Phase 5: finish-failure state, alert, retry disclosure, and receipt/status consistency. Read-only public paths continue to use a published receipt or explicit status. |
| `apps/web/lib/db/collection-queue.contract.test.ts:129-174,271-303`, `source-context.contract.test.ts:27-139`, both DB unit tests, `collection/worker.test.ts`, `collection/seed.test.ts`, provider `evidence-seeded.test.ts`, `source-coordinator*.test.ts`, scoring/identity tests | Phases 1-5 update fixtures and add real-stack seam regressions. Phase 4 retains old-array parity tests. |
| `apps/web/e2e/helpers/scoring-point-fixtures.ts:113-217`, `apps/web/e2e/scoring-point-consistency.spec.ts`, `scripts/delete-user.ts:62-79`, `scripts/clone-prod-db.ts:45` | Phase 5 adapts E2E writer and deletion/export inventories to the new event table. Never leave orphaned private rows after withdrawal or deletion. |
| `supabase/migrations/042_supplemental_evidence_v2.sql:82-93`, supplemental contract tests, direct observation insert in `db/scoring-v7.contract.test.ts:97-99` | Explicitly excluded from the new collection writer; Phase 3 proves legacy JSONB reads and Phase 5 verifies withdrawal/deletion. |
| `apps/web/lib/github/client.ts:18`, historical migration files, unrelated score-policy tests | Re-export/history only; no behavioral edit. Typecheck and parity suite cover their contracts. |

## Rollout and stop conditions

Build and test on isolated implementation worktrees; merge verified phases locally into `develop` under the repository workflow. No push, production migration, release, or issue mutation is part of this planning request. The new migration must be exercised locally before any separately authorized production push (`.claude/rules/supabase.md:24-38`). A release needs the separate `develop` to `main` gate (`CLAUDE.md:387-407`).

Stop implementation and revise this plan if Phase 1 shows a materially different failure boundary, if Phase 2 cannot preserve authorization/atomicity under refresh and withdrawal, or if Phase 4 cannot preserve scoring and digest parity within the measured function budget. Do not raise the event limit before all five phases pass. No open clarification markers remain.
