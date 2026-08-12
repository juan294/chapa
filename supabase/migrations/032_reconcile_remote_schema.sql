-- Reconcile supabase/migrations/ with the production schema. Refs #1064.
--
-- WHY THIS EXISTS
-- `pnpm run check:pending-migrations` builds a shadow database by replaying
-- every file in this directory, then diffs it against the linked production
-- project. It had begun failing on every release PR — including releases that
-- change no migrations at all — because the replay did not reproduce
-- production. Production was NOT behind: all 31 prior migrations are in its
-- applied history, and each statement below was verified read-only against the
-- live database before being accepted.
--
-- WHAT DIVERGED, AND WHY EACH IS SAFE
--
-- 1. Table grants to `anon` / `authenticated` (the bulk of this file).
--    Supabase's platform grants these by default on tables it manages; SQL
--    migrations that CREATE TABLE directly do not. They are not an access path
--    here: every affected table has RLS enabled AND forced, with explicit
--    deny-anon policies (`users`, `verification_records`, `metrics_snapshots`,
--    `supplemental_stats`, `studio_configs`). Verified in production via
--    pg_class.relrowsecurity / relforcerowsecurity and pg_policies.
--
-- 2. `drop policy "deny_anon_all" on "public"."feature_flags"`.
--    Deliberate, not an accident. feature_flags carries
--    `feature_flags_read_all [public]` instead, because /api/feature-flags is a
--    public endpoint. RLS remains forced, so only the read policy applies and
--    writes stay denied.
--
-- 3. `tool_insights` column types and CHECK constraints.
--    Production holds smallint/uuid with range constraints; the original
--    migration produced integer/identity. This file brings a fresh replay in
--    line with production, which is the stricter of the two.
--
-- 4. `pg_net` is present in a locally-built shadow but not in production, and
--    nothing in this repository references it.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT CONTAIN
-- migra also emits a drop/recreate of the `admin_users` view on every run. That
-- is a false positive and no migration content can silence it: production's
-- definition (pg_get_viewdef) is textually identical to what
-- 014_views_security_invoker.sql produces, and the emitted block is byte-for-byte
-- identical whether or not this file recreates the view — verified by running
-- `supabase db diff --linked` both ways and comparing output length (674 chars
-- in both cases). Including a no-op recreate here would only imply a divergence
-- that does not exist, so it is left out. See #1064 for the residual handling.
--
-- APPLYING THIS TO PRODUCTION IS A NO-OP by construction: every statement
-- describes a state production is already in. It exists so that a database
-- built from these files matches production. Do NOT resolve future drift by
-- pushing a diff to production without verifying direction first — the
-- generated statements here would, read naively, drop an extension and a
-- policy that production does not have.

drop extension if exists "pg_net";

drop policy "deny_anon_all" on "public"."feature_flags";

alter table "public"."tool_insights" alter column "craft_score" set data type smallint using "craft_score"::smallint;

alter table "public"."tool_insights" alter column "effectiveness" set data type smallint using "effectiveness"::smallint;

-- tool_insights.id is the one structural divergence rather than a cosmetic one.
-- 015_create_tool_insights.sql declares `id BIGINT GENERATED ALWAYS AS IDENTITY
-- PRIMARY KEY`, but production holds `id uuid` defaulting to gen_random_uuid().
-- The file never described what was actually applied. bigint cannot be cast to
-- uuid (SQLSTATE 42846), so the column is rebuilt rather than altered, and the
-- generator's alphabetical ordering is replaced (Postgres also rejects SET
-- DEFAULT on an identity column, SQLSTATE 42601).
--
-- The guard makes this a provable no-op against production, where the column is
-- already uuid: the block fires only when the column is some other type, which
-- is true solely of a shadow database replayed from these files. It therefore
-- never touches a column holding real data.
DO $reconcile_tool_insights_id$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tool_insights'
      AND column_name = 'id'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE public.tool_insights DROP COLUMN id;
    ALTER TABLE public.tool_insights
      ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY;
  END IF;
END
$reconcile_tool_insights_id$;

alter table "public"."tool_insights" alter column "proficiency" set data type smallint using "proficiency"::smallint;

alter table "public"."tool_insights" alter column "sophistication" set data type smallint using "sophistication"::smallint;

alter table "public"."tool_insights" alter column "uploaded_at" drop not null;

alter table "public"."tool_insights" add constraint "tool_insights_craft_score_check" CHECK (((craft_score >= 0) AND (craft_score <= 100))) not valid;

alter table "public"."tool_insights" validate constraint "tool_insights_craft_score_check";

alter table "public"."tool_insights" add constraint "tool_insights_craft_tier_check" CHECK ((craft_tier = ANY (ARRAY['Novice'::text, 'Practitioner'::text, 'Expert'::text, 'Master'::text]))) not valid;

alter table "public"."tool_insights" validate constraint "tool_insights_craft_tier_check";

alter table "public"."tool_insights" add constraint "tool_insights_effectiveness_check" CHECK (((effectiveness >= 0) AND (effectiveness <= 100))) not valid;

alter table "public"."tool_insights" validate constraint "tool_insights_effectiveness_check";

