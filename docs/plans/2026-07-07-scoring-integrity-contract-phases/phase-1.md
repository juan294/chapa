# Phase 1 — Authoritative PR count + fetch-integrity gate (foundation)

**Depends on:** none. **Batch:** foundational (must ship before 2–5).
**Files:** `packages/shared/src/github-query.ts`, `packages/shared/src/types.ts`, `apps/web/lib/github/queries.ts`, `packages/shared/src/stats-aggregation.ts`, `apps/web/lib/github/stats.ts`, `apps/web/lib/github/stats-integrity.ts` (+ tests).

## Intent
Make the merged-PR count authoritative (from `search`), and reject any fetch whose PR payload is degraded — at the source, with no baseline required.

## Changes

### 1a. Query: add authoritative merged-PR count
`github-query.ts` — add a top-level `search` field and a query variable:
```
query($login, $since, $until, $historySince, $historyUntil, $mergedPrSearch: String!) {
  user(login: $login) { ...existing... }
  search(query: $mergedPrSearch, type: ISSUE) { issueCount }
}
```

`queries.ts` `fetchContributionData`:
```
sinceDate = since.toISOString().slice(0,10)   // YYYY-MM-DD
untilDate = now.toISOString().slice(0,10)
mergedPrSearch = `author:${login} is:pr is:merged created:${sinceDate}..${untilDate}`
// pass as variable
// add optional chaining on the whole access chain (cc?.pullRequestContributions?.nodes ?? [])
mergedPrTotalCount = json.data?.search?.issueCount ?? 0
return { ...raw, mergedPrTotalCount, pullRequests: { totalCount, nodes: [...] } }
```

### 1b. Type
`types.ts` `RawContributionData`: add `mergedPrTotalCount: number`.

### 1c. Integrity assessment (pure)
`stats-integrity.ts` — new export (co-located with `isDegradedPrFetch`):
```
export function assessRawFetchIntegrity(raw: RawContributionData): { ok: boolean; reason?: string } {
  const mergedNodeCount = raw.pullRequests.nodes.filter(n => n.merged).length
  if (raw.mergedPrTotalCount > 0 && mergedNodeCount === 0)
    return { ok:false, reason:"pr_nodes_empty_but_search_positive" }   // juan294 signature
  if (raw.pullRequests.totalCount > 0 && raw.pullRequests.nodes.length === 0)
    return { ok:false, reason:"pr_totalcount_positive_but_nodes_empty" }
  return { ok:true }
}
```

### 1d. Aggregation: authoritative count, weight from sample
`stats-aggregation.ts` `buildStatsFromRaw`:
```
const prsMergedCount = raw.mergedPrTotalCount          // was: mergedPRs.length
const prsMergedWeight = min(sum(computePrWeight(mergedPRs)), PR_WEIGHT_AGG_CAP)  // unchanged (sample)
// quality sub-metrics still derived from sampled mergedPRs (best-effort; MIN_QUALITY_SAMPLE guard stays)
```
Note: `microCommitRatio` uses `prsMergedCount` as denominator today (`:89`) — switch its denominator to the sampled `mergedPRs.length` so the ratio stays consistent with its numerator (both from the sample).

### 1e. Fetch rejection
`stats.ts` `fetchStats` (or in `fetchContributionData` before returning): call `assessRawFetchIntegrity(raw)`; if `!ok`, log + `return null` so `_fetchAndCache` serves stale. Emit nothing here (telemetry in Phase 5 hooks the reason).

## Pseudocode: end-to-end for juan294 degraded fetch
```
raw = { mergedPrTotalCount: 904, pullRequests:{ totalCount:143, nodes:[] }, commits:15585, ... }
assessRawFetchIntegrity(raw) -> { ok:false, reason:"pr_nodes_empty_but_search_positive" }
fetchStats -> null
_fetchAndCache -> serves stats:stale (once healed) / null  // NEVER builds prsMergedCount:0
```

## Success criteria
**Automated**
- `assessRawFetchIntegrity` unit tests: rejects `{search>0, mergedNodes:0}`; rejects `{totalCount>0, nodes:[]}`; accepts genuine `{search:0, nodes:[]}`; accepts `{search:96, 96 merged nodes}`.
- `buildStatsFromRaw` golden test: `prsMergedCount === raw.mergedPrTotalCount`; weight still caps; `microCommitRatio` denominator = sample size.
- `queries.test.ts`: search variable built with correct `YYYY-MM-DD..YYYY-MM-DD` window; optional chaining doesn't throw on null sub-objects.
- typecheck/lint/circular/full suite green.

**Manual**
- Run the real query for juan294 and confirm `search.issueCount` = 904 and a healthy fetch yields `prsMergedCount:904`, weight capped at 120, Delivery ≈ 100 when scored.
