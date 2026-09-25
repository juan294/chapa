# Notes: `2026-09-25-v4-collection-stabilization`

## Deviations

### Phase 1
- **Plan said:** edit only the GitHub collector, its queries and tests, one impact test, one e2e helper comment and two docs.
  **Found:** `lib/bitbucket/evidence-reconciliation.test.ts` asserted that GitHub `issue_work` coverage is not `unavailable`, and it and `lib/codeberg/evidence-reconciliation.test.ts` still carried `V7Issues` handlers.
  **Chose:** flip that assertion to `unavailable` and remove the dead handlers.
  **Why:** direct consequence of the planned behavior change; the full suite is a success criterion.
- **Plan said:** build the equivalence fixture with the existing `lib/impact` test helpers.
  **Found:** those helpers are private to `v7-evidence.test.ts`.
  **Chose:** local builders in the new test.
  **Why:** exporting them would widen the phase for no behavior gain.

### Phase 2
- **Plan said:** the seed checkpoint in `worker.test.ts:325-326` is an input fixture for a mocked seed; leave it.
  **Found:** `worker.ts` calls the real `seedFromPrior`; that literal is the expected output.
  **Chose:** update the literal (`repositoryIds: []`, no `state`).
  **Why:** the test asserts the changed function's output.

### Phase 3
- **Plan said:** add "retry after protocol failure clears checkpoint".
  **Found:** an existing contract test already covered that path.
  **Chose:** rename the existing test instead of adding a duplicate.
  **Why:** same assertions, no duplicate code.
- **Plan said:** the worker needs no change for the retry rule (the SQL owns `attempt`).
  **Found (review):** the worker decided the retry budget from the claim-time `attempt`, but the same slice's checkpoint can reset it in the database. A job that made progress and then failed in the same slice could be ended at the budget edge.
  **Chose:** the worker uses 0 when this slice advanced `operationsDone` past the stored value (`worker.ts`, tests "a stop after progress in the same slice").
  **Why:** makes the stuck-state row "only 8 failures in a row with no progress end it" true.
- **Considered and skipped:** returning `attempt` from the checkpoint RPC so the rule lives only in SQL. It changes the RPC result and every worker test's checkpoint mock to replace one tested line.
- The held-migration renumber to 059 was done by the orchestrator on `hold/1335-contract-migration` (local commit, not pushed). The old plan's `phase-5.md:114` also named the held file and was updated.

### Phase 4
- **Plan said:** measure first. **Found:** measured 2026-09-25 (evidence file). A 50-commit page with line counts times out (502 after about 10.7 s); a page of 10 at offset 1079 still fails with line counts and passes without. The ladder order in the plan was confirmed.
- **Plan said:** `retryOnServerError` returning `Response | null`.
  **Chose:** `onServerError` returning `recovered` / `absorbed` / `stop`, and `runPagedList` `variables` may be a function so later pages use the reduced size.
  **Why:** three outcomes need three states; a fixed variables object cannot follow the reduced size.
- **Added (simplify/review):** after a failed ladder the next slice starts at the smallest size, and a finished `commits:` operation clears its stored size. Both avoid repeating a known 10-second 502.

### Phase 5
- **Plan said:** expanding lists include `profile` (all engines) and GitLab `projects:*`, `emails`.
  **Found:** `profile` and `emails` never add operations; GitLab and Codeberg use exact keys (`projects:owned`, `projects:contributed`, `repos:own`, `repos:user`); Bitbucket `activity:` and Codeberg `refs:` do add operations and were missing from the plan.
  **Chose:** lists from the real call sites, proven by each engine's contract test.
  **Why:** a missing expanding key would let the percentage go backwards.
- **Plan said:** the generating page shows "the discovering copy".
  **Chose:** a null percent omits the `— N%` suffix and keeps the existing step label.
  **Why:** the plan lists no third i18n key for that compact label.
- **Plan said:** add null cases to the refresh, recalculate, generate, BadgeToolbar and status contract tests.
  **Chose:** one null case in `lib/profile/post-write-score.test.ts`, which all three write routes call, plus the renderer tests.
  **Why:** those routes pass the status through without reading `percent`.
- **Plan said:** the "percent never decreases" test feeds rows from the GitHub engine fixture.
  **Chose:** a hand-built sequence in `status.test.ts`; the invariant it depends on is proven per engine by "operationsKnown never grows after discoveryComplete".

### Simplify pass
- Skipped: moving the ladder out of `runPagedList` (the absorb outcome is list-level), a data migration for legacy `issues:`/`closures:` keys (old code runs between migration and deploy and could write them again; the load-time filter is dated instead), a per-operation `expanding` flag (changes the strict checkpoint schema in SQL), a shared event fixture across seven test files (outside this diff), adaptive link-crawl sampling (the plan chose best of 3).
