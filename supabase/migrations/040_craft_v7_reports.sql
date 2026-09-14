-- Future-dated reviewer grants confer no current private access or assessment authority.
CREATE OR REPLACE FUNCTION public.scoring_v7_can_review(p_owner text, p_actor text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.scoring_v7_subjects WHERE owner_handle = p_owner)
    AND (p_actor = p_owner OR EXISTS (
      SELECT 1 FROM public.scoring_v7_reviewer_grants
      WHERE owner_handle = p_owner AND reviewer_handle = p_actor
        AND granted_at <= now() AND revoked_at IS NULL
    ));
$$;
REVOKE ALL ON FUNCTION public.scoring_v7_can_review(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_can_review(text,text) TO service_role;

-- Optional reports are private descriptive evidence, never rubric verdicts.
-- Reuses the withdrawal/deletion inventory from 039; no public table access.
CREATE FUNCTION public.scoring_v7_store_craft_report(
  p_owner text, p_actor text, p_upload uuid, p_digest text,
  p_period_start timestamptz, p_period_end timestamptz,
  p_diagnostics jsonb, p_body text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE existing uuid; received timestamptz := now();
BEGIN
  IF p_owner IS NULL OR p_actor IS DISTINCT FROM p_owner OR p_owner !~ '^[a-z0-9][a-z0-9-]{0,38}$' THEN
    RAISE EXCEPTION 'Craft report owner access denied' USING ERRCODE = '42501';
  END IF;
  IF p_upload IS NULL OR p_digest IS NULL OR p_digest !~ '^[0-9a-f]{64}$'
    OR p_body IS NULL OR octet_length(p_body) > 262144
    OR p_diagnostics IS NULL OR jsonb_typeof(p_diagnostics) <> 'object' OR octet_length(p_diagnostics::text) > 262144
    OR p_diagnostics->>'kind' IS DISTINCT FROM 'insights_diagnostics'
    OR p_diagnostics->>'schemaVersion' IS DISTINCT FROM 'v7'
    OR p_diagnostics ?| ARRAY['episodes','assessments','ownerId','provenance']
    OR p_period_start IS NULL OR p_period_end IS NULL OR NOT isfinite(p_period_start) OR NOT isfinite(p_period_end)
    OR p_period_start >= p_period_end OR p_period_end > (date_trunc('day', received AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + interval '1 day' THEN
    RAISE EXCEPTION 'Invalid Craft report';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner, 10));
  INSERT INTO public.scoring_v7_subjects(owner_handle) VALUES(p_owner) ON CONFLICT DO NOTHING;
  SELECT id INTO existing FROM public.scoring_v7_evidence
    WHERE owner_handle=p_owner AND channel='craft' AND category='craft' AND work_item_id='report:' || p_digest;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  INSERT INTO public.scoring_v7_evidence(id, owner_handle, claim_id, revision, channel, category, work_item_id, period_start, period_end, payload, recorded_at)
    VALUES(p_upload, p_owner, p_upload, 1, 'craft', 'craft', 'report:' || p_digest, p_period_start, p_period_end, p_diagnostics, received);
  INSERT INTO public.scoring_v7_raw_artifacts(id, owner_handle, kind, body, created_at, expires_at)
    VALUES(p_upload, p_owner, 'insights', p_body, received, received + interval '30 days');
  RETURN p_upload;
END;
$$;

-- A single SQL statement gives the private reader one consistent ledger snapshot.
-- The service caller obtains p_actor from session/CLI authentication, not JSON.
CREATE FUNCTION public.scoring_v7_read_craft(p_owner text, p_actor text, p_reference timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_actor IS DISTINCT FROM p_owner AND NOT public.scoring_v7_can_review(p_owner,p_actor) THEN
    RAISE EXCEPTION 'Craft portfolio access denied' USING ERRCODE = '42501';
  END IF;
  IF p_owner IS NULL OR p_actor IS NULL OR p_reference IS NULL OR NOT isfinite(p_reference) THEN
    RAISE EXCEPTION 'Invalid Craft portfolio context';
  END IF;
  RETURN jsonb_build_object(
    'evidence', (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.recorded_at,e.id), '[]') FROM public.scoring_v7_evidence e WHERE e.owner_handle=p_owner AND e.channel='craft' AND e.recorded_at<=p_reference),
    'assessments', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.recorded_at,a.id), '[]') FROM public.scoring_v7_assessments a JOIN public.scoring_v7_evidence e ON e.id=a.evidence_id WHERE a.owner_handle=p_owner AND e.channel='craft' AND a.recorded_at<=p_reference AND a.assessed_at<=p_reference),
    'references', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.reference_id), '[]') FROM public.scoring_v7_evidence_references r WHERE r.owner_handle=p_owner AND r.recorded_at<=p_reference AND (r.expires_at IS NULL OR r.expires_at>now())),
    'grants', (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.reviewer_handle), '[]') FROM public.scoring_v7_reviewer_grants g WHERE g.owner_handle=p_owner)
  );
END;
$$;

-- Called by the existing hourly maintenance cron. Never deletes extracted evidence.
CREATE FUNCTION public.scoring_v7_purge_expired_raw()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE bodies integer; locators integer;
BEGIN
  DELETE FROM public.scoring_v7_raw_artifacts WHERE expires_at<=now();
  GET DIAGNOSTICS bodies = ROW_COUNT;
  DELETE FROM public.scoring_v7_evidence_references WHERE retention='raw_30_days' AND expires_at<=now();
  GET DIAGNOSTICS locators = ROW_COUNT;
  RETURN bodies + locators;
END;
$$;
REVOKE ALL ON FUNCTION public.scoring_v7_store_craft_report(text,text,uuid,text,timestamptz,timestamptz,jsonb,text), public.scoring_v7_read_craft(text,text,timestamptz), public.scoring_v7_purge_expired_raw() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_store_craft_report(text,text,uuid,text,timestamptz,timestamptz,jsonb,text), public.scoring_v7_read_craft(text,text,timestamptz), public.scoring_v7_purge_expired_raw() TO service_role;
