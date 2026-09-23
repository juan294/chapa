# Research: universal v7.2 issuance and evidence-collection reliability

- Date: 2026-09-23
- Branch: `develop` at `d5fb8dc5`. Production runs `ede8f57e` (v3.0.3).
- Question: what exists today for (1) the publication-consent gate and every v6 fallback, (2) the four evidence collectors and the silent skip, (3) durable storage and resumability, (4) background, retry and queue mechanisms, and (5) issuance observability?
- Context: #1335. The owner's decision (2026-09-23) is that every subject moves to v7.2, with no consent option and no v6/v7 choice.

This document describes the current code only. All paths are relative to `apps/web/` unless they start with `supabase/` or `docs/`.

## 0. Production evidence (2026-09-23, from direct queries this session)

- `scoring_v7_rendering` was set to `true` at 09:57:16Z through `PATCH /api/admin/feature-flags`. The response was `{persisted:true, edgePurge:"purged"}`.
- Before juan294 opted in, `scoring_v7_subjects`, `scoring_v7_receipts` and `scoring_observed_current` all had 0 rows.
- juan294 granted consent at 10:03:23.548Z. `POST /api/evidence` returned 200, and no warning or error log was written after 10:02Z.
- Four rows were written to `scoring_v7_source_observations`, all with `reference_time` 10:03:23.848Z:

| Provider | Events | Repos | Reason codes | Recorded |
|---|---|---|---|---|
| github | 400 | 36 | acceptance_time_unknown, discovery_incomplete, not_supported, pagination_incomplete, partial_files, **source_error** | 10:03:55 |
| bitbucket | 0 | 1 | acceptance_time_unknown, attribution_unknown, discovery_incomplete, not_supported, **source_error** | 10:03:29 |
| gitlab | 0 | 0 | acceptance_time_unknown, attribution_unknown, discovery_incomplete, not_supported | 10:03:27 |
| codeberg | 0 | 0 | acceptance_time_unknown, discovery_incomplete, not_supported | 10:03:33 |

- Afterwards `scoring_v7_receipts` still had 0 rows. `/api/profile/juan294` returns `policyVersion:"v6"`, `limitations:["legacy_aggregate"]`. The landing leaderboard strip renders no entries.

## 1. Consent gate

### 1.1 Schema and ledger

- `supabase/migrations/039_scoring_v7_foundation.sql:6-12` defines `scoring_v7_subjects(owner_handle PK, public_evidence_consent boolean NOT NULL DEFAULT false, consent_recorded_at, created_at)`. A CHECK requires a timestamp whenever consent is true.
  - Every other `scoring_v7_*` table cascades from this row.
  - RLS is forced on all of them, and only service_role has access (039:299-318).
- The ledger action `consent` (`041_engineering_evidence_ledger.sql:22-23, 35-42`) upserts the subject and requires `publicationAcknowledged`.
  - `enabled=false` calls `scoring_v7_withdraw`. The `withdraw` action (041:43-46) does the same.
- `scoring_v7_withdraw` (043:66-78) inserts content-free tombstones into `scoring_v7_revocations` (039:187-190). It then deletes anchors and evidence, then the subject.

### 1.2 SQL functions that require consent

Each of these takes `... WHERE public_evidence_consent FOR UPDATE` or returns NULL without consent.

| Function | Location | Behaviour without consent |
|---|---|---|
| `scoring_v7_publish_receipt` | 043:86 | lock finds no row |
| `scoring_v7_receipt_manifest` / `scoring_v7_read_receipt` | 043:123, 050:135 | NULL |
| `scoring_v7_issue_verification` | 044:8 | lock finds no row |
| `scoring_v7_read_verification` | 044:24-30 | NULL; `revoked` if a tombstone exists |
| `scoring_v7_lock_source_context`, `scoring_v7_cas_link_tokens` | 045:68, 045:259 | lock finds no row |
| platform token refresh claim/finish/takeover | 046:30, 046:60, 048:34, 048:67, 053:114 | lock finds no row |
| `scoring_observed_publish_receipt` | 050:46, 051:10 | lock finds no row |
| `scoring_observed_receipt_manifest` / `scoring_observed_read_receipt` | 050:104-105, 051:77, 050:118 | NULL |
| `scoring_report_craft_store` | 051:150-172 | `consent_required` unless acknowledged; success sets consent=true |
| `scoring_report_craft_read` | 051:212-213 | NULL |
| `scoring_observed_publish_with_report` | 051:236-237 | raises `Public evidence consent required` |
| `scoring_observed_history` | 052:6-7 | NULL |
| view `admin_users_observed` | 052:21-31 | joins the subject only when consented; otherwise `current_policy_version='v6'` |

