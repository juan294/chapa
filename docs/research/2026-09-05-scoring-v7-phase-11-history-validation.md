# Scoring v7: immutable history and trend validation

Scope: S13 / #1308. GPT-6 Astra implemented receipt persistence and trend history. Independent Astra review approved the final fixes and completed the dedicated simplify pass. All sequential integration gates passed. S14 verification, consumer adoption and empirical validation remain mandatory before relaunch.

V7 stores the exact canonical receipt revision and raw output independently of its unrounded trend. The elapsed-day EMA uses the latest strictly earlier point anchor and the declared new-value backward-fill assumption. Same-day revisions reuse that prior-day anchor; identical prepared retries are idempotent. Ranges and retractions create gaps. Corrections to history append new receipts without rewriting anchors already consumed by later observations. Policy versions segment history; legacy records retain their original v6 semantics and are labeled non-replayable when complete inputs are absent.

Publication commits the receipt and optional trend in one transaction. Database constraints bind row identity, family lineage, revision, policy, reference instant and issuance time to the stored payload. Conflicting writes cannot overwrite an immutable revision. Atomic family uniqueness also holds across concurrent owners. Authorization is required before reads and rechecked after asynchronous cache work. Validated receipt envelopes are detached and frozen before returning; caller or cache mutation during an await cannot alter them.

Review fixed NULL actor authorization, a concurrent receipt-family creation race, and delayed cache publication after withdrawal. Revoked/error outcomes await deletion and expose cleanup failure explicitly. Revision-only cache keys allow S14 to retry cleanup using content-free revocation tombstones. S13 does not claim to complete S14's broader retention/deletion work or to prove source truth from arithmetic replay.

## Sequential local verification

- Scoped unit tests: 3 files / 9 tests passed.
- Full suite: 552 files / 9,023 tests passed.
- Disposable local database contracts: 41 files / 118 tests passed, including idempotent retries, conflicting writes, same-day correction, elapsed dates, gaps, retractions, frozen anchors, canonical round trips, NULL actors, concurrent root publication and withdrawal.
- Typecheck, lint, migration validation and write registration: passed. Lint retains three existing unused-destructuring warnings in an S07 fixture, with no errors.
- Coverage passed unchanged thresholds: statements 94.48%, branches 89.38%, functions 95.00%, lines 97.04%. Scripts coverage also passed.
- Circular dependency check and production build: passed locally.

Migration043 was reviewed and applied only to the owned disposable `chapa-scoring-v7` database. Its SHA-256 is `773060fe2a05271dd877941bd228a9af65d5e0fb9ce28e487e1118b3716a8d9c`. The original Supabase config was restored. Existing migration039 was not edited.

Logs and the exact 11-file import manifest are under `logs/scoring-v7/s13-*`. No push, PR, hosted CI, deployment or production operation was performed.

```text
apps/web/lib/impact/smoothing-v7.test.ts
apps/web/lib/cache/snapshot-cache-v7.test.ts
apps/web/lib/db/snapshots-v7.test.ts
apps/web/lib/db/snapshots-v7.contract.test.ts
apps/web/lib/db/scoring-v7.contract.test.ts
```
