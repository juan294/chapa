# High-volume badge collection implementation notes

Implementation branch: `fix/high-volume-badge-collection`, based on `26648ab9d48fa483cee2f6a05b5d12bb261d2dbd`.

## Deviations

### Phase 1: checkpoint fails before the old 50,000-event cap

- **Plan said:** The current 50,000-event path would stage all rows, and the 100,000-event fixture would demonstrate the existing `event_limit` boundary.
- **Found:** A synthetic 17,572-event job staged successfully but `scoring_collection_finish` reached the configured 8-second statement timeout on the loaded local stack. A separate 50,000-event job timed out during a 2,000-event checkpoint after 18,000 rows were staged. On a lean local stack, 17,572 events completed and issued a receipt, while 50,000 events staged but the database backend running finish was killed by signal 9 (HTTP 503). The 100,000-event case reached the old `event_limit` after staging 52,000 rows. The checkpoint SQL scans the growing staged set to count it after each insert.
- **Chose:** Treat bounded checkpoint latency and failure atomicity as explicit Phase 2 acceptance gates. Keep the old cap until every read, scoring, and recovery gate passes. Record the 100,000-event baseline as the earliest actual boundary, which may be the checkpoint timeout rather than `event_limit`.
- **Why:** Raising the cap or changing finish alone cannot complete a larger account reliably if later checkpoints or the single large finish overload the database. The loaded and lean results show latency is not determined by event count alone.

### Phase 1: timing interpretation

- **Plan said:** Attribute a share of the finish time to each SQL step.
- **Found:** Separate local rollback profiles measure stand-alone operations but do not add to the duration of the single `scoring_collection_finish` transaction. On the loaded stack, the 17,572-event profile measured count 4.04 ms, ordered aggregation 379.082 ms, source validation 5,960.351 ms, observation insert 343.142 ms, and staged deletion 64.545 ms. Source validation fell to 1,514 ms on the lean stack. The full finish timed out on the loaded stack but succeeded in 2,571 ms on the lean stack.
- **Chose:** Report those as isolated stage measurements, not percentages of the production statement. Profile checkpoint operations separately as the newly observed boundary.
- **Why:** Setup, PL/pgSQL call overhead, source authorization, locks, and returning the full payload are outside those isolated measurements.

### Phase 1: backend termination at 50,000 events

- **Plan said:** The existing 50,000-event bound would be measured as a finish/read baseline, and Phase 2 would remove the aggregate/copy/delete work from finish.
- **Found:** The lean-stack 50,000-event finish returned HTTP 503 after 10,706 ms. The local PostgreSQL log records the finish backend terminated by signal 9, followed by database recovery. The log does not identify the signal sender or prove an out-of-memory cause.
- **Chose:** Treat database process survival, not just statement latency, as a Phase 2 acceptance condition. Do not rerun the old 50,000-event finish solely to force it through. Continue with immutable event rows and small finish metadata, since that design removes the large in-transaction aggregate, validation loop, JSONB copy, delete, and response.
- **Why:** A timeout-only fix would leave the database process failure and the 31 MB response observed even at 17,572 events.

## Phase 1 handoff

- **Scope and candidate:** Local benchmark and plan revision only, on `fix/high-volume-badge-collection` in `/Users/juan/code/chapa-high-volume-badge`, based on `26648ab9d48fa483cee2f6a05b5d12bb261d2dbd`. The exact Phase 1 code commit is recorded in the evidence README after integration. The temporary `supabase/config.toml` port/project change remains uncommitted for disposable local tests. No production migration, push, or release is authorized by this phase.
- **Evidence:** `evidence/phase-1/README.md` and adjacent per-count JSON/SQL/log files. The fixture is synthetic and checksum-pinned. A 100-event case issues a real receipt. A loaded local 17,572-event case timed out at finish; the same fixture completed under lighter load with a 31.4 MB finish response and issued receipt. A 50,000-event finish caused a backend signal-9 termination after staging succeeded; cause is unproven. The old cap stopped the 100,000-request case after 52,000 staged rows.
- **Independent review:** First review found missing actual issuance, missing checkpoint profile, and benchmark job reclaim risk; all were repaired. Second review found the new failure boundary, historical profile provenance, unpinned fixture identity, and incomplete log support; the plan gates were revised, matching profile metadata and a parameter-only log excerpt were saved, and the checksum was pinned. Final narrow review approved the code/evidence subject to binding the exact harness commit SHA. The remaining deployed-function memory and complete 100,000-event path are Phase 5 acceptance gates, not claimed Phase 1 passes.
- **Simplify pass:** Reuse review found no useful shared abstraction for the task-only runner. Quality review added a 30-second CLI status bound and pinned the fixture checksum. Efficiency review considered replacing three small fixture-kind scans and map-based uniqueness checks with one pass, then rejected that nonessential edit because it would alter the measured harness after the large baseline. The code preserves the existing benchmark semantics. The status bound was smoke-tested after the change.
- **Checks:** Fixture Vitest 2/2 passed; targeted 100-event real-stack contract passed after final harness change; 17,572 real-stack contract passed on the lean stack; 50,000 and 100,000 baseline contracts both completed and recorded their failure/limit outcomes; scripts TypeScript, `pnpm run typecheck`, and `pnpm run lint` exited 0. Full repository contract/coverage/build gates are reserved for the implementation candidate after schema and app changes; they are not Phase 1 evidence.
- **Next gate:** Phase 2 begins only after Phase 1 commit identity is bound in the evidence README. Its red real-database contracts must cover bounded checkpoint calls, a small finish response, no backend termination, atomic failure, old in-flight job import, lease and generation fencing, RLS, and withdrawal. Keep the 50,000 cap until all five phases pass.