### 1.3 Application flow

- **Settings:**
  - `app/settings/EvidenceWorkflow.tsx:41-45` reads `dbReadEngineeringEvidence(owner, owner, window).publicConsent`.
  - It renders `PublicationConsent` only when `isScoringV7RenderingEnabled()` is true (EvidenceWorkflow.tsx:51, 97-101; `lib/feature-flags.ts:146-147`).
- **Consent control:** `app/settings/PublicationConsent.tsx:20-50` POSTs `/api/evidence` with `{action:"consent", owner, enabled, publicationAcknowledged:true}`. It checks only `response.ok`.
- **Validation:** `lib/evidence/validation.ts:53` requires `publicationAcknowledged: literal(true)`.
- **Evidence route** (`app/api/evidence/route.ts:62-85`):
  - A withdrawal calls `withdrawReceiptPublicationV7` (`lib/verification/cleanup.ts:38-55`); anything else calls `dbWriteEngineeringEvidence`. Both then call `invalidateProfileReadModels`.
  - When consent is enabled, the route awaits `issueScoreReceiptIfConsented(owner)` (line 75) and discards the result.
  - A withdrawal returns 202 or 503 depending on cleanup status.
- **Source authorization:** `lib/platform/source-authorization.ts:11-29` returns `unavailable` unless consent is true and `consent_recorded_at` is set. GitHub needs no link. The other providers also need their `{provider}_integration` flag and a linked platform.
- **Materialization gate:** `lib/profile/score-receipt-observed.ts:155-156` returns `{status:"unavailable", reason:"not_consented"}`. The archived v7 path has the same gate at `lib/profile/score-receipt-v7.ts:171-172`.
- **Craft read:** `lib/db/report-craft.ts:46-50` maps a NULL RPC result to `{status:"not_consented"}`. `materializeCurrentObservedReceipt` (`lib/profile/issue-receipt.ts:22-24`) throws `Report authority unavailable` for any status other than `found`.

### 1.4 `issueScoreReceiptIfConsented` (`lib/profile/issue-receipt.ts:49-90`) and its callers

It returns `skipped` in these cases:
- the flag is off (57)
- `not_consented`
- any preserve reason other than `storage_error`
- an existing receipt `stored` with no change

It returns `failed` in these cases:
- non-current freshness (62), with no capture
- the verification write throws (captured)
- `storage_error` (captured)
- a thrown exception (captured)

| Caller | Location | Uses the result? |
|---|---|---|
| refresh | `app/api/refresh/route.ts:165-182` | Yes, passes it to `postWriteScore` |
| recalculate | `app/api/recalculate/route.ts:105-121` | Yes, `postWriteScore` |
| generate | `app/api/generate/route.ts:117-140` | Yes, `postWriteScore` |
| admin bulk-recalculate | `app/api/admin/bulk-recalculate/route.ts:168-169` | Yes, collected into `publications[]` (only after `replaced`) |
| cron warm-cache | `app/api/cron/warm-cache/route.ts:470` | No, discarded |
| evidence consent | `app/api/evidence/route.ts:75` | No, discarded |

`postWriteScore` (`lib/profile/post-write-score.ts:20-30`) maps the result as follows:
- flag off → `legacy`
- a current receipt → `current` (a `failed` issuance on top of it → `stale`/`pending`)
- no receipt and `skipped` → `legacy`
- otherwise → `unavailable`/`pending`

## 2. Where v6 / legacy is selected or rendered

**Selection:** `lib/scoring-render-selection.ts:27-45` reads `scoring_v7_rendering` directly from the database (`lib/db/feature-flags.ts:72`).
- The read has a 500 ms timeout. If it gives no answer, the result falls back to the env var `SCORING_V7_RENDERING_ENABLED` and is marked non-cacheable.
- The result is cached per instance for 5 s and within the same UTC day (14, 29).
- `machinePolicy` is `"v7.2"` when enabled, otherwise `"v6"`. Migration 049 seeds the flag as `false`.

