# Research: Systemic root cause of recurring scoring-data corruption

**Date:** 2026-07-07
**Branch:** `develop`
**Trigger:** juan294's Delivery collapsed to ~30 / score to 63 after refresh, despite 562 merged PRs in the last 90 days (904 in 365). This is the same class of bug patched by #826, #930, #1001, #1002, and (earlier) the 2026-03-31 share-page-oauth fix.
**Method:** 4 parallel read-only agents (locator, analyzer, pattern-finder, history) + direct file reads + live GitHub/Redis probing of juan294.
**Status:** Documentarian research — describes what IS. Fix design belongs to the `/plan` phase.

---

## 1. Executive summary — the one root cause

> **A stats fetch can return structurally-valid-but-degraded data (a well-formed payload with silently missing/zeroed fields), and nothing in the pipeline validates payload *completeness or internal consistency* before that data is (a) cached to both the hot and the 7-day fallback keys, (b) fed into scoring, (c) persisted to permanent history, and (d) baked into the HMAC verification record.**

Every past incident is one surface of this single root cause. The clearest proof: the fetch layer **already has the data needed to detect the corruption and does not use it** — `pullRequestContributions.totalCount` is read into the raw payload (`queries.ts:100`) but `buildStatsFromRaw` derives every PR metric from `nodes` alone and never compares `nodes.length` to `totalCount` (`stats-aggregation.ts:48`). A response of `{ totalCount: 143, nodes: [] }` becomes `prsMergedCount: 0` with zero complaint.

The recurring symptom (`prsMergedCount: 0` → Delivery ≈ 30, PR weight is 70% of Delivery) is one instance. The 2026-03 "zero stars/forks" instance (`queries.ts:75-78`), the v2.5.0 `mergeStats` field-drop, the timed-out-platform snapshot, and the token-scope public-only fetch are all the same shape: **degraded input trusted as truth.**

---

## 2. The data path (what exists)

Single-line flow (locator agent):

> Entry route → `materialize*Profile` → `getStats` (`client.ts`) → `fetchStats` + `buildStatsFromRaw` → `mergeStats` (BB/CB/GL + `supplemental`) → `isDegradedPrFetch` guard → cache write (`stats:v2:merged` 6h / `stats:stale` 7d) → `computeImpactV6` → `applyImpactScorePolicy` (smoothing) → `buildSnapshot` → `dbInsert/ReplaceSnapshot` (permanent) → `invalidateProfileReadModels` → badge/page render + HMAC verification.

### Entry points and the token each passes (the visibility nexus)

| Entry point | Token to `getStats` | Sees private merges? |
|---|---|---|
| `POST /api/refresh` (`route.ts:70`) | session OAuth (`getSessionGitHubToken`) | Yes |
| `POST /api/generate` (`route.ts:48`) | session OAuth | Yes |
| `POST /api/recalculate` (`route.ts:56`) | auth.token (CLI/PAT/session) | Depends |
| `GET /api/cron/warm-cache` (`route.ts:278`) | **server `GITHUB_TOKEN`** (`getGithubToken`) | **No — public only** |
| `POST /api/admin/bulk-recalculate` (`route.ts:139`) | **server `GITHUB_TOKEN`** | **No — public only** |
| `u/[handle]/page.tsx` (`:119`) | **none → server `GITHUB_TOKEN` fallback** | **No — public only** |
| `u/[handle]/badge.svg` (`route.ts:237`) | session token if present, else server fallback | Depends |

The cache key is **handle-only** (`stats:v2:merged:<handle>`); on a cache hit the token is ignored entirely (documented 2026-03-31, share-page-oauth research:117-129). So a server-token (public-only) fetch and a user-token (private-inclusive) fetch **write and read the same key** — whichever ran last wins, and they produce materially different data.

---

## 3. How the corruption is produced (analyzer agent — exact mechanics)

### 3.1 The one unsafe fetch shape

`fetchContributionData` (`queries.ts:26`) error handling:

| Response | Result | Safe? |
|---|---|---|
| HTTP non-200 (`:63-68`) | `return null` → serve stale | ✅ |
| GraphQL `errors[]` with `RATE_LIMITED`/`FORBIDDEN` (`:79-86`) | `return null` → serve stale | ✅ |
| GraphQL `errors[]` **any other type** (`:72-87`) | **falls through**, builds data from partial `json.data.user` | ❌ |
| `contributionsCollection` null (`:92`) | `cc.contributionCalendar` throws → caught (`:143`) → null → stale | ✅ |
| `pullRequestContributions` null (`:100`) | `.totalCount` throws → caught → null → stale | ✅ |
| **`pullRequestContributions: { totalCount: 143, nodes: [] }`** | `[].filter()` → `[]`, **no throw** → builds `prsMergedCount: 0` | ❌ |
| `pullRequestContributions: { totalCount: 143, nodes: null }` | `null.filter` throws → caught → null → stale | ✅ |

