# Phase 4: Commit-history 5xx retry ladder

Sequential. Depends on: phase 1 (same file, `lib/github/evidence.ts`).
Issue: #1351 (finding 1). Branch: `fix/1351-commits-5xx-ladder`.

## Why

juan294's job failed at attempt 7 with `{operation: commits, stopKind: http,
httpStatus: 502}` on `commits:R_kgDORAaltg`, cursor
`50c16b655dc3c96bca601bbe8bec8f7c9a38ef6e 1049` (research §3.4). v4.0.2
already bounds history with `since` and pages of 50. The cause is not
measured. One repository that always answers 5xx blocks the whole receipt.

## Step 1: measure (before any code)

Run when the GraphQL allowance has room. Read the headers, not
`gh api rate_limit` (see `docs/accepted-risks.md`):

```bash
gh api graphql -i -f query='query { rateLimit { remaining resetAt } }' | grep -i x-ratelimit
```

Then, for repository `R_kgDORAaltg`, subject juan294's node ID (from
`gh api graphql -f query='{ user(login:"juan294"){ id } }'`), the recorded
cursor, and `since` = window start minus 30 days, send the `V7Commits` query
text from `apps/web/lib/github/evidence-queries.ts` with `first` set to
50, 20 and 10, and the `V7CommitsWithoutLines` text with `first` 50 and 10.
Repeat each 3 times. Record HTTP status, elapsed time and `errors` for each
in `docs/plans/2026-09-25-v4-collection-stabilization-phases/evidence/phase-4-commits-502.md`.
Also record `nameWithOwner` for the repository and the commit at the cursor
offset, if a smaller page returns it.

Decision point:
- If some smaller page size or the no-line-count query succeeds: implement
  the ladder below in the order the measurement supports.
- If every variant fails: implement the ladder unchanged. The absorb rule in
  step 3 is what ends the stuck state.
- If the measurement shows a different cause (for example, `since` is not
  applied, or the error is not a 5xx), STOP and report to the owner before
  writing code.

## Step 2: failing tests

In `apps/web/lib/github/evidence-slice.test.ts`, with the existing fetch fake:

- "retries a 502 commits page at 20, then 10": the fake returns 502 for
  `first: 50` and 200 for `first: 20`. The events for that page are kept, and
  the next page of the same operation uses `first: 20`.
- "falls back to no line counts at the smallest page": 502 for every
  `V7Commits` size, 200 for `V7CommitsWithoutLines` at 10. The commits have
  unknown line counts (`observedNumber(null)` path).
- "returns an http stop when the whole ladder fails, and counts it": the
  checkpoint's `state.commitLadderFailures["commits:R"]` is 1.
- "absorbs a commits op after 3 failed ladders": starting from a checkpoint
  with the counter at 2, a third failed ladder marks the operation done,
  adds `source_error` to the final reasons, and the slice continues to the
  next operation.
- "a success resets the ladder counter" for that key.
- "ladder requests count against maxRequests": with `maxRequests` 2, the
  ladder stops with a `budget` stop and keeps the cursor.

## Step 3: implementation

`apps/web/lib/github/evidence-queries.ts`:

```
~ function commitHistoryQuery(name, lineFields) {
~   query ${name}($id: ID!, $subjectId: ID!, $since: GitTimestamp!, $after: String, $first: Int!) {
~     history(first: $first, after: $after, since: $since, author: {id: $subjectId}) ...
```

`apps/web/lib/github/evidence.ts`:

```
+ const COMMIT_PAGE_LADDER = [50, 20, 10] as const   // order from step 1
+ const COMMIT_LADDER_ABSORB_AFTER = 3

  runPagedList(..., options)
+   options.retryOnServerError?: (cursor) => Promise<Response | null>
    // or keep runPagedList generic and add the ladder inside a commits-specific
    // request wrapper; prefer the smaller change after reading the code

  commits op:
+   pageSize = state.commitPageSize?.[op.key] ?? 50
+   on http stop with httpStatus >= 500:
+     for size in ladder sizes below pageSize:
+       r = request("commits", {..., first: size, after: cursor})
+       if ok: state.commitPageSize[op.key] = size; continue normally
+     r = request("commitsWithoutLines", {..., first: smallest, after: cursor})
+     if ok: continue normally (commits keep unknown lines)
+     failures = (state.commitLadderFailures[op.key] ?? 0) + 1
+     if failures >= COMMIT_LADDER_ABSORB_AFTER:
+       reasons.add("source_error"); op.done = true; op.cursor = null
+       delete counters for op.key; return "done"
+     state.commitLadderFailures[op.key] = failures
+     return the http stop (cursor unchanged)
+   on any success: delete state.commitLadderFailures[op.key]
```

Keep the existing `lineCountsUnavailable` fallback (`evidence.ts:229-232`)
working with `first` passed through. `fillNullNodes` needs pages of the same
length, so pass the same `first` to both requests.

Every ladder request goes through `request()`, so the budget and deadline
checks and `requestCount` still apply.

Check that `source_error` makes the final coverage partial for
`authored_commit`. The `unidentified` list at `evidence.ts:514` already
includes it.

## Step 4: documentation

Runbook and CHANGELOG text: written in phase 5 ("Documentation for phases 1
to 4").

## Success criteria

### Automated
- `pnpm vitest run apps/web/lib/github apps/web/lib/collection`
- `pnpm run typecheck && pnpm run lint`

### Manual
- Step 1 measurement file committed with the phase.
