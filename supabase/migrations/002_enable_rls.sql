-- Enable Row Level Security on all public tables.
-- Fixes: https://github.com/juan294/chapa/issues/409
--
-- We use SUPABASE_SERVICE_ROLE_KEY exclusively (server-side), which bypasses
-- RLS. No policies are needed — the absence of policies means the anon role
-- (and any other non-service role) is denied ALL access by default.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_records ENABLE ROW LEVEL SECURITY;
