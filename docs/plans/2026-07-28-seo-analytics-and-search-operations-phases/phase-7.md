# Phase 7 — Aggregate SEO Ledger and Review Operations

**Status:** Planned
**Batch eligibility:** Not batch-eligible
**Depends on:** Phases 5 and 6

## Objective

Create a secret-safe, aggregate-only daily record of Chapa search acquisition, conversion, indexation, and marketing-page friction.

## Authorization gate

The workflow lands disabled. Obtain explicit authorization before the first provider API collection, manual dispatch, repository commit by the workflow, or enabling the schedule.

## Files

Create:

- `scripts/seo/collect-analytics.ts`
- `scripts/seo/collect-analytics.test.ts`
- `scripts/seo/ledger-workflow.test.ts`
- `docs/analytics/README.md`
- `docs/analytics/seo-ledger.jsonl`
- `.github/workflows/seo-ledger.yml`

Modify:

- `package.json`
- `docs/runbooks/observability.md`

## Implementation

1. Add `pnpm run seo:collect`.
2. Reuse the Spoken Letter provider-isolation shape, but use Chapa-specific IDs, routes, events, and thresholds.
3. Query GA4, Search Console, Bing, and Clarity independently.
4. Normalize a daily record with:
   - `date`, `schemaVersion`, and deployed `commitSha`;
   - one status block per provider;
   - aggregate metrics from the main plan;
   - alarms and collection warnings.
5. Never store service-account JSON, access tokens, replay/session URLs, raw replay payloads, user IDs, profile handles, email addresses, repository names, or unbounded raw queries.
6. Make appending idempotent for a date+SHA. A rerun replaces the incomplete row only when it has strictly better provider completeness.
7. Declare a daily workflow against `develop`, but guard collection and commit jobs with `vars.CHAPA_SEO_LEDGER_ENABLED == 'true'`. The variable is absent/false when this phase lands.
8. Write/commit the row even when one provider fails; fail the job after the commit only for a defined alarm or total collection failure.
9. Document:
   - credential names and acquisition without values;
   - empty-new-property expectations;
   - provider lag windows;
   - weekly and monthly review procedures;
   - schema evolution rules.

## Pseudocode

```text
results = allSettled([
  collectGa4(),
  collectSearchConsole(),
  collectBing(),
  collectClarity()
])

record.providers = results.map(
  fulfilled => { status: "ok", aggregates },
  rejected => { status: "error", redactedReason }
)

assert record contains no forbidden keys/patterns
upsertJsonlBy(date, commitSha, preferMoreComplete)
commit row
if totalFailure or alarm: fail visibly after commit
```

## Automated success criteria

- Fixture tests cover each provider normal, empty, lagged, unauthorized, throttled, and malformed response.
- Partial credentials produce explicit `skipped` status, not fabricated zeroes.
- One provider failure preserves the other three.
- Secret/PII scanning rejects forbidden keys and representative values.
- JSONL append/replacement is deterministic and idempotent.
- Workflow tests pin schedule, branch, secret-name wiring, commit-before-alarm-failure behavior, and concurrency.
- Workflow tests prove absent/false `CHAPA_SEO_LEDGER_ENABLED` performs no provider reads and creates no commit.
- Typecheck, lint, test, and the collection dry-run pass sequentially.

## Manual success criteria

- After explicit authorization, temporarily enable the repository variable and run one manual dispatch that writes a row in which every provider is `ok`, explicitly empty/lagged, or has a precise accepted error; disable it again after verification.
- Compare the row to each vendor dashboard without exporting user/session-level data.
- Confirm the Git diff contains only aggregate metrics and documentation.

## Stop gate

Stop after the first verified ledger row with `CHAPA_SEO_LEDGER_ENABLED` returned to false. Do not turn the row into content or make SEO changes without a later review decision.
