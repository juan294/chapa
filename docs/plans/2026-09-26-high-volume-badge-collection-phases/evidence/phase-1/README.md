# Phase 1 local baseline

Candidate source: base `26648ab9d48fa483cee2f6a05b5d12bb261d2dbd` plus the exact Phase 1 harness commit `4fe38fd8c02978977714aac50b395cbb1f34c751` (`test(scoring): reproduce high-volume collection boundaries`). This evidence README was then updated only to bind that commit identity; its benchmark code and fixture are unchanged. Latest applied local migration: `060_allow_large_changed_file_lists.sql`. Synthetic seed: 294. All cases use generated identities against the disposable `chapa-volume-20260926` local Supabase stack on loopback ports 55431/55432. No production row or credential is in these artifacts.

The fixture uses seven authored commits, two accepted changes, and one review per ten events. Accepted changes have 12–16 changed-file paths; events span 24 generated repositories. The 17,572-event case is 29,609,485 bytes of JSON, 1,118,478 bytes gzipped, and has SHA-256 `5663d9075856070cc47dee877c11b397eb86a81386b364894121adf84cbaff18`. This is about 1,685 bytes per event. The production event-kind and file-list distribution was not measured, so shape equivalence is unverified.

| Events requested | Rows staged | Measured boundary | Checkpoint wall time | Finish wall time | Peak test-process RSS |
| ---: | ---: | --- | ---: | ---: | ---: |
| 100 | 100 | Complete, with real receipt issuance | 50 ms | 22 ms | 168 MB |
| 17,572 (loaded stack) | 17,572 | Finish statement timeout (HTTP 500) | 6,611 ms | 12,387 ms | 279 MB |
| 17,572 (lean stack) | 17,572 | Complete, with real receipt issuance | 2,099 ms | 2,571 ms | 1,019 MB |
| 50,000 (loaded stack) | 18,000 | Checkpoint statement timeout on next 2,000-row batch | Not recorded by initial harness | Not reached | 549 MB |
| 50,000 (lean stack) | 50,000 | Database backend killed during finish; HTTP 503 | 5,657 ms | 10,706 ms | 575 MB |
| 100,000 (lean stack) | 52,000 | Existing `event_limit` | 6,162 ms | Not reached | 877 MB |

The 100-event finish RPC returned 178,670 bytes, approximately the full event payload; the real receipt issuance returned `issued` in 159 ms. In the loaded stack, the 17,572-event finish returned a 100-byte error response stating `canceling statement due to statement timeout`; no observation was published. On the lean stack, the same deterministic fixture completed; its finish returned **31,417,271 bytes**, the source read returned about 29.6 MB of parsed JSON, and actual receipt issuance took 6,916 ms. These two runs show load sensitivity, not a fixed 17,572-row cutoff. The latest `count-17572.json` describes the lean-stack run; the first-run timings are retained in this table. See the per-count JSON files for exact latest times, byte counts, and fixture checksums.

Isolated rollback SQL profile at 17,572 rows on the loaded stack: `count` 4.04 ms, ordered `jsonb_agg` 379.082 ms, source-value validation 5,960.351 ms, direct observation insert 343.142 ms, staged deletion 64.545 ms. The saved lean-stack rerun measured source-value validation at 1,514 ms; the other stages and modeled checkpoint steps are in `count-17572-sql-profile.json`. These operations run in separate rollback transactions and **are not additive shares** of the full finish RPC. The 18,000-row loaded-stack profile timed out during source-value validation at the 8-second limit. Its modeled checkpoint steps were much faster in isolation, and the lean 50,000-event run staged all rows; the earlier checkpoint timeout was load sensitive.

The lean 50,000-event finish received HTTP 503 with `Database client error. Retrying the connection.` The [local PostgreSQL log excerpt](count-50000-db-log-redacted.txt) at 2026-09-26 11:15:50 UTC says the backend running `scoring_collection_finish` was terminated by signal 9 and the database recovered. The saved `DETAIL` has SQL parameter placeholders, no request values. Neither the excerpt nor the response identifies who sent the signal or proves an out-of-memory cause. This is a separate observed failure from the 8-second statement timeout.

The saved SQL profiles belong to earlier failed jobs: `count-17572-sql-profile.json` names job `df7a18b8-ee64-463f-98f2-659f38dc0bd0`, and `count-50000-sql-profile.json` names job `d7e3b04a-cb5f-4bfe-b53f-ecce5ab6b4c7` with 18,000 staged rows. Their matching `*-sql-profile-metadata.json` files preserve the inputs. The latest per-count benchmark metadata names later jobs, which replaced these after fixture cleanup; those old jobs are no longer available for a live rerun.

Configured budgets: PostgREST `authenticator` role statement timeout 8 seconds (queried in the local parity stack); cron route `maxDuration` 300 seconds and tick budget 270 seconds; worker lease 120 seconds and slice time budget 60 seconds. Vercel project API inspection reported 2 GiB/1 vCPU for the standard fluid function default, but the exact deployed function allocation was not exercised by this local benchmark. The RSS figure is for the benchmark Node process and is **not** a measurement of the deployed function. `sourceReadParsedBytes` is the reserialized parsed object, not HTTP wire bytes; `priorSeed` is an in-process transform, not a restaging RPC. The complete 100,000-event path and its memory threshold remain unmeasured.

Commands used (from the task worktree):

```text
supabase start
SCORING_BENCHMARK_COUNTS=100 pnpm run test:contract:local apps/web/lib/db/collection-benchmark.contract.test.ts
SCORING_BENCHMARK_COUNTS=17572 pnpm exec tsx scripts/benchmark-scoring-collection.ts
SCORING_BENCHMARK_COUNTS=50000 pnpm exec tsx scripts/benchmark-scoring-collection.ts
supabase stop --project-id chapa-volume-20260926
supabase start --exclude logflare,vector,studio,postgres-meta,edge-runtime,realtime,storage-api,mailpit --ignore-health-check
SCORING_BENCHMARK_COUNTS=50000,100000 pnpm exec tsx scripts/benchmark-scoring-collection.ts
SCORING_BENCHMARK_COUNTS=17572 pnpm exec tsx scripts/benchmark-scoring-collection.ts
pnpm exec tsx scripts/profile-scoring-collection-sql.ts --metadata <absolute-count-17572-profile-json>
pnpm exec tsx scripts/profile-scoring-collection-sql.ts --metadata <absolute-count-50000-profile-json> --output <absolute-count-50000-sql-profile-json>
```

The first 50,000-event test exited 1 because the harness did not yet classify the checkpoint timeout. The harness now records it as an observed baseline outcome. A later Docker VM slowdown caused the local health check to fail intermittently. A project-scoped `supabase stop` without `--no-backup` preserved the disposable database; the first full restart failed during optional service startup, then a reduced local stack started successfully. Other local projects were not targeted.

Phase 1 baseline evidence has been independently reviewed, and the phase and Phase 2 gates were revised for the checkpoint timeout and 50,000-event backend kill. The pre-commit gate on `4fe38fd8` passed typecheck, lint, and 9,307 unit tests across 630 files. The 100,000-event case records the current limit, not a successful end-to-end path. The complete path and deployed memory budget remain Phase 5 gates.
