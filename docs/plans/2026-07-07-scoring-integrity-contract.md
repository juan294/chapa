# Plan: Scoring-data integrity contract (end the corrupt-score class)

**Date:** 2026-07-07
**Research:** `docs/research/2026-07-07-scoring-data-corruption-root-cause.md`
**Branch strategy:** worktree per phase off `develop`; each phase its own conversation per RPI.
**Scope (user-confirmed):** authoritative `search(is:merged)` count · comprehensive token-scope-aware caching · repair pass for already-poisoned data.

---

## Goal

Replace the scattered per-symptom guards (#826, #930, #1001, #1002, the 2026-03-31 OAuth fix) with **one integrity contract enforced at three boundaries** — fetch, cache, persist — so a structurally-valid-but-degraded payload can never be cached, scored, persisted, or attested. Plus heal already-poisoned data and lock the fix with a real-pipeline regression contract.

### Root cause (from research)
A degraded fetch (empty `pullRequestContributions.nodes` from a partial GraphQL error or token-scope loss) produces `prsMergedCount: 0` that is trusted as truth. The detecting signal already exists (`totalCount` / now `search.issueCount` vs `nodes`) but is discarded. The corrupt zero poisons `stats:v2:merged` + `stats:stale` + permanent snapshot history + the HMAC verification record, and the #1002 guard is blind on cold/pre-poisoned baselines.

### The contract (one sentence)
> A fetched payload is **scored, cached, persisted, or attested only if it passes an integrity assessment**; a degraded or lower-scope payload is rejected in favor of last-known-good and never allowed to downgrade a better stored value.

---

## Design

### 1. Authoritative merged-PR count (fetch layer)
Add to `CONTRIBUTION_QUERY` a `search(query: $mergedPrSearch, type: ISSUE) { issueCount }` field. `$mergedPrSearch = "author:<login> is:pr is:merged created:<sinceDate>..<untilDate>"`. Validated live: returns juan294's exact 904 (365d) / 562 (90d).

- `prsMergedCount` ← `search.issueCount` (authoritative; also fixes profileType ratio — `16/904` = solo, correct).
- `prsMergedWeight` ← computed from `pullRequestContributions.nodes` sample (caps at 120; a real user's sample saturates the cap).

### 2. Integrity assessment (pure function, fetch layer)
`assessFetchIntegrity(raw): { ok: boolean; reason?: string }` — DEGRADED when:
- `raw.mergedPrTotalCount > 0` AND merged-nodes count === 0 (search sees PRs, collection payload empty — the juan294 signature), OR
- `raw.pullRequests.totalCount > 0` AND `nodes.length === 0` (internal inconsistency), OR
- required top-level blocks missing.
A DEGRADED assessment makes `fetchContributionData` return `null` → caller serves stale (never caches/scores/persists). This works with **no baseline** — the authority is the search count, not a prior snapshot.

### 3. Fetch-scope tagging + non-downgrading cache (cache layer)
Every fetch is tagged `fetchScope: "authenticated" | "public"` (session token present ⇒ authenticated). Cache-write rules in `_fetchAndCache`:
- `stats:stale` (7d) is written **only** with a complete, authenticated-or-equal payload — never degraded, never a downgrade.
- `stats:v2:merged` (6h): a `public` fetch does not overwrite a present `authenticated` entry; a degraded fetch never overwrites a complete entry.
- The #1002 `isDegradedPrFetch` guard is subsumed by this rule (the integrity assessment + scope comparison is the single gate).

### 4. Persist-boundary gate (snapshot + verification)
`materializeProfile` carries a `statsComplete` flag. `persistProfileSnapshot` and `getPublicProfileVerification`/`storeVerificationRecord` **skip** when stats are degraded/incomplete — no corrupt snapshot row, no attested corrupt record. Serve last-good instead.

### 5. Heal + regression
- Repair pass: purge poisoned cache keys + delete corrupt snapshot rows for affected handles; force a good authenticated refetch path.
- Real-pipeline contract test: a degraded GraphQL response flows through `getStats` → asserts null/stale served, **nothing** cached/scored/persisted/attested. Golden test for the search-authoritative count. CI gate.

---

## Phase structure

| Phase | Title | Depends on | Batch |
|---|---|---|---|
| 1 | Authoritative PR count + fetch-integrity gate | — | foundational |
| 2 | Scope-aware, non-downgrading cache writes | 1 | `[batch-eligible]` with 3 |
| 3 | Persist-boundary integrity gate (snapshot + verification) | 1 | `[batch-eligible]` with 2 |
| 4 | Heal poisoned data (repair pass) | 1,2,3 | `[batch-eligible]` with 5 |
| 5 | Observability + real-pipeline regression contract | 1,2,3 | `[batch-eligible]` with 4 |

Phase files: `docs/plans/2026-07-07-scoring-integrity-contract-phases/phase-{1..5}.md`.

Phase 1 is the foundation (shared integrity helpers + authoritative count live here so 2 & 3 only consume them, keeping them file-disjoint and batch-eligible). Phases 2 and 3 touch disjoint files (2: `client.ts`/cache/types; 3: `profile/*`/snapshot/verification). Phases 4 and 5 touch disjoint files (4: repair script; 5: contract tests + telemetry).

---

## Global success criteria

**Automated**
- A mocked degraded GraphQL response (`search.issueCount:904, pullRequestContributions.nodes:[]`) run through `getStats` returns stale (or null) and performs **zero** writes to `stats:v2:merged`, `stats:stale`, snapshot DB, or verification store (contract test, Phase 5).
- Golden test: `buildStatsFromRaw` sets `prsMergedCount` from `search.issueCount`; a `{search:904, nodes:[]}` raw is rejected by `assessFetchIntegrity`.
- A `public`-scope fetch does not overwrite an `authenticated` cached entry (Phase 2 unit test).
- Full suite + typecheck + lint + circular green each phase.

**Manual**
- After deploy + repair (Phase 4), juan294's live profile shows Delivery ≈ 100 and score ≈ 76; `stats:stale:juan294` has `prsMergedCount` > 0.
- Telemetry emits a `stats_fetch_rejected` event for a degraded fetch in production (Phase 5).

---

## Non-goals / accepted for this plan
- Not switching PR-weight sourcing to a fully paginated `search` crawl (the 100-node sample saturating the 120 cap is sufficient; documented).
- Not re-introducing EMA onto the displayed headline (would resurrect #1001).
- Not changing the 365-day scoring window or dimension formulas.
