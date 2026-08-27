-- Seed the WebMCP kill switch and anonymous Studio demo gate.
-- Existing admin-managed values remain authoritative if this migration is
-- replayed after either flag has been changed.

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('webmcp_enabled', false, 'Browser-side WebMCP tool registration'),
  ('studio_demo_enabled', false, 'Anonymous Creator Studio demo mode')
ON CONFLICT (key) DO NOTHING;