**Path to v6 while the flag is on:** the manifest RPC returns NULL → `dbReadObservedReceipt` returns `missing` (`lib/db/score-receipts-observed.ts:74, 84`) → `readRenderableReceipt` returns null → `legacyViewModel`.

| Surface | Location | Condition that gives v6 | Output |
|---|---|---|---|
| `readRenderableReceipt` | `lib/profile/score-model.ts:13-19` | flag off, receipt missing, or retracted → null; read error → `{unavailable}` | none |
| `scoreModelFrom` | score-model.ts:29-32 | null or unavailable | `legacyViewModel` |
| `legacyViewModel` | `lib/profile/score-view-model.ts:178-202` | always | `policyVersion:"v6"`, `limitations:["legacy_aggregate"]`, `craft:null` |
| materialize | `lib/profile/materialize-profile.ts:222-233, 247-304` | through `scoreModelFrom`; rejected read → unavailable (301) | same |
| public profile / HMAC | `lib/profile/public-profile.ts:72, 236-241`; `lib/profile/badge-verification.ts:24-29` | v6 → HMAC `verification_records` | |
| stored badge fallback | `lib/profile/stored-badge-profile.ts:140-175` | observed score not current | v6, `freshness:"stale"` |
| badge SVG | `lib/render/BadgeSvg.tsx:193, 299-307`; `lib/render/scoring-evidence-label.ts:51` | `scoring ?? legacyViewModel(impact)` | " Legacy v6 aggregate score." |
| badge route | `app/u/[handle]/badge.svg/route.ts:494, 571, 728-756` | yesterday's SVG reused only when the policy is v6 | |
| OG | `app/u/[handle]/og-image/route.ts:87-88, 153-175` | materialized scoring | |
| share page | `app/u/[handle]/page.tsx:236, 287-308, 478-485` | materialized or stored scoring | |
| landing | `app/LocalizedHome.tsx:45-60` | flag off → `LANDING_IMPACT` | |
| leaderboard | `lib/profile/leaderboard.ts:33-106` | not cacheable → `[]`; v7.2 → drawable receipts only; v6 → stored headline plus live fill | |
| `/api/profile` | `app/api/profile/[handle]/route.ts:21, 62-116` | receipt not current → snapshot | v6 |
| `/api/insights/[handle]` | `app/api/insights/[handle]/route.ts:38-46` | not current | `policyVersion:"v6"` |
| `/api/history` | `app/api/history/[handle]/route.ts:83-104` | flag off or observed history missing | v6 |
| MCP profile/compare | `lib/webmcp/server-tools.ts:103-171, 395-410` | no selection argument; no scoring → nulls plus `legacy` | `not_comparable` when either side has no scoring |
| MCP history | server-tools.ts:275-290 | same as `/api/history` | |
| MCP `verify_badge` | server-tools.ts:308-327 | token is not a v7 token | `version:"v6", status:"legacy_record"` |
| WebMCP | `app/u/[handle]/SharePageWebMcpTools.tsx:87-103`; `lib/webmcp/shared-tools.ts:143`; `app/studio/useStudioWebMcpTools.ts:271-294`; `app/verify/[hash]/VerifyPageWebMcpTools.tsx:25-49` | v6 branches | |
| verify API/page | `app/api/verify/[hash]/route.ts:20, 42-60`; `app/verify/[hash]/page.tsx:81-97` | token not prefixed `v7.` | `legacy_record` |
| emails | `lib/email/notifications.ts:91-100`; warm-cache route.ts:606-629; `lib/email/score-bump.ts:423-444` | v6 bump only when `machinePolicy==="v6"` | |
| dashboard | `components/dashboard/ImpactDashboard.tsx:64`; `DimensionCardsRow.tsx:46`; `components/SharePageOwnerContent.tsx:282` | not v7.2 | |
| projection/compare | `lib/profile/public-score-projection.ts:12-39` | mixed policies → `policy_mismatch` | |
| admin | `app/api/admin/users/route.ts:66-69`; `lib/db/admin-users.ts:232`; `app/admin/AdminUserTable.tsx:54, 104` | flag on → `admin_users_observed` | policy tag |
| supplemental | `app/api/supplemental/route.ts:150` | always | `legacy_aggregate`, `coverage:"legacy"` |
| metadata | `lib/profile/score-description.ts:5-11` | not a v7.2 point | v6 wording |