alter table "public"."tool_insights" add constraint "tool_insights_proficiency_check" CHECK (((proficiency >= 0) AND (proficiency <= 100))) not valid;

alter table "public"."tool_insights" validate constraint "tool_insights_proficiency_check";

alter table "public"."tool_insights" add constraint "tool_insights_sophistication_check" CHECK (((sophistication >= 0) AND (sophistication <= 100))) not valid;

alter table "public"."tool_insights" validate constraint "tool_insights_sophistication_check";




grant delete on table "public"."campaign_sends" to "anon";

grant insert on table "public"."campaign_sends" to "anon";

grant select on table "public"."campaign_sends" to "anon";

grant update on table "public"."campaign_sends" to "anon";

grant delete on table "public"."campaign_sends" to "authenticated";

grant insert on table "public"."campaign_sends" to "authenticated";

grant select on table "public"."campaign_sends" to "authenticated";

grant update on table "public"."campaign_sends" to "authenticated";

grant delete on table "public"."email_campaigns" to "anon";

grant insert on table "public"."email_campaigns" to "anon";

grant select on table "public"."email_campaigns" to "anon";

grant update on table "public"."email_campaigns" to "anon";

grant delete on table "public"."email_campaigns" to "authenticated";

grant insert on table "public"."email_campaigns" to "authenticated";

grant select on table "public"."email_campaigns" to "authenticated";

grant update on table "public"."email_campaigns" to "authenticated";

grant delete on table "public"."feature_flags" to "anon";

grant insert on table "public"."feature_flags" to "anon";

grant select on table "public"."feature_flags" to "anon";

grant update on table "public"."feature_flags" to "anon";

grant delete on table "public"."feature_flags" to "authenticated";

grant insert on table "public"."feature_flags" to "authenticated";

grant select on table "public"."feature_flags" to "authenticated";

grant update on table "public"."feature_flags" to "authenticated";

grant delete on table "public"."merge_operations" to "anon";

grant insert on table "public"."merge_operations" to "anon";

grant select on table "public"."merge_operations" to "anon";

grant update on table "public"."merge_operations" to "anon";

grant delete on table "public"."merge_operations" to "authenticated";

grant insert on table "public"."merge_operations" to "authenticated";

grant select on table "public"."merge_operations" to "authenticated";

grant update on table "public"."merge_operations" to "authenticated";

grant delete on table "public"."metrics_snapshots" to "anon";

grant insert on table "public"."metrics_snapshots" to "anon";

grant select on table "public"."metrics_snapshots" to "anon";

grant update on table "public"."metrics_snapshots" to "anon";

grant delete on table "public"."metrics_snapshots" to "authenticated";

grant insert on table "public"."metrics_snapshots" to "authenticated";

grant select on table "public"."metrics_snapshots" to "authenticated";

grant update on table "public"."metrics_snapshots" to "authenticated";

grant delete on table "public"."studio_configs" to "anon";

grant insert on table "public"."studio_configs" to "anon";

grant select on table "public"."studio_configs" to "anon";

grant update on table "public"."studio_configs" to "anon";

grant delete on table "public"."studio_configs" to "authenticated";

grant insert on table "public"."studio_configs" to "authenticated";

grant select on table "public"."studio_configs" to "authenticated";

grant update on table "public"."studio_configs" to "authenticated";

grant delete on table "public"."supplemental_stats" to "anon";

grant insert on table "public"."supplemental_stats" to "anon";

grant select on table "public"."supplemental_stats" to "anon";

grant update on table "public"."supplemental_stats" to "anon";

grant delete on table "public"."supplemental_stats" to "authenticated";

grant insert on table "public"."supplemental_stats" to "authenticated";

grant select on table "public"."supplemental_stats" to "authenticated";

grant update on table "public"."supplemental_stats" to "authenticated";

grant delete on table "public"."tool_insights" to "anon";

grant insert on table "public"."tool_insights" to "anon";

grant select on table "public"."tool_insights" to "anon";

grant update on table "public"."tool_insights" to "anon";

grant delete on table "public"."tool_insights" to "authenticated";

grant insert on table "public"."tool_insights" to "authenticated";

grant select on table "public"."tool_insights" to "authenticated";

grant update on table "public"."tool_insights" to "authenticated";

grant delete on table "public"."user_platforms" to "anon";

grant insert on table "public"."user_platforms" to "anon";

grant select on table "public"."user_platforms" to "anon";

grant update on table "public"."user_platforms" to "anon";

grant delete on table "public"."user_platforms" to "authenticated";

grant insert on table "public"."user_platforms" to "authenticated";

grant select on table "public"."user_platforms" to "authenticated";

grant update on table "public"."user_platforms" to "authenticated";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."verification_records" to "anon";

grant insert on table "public"."verification_records" to "anon";

grant select on table "public"."verification_records" to "anon";

grant update on table "public"."verification_records" to "anon";

grant delete on table "public"."verification_records" to "authenticated";

grant insert on table "public"."verification_records" to "authenticated";

grant select on table "public"."verification_records" to "authenticated";

grant update on table "public"."verification_records" to "authenticated";


