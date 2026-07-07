# Validation Report — Scoring-Data Integrity Contract (#1004)

**Date:** 2026-07-07 | **Branch:** `develop` | **Verdict: ✅ VALIDATED**
**Plan:** `../2026-07-07-scoring-integrity-contract.md`
**Research:** `../../research/2026-07-07-scoring-data-corruption-root-cause.md`

All 5 phases implemented, committed, and matching the plan. Full automated suite passes; the fix is confirmed live in production.

## Phase status

| Phase | Status | Key evidence (file:line) |
|---|---|---|
| 1 — Authoritative count + fetch-integrity gate | ✅ | `search(is:merged)` `github-query.ts:76`; `assessRawFetchIntegrity` `stats-integrity.ts:68` invoked in `stats.ts:22`; `prsMergedCount = raw.mergedPrTotalCount` `stats-aggregation.ts:54`; `microCommitRatio` denominator → sample `:97`; optional chaining in `queries.ts` |
| 2 — Scope-aware, non-downgrading cache | ✅ | `fetchScope` on `StatsData`; `scopeRank` + downgrade guards on merged **and** stale writes `client.ts:340-352`; concurrent-race re-read |
| 3 — Persist-boundary gate | ✅ | `statsComplete = !isPoisonedStats` `materialize-profile.ts:55`; snapshot skip + telemetry `public-profile.ts:105`; verification null on incomplete `:41` |
| 4 — Heal poisoned data | ✅ | `scripts/heal-poisoned-stats.ts` (dry-run default, `--apply` gate); `pnpm heal-poisoned-stats`; run for juan294 |
| 5 — Regression contract + telemetry | ✅ | `client.integrity.contract.test.ts` (degraded→null+no writes; healthy-stale→no downgrade; poisoned→no snapshot/verification); `stats_fetch_rejected` + `snapshot_skipped_incomplete_stats`; golden test 904→Delivery 100→solo |

## Automated verification

- Full suite: **8,251 passed** (+57 for this work)
- Typecheck ✅ · Lint ✅ 0 errors · Circular ✅ · Write-registration ✅
- Real-pipeline contract test: 3 anti-recurrence assertions pass

## Manual verification — live production

| Criterion | Before | After |
|---|---|---|
| Delivery | 30 | **100** |
| Score / tier | corrupt 63 | **75 / High** |
| Corrupt 2026-07-07 snapshot | delivery 30, PRs 0 | **purged** |
| Poisoned cache keys | `prsMergedCount:0` | **nil (purged)** |

## Notes / residuals

- `stats:stale:juan294` is currently nil (purged by heal, not yet repopulated). Repopulates to the authoritative 904 (`fetchScope:authenticated`) on the next logged-in visit; Phase 2 guarantees a public/cron fetch can no longer re-poison it.
- Served 2026-07-06 snapshot shows `prsMergedCount:96` (pre-deploy, sample-based). Fresh fetches yield 904 (proven by golden test). Historical rows predating the code are expected.
- Post-validation cleanup: cleared one cosmetic lint warning (`_args` unused) in `public-profile.test.ts`.

## Conclusion

The recurring corrupt-score class is closed at all three boundaries (fetch, cache, persist), verified end-to-end by a real-pipeline contract test that fails the build on regression, healed in production, with the live profile correct (Delivery 100, score 75). Root-cause fix, not a patch.
