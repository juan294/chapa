-- Migration: 018_fix_tool_insights_rls
-- Description: Re-enable RLS on tool_insights table
-- Date: 2026-03-24
-- Fixes: Supabase security alert — tool_insights missing RLS
--
-- Migration 015 included ENABLE ROW LEVEL SECURITY + deny_anon policy,
-- but the advisory still flags this table. Re-applying to ensure RLS is active.
-- Also re-applying on merge_operations and campaign_sends (can't verify — empty tables).

-- tool_insights: re-enable RLS + ensure deny policy exists
ALTER TABLE public.tool_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_insights FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tool_insights' AND policyname = 'deny_anon_tool_insights'
  ) THEN
    CREATE POLICY deny_anon_tool_insights ON tool_insights FOR ALL TO anon USING (false);
  END IF;
END $$;

-- merge_operations: ensure FORCE RLS (can't verify — 0 rows)
ALTER TABLE public.merge_operations FORCE ROW LEVEL SECURITY;

-- campaign_sends: ensure FORCE RLS (can't verify — 0 rows)
ALTER TABLE public.campaign_sends FORCE ROW LEVEL SECURITY;

-- Apply FORCE on all other tables too for defense-in-depth
-- FORCE means RLS applies even to the table owner
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.verification_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_platforms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns FORCE ROW LEVEL SECURITY;
