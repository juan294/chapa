# Plan: universal v7.2 scoring with reliable evidence collection

- **Date:** 2026-09-23
- **Issue:** #1335
- **Research:** `docs/research/2026-09-23-v72-universal-issuance-and-collection-reliability.md`
- **Release shape:** implemented on `develop` in worktrees, then released through the normal `develop` to `main` flow (`docs/release/release-playbook.md`). Phase 7 is the production rollout. Each production action in it (migration, release, data reset, enqueue) needs the owner's explicit authorization when it is run. Implementing the other phases authorizes none of it.

## Problem, as measured in production (2026-09-23)

- `scoring_v7_rendering` was switched on at 09:57:16Z.
- juan294 granted consent at 10:03:23Z. Four source observations were written, but no receipt was issued, and nothing was logged.
- GitHub stopped at 400 events with `pagination_incomplete` and `source_error`, 32 s after the start. That matches the single 30 s `AbortSignal` in `apps/web/lib/github/evidence.ts:63-67`. The abort exception maps to `source_error` at `:85`.
- Bitbucket recorded `source_error` on the one repository. No diagnostic survives: only reason codes are stored.
- Any `source_error` causes `preserve("source_error")` at `apps/web/lib/profile/score-receipt-observed.ts:171`. That result becomes a silent `skipped` in `apps/web/lib/profile/issue-receipt.ts:85`.
- Every surface still renders v6 (`legacyViewModel`), and the landing top-three strip is empty.

## Owner decisions (binding, 2026-09-23)

1. Every signed-up subject is scored with v7.2. The publication-consent option is removed completely: UI, API action, SQL predicates and the source-authorization gate.
2. No legacy v6 remains as a rendered or selectable policy on any surface. v6 scoring code and v6 data are deleted, including `metrics_snapshots`, `verification_records` and v6 HMAC codes. The `scoring_v7_rendering` selector is retired.
3. Collection is durable and resumable, and it converges for very active profiles.
4. No silent failure. Every skipped or failed outcome is recorded, observable and shown to the owner with a reason and a way to recover.
5. Only signed-up users are scored. A signed-up user is a handle with a `user_platforms` row for `github`; this is the sharp test in the owner's memory, not the email filter. Any other handle's badge shows a "not on Chapa yet" state with no number.
6. The first score is not published until collection is complete. Until then, surfaces show "scoring in progress" with progress figures.
7. Docs are updated to record the reversal.

## Architecture after this plan

```text
OAuth callback ──► ensure subject ──► enqueue(owner, all connected providers, today)
refresh button ──────────────────────► enqueue(...) + run one slice in after()
warm-cache (hourly) ─────────────────► enqueue daily jobs for registered users
collect-evidence cron (every 5 min) ─► claim jobs (lease) ─► collector slice(checkpoint, budget)
                                            │  events → staged; checkpoint saved
                                            │  rate limit → wait until reset
                                            │  transient → backoff retry
                                            ▼
                                       job complete ─► append observation (existing RPC)
                                            ▼
                             all of owner's jobs for the day complete?
                                            ▼ yes
                                     issueScoreReceipt(owner) ─► publish, verification, caches
render surfaces ◄── receipt (ready) | scoring status (collecting / failed + action) | not registered
```

## Design choice: durable queue, not a bigger single run

| Option | Verdict |
|---|---|
| **A. Lease-based job table + checkpointed collector slices + cron worker** (the campaign-send pattern, migrations 023-033) | **Chosen.** Survives crashes, rate limits and function limits. Converges across runs. Visible state for owners and operators. |
| B. Raise the single-run budget to 300 s in `after()` | Rejected. juan294 needs about 3,000 GitHub requests (roughly one per merged PR for files, plus per-repo and per-issue calls), which is more than one run and close to the 5,000/h token limit. The search API is also capped at 1,000 nodes. |
| C. Redis list queue | Rejected. The repo has no Redis queue primitive. Leases, retries and audit are already proven in Postgres (`claim_campaign_sends`). Durability should live next to the receipts. |

## Phases

| # | Phase | Depends on | Batch |
|---|---|---|---|
| 1 | [Honest stop classification and diagnostics](2026-09-23-universal-v72-reliable-collection-phases/phase-1.md) — [x] done | none | `[batch-eligible]` with 2 |
| 2 | [Remove publication consent](2026-09-23-universal-v72-reliable-collection-phases/phase-2.md) — [x] done | none | `[batch-eligible]` with 1 |
| 3 | [Durable resumable collection](2026-09-23-universal-v72-reliable-collection-phases/phase-3.md) — [x] done | 1, 2 | no |
| 4 | [Issuance fan-in, pending states and no silent failure](2026-09-23-universal-v72-reliable-collection-phases/phase-4.md) — [x] done | 3 | no |
| 5 | [Delete v6](2026-09-23-universal-v72-reliable-collection-phases/phase-5.md) | 4 | no |
| 6 | [Reverse the docs](2026-09-23-universal-v72-reliable-collection-phases/phase-6.md) | 5 | no |
| 7 | [Production rollout (authorization-gated)](2026-09-23-universal-v72-reliable-collection-phases/phase-7.md) | 6 | no |