The documented basis for the fallback:
- `docs/impact-v7.md:7-9`
- `docs/runbooks/scoring-v7-transition.md:42-44`
- `docs/release/scoring-v7-release-packet.md:39`
- `docs/research/2026-09-06-v7-site-cutover-handoff.md:78-81` ("deliberate and load-bearing": any handle can be embedded) and :240-243 ("one consenting user at a time")

## 3. Evidence collectors

**Wiring:** production calls reach the collectors through `collectSource` (`lib/platform/source-collectors.ts:12-34`). It passes the window, the credential and optional repositoryIds. It never passes `maxRequests`, `timeoutMs` or a cursor.

**Budgets:** each collector owns one `AbortSignal.timeout` for its whole run and does not retry.

| Provider | File | Default requests / time | Hard maximum |
|---|---|---|---|
| GitHub | `lib/github/evidence.ts:63-67` | 80 / 30 s | 500 / 120 s (65) |
| Bitbucket | `lib/bitbucket/evidence.ts:57, 62` | 100 / 30 s | |
| GitLab | `lib/gitlab/evidence.ts:77, 80` | 100 / 30 s | |
| Codeberg | `lib/codeberg/evidence.ts:56, 59` | 100 / 30 s | |

### 3.1 GitHub (`lib/github/evidence.ts`)

**`request()` (74-86):**
- If the budget is used up or the signal has already aborted, it returns `pagination_incomplete` without fetching (75).
- 401/403 → `not_accessible`. Any other non-ok status → `source_error` (82).
- A GraphQL `errors` array → `source_error` (84).
- **Any exception → `source_error` (85).** This includes the AbortError raised when the timeout fires during `fetch` or `json()`.

**`collect()` (94-142):**
- An errored response with no nodes breaks without adding `pagination_incomplete` (108-110).
- Other paths add reason codes as follows:
  - null totalCount → `source_error` (113)
  - an errored page that still has nodes → `pagination_incomplete` (121)
  - non-boolean hasNextPage → `source_error` (124)
  - total/node mismatch → `pagination_incomplete` (127)
  - repeated or missing cursor → `pagination_incomplete` (131)
  - search issueCount > 1000 → `discovery_incomplete` (134)
  - search reaches 1000 nodes → `pagination_incomplete` and stops (137)
- Reasons merge into the source only if the operation is incomplete (139).
- Progress `{operation, variables, nextCursor, collectedNodes, totalCount, complete, reasonCodes}` is built at 140.

**Operation order:**
1. `profile` (87)
2. `repositories`, then `contributed`; `discovery_incomplete` is added unconditionally (151-154)
3. `merged` search (175), then a `files` collect per merged PR (184); `partial_files` is added at 186-187
4. `reviewDiscovery` (204), which also adds `discovery_incomplete` unconditionally (207), then a `reviews` collect per PR (215-216)
5. Per repository: `commits` (224), `issues` (231), then `closures` per issue (235)

**Other reasons:** a missing or unparseable date adds `source_error` (158-159). `acceptance_time_unknown` (271) and `not_supported` (277-279) are always present.

**Status:** `complete` only if every event kind is complete and there are no reasons (280). `accepted_change` and `review` are always partial (273, 275), so the status in practice is `partial` (283).

**Token:** `resolvedCredential`, else `token ?? getGithubToken()` (68-72). Rate-limit headers are not read anywhere in `lib/github`.

### 3.2 Bitbucket (`lib/bitbucket/evidence.ts`)

**Error mapping:**
- Budget used up or aborted → `pagination_incomplete` (67).
- 401/403/404 → `not_accessible`; any other non-ok → `source_error` (72).
- Body `type==="error"` or `error` → `source_error` (74).
- Exception or abort → `source_error` (75).

**Paths that add `source_error` for a single-repo account:**
- non-array `values` (90), non-object value (92)
- invalid, repeated, off-origin or scope-changed `next` URL (98-105)
- repo metadata mismatch (179)
- commit sha/date invalid for the subject (184-186)
- non-numeric PR id (195)
- activity dates or ids invalid (203, 210, 212)
- invalid diffstat redirect (237-246)
- `created_on` fails to parse (273)

