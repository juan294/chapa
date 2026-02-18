-- Add score_notifications feature flag for engagement email notifications.
-- Disabled by default — admin enables via the Engagement panel.
-- Refs: Issue #424

INSERT INTO feature_flags (key, enabled, description)
VALUES (
  'score_notifications',
  false,
  'Send email notifications when user scores increase significantly'
)
ON CONFLICT (key) DO NOTHING;
