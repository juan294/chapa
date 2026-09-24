# v4 collection stabilization: how the current system works

Date: 2026-09-24. Branch: `develop` at `0d281481` (v4.0.6). Issue: #1351 (Refs #1335).

This document describes the system as it is, for the six open findings in
#1351. It records no fixes and no recommendations. Paths are relative to the
repository root. Production figures come from read-only queries on the linked
production database on 2026-09-24, with the time given.

## 1. Where a GitHub request comes from

A cron route runs the worker every 5 minutes (`apps/web/vercel.json:24-27`),
with `maxDuration = 300` (`apps/web/app/api/cron/collect-evidence/route.ts:23`)
and a tick budget of 270,000 ms (`route.ts:29,36`).

The tick loop (`apps/web/lib/collection/worker.ts:441-494`) works as follows:

- It claims `CLAIM_LIMIT = 4` jobs with a `LEASE_SECONDS = 120` lease
  (`worker.ts:194-195,471`). It repeats until 20 s before the deadline
  (`TICK_SAFETY_MARGIN_MS`, `worker.ts:202,470`).
- It runs the claimed slices in parallel with `Promise.allSettled`
  (`worker.ts:478`).
- Each slice has `maxRequests = 150` (`MAX_REQUESTS_PER_SLICE`, `worker.ts:197`).
  Its deadline is `min(tick deadline, now + 60 s)` (`SLICE_TIME_BUDGET_MS`,
  `worker.ts:198,473`).
- `scheduleCollectionAdvance` also runs the tick inside `after()`, with a
  60,000 ms budget (`apps/web/lib/collection/enqueue.ts:65,80-83`). It is
  called after an enqueue from refresh, recalculate, generate, the status retry
  and admin bulk-recalculate.

**Token.** For GitHub, `resolveCredential` builds the source context with
`{kind: "github"}` and no token (`worker.ts:66,72`). `createSourceContext` then
sets `token = credential.token ?? getGithubToken()`
(`apps/web/lib/platform/source-context.ts:49`). That is the trimmed
`GITHUB_TOKEN` environment variable (`apps/web/lib/env.ts:112-113`). The
collector sends `Authorization: Bearer` only when that token is set
(`apps/web/lib/github/evidence.ts:144,179`). Every GitHub job for every owner
therefore uses the server `GITHUB_TOKEN`.

**Documentation of that token:**
- The integrity-contract ADR describes GitHub fetches as "the request's session
  token, else the server `GITHUB_TOKEN`"
  (`docs/decisions/2026-08-11-scoring-data-integrity-contract.md:13-17`).
- The outage playbook calls it "a shared token" with 5,000 requests per hour
  (`docs/runbooks/outage-playbook.md:56,70`).
- The no-consent ADR estimates juan294 at about 3,000 GitHub requests, "close
  to the 5,000/h token ceiling" (`docs/decisions/2026-09-23-universal-v72-no-consent.md:92-94`;
  plan `docs/plans/2026-09-23-universal-v72-reliable-collection.md:51`).

**Measured on 2026-09-24:**
- At 11:02Z, a `gh api graphql -i` call returned `X-Ratelimit-Remaining: 0`
  with reset 11:08:55Z. At the same time, juan294's collection job was
  `waiting_rate_limit` with resume 11:08:56Z.
- The GitHub account behind `GITHUB_TOKEN` is user ID 3944118. That is the
  identity in the `gh` rate-limit error.

## 2. The GitHub operations a job creates

### 2.1 Creation and order

A job's operation list starts with a scaffold (`evidence.ts:483-490`):
1. `profile`
2. `repositories` and `contributed` (not in explicit mode)
3. One `merged:<start>..<end>` per calendar month of the window
   (`evidence.ts:59-71,486`)
4. `reviewDiscovery`

Operations discovered later are appended to the end of the list through
`ensureOp` (`evidence.ts:160`; `apps/web/lib/collection/slice-helpers.ts:69-71`).
The loop processes them in list order in the same slice (`evidence.ts:492-500`).

| Operation | Created by | Count |
|---|---|---|
| `commits:<repoId>`, `issues:<repoId>` | `registerRepo` (`evidence.ts:161-166`) | One each per distinct repository |
| `files:github:<prId>` | `onMergedNode` (`evidence.ts:283`); a linked closer (`evidence.ts:466-473`) | One per merged PR by the subject |
| `reviews:github:<prId>` | `reviewDiscovery` handler (`evidence.ts:380`) | One per PR in `pullRequestReviewContributions` |
| `closures:<issueId>` | `issues:` handler (`evidence.ts:435`) | One per issue the issues query returns |

