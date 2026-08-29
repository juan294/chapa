-- Seed the AI tool insights flag.
--
-- Completes migration 026_seed_integration_flags.sql (Refs #857), which set out
-- to stop integration flags falling through to their NEXT_PUBLIC_*_ENABLED env
-- fallback and logging "[db] feature_flags: expected row object, got null" on
-- each request, but seeded only bitbucket/codeberg/gitlab. `insights_integration`
-- reads through the identical checkFlag path and was left out, so it is the last
-- app-read flag key with no row in the table.
--
-- enabled = true preserves current production behaviour. Verified before writing
-- this migration: POST /api/insights returns 401 "Authentication required", not
-- the 403 "Feature not available" its pre-auth flag gate emits when the flag is
-- off, so isInsightsEnabled() resolves true in production today (via the env
-- var, there being no row). Seeding false would silently disable insights the
-- moment this row lands, since a present row overrides the env var.
--
-- ON CONFLICT DO NOTHING preserves any value already set via /admin and makes
-- the migration safe to re-run.
--
-- Refs #1210, #857

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('insights_integration', true, 'AI tool insights upload + dashboard panel')
ON CONFLICT (key) DO NOTHING;
