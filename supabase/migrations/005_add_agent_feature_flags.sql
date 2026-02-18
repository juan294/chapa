-- Add feature flags for the 4 new agents: Performance, Documentation, Cost Analyst, Localization.
-- Refs: Issue #427

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('performance_agent', true, 'Weekly performance and bundle size analysis agent'),
  ('documentation_agent', true, 'Weekly documentation freshness and completeness audit agent'),
  ('cost_analyst', true, 'Daily infrastructure cost and usage analysis agent'),
  ('localization_agent', true, 'Weekly copy consistency and i18n readiness audit agent')
ON CONFLICT (key) DO NOTHING;
