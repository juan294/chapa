# Phase 2: remove publication consent

Parent plan: `../2026-09-23-universal-v72-reliable-collection.md`. Depends on nothing. It is `[batch-eligible]` with phase 1.

## Goal

A registered subject needs no opt-in to be collected, published, verified or read. Consent disappears from the schema, the SQL functions, the API, the UI, the types and the i18n. Subjects are created on the authenticated side, in the OAuth callback. Existing registered users are backfilled.

## Files

| File | Change |
|---|---|
| `supabase/migrations/054_remove_publication_consent.sql` (new) | redefine the consent-guarded functions without the predicate; backfill subjects; drop the columns |
| `apps/web/lib/db/scoring-subjects.ts` (new, +`.contract.test.ts`) | `dbEnsureScoringSubject(handle)` |
| `apps/web/app/api/auth/callback/route.ts` (+test) | call `dbEnsureScoringSubject` after `dbUpsertUser` |
| `apps/web/lib/platform/source-authorization.ts` (+test) | subject existence replaces the consent check |
| `apps/web/lib/profile/issue-receipt.ts` (+tests) | rename to `issueScoreReceipt`; remove `not_consented` |
| `apps/web/lib/profile/score-receipt-observed.ts`, `score-receipt-v7.ts` (+tests) | remove the `publicConsent` gate (`:155-156`, `:171-172`) |
| `apps/web/lib/db/engineering-evidence.ts`, `lib/evidence/{types,validation,test-fixtures}.ts` | remove `publicConsent`, the `consent` action and `publicationAcknowledged` |
| `apps/web/lib/db/report-craft.ts` (+test) | NULL now means `not_registered`, not `not_consented` |
| `apps/web/app/api/evidence/route.ts` (+tests) | remove the consent/withdraw branch and the issuance call |
| `apps/web/app/api/insights/route.ts` (+tests) | remove `publicationAcknowledged` from the body schema (`:81-92`) |
| `apps/web/app/settings/PublicationConsent.tsx` | delete |
| `apps/web/app/settings/EvidenceWorkflow.tsx` | remove the consent section and the `isScoringV7RenderingEnabled` read |
| `apps/web/lib/i18n/dictionaries/{en,es}.ts` | delete the `settings.consent*` keys; parity test stays green |
| every caller of `issueScoreReceiptIfConsented` | rename only (behaviour change comes in phase 4) |
| the contract tests named in the parent sweep | drop the consent setup and assert that no consent is needed |
| `scripts/check-pending-migrations.ts` | update the probed column list |

## Steps

### 2.1 Red: contract tests against local Supabase

- `lib/db/score-receipts-observed.contract.test.ts`: publish for a subject created by `dbEnsureScoringSubject` with no consent row succeeds, and the manifest and read return the receipt.
- The same for `verification-v7`, `source-context` (lock and append), `platform-token-refresh` (claim, finish, takeover), report-craft store and read, and `scoring_observed_history`.
- A schema test: no function body in `pg_proc` references `public_evidence_consent`. The columns remain until 058, so that `ensure_subject` inserts work under both the old and the new code.

### 2.2 Green: migration 054

```sql
-- For each function in research §1.2 (039/041/043/044/045/046/048/050/051/052/053):
CREATE OR REPLACE FUNCTION <same signature> ... -- identical body, minus
--   "AND public_evidence_consent" in FOR UPDATE locks
--   "IF NOT consent THEN RETURN NULL" guards
--   scoring_report_craft_store: remove the consent_required branch; p_acknowledged is ignored (kept for signature stability)
--   scoring_v7_ledger_write: 'consent' and 'withdraw' actions RAISE 'retired action'
-- Owner-data deletion stays available for scripts/delete-user.ts (scoring_v7_delete_user_with_receipts, unchanged).

CREATE OR REPLACE FUNCTION scoring_v7_ensure_subject(p_owner text) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS
  $$ INSERT INTO scoring_v7_subjects(owner_handle) VALUES (lower(p_owner)) ON CONFLICT DO NOTHING $$;
REVOKE ALL ON FUNCTION scoring_v7_ensure_subject(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION scoring_v7_ensure_subject(text) TO service_role;

-- Backfill: every signed-up user (decision 5)
INSERT INTO scoring_v7_subjects(owner_handle)
  SELECT DISTINCT lower(handle) FROM user_platforms WHERE platform = 'github'
  ON CONFLICT DO NOTHING;

-- Expand only: the columns are NOT dropped here. Migrations are applied before the code that
-- depends on them goes live (docs/runbooks/migrations.md:122), and the running release still reads
-- public_evidence_consent. So set every subject's consent to true to keep the old code working, and
-- give the column a default of true for rows inserted by the old code:
UPDATE scoring_v7_subjects SET public_evidence_consent = true, consent_recorded_at = coalesce(consent_recorded_at, now());
ALTER TABLE scoring_v7_subjects ALTER COLUMN public_evidence_consent SET DEFAULT true;
-- The columns are dropped by the contract migration 058 (phase 5), after the release.
-- admin_users_observed (052:18): recreate without the consent join
```

Rule for the implementer: copy each function body from the latest migration that defines it (`grep -n "CREATE OR REPLACE FUNCTION <name>" supabase/migrations/*.sql | tail -1`), then remove only the consent predicate. A contract test covers each one.

### 2.3 App changes

- `source-authorization.ts` returns `unavailable` only when there is no subject row, reading through a subject-existence query. The provider flags and link checks are unchanged.
- The evidence route keeps claim, retract, grant and assessment. Consent and withdraw now return 400 `retired_action`.

### 2.4 Tests that must fail if consent comes back

`lib/profile/scoring-consumer-inventory.test.ts` gains an assertion that no source file under `apps/web` references `publicConsent`, `public_evidence_consent` or `PublicationConsent`.

## Success criteria

**Automated**
- The contract tests in 2.1 pass.
- The i18n parity test passes.
- The inventory test passes.
- The global verification list passes.
- `supabase db reset` locally applies 001-054 cleanly.

**Manual**
- `/settings` renders with no consent section in both locales. Check it in the local candidate.