The issues query returns every issue in the repository updated since the window
start (`since` from `evidence.ts:431`). It selects `issues(first:100,
filterBy:{since}, orderBy: UPDATED_AT DESC)` with no author or assignee filter
(`apps/web/lib/github/evidence-queries.ts:62-68`).

The closures query reads `timelineItems(first:100, itemTypes:[CLOSED_EVENT])`
for each issue (`evidence-queries.ts:69-78`). The handler keeps a ClosedEvent
whose actor is the subject and whose date is in the window (`evidence.ts:440-478`).

### 2.2 How the policy uses each evidence kind

**Delivery.** A delivery unit needs:
- an authored merged change,
- a directly authored commit that reaches the default branch, or
- completed issue work with a linked accepted result.

"Closing an issue without a linked accepted result does not create a delivery
unit" (`docs/plans/2026-09-05-scoring-relaunch-phases/policy.md:29,33`). The
v7.2 policy reuses these rules (`docs/plans/2026-09-08-v7-single-score-consistency-phases/policy.md:15`).

**Issue closures.** The CHANGELOG states "Only a merged pull request closer
earns credit" (`CHANGELOG.md:89`). The validation research records that issue
closure actions "remain diagnostics until qualifying evidence is assessed"
(`docs/research/2026-09-05-scoring-v7-phase-5-validation.md:7`).

**Changed files.** The documentation category needs a complete changed-file
list (relaunch `policy.md:66`). The `files:` operation supplies it.

### 2.3 Measured operation counts (production, 2026-09-24 19:15Z)

Counts are by operation kind for GitHub jobs that were not `complete`. `done`
is in parentheses.

| Owner | closures | files | issues | commits | reviews | merged |
|---|---|---|---|---|---|---|
| w-winter | 73,583 (2,748) | 69 (69) | 58 (58) | 58 (58) | 11 (11) | 13 (13) |
| bbezerra82 | 55,744 (5,368) | 1 (1) | 23 (23) | 23 (23) | — | 13 (13) |
| nicholaivogel | 33,797 (0) | 1,023 (0) | 53 (40) | 53 (41) | 192 (0) | 13 (13) |
| awizemann | 30,709 (4,587) | 40 (40) | 21 (21) | 21 (21) | 5 (5) | 13 (13) |
| cristhianrivera | 5,595 (5,503) | 2 (2) | 25 (25) | 25 (25) | — | 13 (13) |
| komediruzecki | 3,842 (2,173) | 998 (998) | 48 (48) | 48 (48) | 32 (32) | 13 (13) |
| juan294 | 274 (0) | 1,855 (0) | 36 (7) | 36 (7) | 33 (0) | 13 (13) |
| juan-gonzalezponce_avoltagh | — | — | — | — | — | 13 (0) |

Every job also has one `profile`, `repositories`, `contributed` and
`reviewDiscovery` operation. At that time there were 13 rows in
`scoring_v7_receipts`.

## 3. Requests, rate limits and retries

### 3.1 How a request is classified

`request()` (`evidence.ts:173-196`) works as follows:

1. **Budget.** If the slice has made 150 requests, or its deadline signal has
   aborted, it returns a `budget` or `deadline` stop without fetching
   (`evidence.ts:174-175`; `apps/web/lib/platform/evidence-diagnostics.ts:77-81`).
2. **Count.** It increments `requestCount` before each fetch (`evidence.ts:176`).
   Fallback requests are counted too.
3. **HTTP errors.** For a non-OK status:
   - 429, or 403 with `x-ratelimit-remaining: 0`, gives `rate_limited`;
   - 401 or 403 gives `not_accessible`;
   - anything else gives `http` (`evidence.ts:183`;
     `evidence-diagnostics.ts:87-98`).
4. **GraphQL errors.** For a GraphQL `errors` array (`evidence.ts:187-191`):
   - If every error is `SERVICE_UNAVAILABLE` at an `additions` or `deletions`
     path, the data is kept with no stop (`evidence.ts:27-32`).
   - Otherwise, `RATE_LIMITED`, `RATE_LIMIT` or `graphql_rate_limit` gives
     `rate_limited` (`evidence-diagnostics.ts:115-128`). Anything else gives
     `graphql`.
5. **Thrown errors.** A fetch that throws gives `deadline`, `network` or `parse`
   (`evidence-diagnostics.ts:40-50`).

**Rate-limit fields.**
- Each query carries `rateLimit { remaining resetAt cost }`
  (`apps/web/lib/github/evidence-rate-limit.ts:17-20`).
- Below `RATE_LIMIT_FLOOR = 200` remaining, `rateLimitStop` returns
  `rate_limited` with the time until `resetAt` (`evidence.ts:99,198-205`). It
  is checked after `profile` and after a page that has a next page
  (`evidence.ts:260-264,328`).