**Always present:** `acceptance_time_unknown`, `not_supported`, `discovery_incomplete` (289). Status is always `partial` (302).

### 3.3 GitLab (`lib/gitlab/evidence.ts`)

- Error mapping is the same as Bitbucket (85, 91, 93).
- Non-array body → `source_error` (101). Bad next page or `x-total` mismatch → `pagination_incomplete` (123, 127).
- No verified email → `attribution_unknown` (146). `partial_files` at 209.
- Status is `partial` unless everything is complete (287, 292).

### 3.4 Codeberg (`lib/codeberg/evidence.ts`)

- Invalid Link cursor → `source_error` (90). Bad `x-total-count` → `pagination_incomplete` (94-95).
- `partial_files` at 189. `has_issues===false` → `not_supported` (217). Status is always `partial` (244).

### 3.5 Coordinator (`lib/platform/source-coordinator.ts:38-103`, `lib/profile/score-receipt-v7.ts:62-102`)

**Per-source selection (source-coordinator.ts):**
1. Read the exact-window observation. If it exists and this is not a refresh, return it (67-75).
2. Otherwise read `prior = exact ?? read(prior=true)` (76). `read(prior=true)` is `scoring_v7_read_source` with `p_prior=true`, which returns the latest earlier observation and prefers complete ones (`045:227-228`).
3. In readOnly mode, return the prior as `stale`, or `readonlymiss` if there is none (79).
4. Otherwise call the collector (80). **`prior` is not passed to the collector.**
5. If the collector returns null or throws, return the prior as `stale`, else `unavailable` (80-82).
6. A non-null result is appended through `scoring_v7_append_source` with a fresh UUID, whatever its reasons (83-85). The comment at line 83 reads "Never carry checkpoint URLs".
7. A complete prior in the same window wins over a new partial result (89).

**Other coordinator behaviour:**
- Write mode refreshes linked-platform tokens (52-55).
- Calls are coalesced in memory per process (39, 94-97).
- Token selection (`lib/platform/source-context.ts:47-53`): GitHub uses `credential.token ?? getGithubToken()`; linked providers use `link.tokens.accessToken`.
- Non-GitHub `collectSource` first calls `/user` with an 8 s timeout (`source-collectors.ts:21`).

**`collectSources` (score-receipt-v7.ts:62-102):**
- Runs all four providers in parallel (68-78).
- `stale` → `status:"stale"` plus `stale_data` (84-87).
- `unlinked` → excluded as `not_connected`; `disabled` → `not_consented` (91-92).
- `unavailable`, `unsupported` or `readonlymiss` → a synthetic `unavailable` source (94-99).
- No path in this coordinator assigns `legacy`.

### 3.6 The silent skip

- `lib/profile/score-receipt-observed.ts:171`: `sources.some(unavailable | stale | legacy | reasonCodes.includes("source_error"))` → `preserve("source_error")`.
- `preserve` (115-120) returns the stored receipt as `stale` if a non-retracted one exists. Otherwise it returns `{unavailable, reason}`.
- `pagination_incomplete`, `partial_files` and `discovery_incomplete` do **not** block issuance. Only `source_error`, or a status of unavailable, stale or legacy, does.
- The Craft read (172-175) and publish (198) follow the source check.
- In `issueScoreReceiptIfConsented`, an `unavailable`/`source_error` result returns `skipped` at line 85, with no capture.

## 4. Storage and resumability

**Durable tables** (from the migrations; all `scoring_v7_*` tables force RLS and are service_role only):

| Table | Location | Notes |
|---|---|---|
| `scoring_v7_sources` | 039:14 | unique (owner, provider, host, subject_id, access_context_id) |
| `scoring_v7_source_observations` | 039:27 | immutable (039:308-310), no TTL; 365-day UTC window CHECKs; `data_through <= reference_time`; `coverage`/`payload` jsonb; `upload_digest` (042:3-4); index (source_id, reference_time DESC) (039:44) |
| `scoring_v7_receipts` | 039:143, 043:3-13, 050:3-7, 051:2 | revision/supersedes chain |
| `scoring_observed_current` | 050:9 | per-owner pointer to the current v7.2 receipt |
| `scoring_v7_trend_anchors` | 039:170, 050:20 | 0.85^days EMA to within 1e-10 |
| `scoring_v7_verification` | 039:162 | |
| `scoring_v7_revocations` | 039:187 | |
| `scoring_v7_evidence`, `scoring_v7_evidence_references`, `scoring_v7_raw_artifacts` | 039:56, 119, 132 | raw artifacts expire after ≤30 days and are purged hourly by `scoring_v7_purge_expired_raw` (044:66-77) from warm-cache route.ts:386 |
| `report_craft_reports` / `report_craft_selection` | 051:93, 051:111 | |

