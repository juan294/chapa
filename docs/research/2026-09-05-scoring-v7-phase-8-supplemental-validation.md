# Scoring v7: supplemental evidence validation

Scope: S07 / #1302. Independent GPT-6 Astra review approved the dated upload implementation and its two subsequent correctness fixes, followed by a dedicated simplify review. S07 is verified locally. S08 source integrity remains incomplete, so phase 8 as a whole is not closed. Public consumers migrate in S15; relaunch still requires every remaining task.

The strict `supplemental-v2` producer protocol stores dated, immutable source declarations. Each read clips actual events to the reference window after union and identity deduplication, including diagnostic denominators and repository effects. Upload time controls historical visibility only. Authentication establishes the uploader, while claimed source ownership, acceptance and measurements remain self-reported with partial coverage. Unknown coverage spans the complete reference window; a partial import cannot imply complete earlier discovery. Accountable artifact assessment belongs to the S11 ledger.

Within-upload immutable identity conflicts are rejected by validation and again inside the database transaction. Cross-upload conflicts fail atomically under an owner lock. Stable event identity includes repository, actor, kind and event ID; work identity, event instant and artifact revision cannot change. Missing diagnostic measurements can be enriched without treating conflicting measurements as known. Replays reuse the original committed upload and timestamp.

The v7 reader checks the current authorized database manifest before using Redis. Both cache hits and database fallback age the same immutable rows. Withdrawn or mismatched portfolios cannot be served from an old cache. Cache publication failure preserves successful durable writes and reports rebuild status honestly. Legacy scalar uploads remain stored, explicitly historical and ineligible for dated v7 reconstruction; no annual proration is invented. A bounded fixture client supports reproducible offline generation and authenticated local submission.

Review found and corrected two material gaps: partial discovery originally left later temporal gaps too narrow, and conflicting immutable facts originally could reach storage before aggregation rejected them. Regressions now cover full-window unknown bounds and transactional rejection without damaging earlier evidence/cache. Original root fixtures have retained red/green logs. The later worker authored regression cases before drafting fixes while verification was reserved elsewhere; no separate red execution is claimed for those worker fixes.

## Sequential local verification

- Worker scoped tests: 5 files / 91 tests passed.
- Migration validation and exhaustive write-registration check: passed.
- Final integration database contracts: 40 files / 111 tests passed against disposable local Supabase with migrations041 and042. Tests cover durable replay, rollback, authorization, withdrawal, actual route writes and cache publication/deletion failures.
- Full typecheck and lint: passed.
- Full test suite: 546 files / 8,971 tests passed.
- Coverage with unchanged thresholds: statements 94.74%, branches 89.96%, functions 95.03%, lines 97.08%.
- Scripts coverage, circular dependency check and production build: passed locally.
- The documented fixture CLI executed locally with reference `2026-09-05T12:00:00.000Z`, producing synthetic JSON without network or credentials.

Final migration042 SHA256: `1e621fafe392ac6dc3f2b729ae00e45321760326922113870ca46cc696c96373`. Retained evidence is under `logs/scoring-v7/s07-*.log`, with a guarded 13-file import manifest. The temporary borrowed migration041 in the worker was verified and removed before bringing in S11's tracked migration. The tracked Supabase configuration is restored before commit. No production data, remote CI, push, PR or deployment was involved.

## Scoped suite paths

```text
apps/web/lib/platform/evidence-aging.test.ts
apps/web/lib/db/supplemental-v7.test.ts
apps/web/app/api/supplemental/route.test.ts
apps/web/app/api/supplemental/route-v7.test.ts
scripts/supplemental-evidence-client.test.ts
```

Real database tests are `apps/web/lib/db/supplemental-v7.contract.test.ts` and `apps/web/app/api/supplemental/route-v7.contract.test.ts`. The [producer protocol and fixture client](../supplemental-evidence-v2.md) document eligibility, coverage, resource bounds and failure responses.
