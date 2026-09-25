# v4 collection stabilization: implementation plan

Date: 2026-09-25. Issue: #1351 (Refs #1335). Also fixes #1342 and #1352.
Research: `docs/research/2026-09-24-v4-collection-stabilization.md`.
Phase files: `docs/plans/2026-09-25-v4-collection-stabilization-phases/`.

## Goal

Make durable evidence collection finish for every registered owner within the
shared GitHub allowance, recover by itself from transient provider failures,
and report progress that never moves backwards. Make the two unstable
end-to-end checks deterministic. No new CI, release or approval gate.

## Decisions (made with the owner, 2026-09-25)

| Topic | Decision |
|---|---|
| GitHub issue closures | Remove the `issues:` and `closures:` operations. A test must first prove that the displayed score and the core scoring inputs do not change. |
| Server `GITHUB_TOKEN` (#1346) | Keep the shared token. Record it in `docs/accepted-risks.md` and close #1346 with a reference to that entry. |
| Retry budget | New migration `058_collection_attempt_policy.sql`. The held contract migration on `hold/1335-contract-migration` is renumbered to `059`. |
| Persistent commit-history 5xx | After the full retry ladder fails in 3 separate slices, absorb that repository's `commits:` operation as partial coverage (`source_error`) so the receipt still issues. |
| Progress | While any job can still add operations, show "discovering" with no percentage. Show a percentage only after that, so it can only go up. |

## Evidence status

- VERIFIED (code read, this session): the GitHub `issue_work` events never
  carry `linked_issue_result` acceptance (`apps/web/lib/github/evidence.ts:456-463`),
  so `acceptedKind` rejects them (`apps/web/lib/impact/v7-evidence.ts:89-95`).
  The worker always runs `owned_and_contributed` discovery
  (`apps/web/lib/collection/worker.ts:37`).
- INFERRED: removing the events leaves the displayed score and
  `CoreScoringInputs` unchanged. Phase 1 proves it with a test before any code
  is removed. If the test shows a difference, STOP and report.
- VERIFIED (code read): the seed bug (#1352) and the N/N seed progress write
  (`apps/web/lib/collection/seed.ts:43,61`, `worker.ts:309-315`). Not yet
  reproduced at runtime; phase 2 reproduces it with a failing test.
- INFERRED (agent reading, not reproduced): the share-page flake is a click on
  the new document before hydration. Phase 6 makes the test independent of
  that timing, whatever the cause.
- UNKNOWN: why `commits:R_kgDORAaltg` answers 502. Phase 4 measures before it
  changes code.

## Phases

| # | Phase | Batch | Depends on | Issue |
|---|---|---|---|---|
| 1 | [Remove the GitHub issue-closure scan](2026-09-25-v4-collection-stabilization-phases/phase-1.md) | [batch-eligible] | none | #1351 findings 2, 3 |
| 2 | [Seeded jobs keep per-repository operations](2026-09-25-v4-collection-stabilization-phases/phase-2.md) | [batch-eligible] | none | #1352 |
| 3 | [Retry and attempt policy (migration 058)](2026-09-25-v4-collection-stabilization-phases/phase-3.md) | [batch-eligible] | none | #1351 finding 1 |
| 4 | [Commit-history 5xx retry ladder](2026-09-25-v4-collection-stabilization-phases/phase-4.md) | sequential | 1 | #1351 finding 1 |
| 5 | [Discovery-aware progress](2026-09-25-v4-collection-stabilization-phases/phase-5.md) | sequential | 2, 3, 4 | #1342 |
| 6 | [Deterministic e2e checks](2026-09-25-v4-collection-stabilization-phases/phase-6.md) | [batch-eligible] | none | #1351 findings 4, 5 |

File overlap check for the batch set:
- Phase 1: `lib/github/evidence.ts`, `lib/github/evidence-queries.ts`, GitHub
  tests, one new `lib/impact/` test, `e2e/helpers/redesign-upstream.test.ts`
  (comment), `docs/accepted-risks.md`, `docs/impact-v7.md`.
- Phase 2: `lib/collection/seed.ts`, `seed.test.ts`, one new engine-level test
  file per provider (`lib/<provider>/evidence-seeded.test.ts`).
- Phase 3: `supabase/migrations/058_*`, `lib/db/collection-queue.contract.test.ts`,
  `lib/collection/worker.ts` and `backoff.ts` (comments only), `worker.test.ts`,
  `app/api/scoring/status/route.ts` (comment), and the three docs that name
  the held migration.
- Phase 6: `apps/web/e2e/share-page.spec.ts`, `landing.spec.ts`, `link-crawl.spec.ts`, new `e2e/helpers/locale-switch.ts`, `docs/runbooks/deployment-smoke.md`.

Shared docs (`CHANGELOG.md`, `docs/runbooks/scoring-collection-queue.md`,
`CLAUDE.md`) are written once, in phase 5, for all phases.

Phases 4 and 5 both edit `lib/github/evidence.ts`, and phase 5 also edits
`worker.ts`, `collection-queue.ts` and every engine, so they run in order after
the batch.

## Pseudocode notation

`+` adds a line, `-` removes a line, `~` changes a line. `...` is unchanged code.

## Success criteria (whole plan)

### Automated
- `pnpm run test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:circular`
  pass, run in order with each exit status kept.
- `pnpm run test:contract:local` passes against local Supabase with migration 058
  applied (`supabase db reset` on the disposable local stack).
- `pnpm run test:coverage` keeps the `lib/impact/**` floors.
- Phase 6: `share-page.spec.ts` and `link-crawl.spec.ts` pass 5 repeats in
  local-candidate mode with `--repeat-each=5` and no retries.

### Manual (after an authorized release only)
- Production: every GitHub job reaches `complete` within one day of enqueue.
  Read with the queries in `docs/runbooks/scoring-collection-queue.md`.
- A GitHub job's known operation count for w-winter, bbezerra82 and awizemann
  falls under 1,000 (was 30,000 to 74,000).
- juan294's job completes or absorbs `commits:R_kgDORAaltg` with
  `source_error` and issues a receipt.

## Stuck states and recovery

| State | Who sees it, and what | How it ends | Test |
|---|---|---|---|
| `waiting_rate_limit` (shared allowance empty) | Owner: "Rate limit reached, resuming at {time}" (`en.ts:477`). Operator: job row, `/api/health` `scoringQueue` | Automatic at `next_run_at`. After phase 3 it never uses up the retry budget, so it cannot become `failed` by rate limits alone | Phase 3: `worker.test.ts` "rate-limited stops never make a job terminal"; contract test "fail with rate_limited keeps attempt" |
| `retrying` after 5xx/network | Owner: "Temporary error, retrying at {time} (attempt N)" | Automatic. Progress resets `attempt` (phase 3), so only 8 failures in a row with no progress end it | Phase 3 contract test "checkpoint with more done operations resets attempt" |
| One repository's commit history returns 5xx at every page size | Owner: `retrying` rows while it lasts | Automatic: absorbed as partial after 3 failed ladders (phase 4). The receipt issues; coverage carries `source_error` | Phase 4: `evidence-slice.test.ts` "absorbs a commits op after 3 failed ladders" |
| `failed` after a transient stop (http, network) | Owner: action needed with **Retry**. Operator: `scoring_collection_failed` alert | Owner presses Retry: resumes from the saved checkpoint (phase 3) | Phase 3 contract test "retry after http failure keeps checkpoint"; `ScoringStatusPanel.render.test.tsx` shows Retry |
| `failed` after a structural stop (graphql, protocol, parse) | Same as above | Retry restarts from an empty checkpoint, so a bad cursor cannot repeat | Phase 3 contract test "retry after protocol failure clears checkpoint" |
| `failed` with `not_accessible` credential | Owner: "reconnect" reason and reconnect prompt (unchanged) | Owner reconnects | Existing `status.test.ts` reconnect case |
| Discovering (no percentage) | Owner, share page, badge, OG: "Discovering your activity" | Automatic when the engine reports `discoveryComplete` | Phase 5: engine tests "operationsKnown never grows after discoveryComplete"; `status.test.ts` "shows percent once every job has discovered" |
| In-flight job with pre-phase-1 `issues:`/`closures:` operations | Nobody (inflated counts only) | Automatic: the GitHub engine drops those keys when it loads the checkpoint | Phase 1: `evidence-slice.test.ts` "drops legacy issue-closure operations" |
| Receipts issued by seeded jobs before #1352 (missing new commits in known repos) | Nobody | Automatic: the next daily job after the fix seeds without pre-registered repositories | Phase 2: engine tests "seeded job registers commits for seeded repositories" |

## Consumer sweep

Commands (run from the repository root on `develop` at `3851c47a`):

```bash
grep -rn "closures:\|\"issues:\|\`issues:\|V7Closures\|V7Issues" apps/web scripts packages --include='*.ts'
grep -rln "seedFromPrior\|seededDataThrough" apps/web scripts --include='*.ts'
grep -rln "CollectSlice\b\|collectGitHubSlice\|collectGitLabSlice\|collectBitbucketSlice\|collectCodebergSlice" apps/web scripts --include='*.ts'
grep -rn "scoring_collection_fail\|scoring_collection_checkpoint\|scoring_collection_enqueue" apps/web scripts --include='*.ts' --include='*.sql'
grep -rn "\.attempt\b\|attempt:" apps/web/lib apps/web/app --include='*.ts' --include='*.tsx'
grep -rn --include='*.ts' --include='*.tsx' "operationsKnown\|operationsDone" apps packages
grep -rn --include='*.ts' --include='*.tsx' "\.percent\b\|percent}\|percent=" apps/web packages
```

### GitHub issue-closure operations and `issue_work` (phase 1)

| Hit | Kind | Coverage |
|---|---|---|
| `lib/github/evidence.ts` (issues/closures handlers, `issuesComplete`) | writer | Phase 1 |
| `lib/github/evidence-queries.ts` (`issues`, `closures`) | query | Phase 1 removes |
| `lib/github/evidence-slice.test.ts`, `evidence-parity.test.ts` | tests | Phase 1 updates |
| `lib/gitlab/evidence.ts`, `lib/codeberg/evidence.ts` | own `issues:` keys | Excluded: other providers, separate allowances, no measured problem |
| `lib/bitbucket/evidence-reconciliation.test.ts`, `lib/codeberg/evidence-reconciliation.test.ts` | tests for those providers | Excluded, same reason |
| `e2e/helpers/redesign-upstream.test.ts:149` | comment in a fixture helper | Phase 1 updates the comment |
| `lib/impact/v7-evidence.ts`, `lib/profile/score-receipt-observed.ts`, `lib/evidence/*`, `lib/db/source-context.ts` | readers of `issue_work` for all providers | Unchanged; phase 1's equivalence test covers the GitHub effect |

### Seed (phase 2)

| Hit | Kind | Coverage |
|---|---|---|
| `lib/collection/seed.ts` | writer | Phase 2 |
| `lib/collection/worker.ts` (seed progress write) | writer | Phase 5 (progress shape) |
| `lib/github/evidence.ts` (`seededDataThrough`) | reader | Phase 1 removes its only use (the issues `since`) |
| `seed.test.ts`, `worker.test.ts` | tests | Phases 2 and 5 |

### `CollectSlice` result shape (phase 5 adds `discoveryComplete`)

| Hit | Kind | Coverage |
|---|---|---|
| `lib/collection/plan.ts` | type | Phase 5 |
| `lib/github/evidence.ts`, `lib/bitbucket/evidence.ts`, `lib/gitlab/evidence.ts`, `lib/codeberg/evidence.ts` | writers | Phase 5 |
| `lib/collection/collect-source-slice.ts` | pass-through | Phase 5 |
| `lib/collection/worker.ts` | reader | Phase 5 |
| `lib/db/collection-queue.ts` | progress schema | Phase 5 (zod), phase 3 (SQL) |
| `lib/github/stats.ts`, `lib/bitbucket/stats.ts`, `lib/codeberg/stats.ts` | re-exports only | No change needed; typecheck proves it |
| `collect-source-slice.test.ts`, `github/evidence-*.test.ts`, `bitbucket/evidence-*.test.ts`, `codeberg/evidence-*.test.ts`, `gitlab` tests | test fakes | Phase 5 updates fakes |

### Queue RPCs and `attempt` (phase 3)

| Hit | Kind | Coverage |
|---|---|---|
| `lib/db/collection-queue.ts` | RPC wrappers | Phase 3 |
| `lib/collection/worker.ts:423,430` | retry rule reader | Phase 3 |
| `lib/collection/backoff.ts` | budget constant | Phase 3 (doc comment) |
| `lib/collection/fan-in.ts` | enqueue/finish caller | Unchanged; contract suite proves it |
| `lib/collection/status.ts:43`, `app/settings/ScoringStatusPanel.tsx:55` | display of `attempt` | Phase 3: meaning becomes "failures since last progress"; copy unchanged |
| `e2e/helpers/scoring-point-fixtures.ts` | writes jobs through the RPCs | Phase 3 checks that it still passes; no shape change |
| `worker.test.ts`, `fan-in.test.ts`, `collection-queue.test.ts`, `collection-queue.contract.test.ts` | tests | Phase 3 |

### Progress and percent (phase 5)

| Hit | Kind | Coverage |
|---|---|---|
| `lib/collection/worker.ts:309-314,341-346` | writers | Phase 5 |
| `lib/db/collection-queue.ts:18-24,53-70` | type and schema | Phase 5 |
| `supabase/migrations/055:48-58` (`scoring_collection_valid_progress`) | SQL validator | Phase 3 (migration 058 relaxes it) |
| `lib/collection/status.ts`, `lib/collection/scoring-status.ts` | derivation and type | Phase 5 |
| `app/settings/ScoringStatusPanel.tsx`, `app/generating/[handle]/GeneratingProgress.tsx`, `app/u/[handle]/SharePageScoringStatus.tsx`, `app/u/[handle]/badge.svg/route.ts`, `app/u/[handle]/og-image/route.ts`, `lib/render/badge-state.ts` | renderers | Phase 5 |
| `app/api/scoring/status/route.ts`, `app/api/profile/[handle]/route.ts`, `app/api/insights/[handle]/route.ts`, `lib/profile/post-write-score.ts` (refresh, recalculate, generate), `lib/webmcp/server-tools.ts` | JSON pass-through | Phase 5: `percent` becomes `number \| null`; tests updated |
| `lib/i18n/dictionaries/en.ts`, `es.ts` | copy | Phase 5 adds discovering keys |
| Tests listed in phase 5 | fixtures | Phase 5 |
| `e2e/badge-endpoint.spec.ts`, `e2e/scoring-point-consistency.spec.ts`, `e2e/helpers/deployment-probes.ts` | check state only, never percent | Excluded: no change; phase 5 reruns them |
| `app/llms-full.txt/route.ts`, `components/BadgeToolbar.tsx` | read `kind` only | Excluded |

## Rollout

Implementation and local proof authorize neither a release nor the production
migration. After merge to `develop`, the release follows
`docs/release/release-playbook.md` with its separate authorizations.
Migration 058 must be applied to production in that release, because the
pending-migrations check compares the repository with production.

No manual step follows the release. Both leftover states end by themselves
(see the stuck-state table): the GitHub engine drops legacy closure operations
when it loads a checkpoint, and the next daily job after the release seeds
without pre-registered repositories. Admin bulk-recalculate cannot speed this
up, because an `admin` enqueue is a no-op on an existing job
(`supabase/migrations/055_scoring_collection_queue.sql:164`).

The first receipt after the release can have a new evidence digest, because
GitHub `issue_work` events are no longer present. The displayed score does not
change (phase 1 test).

## Out of scope

- A token pool, a GitHub App or a bot account (#1346, accepted risk).
- Request reduction for Bitbucket, GitLab and Codeberg. No measurement shows a
  problem, and each has its own allowance.
- Any change to the v7.2 scoring policy or the receipt format.
