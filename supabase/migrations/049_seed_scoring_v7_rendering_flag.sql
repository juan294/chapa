-- Seed the Impact v7 render/issue flag, disabled.
--
-- `scoring_v7_rendering` gates both halves of the v7 cutover: whether a
-- rendering surface reads an issued receipt, and whether the write paths issue
-- one at all. Without a row, `dbGetFeatureFlag` returns null and `checkFlag`
-- falls through to the SCORING_V7_RENDERING_ENABLED env var — which would make
-- the only way to enable v7 in production a Vercel env change plus a redeploy,
-- and the only way to switch it back off the same thing again. A gate whose
-- purpose is to be turned off quickly cannot live behind a deploy.
--
-- `dbUpdateFeatureFlag` is an UPDATE, not an upsert, so /admin cannot create
-- this row either: without this migration the toggle in the dashboard silently
-- matches nothing. That is the same defect #857 and #1210 fixed for the
-- integration flags, and the same rule applies here — every flag key the app
-- reads has a seeded row.
--
-- enabled = false is the current behaviour and the correct default. The cutover
-- reaches the badge only; the share page header, the JSON-LD, the verification
-- HMAC, the leaderboard, the public API headline and the Studio preview all
-- still read the v6 aggregate, so enabling this before those surfaces read the
-- shared model would publish two different numbers for one revision. The
-- conditions for turning it on are enumerated in
-- docs/research/2026-09-06-v7-site-cutover-handoff.md, section 9.3.
--
-- ON CONFLICT DO NOTHING preserves any value already set via /admin and makes
-- the migration safe to re-run.
--
-- Refs #1311, #1210, #857

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('scoring_v7_rendering', false, 'Render and issue Impact v7 receipts (off until every scored surface reads the shared model)')
ON CONFLICT (key) DO NOTHING;