- `retryAfterSeconds` reads `retry-after`, else `x-ratelimit-reset`
  (`evidence-diagnostics.ts:133-143`).

### 3.2 Stops in the middle of a list

In `runPagedList` (`evidence.ts:216-267`):
- A `not_accessible` stop marks the operation done and adds a reason
  (`evidence.ts:255`).
- Any other stop saves the failed page's cursor, so the next slice fetches the
  same page again (`evidence.ts:256`).
- For `commits` only, a line-count-only error triggers a second request for the
  same page through `commitsWithoutLines`. Null nodes are then filled from it
  by index (`evidence.ts:113-122,229-232,425`).

**Commit history query.** It uses `history(first: 50, since: $since,
author: {id})` (`evidence-queries.ts:12-20,58,61`). `since` is the window start
minus 30 days (`evidence.ts:124,131`). The comment at
`evidence-queries.ts:54-57` states that `since` filters by committed date.

### 3.3 Retry policy and the `attempt` counter

The worker maps each stop kind to a queue transition (`worker.ts:389-431`):

| Stop kind | Retry time | Ends when |
|---|---|---|
| `budget`, `deadline` | Released to `queued` now, no `fail` call | Never ends from this kind |
| `rate_limited` | `now + (retryAfterSeconds ?? 60)` | No limit in TS |
| `not_accessible` | None | Terminal at once |
| `http`, `network` | `nextBackoff(attempt)`: 1, 2, 4, 8, 16, 32, 64, 64 min (`apps/web/lib/collection/backoff.ts:8,12,26-30`) | Terminal when `attempt >= 7` (`MAX_COLLECTION_ATTEMPTS = 8`, `backoff.ts:18`) |
| `graphql`, `protocol`, `parse`, thrown collector | `structuralRetryAt`: 1 min, then 2 min | Terminal when `attempt >= 2` (`worker.ts:332-339,425,428-431`) |

`scoring_collection_fail` increments `attempt` on every non-terminal failure.
That includes `rate_limited`: it sets `waiting_rate_limit` and runs
`attempt = attempt + 1` in the same statement
(`supabase/migrations/055_scoring_collection_queue.sql:313-317`). The http and
structural limits above read the same `attempt` column. An enqueue with reason
`retry`, `reconnect` or `refresh` resets `attempt` to 0 and clears the
checkpoint and staged events. It keeps the stored `reference_time`
(`055:146-163`).

**Measured on 2026-09-24:**
- At 18:45Z, every GitHub job except juan294's was `waiting_rate_limit` until
  19:09Z, with `attempt` at 1 to 4.
- At 16:09Z the GraphQL allowance reset. A replay request from `gh` at about
  16:12Z was refused with `RATE_LIMIT`.

### 3.4 juan294's `commits` operation

Production state at 19:15Z:
- The job's state is `failed`, with `attempt` 7.
- `last_stop` is `{provider: github, operation: commits, stopKind: http,
  httpStatus: 502}`.
- The first unfinished `commits` operation is `commits:R_kgDORAaltg`, at list
  position 32. Its saved cursor is `50c16b655dc3c96bca601bbe8bec8f7c9a38ef6e 1049`.
- The job had 2,251 known operations, 31 of them done, and 1,333 events.

The job reached `retrying` with the same `commits` 502 at attempts 5, 6 and 7
during the day. Earlier the same day, before v4.0.4, it had failed with
`event_limit` at 11,124 staged `authored_commit` events.

## 4. Owner-facing progress

- `operationsDone` and `operationsKnown` are the counts of done and total
  checkpoint operations after each slice (`worker.ts:341-346`).
- A provider's percent is `min(99, floor(done/known*100))`, or 100 when
  complete (`apps/web/lib/collection/status.ts:25-36`).
- The overall percent sums done and known across all of the day's jobs
  (`status.ts:56-62`).
- Operations are added as discovery proceeds (`evidence.ts:160`), so
  `operationsKnown` grows over the slices. The `closures:` operations are
  added while each repository's `issues:` operation runs (`evidence.ts:435`).
- The panel labels the value "Estimated — the total can grow as more activity
  is discovered." (`apps/web/lib/i18n/dictionaries/en.ts:472-478`;
  `apps/web/app/settings/ScoringStatusPanel.tsx:153-155`).
- The phase plan defined the same formula and label
  (`docs/plans/2026-09-23-universal-v72-reliable-collection-phases/phase-4.md:52`).
- #1342 tracks this display.

## 5. The two unstable end-to-end checks

### 5.1 `share-page.spec.ts:133`