**Source functions:**
- `scoring_v7_append_source` (045:187) enforces strict key allowlists. Its comment at 045:86 says it rejects "accidental raw responses, pagination progress". It is idempotent on the observation ID.
- `scoring_v7_read_source` (045:212) and `scoring_v7_discover_source` (045:237).

**Resumable collection does not exist:**
- The option interfaces have no cursor or resume field (`lib/github/evidence.ts:31-42`; gitlab:47, codeberg:27, bitbucket:27).
- The GitHub cursor starts at `null` on every call (97).
- `progress` is returned at 288, and nothing consumes it after the function returns. The coordinator reads only `coverage` and `events` (source-coordinator.ts:84), and the SQL allowlist rejects pagination progress.
- The only reuse of retained data: in the report-update branch, `score-receipt-observed.ts:158-170` relabels a stale prior observation as `partial` for the new window. It fetches no new data.

**Redis:**
- `snapshot:v7.2:receipt:{revisionId}`, 86400 s (`lib/cache/snapshot-cache-observed.ts:6-7, 33`).
- `snapshot:v7:receipt:{revisionId}`, 86400 s (`lib/cache/snapshot-cache.ts:20, 101-121`).
- Revocation and retired-supplemental sweep cursors (`lib/verification/cleanup.ts:6, 31, 59-63`).
- Manifests are read from Supabase on every request and are not cached.

## 5. Background, retry and queue mechanisms

**Crons** (`vercel.json`):

| Cron | Schedule | maxDuration |
|---|---|---|
| warm-cache | `0 * * * *` | 300 |
| sync-audience | `30 3 * * *` | 300 |
| process-campaigns | `0 8 * * *` | 300 |
| latency-check | `15 6 * * *` | 60 |

**Route `maxDuration` exports:**
- warm-cache :53 (300)
- process-campaigns :8
- sync-audience :17
- latency-check :16 (60)
- admin/bulk-recalculate :19 (300)
- badge.svg :51 (35)
- None on refresh, generate, recalculate or evidence.

**warm-cache** (`app/api/cron/warm-cache/route.ts`):
- **Limits:** `MAX_HANDLES=50` (77), `BATCH_SIZE=5` (80), `TIME_BUDGET_MS=270000` (105).
- **Handle selection:**
  - Rotation offset in `cron:warm-cache:offset` (108).
  - Up to 50 handles: all of them (165-168). Otherwise priority handles first, then a wrap-around scan (170-183).
- **Per handle** (`warmHandle` 454-642):
  1. Read the selection.
  2. Read the baseline receipt (465-469).
  3. `issueScoreReceiptIfConsented` with no token (470), so the server `GITHUB_TOKEN` is used. The result is discarded.
  4. `materializeOrchestratedProfile` (472).
  5. SVG warm (522-593), snapshot persist, and emails (595-631).
- **Alerts:** `warm_cache_time_budget_exceeded`, `warm_cache_high_failure_rate` and `warm_cache_ceiling_approached` (263-351).
- **Heartbeat:** 409.

**Other patterns:**
- **`after()`:** used at auth/callback:165, u/[handle]/page.tsx:425, badge.svg:676/810, insights:176, generate:129, and `lib/analytics/schedule-server-event.ts:10`. The rule is in `.claude/rules/post-response-work.md`.
- **`lib/async`:** `fireAndForget`, `withTimeout` (`DB_TIMEOUT_MS=10s`), and `processInBatches` (sequential `Promise.allSettled` batches).
- **`fetchWithRetry`** (`lib/utils/fetch-retry.ts:12, 59-69`): 2 attempts, retries 5xx only, never retries 429 or timeouts, adds jitter.
- **Durable lease queue (campaigns):**
  - `campaign_sends` gets `claimed_at`, `lease_expires_at` and `lease_token`. `claim_campaign_sends()` recovers expired leases (`supabase/migrations/023_add_campaign_send_claims.sql`; hardened in 029-033).
  - App side: `lib/email/campaigns.ts:50, 209-246` (10 min lease), and a round-robin plus time-budget loop in `app/api/cron/process-campaigns/route.ts:17, 77-79`.
