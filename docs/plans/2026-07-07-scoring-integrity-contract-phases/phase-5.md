# Phase 5 — Observability + real-pipeline regression contract

**Depends on:** Phases 1, 2, 3. **Batch:** `[batch-eligible]` with Phase 4.
**Files:** `apps/web/lib/github/queries.ts` or `stats.ts` (telemetry hook), `apps/web/lib/github/client.integrity.contract.test.ts` (new), `apps/web/lib/github/stats-integrity.test.ts` (extend), CI wiring (`package.json`/existing scoring-integrity gate) (+ golden fixtures).

## Intent
Prove the contract holds end-to-end against a real (mocked-at-the-network-edge) degraded payload, and make a regression loud in production and in CI — so this class cannot silently return.

## Changes

### 5a. Telemetry
On `assessRawFetchIntegrity` rejection (Phase 1 site), fire fire-and-forget:
```
captureServerEvent("stats_fetch_rejected", { handle, reason, mergedPrTotalCount, mergedNodeCount, authenticated })
```
Plus keep/rename the Phase-3 `snapshot_skipped_incomplete_stats` event. These give a production signal for how often degradation occurs (baseline for future work).

### 5b. Real-pipeline contract test (the anti-recurrence gate)
`client.integrity.contract.test.ts` — mock only `fetchWithRetry`/global fetch to return the exact degraded GraphQL body, then drive the REAL `getStats` → `materialize*Profile` → assert:
```
given fetch returns { data:{ user:{...}, search:{ issueCount:904 }, ...pullRequestContributions:{ totalCount:143, nodes:[] } } }
and stale cache empty:
  getStats(handle) -> null            // not a 0-PR StatsData
  cacheSet NOT called with stats:v2:merged
  cacheSet NOT called with stats:stale
and stale cache = healthy authenticated entry (prsMergedCount:904):
  getStats(handle) -> the healthy stale
  no downgrade write
```
Add a second case at the persist boundary: served-from-poisoned-stale → `persistProfileSnapshot` returns false, no verification stored.

### 5c. Golden test — authoritative count
Fixture raw with `mergedPrTotalCount:904, nodes:[96 merged sample]` → `buildStatsFromRaw` → `prsMergedCount:904`, `prsMergedWeight:120` (capped), `computeDelivery ≈ 100`, `detectProfileType` = solo (`16/904 < 0.15`).

### 5d. CI gate
Wire the contract + golden tests into the existing scoring-integrity CI gate (the one from the 2026-03-29 hardening). Ensure they run on the real-stack contract job where applicable.

## Success criteria
**Automated**
- Contract test: degraded fetch ⇒ zero writes to merged/stale/snapshot/verification; healthy stale served on degradation.
- Golden test: authoritative count → Delivery ≈ 100, solo profile.
- Both wired into CI and failing if the gate is removed (mutation check: temporarily reverting Phase 1's rejection makes the contract test red).
- typecheck/lint/circular/full suite green.

**Manual**
- After deploy, observe at least one `stats_fetch_rejected` event in PostHog/telemetry during a real degraded fetch (confirms the production signal works).
