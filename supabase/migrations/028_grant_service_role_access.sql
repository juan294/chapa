-- Ensure the server-side Supabase service role can perform the durable reads and
-- writes used by API routes when the full local PostgREST stack is exercised.
--
-- RLS remains enabled/forced; service_role carries BYPASSRLS, but it still needs
-- normal table and sequence privileges for PostgREST to execute statements.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
