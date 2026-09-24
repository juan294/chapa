# Phase 4: issuance fan-in, pending states and no silent failure

Parent plan: `../2026-09-23-universal-v72-reliable-collection.md`. Depends on phase 3. Not batch-eligible.

## Goal

- A receipt is issued exactly when all of an owner's connected sources for the day are complete.
- Every surface shows the owner's true scoring state:
  - ready
  - collecting (with progress)
  - action needed (with a reason and a way to recover)
  - not registered
- Every outcome is recorded and observable.
- Nothing fails silently.

## Files

| File | Change |
|---|---|
| `supabase/migrations/056_scoring_status_and_fan_in.sql` (new) | `scoring_issuance_attempts` table; `scoring_status(owner)` read RPC |
| `apps/web/lib/collection/status.ts` (new, +test) | pure `deriveScoringStatus(jobs, receipt, registered)` |
| `apps/web/lib/collection/fan-in.ts` (new, +test) | `onJobComplete` → `maybeIssue(owner, date)` |
| `apps/web/lib/collection/enqueue.ts` (new, +test) | `enqueueCollection(owner, reason)` for every connected provider |
| `apps/web/lib/profile/issue-receipt.ts` (+tests) | called only by fan-in; records every outcome |
| `apps/web/app/api/auth/callback/route.ts` (+test) | enqueue `signup` |
| `apps/web/app/api/auth/{bitbucket,codeberg,gitlab}/callback/route.ts` (+tests) | enqueue `reconnect` for that provider |
| `apps/web/app/api/refresh/route.ts`, `recalculate`, `generate`, `admin/bulk-recalculate` (+tests) | enqueue, then run one slice via `after()`; the response carries `scoringStatus` |
| `apps/web/app/api/cron/warm-cache/route.ts` (+test) | enqueue `daily` for registered handles; remove the inline issuance (`:470`) |
| `apps/web/app/api/scoring/status/route.ts` (new, +test) | GET for the authenticated owner; POST `{action:"retry", provider}` enqueues `retry` |
| `apps/web/lib/profile/post-write-score.ts` (+test) | returns `ScoringStatus`, not `legacy`/`pending` |
| `apps/web/lib/render/BadgeSvg.tsx`, `lib/render/badge-state.ts` (new), and render tests | `collecting` / `unregistered` / `action_needed` badge variants |
| `apps/web/app/u/[handle]/badge.svg/route.ts`, `og-image/route.ts`, `page.tsx` (+tests) | resolve status; render the state; no-store while not ready |
| `apps/web/components/SharePageOwnerContent.tsx`, `BadgeToolbar.tsx` (+tests) | show the status panel and act on it |
| `apps/web/app/settings/ScoringStatusPanel.tsx` (new) and `app/settings/page.tsx` | per-provider status, reason, action |
| `apps/web/app/generating/[handle]/GeneratingProgress.tsx` (+test) | poll `/api/scoring/status` and show progress |
| `apps/web/app/api/health/route.ts` (+test) | `scoringQueue` block |
| `apps/web/lib/i18n/dictionaries/{en,es}.ts` | `scoring.status.*` keys |
| `apps/web/lib/profile/leaderboard.ts` (+test) | unchanged semantics (ready receipts only); confirm with a test that collecting owners are skipped |

## Status model

```ts
type ScoringStatus =
  | { kind: "unregistered" }
  | { kind: "collecting"; percent: number; sources: ProviderStatus[]; hasPriorReceipt: boolean }
  | { kind: "action_needed"; sources: ProviderStatus[]; hasPriorReceipt: boolean }
  | { kind: "ready"; receiptDate: string; updating: boolean };
type ProviderStatus = { provider; state: JobState; percent; resumesAt?: string; attempt?: number;
                        reason?: "reconnect" | "rate_limited" | "temporary" | "failed"; stop?: SourceDiagnostic };
```

- `percent` = operationsDone / max(operationsKnown, 1), capped at 99 until done. The value is honest: discovery can grow `operationsKnown`, and the UI labels it as an estimate.
- Deriving the status is a pure function with an exhaustive table test covering every combination of job states × receipt present or absent × registered or not.

## Fan-in and outcome recording

