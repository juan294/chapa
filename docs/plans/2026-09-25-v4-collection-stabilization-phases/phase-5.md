# Phase 5: Discovery-aware progress

Sequential. Depends on: phase 2 (seed shape), phase 3 (SQL accepts
`progress.discovering`), phase 4 (last edit of `lib/github/evidence.ts`).
Issue: #1342. Branch: `fix/1342-discovery-progress`.

## Why

- A seeded job writes `progress = N/N` before any request
  (`apps/web/lib/collection/worker.ts:309-315`), so `clampPercent` shows 99%
  (`apps/web/lib/collection/status.ts:25-29`). Discovery then appends
  operations and the percent falls.
- Without a seed, the percent is done over operations known so far, which grows
  during discovery.
- The aggregate sums all jobs (`status.ts:56-62`), so a finished job hides a
  sibling that is still discovering.
- Nothing records whether a job can still add operations (research §4; the
  checkpoint has no such field).

## Target behavior (from #1342's acceptance)

- While any in-progress job can still add operations, the owner, share page,
  badge, OG image and generating page show "discovering" with no percentage.
- A percentage appears only after every in-progress job has finished
  discovery. From then on it never decreases, because the known count of each
  job is fixed and the done count only grows.
- Complete jobs count as discovered.

## Step 1: failing tests

### Engine contract (one test per provider)

In each provider's slice test file (`lib/github/evidence-slice.test.ts`,
`lib/bitbucket/evidence-slice.test.ts`, `lib/codeberg/evidence-slice.test.ts`,
and the GitLab slice test), with that file's existing fetch fake:

- "operationsKnown never grows after discoveryComplete": run the collector
  slice by slice with `maxRequests: 1` over a fixture that exercises every
  operation kind the engine has. After the first result with
  `discoveryComplete: true`, assert that every later checkpoint has the same
  operation count, and that `discoveryComplete` stays true.
- "discoveryComplete is false on the first slice" (scaffold not yet run).
- "a legacy checkpoint with no flag starts as not discovered" (GitHub only,
  for resumed pre-phase-5 jobs).

This test is the specification. Each engine computes the flag as "no
not-done operation can still add operations". Build that list from the
engine's own `ensureOp`/`registerRepo` call sites. Research found these
(check them against the code at implementation time):

| Engine | Operations that add operations |
|---|---|
| GitHub (after phase 1) | `profile`, `repositories`, `contributed`, `merged:*`, `reviewDiscovery` |
| Bitbucket | `profile`, `workspaces`, `workspace-repos:*`, `pullrequests:*`, `diffstat:*` |
| GitLab | `profile`, `emails`, `authored_merged`, `projects:*`, `merge_requests:*`, `issues:*`, and whichever op creates `diffs:` |
| Codeberg | `profile`, `repos:*`, `feeds`, `pulls:*`, `issues:*` |

Export each list as a named constant beside its engine, so the test and the
engine read the same list.

### Status derivation (`lib/collection/status.test.ts`)

- "a job still discovering has percent null".
- "collecting percent is null while any in-progress job is discovering".
- "shows percent once every job has discovered".
- "a complete job counts as discovered".
- "legacy progress without the discovering key is treated as discovering,
  unless the job is complete".
- "percent never decreases across a discovery-to-completion sequence": feed
  the sequence of progress rows produced by the GitHub engine contract fixture
  and assert the non-null percents are non-decreasing.

### Worker (`lib/collection/worker.test.ts`)

- "seed writes discovering true": the seed checkpoint's progress has
  `discovering: true`.
- "slice progress carries the collector's discoveryComplete".

### Renderers

- `lib/render/badge-state.test.ts`: collecting with `percent: null` renders the
  discovering string and no percentage text; the bar shows no fill.
- `app/settings/ScoringStatusPanel.render.test.tsx`: discovering copy; no
  "Estimated" note.
- `app/generating/[handle]/GeneratingProgress.render.test.tsx`: step 1 shows
  the discovering copy and no `— N%`.
- `app/u/[handle]/SharePageScoringStatus.render.test.tsx`,
  `app/u/[handle]/badge.svg/route.test.ts`, `app/u/[handle]/og-image/route.test.ts`,
  `app/u/[handle]/share-page.render.test.tsx`: a collecting status with
  `percent: null`.
- API pass-through tests that fix a percent value
  (`api/scoring/status/route.test.ts`, `route.contract.test.ts`,
  `api/profile/[handle]/route.test.ts`, `route.observed.test.ts`,
  `api/refresh`, `api/recalculate`, `api/generate` tests,
  `lib/profile/post-write-score.test.ts`, `lib/webmcp/server-tools.test.ts`,
  `components/BadgeToolbar.render.test.tsx`,
  `lib/collection/read-scoring-status.test.ts`): add one null case where the
  test covers the collecting shape; keep numeric cases.

## Step 2: implementation

`apps/web/lib/collection/plan.ts`:

```
  interface SliceResult {
    ...
+   /** No not-done operation can add operations. Once true for a job, its operation count is final. */
+   readonly discoveryComplete: boolean;
  }
```