- **Claim table:** `platform_token_refresh_attempts` (046/048/053) with claim, takeover and release in `lib/platform/source-refresh.ts:55-82`.
- **Locks and coalescing:**
  - Badge render lock `badge-lock:` with a 30 s TTL (badge.svg route.ts:53, 199; `lib/render/badge-svg-cache.ts:130`).
  - In-flight coalescing in `lib/github/client.ts:39, 162-174` (with a 30 s `withTimeout`) and in `lib/platform/source-coordinator.ts:39, 94-97`.
- **Rate limits:**
  - `rateLimit` fails open, `rateLimitStrict` fails closed (`lib/cache/redis.ts:279, 312`).
  - refresh 5/h per handle (strict)
  - recalculate 10/h per IP, 20/h per handle
  - bulk-recalculate 5/h
  - evidence 120/h per IP, 240/h per account (strict)
- **No queue for receipt issuance:** there is no job table, and no Redis list or stream operation in `lib`.

## 6. Observability of issuance

- **`issue-receipt.ts`:**
  - Emits no success or skip event.
  - `captureServerError({route:"issue-score-receipt-observed"})` fires only on a verification-write failure, `storage_error`, or a thrown error.
  - `score-receipt-observed.ts:207` captures only thrown errors. Source and craft preserve paths emit nothing (115-120, 164, 171-175).
- **Client-visible outcome:**
  - refresh, recalculate and generate return `publication: "published"|"unchanged"|"pending"` through `postWriteScore`.
  - The evidence consent response returns the ledger result only.
  - warm-cache discards the outcome.
- **UI:**
  - `PublicationConsent.tsx:26-50` reads only `response.ok`.
  - `components/SharePageOwnerContent.tsx:55-72` and `BadgeToolbar.tsx:64` reload on ok and read `staleSources` on 409. They do not read `publication`.
- **Health:**
  - `/api/health` checks Redis, Supabase, the GitHub `rate_limit` probe (`GITHUB_RATE_LIMIT_FLOOR=500`, `repo` scope), the four cron heartbeats (26 h window) and the rasterizer.
  - It has no v7.2 or receipt check.
- **Alerts:** `captureOperationalAlert` (`lib/analytics/server-errors.ts:121-160`) posts to `CHAPA_ALERT_WEBHOOK_URL`, or falls back to Resend email.

## 7. Documented decisions that bind the current design

- **Consent:**
  - Policy: `docs/plans/2026-09-08-v7-single-score-consistency-phases/policy.md:65-69`, acceptance C16 (`acceptance.md:34`), `phase-5.md:31`.
  - Decisions: `docs/decisions/2026-09-05-scoring-v7-policy.md:11, 17`; `docs/decisions/2026-09-08-scoring-v7-observed-point-policy.md:31`.
  - Research: `docs/research/2026-09-06-v7-site-cutover-handoff.md:50-51, 122-128, 133-138` (no issuance on a public read, following the #1239 lesson).
- **Unavailable is not empty:**
  - `policy.md:25`: never overwrite a known-good receipt with fabricated empty observations.
  - `docs/impact-v7.md:9`.
- **Budget and partial coverage:**
  - `docs/research/2026-09-05-scoring-v7-phase-4-supported-validation.md:7`: discovery and pagination share one explicit budget, and missing pages keep unknown coverage.
  - `phase-8-integrity-design.md:31`.
  - No document plans resumable or background collection or large-profile handling.
- **CLAUDE.md:**
  - Goal #2 (lines 12-28) keeps v6 "when selected or explicitly falling back without a current receipt".
  - Goal #9 (lines 37-41): v7.2 standings skip legacy-only subjects.
- **Related open issues:**
  - #1335 is this work.
  - Epic #1295 with S01/S11-S15/S18/S19 (#1296, #1306-#1310, #1313, #1314) and #1320 (no contract coverage for the flag-on path).
  - #1311 is S16 rendering, not consent. The `#1311` comment at `app/api/evidence/route.ts:66` and warm-cache route.ts:460-464 references it.
