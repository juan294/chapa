-- Migration: 008_add_rls_deny_policies
-- Description: Add explicit deny-all policies for the anon role on all tables.
-- Date: 2026-02-21
-- Fixes: https://github.com/juan294/chapa/issues/447
--
-- Defense-in-depth: The app uses SUPABASE_SERVICE_ROLE_KEY exclusively
-- (server-side), which bypasses RLS. No anon key is exposed to the client.
-- These policies ensure that even if the anon key were accidentally leaked,
-- no data would be accessible.
--
-- For feature_flags: the existing "feature_flags_read_all" SELECT policy
-- (USING true) remains untouched. Because permissive policies are ORed in
-- PostgreSQL, SELECT still works for anon (false OR true = true), while
-- INSERT/UPDATE/DELETE are denied (only false = denied).

-- 1. users — full deny for anon
CREATE POLICY "deny_anon_all" ON users
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 2. metrics_snapshots — full deny for anon
CREATE POLICY "deny_anon_all" ON metrics_snapshots
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 3. verification_records — full deny for anon
CREATE POLICY "deny_anon_all" ON verification_records
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 4. merge_operations — full deny for anon
CREATE POLICY "deny_anon_all" ON merge_operations
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 5. feature_flags — deny anon for all operations; existing SELECT policy
--    ("feature_flags_read_all" USING true) still allows public reads via OR.
CREATE POLICY "deny_anon_all" ON feature_flags
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
