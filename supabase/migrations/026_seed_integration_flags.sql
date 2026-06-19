-- Seed platform integration feature-flag rows so they are DB-backed rather than
-- env-only. Previously these flags had no DB row, so every check fell through to
-- the NEXT_PUBLIC_*_ENABLED env fallback and logged a noisy
-- "[db] feature_flags: expected row object, got null" on each request.
--
-- ON CONFLICT DO NOTHING preserves any value already set (e.g. toggled via the
-- admin panel) and makes the migration safe to re-run.
--
-- NOTE: a present DB row is the source of truth and overrides the env var, so
-- after this migration these integrations are managed via the feature_flags
-- table (/admin) rather than NEXT_PUBLIC_*_ENABLED.
--
-- Refs #857

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('bitbucket_integration', true, 'Bitbucket account linking + stats merge'),
  ('codeberg_integration', true, 'Codeberg account linking + stats merge'),
  ('gitlab_integration', true, 'GitLab account linking + stats merge')
ON CONFLICT (key) DO NOTHING;
