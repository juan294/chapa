# Scoring v7: optional Craft validation

Scope: S10 / #1305. The isolated Craft worker implementation passed independent GPT-6 Astra policy review and a dedicated simplify pass, then integrated local checks against develop including the redesign at 3760a35b. S10 is verified; this is not relaunch authorization or empirical validation.

Craft is a separate four-criterion engineering-practice calculation. Tool names, lines, files, response speed, messages, agent count and parallelism cannot earn Craft points. Optional report absence remains not observed and cannot alter core scoring. Reports describe usage and model-estimated classifications; they cannot supply accountable rubric verdicts. The evidence-ledger path supports dated practice without an AI report. Artificer requires the published score threshold plus one independently corroborated episode satisfying all four criteria, including accepted outcome.

Strict JSON and HTML parsing rejects non-finite, overflowing, negative, inconsistent and future-dated measurements. Missing response-time fields remain unknown; unknown outcome labels and unclassified sessions remain visible. Likely-satisfied classifications remain distinct model estimates. Old and straddling aggregate reports are historical or partial, with no prorating or upload-time rejuvenation. Work episodes deduplicate across reports and use actual episode dates separately from their measurement horizons.

Private report storage is atomic and digest-deduplicated. Raw bodies expire after 30 days; retained diagnostic evidence and scored-practice references remain until owner withdrawal. A single authorized database snapshot supplies current claims, assessment revision chains, reference retention and reviewer access. Future or revoked grants cannot authorize private access. The existing warm-cache maintenance route invokes raw expiry and reports failures. S11 owns the complete claim/review authoring workflow, including immutable grant-history metadata; S15 owns adoption by public consumers and shared receipt caching.

Review corrections include whole-token numeric parsing (legacy substring parsing could misread an exponent as a small count), explicit episode dates, measurement horizons bounded by claim/assessment time, actual route-to-database contract coverage, future reviewer-grant rejection, and removing a redundant Redis lookup after a complete database computation. Real database testing caught a purge fixture whose separately sampled clocks exceeded 30 days by milliseconds; the fixture now uses one explicit instant. Final migration 040 SHA256 is d20491b41bea51119dbe4e9748c0dbb7857736c97dc402440edad6a3c64c8e3c.

## Sequential local verification

- Worker scoped suites: 313 tests passed; exact suite paths below.
- Migration validation and exhaustive write-registration check: passed.
- Disposable local Supabase, final migration 040: 36 contract files / 86 tests passed. Atomic write/replay/rollback, expiry, private role access, future/revoked grants, historical assessment visibility and actual upload route persistence are exercised.
- Full typecheck and lint: passed.
- Full test suite: 536 files / 8,852 tests passed.
- Coverage with unchanged thresholds: statements 94.99%, branches 90.46%, functions 94.84%, lines 97.19%.
- Scripts coverage: passed unchanged thresholds.
- Circular dependency check: passed.
- Production build: passed locally.

Logs are retained under logs/scoring-v7/s10-*.log. No push, PR, remote CI, hosted deployment or production data operation was performed. The tracked Supabase configuration is restored before commit; database execution targeted only the disposable chapa-scoring-v7 project.

## Scoped suite paths

```text
apps/web/lib/insights/parser.test.ts
apps/web/lib/insights/validation.test.ts
apps/web/lib/insights/scoring.test.ts
apps/web/lib/insights/craft-v7.test.ts
apps/web/lib/insights/report-v7.test.ts
apps/web/lib/db/craft-v7.test.ts
apps/web/lib/db/tool-insights.test.ts
apps/web/lib/cache/craft-v7-cache.test.ts
apps/web/lib/cache/craft-cache.test.ts
apps/web/app/api/insights/route.test.ts
apps/web/app/api/insights/route-v7.test.ts
apps/web/app/api/cron/warm-cache/route.test.ts
```

The worker's directory selection reported 13 suites / 313 tests; the explicit path reconstruction above identifies 12 suites. The authoritative integration test and database counts above come directly from retained local logs.
