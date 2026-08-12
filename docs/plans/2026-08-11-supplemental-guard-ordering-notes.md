# Implementation notes — `2026-08-11-supplemental-guard-ordering`

## Deviations

### Phase 1 — rejected fetch with no baseline

- **Plan said:** `base = (rejected and baseline != null) ? baseline : primary`, then
  unconditionally `cacheSet(cacheKey, composed)` and write the baseline when
  `base is primary`.
- **Found:** when a fetch is rejected *and* no baseline exists (the race case
  covered by `client.test.ts` — "a public fetch does NOT overwrite an authenticated
  stats:v2:merged entry", where the better-scoped entry is discovered by the
  pre-write re-read rather than held in the baseline), `base` falls back to
  `primary`. The plan's unconditional write would then persist a downgrade to the
  composed key. The pre-#1060 code wrote nothing in that situation.
- **Chose:** an explicit `accepted = !rejected` flag. The composed key is written
  only when `accepted || baseline != null`; the baseline key only when `accepted`.
- **Why:** the plan's formulation silently weakened the #1046 protection it was
  meant to preserve. The caller still receives its own composed data, so nothing is
  lost from the response — only the shared cache write is withheld.

### Phase 1 — test mock queue leakage

- **Plan said:** nothing about the mock harness beyond extending the sequential
  `mockCacheGet` chains.
- **Found:** `vi.clearAllMocks()` in `beforeEach` clears recorded calls but not
  queued `mockResolvedValueOnce` values. The suite only passed because every test
  happened to consume exactly as many `cacheGet` reads as it queued. Changing the
  read counts left residue that leaked into later tests — three stale-fallback tests
  failed in-suite while passing in isolation.
- **Chose:** added `mockCacheGet.mockReset()` to `beforeEach`.
- **Why:** the alternative was hand-balancing queue lengths per test, which restores
  the same latent fragility for the next person to change a read count.

### Phase 3 — more test churn than anticipated

- **Plan said:** move the inline `cacheDel` assertion to an
  `invalidateProfileReadModels` assertion, and verify ordering.
- **Found:** two further tests depended on there being exactly one
  `invalidateProfileReadModels` call. `"persists before invalidating history-backed
  read models"` indexed `invocationCallOrder[0]`, which is now the pre-fetch call;
  `"returns 500 when the refreshed snapshot cannot be persisted"` asserted the mock
  was never called at all.
- **Chose:** the ordering test now locates the post-persist call by its `badgeSvg`
  flag rather than by index; the 500 test asserts the *post-persist* invalidation
  did not run instead of asserting no call at all. Added
  `"forces the refetch before materializing, never after"` to pin the pre-fetch
  call's position, which nothing covered before.
- **Why:** indexing by position would break again the next time a call is added.

## Notes (not deviations)

- Phase 1 §5.6 predicted the D4 behaviour change would require updating
  `client.test.ts:294`. It did not: that test asserts the *cache write*, not the
  return value, and the new behaviour satisfies it unchanged. The D4 contract is
  pinned by a new test instead.
- Test count went 8731 → 8748 (+17).
