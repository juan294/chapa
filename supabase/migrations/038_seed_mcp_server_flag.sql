-- Seed the independent kill switch for Chapa's stateless remote MCP endpoint.
-- Existing admin-managed values remain authoritative if this migration is replayed.

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('mcp_server_enabled', false, 'Remote MCP endpoint kill switch')
ON CONFLICT (key) DO NOTHING;