The test is at `apps/web/e2e/share-page.spec.ts:133-157`.

Steps:
1. Opens `/u/octocat?__chapa_smoke=1&lang=en` with `waitUntil:
   "domcontentloaded"`.
2. Clicks the `EN` button, then the `Español` option.
3. Waits for the URL `...&lang=es` and the image `Chapa de octocat`.
4. Switches back the same way.

What the app does on the switch:
- `setLocale` imports the other dictionary and persists the cookie through the
  `setLocaleAction` server action.
- It then runs `window.location.assign(target)`, a full document navigation
  (`apps/web/lib/i18n/provider.tsx:244-293`; `set-locale-action.ts:5-12`).
- The code uses no `router.refresh()`; a comment explains the full navigation
  (`provider.tsx:272-276`).

Timeouts:
- The config sets a 30 s test timeout and no `expect` timeout. The URL and image
  waits after each click therefore use Playwright's 5 s default
  (`apps/web/playwright.config.ts:25,19-68`).
- The config sets no `workers` and uses `fullyParallel: true`, so all workers
  share one server (`playwright.config.ts:27`).
- Retries are 2 in CI and 0 otherwise (`playwright.config.ts:26`).

Observed on 2026-09-24:
- In CI-mode qualification (retries off) for v4.0.5 and v4.0.6, the first run
  failed this test with `locator.click: Test timeout of 30000ms exceeded`. The
  log also shows `Error: The destination stream closed early` from the web
  server.
- The v4.0.5 spec file passed 80 of 80 over five repeats.
- The full suite passed on rerun for both versions (172 passed).

### 5.2 `link-crawl.spec.ts:271-277`

- Budgets: landing cold under 5,000 ms, landing warm under 2,000 ms, and
  `/u/juan294` and `/u/octocat` warm under 2,000 ms
  (`apps/web/e2e/link-crawl.spec.ts:271-277`).
- `ms` is wall-clock time from `page.goto(..., {waitUntil: "load"})` to the
  `load` event (`link-crawl.spec.ts:127-129`).
- "Warm" is one repeat visit after the whole crawl (`link-crawl.spec.ts:239-242`).
- The budgets apply only when `PLAYWRIGHT_BASE_URL` is set
  (`link-crawl.spec.ts:46`). That holds for release qualification. It does not
  hold for the CI e2e job, which starts its own server
  (`.github/workflows/ci.yml:356-441`).
- Recorded production-build timings from the design phase were between 419 and
  1,479 ms for the profiles
  (`docs/plans/2026-09-07-local-e2e-verification-phases/evidence/phase3/`).

Observed on 2026-09-24, in v4.0.6 qualification:
- The first run recorded `/u/octocat` at 3,806 ms and `/u/juan294` at 3,529 ms,
  with a machine load average of 14 to 16.
- The rerun passed, at a load average of about 24.

## 6. The hotfix series 4.0.1 to 4.0.6

Each entry gives the stated cause (from `CHANGELOG.md:10-91` and the commits).

| Version | Fix | Stated cause |
|---|---|---|
| 4.0.1 | Bitbucket `pullrequests` pagelen 50 | API answered 400 to 100 |
| 4.0.1 | Closures query without `ProjectV2` | Needed `read:project`, which the server token lacks |
| 4.0.1 | Credential errors captured | Only `not_accessible` was reported |
| 4.0.2 | Bitbucket `activity` pagelen 50 | API answered 400 to 100 |
| 4.0.2 | Saved cursors with another page size restart | Pre-4.0.1 cursors kept `pagelen=100` |
| 4.0.2 | Commits bounded with `since` and pages of 50 | Unbounded history returned 502 |
| 4.0.2 | Local time in status | UTC times were read as local |
| 4.0.3 | `RATE_LIMIT` body recognised | Only `RATE_LIMITED` was matched |
| 4.0.4 | Event limit 50,000 (migration 057) | 11,124 staged commits exceeded 10,000 |
| 4.0.4 | Staged keys paged | PostgREST returns at most 1,000 rows |
| 4.0.5 | Uncounted commits kept | `SERVICE_UNAVAILABLE` on `additions` nulled a node |
| 4.0.6 | Throwing collector fails the job | The lease expired and the job was re-claimed forever |
| 4.0.6 | EMU logins accepted | The login check rejected `_` |

**Migration numbering.**
- The repository's migration 057 is `057_raise_source_event_limit.sql`.
- The held contract migration is `058_contract_v6_and_consent.sql` on branch
  `hold/1335-contract-migration`.
- The no-consent ADR (`:143-151`) and the plan notes (`:64`) still name the
  held file `057_contract_v6_and_consent.sql`.