Each engine (`lib/{github,bitbucket,gitlab,codeberg}/evidence.ts`):

```
+ export const <PROVIDER>_EXPANDING_OPERATIONS = [...]   // exact keys and prefixes
+ const discoveryComplete = !operations.some(op => !op.done && expands(op.key))
  return { ..., discoveryComplete }   // on every return path
```

GitHub also: a `merged:*` split inserts two new expanding operations, so the
flag correctly stays false until both finish.

`apps/web/lib/collection/collect-source-slice.ts`: pass the field through.

`apps/web/lib/db/collection-queue.ts`:

```
~ CollectionProgress { operationsDone; operationsKnown; events; requests; discovering?: boolean }
~ progressSchema: + discovering: z.boolean().optional()
```

`apps/web/lib/collection/worker.ts`:

```
  seedProgress = { ..., discovering: true }
  progress = { ..., discovering: !result.discoveryComplete }
```

`apps/web/lib/collection/scoring-status.ts`:

```
~ ProviderStatus.percent: number | null   // null while that job is discovering
~ collecting.percent: number | null        // null while any in-progress job is discovering
```

Update the doc comment at `:17` (no longer "an estimate").

`apps/web/lib/collection/status.ts`:

```
+ function discovering(job) { return job.state !== "complete" && job.progress.discovering !== false }
~ clampPercent -> null when discovering(job)
~ overallPercent -> null when jobs.some(discovering); else min(99, floor(Σdone/Σknown*100))
```

Renderers:
- `lib/render/badge-state.ts`: `percent: number | null`. Null draws the track
  with no fill and uses the new `badgeDiscovering` string.
  `buildBadgeStatusStrings` picks `badgeDiscovering` when null.
- `app/settings/ScoringStatusPanel.tsx`: `panelDiscovering` when null; remove
  the `panelPercentEstimate` note (its reason is gone). Fix the stale comment
  at `:71` that says source rows render `source.percent`.
- `app/generating/[handle]/GeneratingProgress.tsx`: no `— N%` while null; use
  the discovering copy.
- `app/u/[handle]/SharePageScoringStatus.tsx`, `badge.svg/route.ts`,
  `og-image/route.ts`: pass `null` through.

i18n (`lib/i18n/dictionaries/en.ts`, `es.ts`, same key paths, parity test):

```
+ badgeDiscovering: 'Scoring in progress, discovering activity'   /  'Puntuación en curso, descubriendo actividad'
+ panelDiscovering: 'Discovering your activity. A percentage appears once the total is known.'
                    /  'Descubriendo tu actividad. El porcentaje aparece cuando se conoce el total.'
- panelPercentEstimate
```

Grep `docs/webmcp.md`, `lib/webmcp/server-tools.ts` descriptions and
`app/llms-full.txt/route.ts` for "percent" and update any text that promises
a number while collecting.

## Documentation for phases 1 to 4

Phases 1 to 4 do not edit these files, so the batch phases do not conflict.
Write them here:

`docs/runbooks/scoring-collection-queue.md`:
- GitHub operation kinds after phase 1 (no `issues:`/`closures:`).
- Incremental reuse no longer seeds repositories (phase 2).
- Retry-policy table from phase 3 ("Rules after this phase").
- Commit-history ladder and absorb rule, and how to see it (phase 4).
- Progress: `progress.discovering`, and why no percentage shows during discovery.

`CHANGELOG.md` Unreleased:
- "GitHub collection no longer scans issue closures, which never affected
  the displayed score and used most of the shared request allowance (#1351)."
- "Daily collection again collects new activity in repositories that were
  already known from the previous day (#1352)."
- "Rate-limit waits no longer use up a collection's retry budget, progress
  resets it, and Retry after a temporary error resumes instead of starting
  over (#1351)."
- "A repository whose commit history keeps failing at GitHub no longer blocks
  the score: Chapa retries with smaller pages, then records that history as
  incomplete (#1351)."
- "Scoring progress shows 'discovering' until the total is known, then a
  percentage that only goes up (#1342)."

`CLAUDE.md`: in the "Durable evidence collection queue (#1335)" bullet, add
one sentence each for the attempt rule (phase 3) and the discovering flag
(this phase).

After merge to `develop` with a green local run: close #1342 and #1351 with
the merge SHA (REST, as in phase 1).

## Success criteria

### Automated
- `pnpm run test` (includes `dictionaries/parity.test.ts`)
- `pnpm run test:contract:local`
- `pnpm run typecheck && pnpm run lint && pnpm run check:circular`
- `pnpm --filter @chapa/web exec playwright test e2e/badge-endpoint.spec.ts e2e/scoring-point-consistency.spec.ts --retries=0`
  (these read `collecting` state only; they must still pass)

### Manual
- Local dev with local Supabase: enqueue a fixture job, open `/settings` and
  `/u/<handle>` while it runs, and see "discovering" and then a percentage
  that only rises. Screenshot both states for the phase notes.
