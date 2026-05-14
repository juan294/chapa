-- Ensure supplemental_stats matches the FORCE RLS posture of the other
-- application tables. The app uses service-role server access, but this keeps
-- owner-role behavior consistent with the rest of the schema.

ALTER TABLE supplemental_stats FORCE ROW LEVEL SECURITY;