```ts
onJobComplete(job):
  jobs = jobsFor(job.owner, job.reference_date)
  if any job for a connected provider is not complete: return
  outcome = await issueScoreReceipt(owner, { referenceTime: job.reference_time })   // reads the finished observations, no collection
  record scoring_issuance_attempts(owner, date, outcome, reason)                    // every outcome
  scheduleServerEvent("scoring_issuance_outcome", { outcome, reason })
  if outcome === "failed": captureServerError(...); leave the fan-in marker unset → retried on the next tick (runCollectionTick first re-runs fan-in for complete-but-unissued days)
```

- `issueScoreReceipt` can no longer return a silent `skipped`. Its results are:
  - `issued`
  - `unchanged`
  - `failed{reason}`
- `preserve` reasons become explicit `failed{source_error | craft_error | storage_error}`. Each one is recorded and surfaced.

## Surfaces

- **Badge** (`data-chapa-state`):
  - `rendered` for a ready receipt (existing).
  - `collecting`: identity header, "Scoring in progress, n%", no score or radar numbers.
  - `action_needed`: identity header plus "Scoring paused: action needed".
  - `unregistered`: "Not on Chapa yet" plus `chapa.thecreativetoken.com`.
  - When a prior receipt exists, the last receipt is rendered with the existing stale label. Collecting is shown only on the owner's surfaces.
  - Every non-ready state is sent `no-store`.
  - These are machine-readable for the release probe, like the 2026-09-22 plan.
- **OG image:** same states. Non-ready is sent `no-store`.
- **Share page:**
  - Visitors see the badge state plus one sentence.
  - The owner sees the status panel (per provider: state, percent, resume time, reason, action button).
- **`/settings`:** `ScoringStatusPanel`, with Retry per failed provider and Reconnect links using the existing keys.
- **Refresh / generate:** the response body is `{ scoringStatus }`. The UI renders the status. It never reloads into an unchanged page without saying why.

## Observability

- Events:
  - `scoring_collection_slice` (provider, stopKind, requests, events, done)
  - `scoring_collection_failed` (provider, stopKind, httpStatus, operation, attempt)
  - `scoring_issuance_outcome`
- Alerts (`captureOperationalAlert`, P2):
  - `scoring_collection_failed` on the terminal `failed` state, deduped per owner/provider/day.
  - `scoring_queue_stuck` when the oldest queued job is older than 2 h or a lease has been expired for more than 30 min, checked in `runCollectionTick`.
- `/api/health` `scoringQueue`:
  - `{ queued, running, retrying, waitingRateLimit, failedToday, oldestQueuedAgeMs, expiredLeases }`
  - Degraded when `oldestQueuedAgeMs > 2h`, `expiredLeases > 0` for more than 30 min, or the `collect-evidence` heartbeat is stale (> 15 min).
  - Tests follow the existing heartbeat tests.

## Steps (TDD order)

1. **4.1 Status.** Status table test (red) → `status.ts`.
2. **4.2 Fan-in.**
   - Red: two providers, one completes and nothing is issued; the second completes and exactly one issuance happens.
   - Red: an issuance failure is recorded and retried on the next tick.
   - Green.
3. **4.3 Enqueue sites.**
   - Red: the callback enqueues `signup` for every connected provider.
   - Red: a platform reconnect enqueues `reconnect`.
   - Red: refresh enqueues and responds with a status.
   - Red: warm-cache enqueues `daily` and no longer calls issuance.
   - Green.
4. **4.4 Status API.** Owner-only GET and retry POST, rate-limited strict like refresh. Register it in write-registration.
5. **4.5 Render states.** Badge, OG and share, each with a red test per state (including `data-chapa-state` and `no-store`). Snapshot tests in both locales.
6. **4.6 Owner UI.** Settings panel, share owner panel, toolbar and generating progress (component tests with mocked status).
7. **4.7 Observability.** Health block tests, alert dedupe test and event schema tests.
8. **4.8 E2E.** Extend `scoring-point-consistency.spec.ts`: a fixture owner with a queued job shows collecting. After driving `collect-evidence` in local candidate mode, the owner shows ready with an identical score on badge, share, `/api/profile`, MCP and history. Also add a `failed` fixture showing the reason and Retry.

## Success criteria

**Automated**
- All tests listed above pass.
- The e2e spec passes on chromium and mobile.
- The global verification list passes.

**Manual**
- Visual check of the four badge states in EN and ES, and the settings panel with each provider state (local candidate).
