# Scoring v7: engineering evidence ledger validation

Scope: S11 / #1306. Independent GPT-6 Astra policy review and dedicated simplify review approved the final ledger and coordinated Craft-reader changes. A separate Astra review approved the final private monitoring correction. S11 is verified locally; the later public-consumer integration and empirical pilot remain required before relaunch.

The authenticated API supports dated owner core/Craft claims, authorized non-owner assessments, amendments, retractions, reviewer grants and revocation, public-aggregate consent and withdrawal. Seven outcome categories include design, documentation, mentoring, maintenance and incident recovery. Explicit attribution, observation horizon, baseline limitations and counterevidence distinguish observed work from claims of benefit. A merged PR, CI count, artifact link or report cannot create a semantic rubric verdict. Manual and AI-assisted work use the same criteria; optional Craft remains separate from the four core dimensions.

Private references and optional bounded raw bodies use existing owner-scoped storage and deletion boundaries. No submitted URL is fetched. Raw bodies expire after 30 days; retained evidence supports historical replay until withdrawal. Current revoked grants deny access while immutable SQL-derived authority snapshots preserve earlier authorized assessments. Private route responses are non-cacheable; unexpected failures report only a fixed error without private exception text or causes.

Review corrections cover PostgreSQL timestamp normalization at the trusted boundary; conflicting Craft assessment revision chains; duplicate artifact/work identity; references supporting distinct criteria; stable revision-specific practice event IDs; canonical acceptance selection; reviewed episode dates instead of upload dates; conflicting acceptance dates across claims; and semantic acceptance equality across mixed human/model provenance. Unresolved identity or contradictory dates withhold established credit and retain unknown coverage. Selected canonical acceptance and separately dated practice events preserve equivalent-work behavior with or without a provider observation.

Initial database verification found four failures caused by PostgreSQL microsecond timestamps. Later runs passed 95 and then 96 contracts after the boundary and identity corrections. The first full integration run found the missing mandatory route-monitoring wrapper (8,906 passed, one failed); the final reviewed wrapper and privacy regression resolve it. These failed runs are retained with the final passing logs.

## Sequential local verification

- Final owned suites below: 7 files / 58 tests passed.
- Migration validation and exhaustive write-registration check: passed.
- Disposable local Supabase: 38 files / 96 contracts passed, including actual API writes, role isolation, authorization history, revisions, artifact retention and withdrawal.
- Full typecheck and lint: passed.
- Full test suite: 542 files / 8,908 tests passed.
- Coverage with unchanged thresholds: statements 94.79%, branches 89.85%, functions 95.20%, lines 97.07%.
- Scripts coverage: 264 tests passed with unchanged thresholds.
- Circular dependency check and production build: passed locally.

Final migration041 SHA256: `2860b01884b912b882b82088e30e456a004baaed6973358c4367c7694d6887c1`. Logs reside under `logs/scoring-v7/s11-*.log`; the guarded source manifest records the exact 21 imported files. The original tracked Supabase configuration was restored before commit. No push, PR, remote CI, deployment or production operation was performed.

## Owned suite paths

```text
apps/web/lib/evidence/authorization.test.ts
apps/web/lib/evidence/craft-identity.test.ts
apps/web/lib/evidence/projection.test.ts
apps/web/lib/evidence/validation.test.ts
apps/web/lib/db/engineering-evidence.test.ts
apps/web/lib/db/craft-v7.test.ts
apps/web/app/api/evidence/route.test.ts
```

Real database suites are `apps/web/lib/db/engineering-evidence.contract.test.ts` and `apps/web/app/api/evidence/route.contract.test.ts`, run with the complete local contract set. API usage and reproducible request examples are documented in [the private ledger API](../api/engineering-evidence-v7.md).