The **only** unsafe structural shape is a well-formed object with an **empty `nodes` array** — precisely what a token-scope loss or a per-field partial error produces. The try/catch protects against `null`/missing intermediates (they throw); it does not protect against a valid-but-empty array (it doesn't throw). There is **no optional chaining** on `cc`, `cc.contributionCalendar`, `cc.pullRequestContributions`, or `.nodes` (`queries.ts:92-101`).

### 3.2 Aggregation trusts `nodes`, ignores `totalCount`

`stats-aggregation.ts:48-53`:
```ts
const mergedPRs = raw.pullRequests.nodes.filter((pr) => pr.merged);
const prsMergedCount = mergedPRs.length;              // → 0 when nodes empty
const prsMergedWeight = Math.min(mergedPRs.reduce(...), PR_WEIGHT_AGG_CAP); // → 0
```
`raw.pullRequests.totalCount` (populated at `queries.ts:100`) is **never referenced**. No `nodes.length` vs `totalCount` consistency check exists anywhere.

Fields that silently go 0/undefined on the same empty-`nodes` input: `linesAdded`/`linesDeleted` (`:56-57` → 0); `prDescriptionRate`/`featureBranchRate`/`issueLinkageRate` (`:78-86` → undefined); `microCommitRatio` (`:89` → undefined); `batchSizeScore` (`:94` → undefined); `medianPrLeadTimeHours` (`:102-109` → undefined). Note `commitsTotal` = `contributionCalendar.totalContributions` (`:45`, *all* contributions incl. restricted, not merged-PR commits) — it survives, which is exactly why the #1002 guard leans on `commitsTotal > 0` as an "activity remains" signal.

### 3.3 Propagation to score

`computeDelivery` (`v6.ts:74-82`) with `prsMergedWeight: 0`: `normalize(0, 60) = 0` (`utils.ts:47-51`), so `raw = 100 × (0.7×0 + 0.2×~1 + 0.1×~1) = 30`. The 70% PR term vanishes.

`detectProfileType` (`v6.ts:268-277`): `prCount = Math.max(prsMergedCount, 1)` turns `0` into denominator `1`, so `reviews / 1 ≥ 0.15` flips **solo → collaborative**, cascading into `computeQuality` path, composite denominator (quality included vs excluded), and archetype key set.

### 3.4 Propagation to cache, history, verification

- **Cache poisoning** (`client.ts:302-308`): when the guard doesn't fire, corrupt stats are written to **both** `stats:v2:merged` (6h) **and** `stats:stale` (7d). The stale write destroys the very fallback the guard depends on.
- **Permanent history** (`snapshot.ts:23-49`, `public-profile.ts:100-108`): `buildSnapshot` records `prsMergedCount: 0`, `delivery: ~30`, flipped `profileType` into a Supabase row. **No integrity check in the snapshot path.** Even after the live cache heals, the corrupt data point stays in trend history forever.
- **Verification record** (`public-profile.ts:41-60`): built from `displayImpact` (the fresh corrupt score) + `stats.prsMergedCount: 0` and HMAC-signed. Corruption is attested.
- **readOnly path** (`client.ts:302-304`): returns corrupt stats without caching — doesn't poison, but still renders a wrong score for that request.

---

## 4. Live evidence (juan294, 2026-07-07)

- **Chapa's exact query, run manually with a token:** `pullRequestContributions.totalCount: 143`, **nodes: 100, of which merged: 96**. The query *can* get the PRs.
- **Chapa's cached fetch (`stats:v2:merged` and `stats:stale`, fetched 06:59Z):** `prsMergedCount: 0`, `prsMergedWeight: 0`, but `commitsTotal: 15585`, `issuesClosedCount: 5104`, `reviewsSubmittedCount: 16`. Private-inclusive everywhere *except* PRs = 0. Signature of a partial fetch that lost only the `pullRequestContributions.nodes` payload.
- **Ground truth (`gh search prs --author @me --merged`):** 904 merged PRs in 365 days, **562 in the last 90 days**.
- **Hand-computed correct Delivery:** PR weight caps at 120 → `normalize(120,60)=1.0`, issues/commits saturate → Delivery = `100 × (0.7+0.2+0.1) = 100`. Correct composite ≈ `(100+68+60+69+83)/5 = 76`.
- **Poisoning confirmed:** `stats:stale` now also holds `prsMergedCount: 0`, so `isDegradedPrFetch`'s `lastGood.prsMergedCount <= 0` short-circuit (`stats-integrity.ts:39`) returns false — the guard cannot self-heal.

---

## 5. The accreted guards, and the gap each leaves (pattern-finder agent)

| # | Guard | file:line | Protects against | Residual gap |
|---|---|---|---|---|
| 1 | `isDegradedPrFetch` (#1002) | `stats-integrity.ts:28`, `client.ts:276` | 0-PR fetch overwriting good stats | Needs a good baseline; skipped when no stale, stale already 0, or fully-empty; guards only the Redis cache, not snapshot/verification; readOnly-exempt |
| 2 | Same-day EMA lock + dirty bypass (#826) | `smoothing.ts:63-85`, `dirty-stats.ts` | EMA feedback-loop spiral | 1h marker TTL window; only fires on next public read |
| 3 | `ignoreSnapshot` (#930) | `materialize-profile.ts:43-50`, bulk-recalc | Same-day lock freezing a bad snapshot | Point-fix for one route |
| 4 | Fresh headline (#1001) | `materialize-profile.ts:80` | Smoothed headline lagging fresh dimensions | Exposes corrupt dimensions immediately (removed the cushion that hid this bug) |
| 5 | RATE_LIMITED/FORBIDDEN → null | `queries.ts:72-87` | Partial fetch → cached zero stars/forks (**the 2026-03 instance of THIS bug**) | Only two error types; any other partial error falls through |
| 6 | Stale-serve fallback | `client.ts:163-170` | Fetch returning null | Only triggers on `null`, not a non-null 0-PR result |
| 7 | `MIN_QUALITY_SAMPLE` fallback | `stats-aggregation.ts:63-75` | Skewed quality rates under limited token scope | Comment already names "`GITHUB_TOKEN` seeing only public contributions" — team knew the root cause |
| 8 | `normalizeStats` defaults (AR-M5) | `stats-aggregation.ts:183-274` | Missing StatsData field → inconsistent default | Fills *defaults*; cannot tell "genuinely 0" from "corrupt 0" |
| 9 | Detect-don't-mask NOT-NULL snapshot cols | `snapshots.ts:107-144` | Fabricated 0 persisted silently | Only catches `undefined`, not an explicit corrupt `0` |
| 10 | Field-completeness guard + golden tests + CI gate | `stats-schema.ts`, 2026-03-29 plan | A new field silently dropped by a stage | Structural presence, not value plausibility |
| 11 | Real-stack contract suite | `*.contract.test.ts`, 2026-07-03 | Silent-persist seam bugs | Doesn't assert value plausibility of a degraded fetch |

Quote proving the class is old — `queries.ts:75-78`:
> "Treat RATE_LIMITED or FORBIDDEN errors as a complete fetch failure. GitHub returns partial data alongside these errors, but that partial data has zero stars/forks/watchers which would get cached for 6h and cause score drops. Returning null lets the caller serve stale cache instead."

---

## 6. Institutional history — the recurrence (history agent)

| Date | Doc | Instance of the class |
|---|---|---|
| 2026-03-08 | `score-stasis-solution-space.md`, `insights-upload-ux-and-score-stasis.md` | EMA same-day lock **freezing** the score; snapshot cache never invalidated |
| 2026-03-08 | `score-drop-and-badge-design.md` | Solo composite regression + 365-day window aging drops |
| 2026-03-28/29 | `scoring-pipeline-hardening.md` (research + plan) | `mergeStats` **dropped fields** (Quality → ~5); "100% line coverage, field still missing" |
| **2026-03-31** | **`share-page-oauth-fix.md`** | **THE SAME BUG: no-token fetch → "~10 merged PRs (public only)" vs 78 with OAuth → solo→collaborative, Quality 28 vs 83.** Admitted residual risk: "Cron warm-cache overwrites with `GITHUB_TOKEN` data … 6h cache TTL limits exposure" |
| 2026-04-18 | `deep-engineering-audit.md` | Cache keys have no scoring/schema-version axis; snapshot cache not invalidated on insights |
| 2026-06-21 | `data-sources-linking-scoring-hardening.md` | Link/unlink not flowing through dirty-input path |
| 2026-07-03 | `reliability-hardening-playbook.md` | Silent-persist seam bugs (insights 200-on-failure, snapshot NOT-NULL drop) |
| 2026-07-07 | #1001, #1002 | Fresh headline; `isDegradedPrFetch` last-known-good guard |

**The 2026-03-31 plan predicted this exact failure and accepted it as a bounded risk.** #1002 (2026-07-07) is the third pass at the same token-scope corruption, and juan294's live data shows it still occurs (guard can't heal a pre-poisoned stale key).

### What was already tried (so the Plan phase does not repeat it)
- EMA on the **displayed** score: added (2026-03) → froze → bypassed → **removed from the headline** (#1001). Re-introducing it resurrects #1001.
- `dbReplaceSnapshot` upsert replaced `ignoreDuplicates` dedup (2026-03).
- Token-scope: attacked via client-side OAuth cache-warming (2026-03-31) and `isDegradedPrFetch` (#1002) — both are compensating downstream, neither validates the payload at the source.
- Field-survival: structurally enforced (2026-03-29 completeness guard + CI gate) — but for field *presence*, not value *plausibility*.

---

## 7. Observed structural properties (facts the Plan phase must design around)

1. **The corruption-detecting signal already exists but is discarded:** `totalCount` vs `nodes.length` (`queries.ts:100` vs `stats-aggregation.ts:48`).
2. **No single "payload completeness/plausibility" gate exists** between fetch and cache/score/persist. Guards are per-symptom and per-consumer.
3. **All comparison-based guards need a trusted baseline** and cannot judge a cold/first fetch or a pre-poisoned baseline.
4. **The `stats:stale` fallback is writable by the same corrupt path it protects against** (`client.ts:308`).
5. **The snapshot-history and verification-record paths have no integrity guard at all** — corruption there is permanent and attested.
6. **Server-token (public-only) and user-token (private-inclusive) fetches share one handle-keyed cache** and produce materially different data; the cron and public page always use the public-only token.
7. **`commitsTotal` is `totalContributions`, not commits** — any plausibility check must not assume it correlates with merged-PR count.
8. **Ground truth (`search prs is:merged`) diverges from `contributionsCollection.pullRequestContributions`** — the query itself under-samples (`first: 100`, no pagination) and is token-scoped; a manual `search` returns 904 vs the collection's 143 public.

---

## 8. Open questions for the `/plan` phase (not answered here)

- Where should the durable integrity gate live — fetch layer (reject partial payloads), aggregation (validate `totalCount` vs `nodes`), cache-write (never overwrite good with degraded), or all three?
- Should merged-PR count come from a more reliable source (`search prs is:merged` totalCount) than the token-scoped, 100-capped `pullRequestContributions.nodes`?
- Should the cache be keyed/annotated by token scope (public vs authenticated) so a public-only fetch cannot clobber a private-inclusive one?
- How to heal already-poisoned `stats:stale` + permanent snapshot rows for affected users (incl. juan294)?
- Should snapshot persistence and the verification record get the same integrity gate as the cache?
- Can a "known good baseline" be established for cold fetches (e.g. `search` cross-check) so comparison guards aren't blind on first fetch?

---

## Appendix — key file:line references

- Query: `packages/shared/src/github-query.ts:14` (`CONTRIBUTION_QUERY`), `pullRequestContributions(first: 100)` at `:35`.
- Fetch + error handling: `apps/web/lib/github/queries.ts:26` (fetch), `:63-89` (error paths), `:100-101` (totalCount/nodes).
- Retry: `apps/web/lib/utils/fetch-retry.ts:11` (2 attempts), `:15-17` (5xx-only), `:49-51` (backoff); 15s timeout at `queries.ts:13,50`.
- Aggregation: `packages/shared/src/stats-aggregation.ts:32` (`buildStatsFromRaw`), `:45` (commitsTotal=totalContributions), `:48-53` (PR metrics), `:66` (`MIN_QUALITY_SAMPLE` + public-token comment), `:251` (`normalizeStats`).
- Caps: `packages/shared/src/constants.ts:5` (`PR_WEIGHT_AGG_CAP=120`), `:12-15` (`SCORING_CAPS` prWeight 60/issues 40/commits 300).
- Merge + cache + guard: `apps/web/lib/github/client.ts:49` (`getStats`), `:149` (`_fetchAndCache`), `:159` (stale read), `:276-300` (#1002 guard), `:302-308` (unguarded cache writes); `apps/web/lib/github/stats-integrity.ts:28`.
- Scoring: `apps/web/lib/impact/v6.ts:74-82` (Delivery), `:268-277` (profileType flip); `apps/web/lib/impact/utils.ts:47-51` (normalize).
- Smoothing: `apps/web/lib/impact/smoothing.ts:63-85` (same-day lock), `:95-131` (policy).
- Orchestration/persist: `apps/web/lib/profile/materialize-profile.ts:57-92`, `apps/web/lib/profile/public-profile.ts:41-111`, `apps/web/lib/history/snapshot.ts:12-54`, `apps/web/lib/db/snapshots.ts:107-144`.
- Verification: `apps/web/lib/verification/hmac.ts:13-70`, `apps/web/lib/profile/public-profile.ts:41-60`.