**Migration numbers are fixed** so that phases 1 and 2 can run in parallel without colliding:

| Migration | Phase | Purpose |
|---|---|---|
| none | 1 | no SQL change |
| `054_remove_publication_consent.sql` | 2 | expand |
| `055_scoring_collection_queue.sql` | 3 | expand |
| `056_scoring_status_and_fan_in.sql` | 4 | expand |
| `057_retire_v6_selector.sql` | 5 | expand |
| `058_contract_v6_and_consent.sql` | 5 | contract, applied only after the release |

The split follows `docs/runbooks/migrations.md:122` and `:203-215`: migrations are applied before the code that depends on them, and destructive drops wait until no running code reads the objects.

Phases 1 and 2 have no file overlap:
- Phase 1 touches `lib/{github,bitbucket,gitlab,codeberg}/evidence*.ts`, `lib/platform/source-collectors.ts` and the analytics event schema.
- Phase 2 touches migrations, consent UI/API/types, `lib/platform/source-authorization.ts`, `lib/profile/issue-receipt.ts` and `lib/db/report-craft.ts`.

## Required invariants

- **Unavailable is still not empty** (`docs/plans/2026-09-08-v7-single-score-consistency-phases/policy.md:25`). An incomplete or failed collection never publishes a receipt whose counts are presented as complete. The first receipt waits for completeness (decision 6). Later receipts are built from complete collections only. Partial daily slices never replace a complete observation (`apps/web/lib/platform/source-coordinator.ts:89` semantics retained).
- **A budget or timeout stop is never recorded as `source_error`.** Only a provider-reported or structural failure is.
- **Nothing durable is created from a public read** (#1239, `CLAUDE.md:201`). Enqueueing happens only in the OAuth callback, owner refresh, the warm-cache cron (registered users) and admin actions.
- **Every job state is visible:**
  - Owner: `/settings` scoring panel, refresh response, share-page owner banner.
  - Public: badge and share state.
  - Operator: `/api/health` `scoringQueue` block, alerts, PostHog events.
- **No credentials, API bodies or URLs with secrets** are stored in job rows or telemetry. Only provider, operation name, HTTP status and a stop kind.
- **Receipt schema and scoring math are unchanged.** `computeObservedImpactV7`, the receipt parsers and the `v7.2` policy stay byte-identical. This plan changes collection, gating and rendering only.

## Stuck states and recovery

| State | Who sees it, and what | How it ends | Test that proves it |
|---|---|---|---|
| Job `running` with an expired lease (worker crashed or timed out) | Owner: "collecting, n%", with the time since the last progress shown. Operator: `stuckLeases` in health if older than 30 min. | The next claim recovers leases where `lease_expires_at < now()`. | Phase 3: contract test for claim recovery. Phase 4: health test for the stuck-lease threshold. |
| Job `waiting_rate_limit` | Owner: "GitHub rate limit reached, resuming at HH:MM UTC". | Automatic at `next_run_at` = provider reset time. | Phase 3: worker test with a rate-limit fixture. Phase 4: status render test showing the resume time. |
| Job `retrying` (5xx, 429, network) | Owner: "temporary error from Bitbucket, retrying at HH:MM (attempt k/8)". | Exponential backoff. After 8 attempts it becomes `failed`. | Phase 3: backoff schedule unit test. Phase 4: status render test. |
| Job `failed` because access was lost (401/403 on a linked platform) | Owner: "reconnect Bitbucket", linking to `/settings` connections (existing `userMenu.reconnect*` keys). Badge shows the last receipt, or "scoring in progress: action needed". | Reconnecting enqueues a new job (connect callback hook). | Phase 4: the reconnect callback enqueues, and the status shows the action. |
| Job `failed` terminally (structural or parse error, or retries exhausted) | Owner: "Bitbucket data could not be read (operation X, HTTP n). We were alerted; you can retry." with a Retry button. Operator: P2 alert `scoring_collection_failed`. | Owner Retry, or the operator fixes the code; then the next warm-cache enqueues a fresh job. | Phase 4: alert emitted on terminal failure; Retry button enqueues. |
| Owner has no receipt yet and collection is in progress | Public badge: `data-chapa-state="collecting"` with "Scoring in progress". Share page: progress panel. | Receipt issuance on fan-in. | Phase 4: badge, share and OG render tests for the collecting state. |
| Handle not registered | Public badge: `data-chapa-state="unregistered"`, "Not on Chapa yet", and the claim URL. | The person signs in (OAuth) and a job is enqueued. | Phase 4: unregistered badge test, and an OAuth callback test that enqueues. |
| Issuance fails (storage error) after collection completed | Owner: "score publication failed, retrying". Operator: `captureServerError` plus the `scoring_issuance_outcome` event. | The fan-in retry runs on the next cron tick (the job stays `complete`; the fan-in marker is not set until publication succeeds). | Phase 4: fan-in retry test. |
| Queue backlog (oldest queued job older than 2 h) | Operator: `/api/health` degraded plus an alert. Owner: queue position or an estimated start. | Cron throughput; the operator can raise `MAX_JOBS_PER_RUN`. | Phase 4: health threshold test. |
| Receipt exists but today's collection is still running | Public: the last receipt with its date (`freshness: stale` label already exists). Owner: "updating". | Daily fan-in. | Phase 4: stale label test with an in-progress status. |
| Retired v6 verification code requested | Public `/verify/<hex>`: "This is a retired v6 verification code. Current badges use v7.2 receipt codes." HTTP 410, not a 500. | Terminal by design, with an explained page. | Phase 5: verify page and API test for legacy hex returning 410. |

## Consumer sweep

Commands (run 2026-09-23 on `develop` `d5fb8dc5`):

```bash
for p in issueScoreReceiptIfConsented legacyViewModel readScoringRenderSelection isScoringV7RenderingEnabled \
  public_evidence_consent publicConsent computeImpactV6 metrics_snapshots verification_records getVerificationRecord \
  'collectSource\b' fetchGitHubEvidence fetchBitbucketEvidence fetchGitlabEvidence fetchCodebergEvidence \
  postWriteScore PublicationConsent scoring_v7_rendering machinePolicy; do
  grep -rlE "$p" apps/web packages scripts supabase/migrations .github | grep -v node_modules | grep -v '\.next/'
done
```

Every non-generated hit is listed below with the phase that covers it. `packages/shared/dist/*` is build output and regenerates. Historical migrations are immutable; they are superseded by migrations 054-058, never edited.

| Symbol / data | Callers and writers (production code, tests, fixtures, scripts) | Covered by |
|---|---|---|
| `issueScoreReceiptIfConsented` | `app/api/{admin/bulk-recalculate,cron/warm-cache,evidence,generate,recalculate,refresh}/route.ts` plus tests; `lib/profile/issue-receipt*.ts`; `lib/profile/scoring-consumer-inventory.test.ts`; `lib/profile/scoring-v7-enabled.contract.test.ts` | Phase 2 renames it to `issueScoreReceipt` and drops the consent gate. Phase 4 moves every caller to `enqueueCollection`, with only the fan-in calling issuance. |
| consent: `public_evidence_consent`, `publicConsent`, `PublicationConsent` | migrations 039/041/043-046/048/050-053 (superseded by 054); `lib/platform/source-authorization.ts`(+test); `lib/db/engineering-evidence.ts`; `lib/evidence/{types,test-fixtures}.ts`; `lib/profile/score-receipt-{observed,v7}.ts`(+tests); `app/settings/{EvidenceWorkflow,PublicationConsent}.tsx`; contract tests in `app/api/insights`, `app/api/verify/[hash]`, `lib/db/{platform-token-refresh,score-receipts-observed,snapshots-v7,source-context,verification-v7}`, `lib/profile/{issue-receipt,score-receipt-v7,scoring-v7-enabled}`; `scripts/check-pending-migrations.ts` | Phase 2 (all of them). `check-pending-migrations.ts` only mentions consent in a probe list: update the expected columns. |
| `readScoringRenderSelection`, `isScoringV7RenderingEnabled`, `scoring_v7_rendering`, `machinePolicy` | 49 non-test and test files listed by the command, including `app/[locale]/about/scoring/page.tsx`, `app/LocalizedHome.tsx`, all API routes above, `app/settings/page.tsx`, `app/studio/page.tsx`, badge/OG/share routes, `lib/feature-flags.ts`, `lib/db/feature-flags.ts`, `lib/profile/{leaderboard,materialize-profile,score-model,issue-receipt}.ts`, `lib/render/{badge-svg-cache,badge-locale}.ts`, `lib/scoring-render-selection.ts`, `lib/webmcp/server-tools.ts`, `app/api/admin/feature-flags/route.ts`, `e2e/helpers/scoring-point-fixtures.ts`, `e2e/scoring-point-consistency.spec.ts`, `scripts/recalculate-handles.ts`, migration 049 | Phase 5. The selector becomes a constant `v7.2` policy. Cache key segments keep the literal `v7.2` so the key format is unchanged (see phase 5 step 5.2). |
| `legacyViewModel` | `lib/profile/{score-model,score-view-model,stored-badge-profile}.ts`, `lib/render/BadgeSvg.tsx`, `app/api/profile/[handle]/route.ts` plus 13 test files | Phase 5 |
| `computeImpactV6` and the v6 impact modules | `lib/impact/{v6,smoothing,utils,recency,heatmap-evenness,simulate}.ts`, `lib/profile/{materialize-profile,stored-badge-profile}.ts`, `app/api/generate/route.ts`, `app/api/admin/users/route.ts`, `lib/validation.ts`, `e2e/helpers/redesign-fixtures.ts`, `packages/shared/src/constants.ts`, `scripts/check-craft-propagation.sh`, `scripts/lib/check-craft-propagation.py`, tests (`golden-profiles`, `pipeline`, `craft-propagation`, `craft-e2e-propagation`, `v6.test`, `useStudioWebMcpTools.test`, `validation.test`, `server-tools.test`) | Phase 5 |
| `metrics_snapshots` / `MetricsSnapshot` | `app/api/cron/warm-cache/route.ts`, `lib/db/{snapshots,supabase}.ts`, `lib/profile/snapshot-write.ts`, `lib/github/client.integrity.contract.test.ts`, `packages/shared/src/types.ts`, e2e `redesign-fixtures.ts`, `scoring-point-fixtures.ts`, `journey.spec.ts`, scripts `backfill-{parsers,supabase}.ts`, `clone-prod-db.ts`, `delete-user.ts`, `heal-poisoned-stats.ts`, `recalculate-handles.ts`, `rls-deny-migration.test.ts`, `scoring/migrate-v7.ts` | Phase 5 (the code stops using it; contract migration 058 drops the table, the views `latest_snapshots` / `admin_users` and the snapshot RPCs after the release) |
| `verification_records` / `getVerificationRecord` / v6 HMAC | `lib/db/verification.ts`, `lib/profile/public-profile.ts`, `lib/verification/{hmac-payload,store}.ts`, `app/api/verify/[hash]/route.ts`, `app/verify/[hash]/page.tsx`, `lib/webmcp/server-tools.ts`, `app/api/cron/warm-cache/route.ts` (cleanup), e2e fixtures, scripts (backfill, clone-prod-db, delete-user, rls test) | Phase 5 |
| Collectors (`fetch{GitHub,Bitbucket,Gitlab,Codeberg}Evidence`) and `collectSource` | `lib/platform/source-collectors.ts`; re-exports in `lib/{github,bitbucket,codeberg,gitlab}/stats.ts`; `packages/shared/src/github-query.ts` (query-shape reference); tests in each provider dir | Phase 1 (classification and diagnostics). Phase 3 (checkpoint signature, called only by the worker). |
| `postWriteScore` | `app/api/{admin/bulk-recalculate,generate,recalculate,refresh}/route.ts`, `lib/profile/post-write-score.ts`(+test) | Phase 4 (returns scoring status instead of the `legacy` outcome) |
| Source observations writer `scoring_v7_append_source` | `lib/db/source-context.ts` (from `source-coordinator.ts`); the supplemental path `scoring_v7_store_supplemental` | Phase 3 (the worker becomes the only collector writer; the coordinator becomes read-only). Supplemental excluded: EMU uploads are an owner write path that already records `legacy_upload`. Phase 5 decides its label (step 5.9). |

## Automated verification (every phase)

Run in order, keeping each exit status:
1. `pnpm run test`
2. `pnpm run typecheck`
3. `pnpm run lint`
4. `pnpm run check:circular`
5. `pnpm run test:contract:local` (after `supabase start`)
6. `pnpm run test:coverage` (phases 3-5)
7. `pnpm run build` plus the bundle-size check (phases 4-5)
8. The relevant `pnpm run test:e2e` specs, in local-candidate mode (phases 4-5)

`pnpm run check:write-registration` is needed for every new write endpoint (phases 3-4).

## Manual verification

This is limited to what automation cannot see:
- A visual check of the collecting, unregistered and failed badge states in both locales (phase 4).
- The phase 7 production observations, each with the owner's authorization.

## Out of scope

- Changing v7.2 scoring math or the receipt schema.
- The OpenAI plugin application. It resumes after phase 7, from the checklist in the session notes.
- Self-serve account deletion (still `scripts/delete-user.ts`).
