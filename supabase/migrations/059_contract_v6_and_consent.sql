-- HOLD: contract migration for #1335 phase 5 (v6 retirement) and phase 2
-- (publication-consent removal). Applied only after production is running
-- the new code that no longer reads any of these objects (release-playbook
-- phase 7 step 7.5) — this file is deliberately excluded from this release
-- and moved to a post-release branch by the team lead.
--
-- Dependency order (measured 2026-09-23 against 001-056, see
-- docs/plans/2026-09-23-universal-v72-reliable-collection-phases/phase-5.md
-- step 5.11):
--   1. admin_users_observed is rebuilt from `users` directly (no admin_users,
--      no legacy CASE fallback, no 'v6' literal) so it no longer depends on
--      admin_users/latest_snapshots/metrics_snapshots.
--   2. admin_users (013/014) can now be dropped safely.
--   3. latest_snapshots (012/014), whose only dependent was admin_users, can
--      now be dropped safely.
--   4. metrics_snapshots (001), whose only remaining dependents were
--      latest_snapshots and the 047 headline_score column/comment, can now
--      be dropped.
--   5. verification_records (001) has no view dependents; its RLS policies
--      (008) and grants (032) are dropped automatically with the table.
--   6. The scoring_v7_rendering flag row and the consent columns/constraint
--      on scoring_v7_subjects (039) are no longer read by any running code.
-- No snapshot RPC exists to drop (confirmed by grep for
-- "metrics_snapshots|verification_records|latest_snapshots|admin_users\b"
-- across supabase/migrations/*.sql — the only writers were the app-layer
-- CRUD deleted in phase 5, never a database function).

-- 1. Rebuild admin_users_observed directly from `users` — the only
--    remaining policy is v7.2, so there is no legacy CASE fallback and no
--    'v6' literal. Keeps exactly the columns the new admin code reads
--    (lib/db/admin-users.ts): handle, registered_at, display_name,
--    avatar_url, and the current_* receipt projection. current_confidence
--    is dropped — v7.2 has no confidence concept.
-- `CREATE OR REPLACE VIEW` cannot drop or reorder columns (Postgres error
-- 42P16); this view drops `current_confidence` relative to 054's definition,
-- so it must be dropped and recreated rather than replaced in place.
DROP VIEW IF EXISTS public.admin_users_observed;
CREATE VIEW public.admin_users_observed WITH (security_invoker=true) AS
SELECT
  u.handle,
  u.registered_at,
  u.display_name,
  u.avatar_url,
  r.id AS current_revision_id,
  (r.public_receipt #>> '{core,composite,displayValue}')::double precision AS current_display_score,
  (r.public_receipt #>> '{core,composite,exact}')::double precision AS current_exact_score,
  r.public_receipt #>> '{core,tier}' AS current_tier,
  r.public_receipt #>> '{core,archetype}' AS current_archetype,
  (r.reference_time AT TIME ZONE 'UTC')::date AS current_snapshot_date,
  r.reference_time AS current_fetched_at,
  CASE WHEN r.id IS NOT NULL THEN pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.canonical_receipt,'UTF8')),'hex') END AS current_content_hash
FROM public.users u
LEFT JOIN public.scoring_v7_subjects s ON s.owner_handle = u.handle
LEFT JOIN public.scoring_observed_current c ON c.owner_handle = s.owner_handle
LEFT JOIN public.scoring_v7_receipts r ON r.id = c.receipt_id AND r.owner_handle = u.handle AND r.policy_version = 'v7.2' AND r.public_receipt->>'action' <> 'retract';
REVOKE ALL ON public.admin_users_observed FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.admin_users_observed TO service_role;

-- 2-4. v6 lifetime-history objects. Order matters: admin_users depended on
--      latest_snapshots, and admin_users_observed depended on admin_users
--      until step 1 rebuilt it — both are now unreferenced.
DROP VIEW IF EXISTS public.admin_users;
DROP VIEW IF EXISTS public.latest_snapshots;
DROP TABLE IF EXISTS public.metrics_snapshots;

-- 5. v6 badge-verification records. `/verify/<retired hex>` and
--    `/api/verify/<retired hex>` answer 410 retired_v6_code statically —
--    there is nothing left to read.
DROP TABLE IF EXISTS public.verification_records;

-- 6. The scoring_v7_rendering selector is retired; v7.2 is the only
--    rendered policy, so this flag row is never read by the running code.
DELETE FROM public.feature_flags WHERE key = 'scoring_v7_rendering';

-- 7. Publication consent (#1335 phase 2 decision 1) — every signed-up
--    subject is scored with v7.2, and the consent option is removed
--    completely: UI, API action, SQL predicates and the source-authorization
--    gate all stopped reading these in phase 2. The column/constraint
--    survived until now (kept for signature stability on the report-craft
--    RPC, per notes.md "Kept for phase 5") and can be dropped now that the
--    running code never reads them.
ALTER TABLE public.scoring_v7_subjects DROP CONSTRAINT scoring_v7_subjects_check;
ALTER TABLE public.scoring_v7_subjects DROP COLUMN public_evidence_consent;
ALTER TABLE public.scoring_v7_subjects DROP COLUMN consent_recorded_at;

-- Archived machine v7 / algorithm v7.1 receipt tables and RPCs are NOT
-- dropped (immutable replay, CLAUDE.md goal #2).
