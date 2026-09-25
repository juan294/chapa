# Phase 2: Seeded jobs keep per-repository operations

[batch-eligible] Depends on: none. Issue: #1352.
Branch: `fix/1352-seed-repository-ops`.

## Why

`seedFromPrior` writes the retained events' repositories into
`checkpoint.discovered.repositoryIds` (`apps/web/lib/collection/seed.ts:43,61`).
Each engine starts its repository set from that list (github `evidence.ts:148`,
bitbucket `evidence.ts:72`, gitlab `evidence.ts:77`, codeberg `evidence.ts:57`).
`registerRepo` returns early for a known ID (github `evidence.ts:161-162`,
bitbucket `:82-84`, gitlab `:90-92`, codeberg `:69-72`). So a seeded job never
creates `commits:` (and `pullrequests:`, `merge_requests:`, `pulls:`, `issues:`)
operations for repositories the owner was already active in. New activity in
those repositories since the prior observation is not collected.

## Step 1: failing tests

`apps/web/lib/collection/seed.test.ts`:

- "does not pre-register repositories": `seedFromPrior(prior, window)` returns
  `checkpoint.discovered.repositoryIds` equal to `[]`, and still returns the
  in-window events and the pre-done `files:`/`reviews:` operations.

One engine-level test per provider, in new files
`apps/web/lib/{github,bitbucket,gitlab,codeberg}/evidence-seeded.test.ts`
(reuse each provider's existing slice-test fetch fake; do not write a new one):

- "seeded job registers per-repository operations for seeded repositories":
  1. Build a prior observation with one event in repository R.
  2. `seed = seedFromPrior(prior, window)`.
  3. Run the collector from `seed.checkpoint`, with discovery returning R.
  4. Assert the checkpoint contains that provider's per-repository operation(s)
     for R (github `commits:R`; bitbucket `commits:R` and `pullrequests:R`;
     gitlab `commits:R`, `issues:R`, `merge_requests:R`; codeberg `commits:R`,
     `pulls:R`, `issues:R`), and that the seeded `files:` operation stays done
     with no request for it.

These four engine tests must fail on current code with only `seed.test.ts`
changed back. Run them first against the unchanged `seed.ts` to see the failure.

## Step 2: implementation

`apps/web/lib/collection/seed.ts`:

```
- const repositoryIds = [...new Set(seededEvents.map((event) => event.repositoryId))].sort();
  ...
~ discovered: { repositoryIds: [], itemIds: { seededWorkItemIds: [...immutableFiles].sort() } },
```

Also remove `state: { seededDataThrough: prior.dataThrough }`. Its only reader
was the GitHub issues `since`, which phase 1 deletes. If phase 1 is not merged
yet, the GitHub engine falls back to the window start, which is correct and
only costs more requests. Remove the matching `seededDataThrough` assertions
from `seed.test.ts`. The fake seed checkpoint in `worker.test.ts:325-326` is an
input fixture for a mocked seed; leave it, so this phase does not touch the
worker tests that phase 3 edits.

Update the doc comment (remove the `discovered.repositoryIds` and `dataThrough` bullets and say
why: pre-registering a repository suppresses its per-repository operations).
Discovery re-finds every repository, because the worker always uses
`owned_and_contributed` scope (`worker.ts:37`), and every merged change or
review registers its repository.

Do not touch `worker.ts` here. Phase 5 changes the seed progress write.

## Step 3: documentation

Phase 5 writes the runbook and CHANGELOG text for this phase (see phase 5,
"Documentation for phases 1 to 4"), so the batch phases do not edit the same
files.

- After merge to `develop` and a green local run: close #1352 with the commit
  SHA (REST, as in phase 1).

## Success criteria

### Automated
- `pnpm vitest run apps/web/lib/collection apps/web/lib/github apps/web/lib/bitbucket apps/web/lib/gitlab apps/web/lib/codeberg`
- `pnpm run typecheck && pnpm run lint`

### Manual
- None before release.
