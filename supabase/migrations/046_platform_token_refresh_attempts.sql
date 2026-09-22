-- S08 draft: an unresolved refresh attempt blocks the connection until an
-- exact successful finish or explicit disconnect. This is an operational
-- connection barrier, not evidence: consent withdrawal must not remove it
-- while the same user_platforms grant survives. No timeout takeover exists.
-- This does not claim exactly-once provider execution or recovery of a lost
-- successful provider response. Review exact bytes before local application.

CREATE TABLE public.platform_token_refresh_attempts (
  link_id uuid PRIMARY KEY REFERENCES public.user_platforms(id) ON DELETE CASCADE,
  link_version timestamptz NOT NULL CHECK (isfinite(link_version)),
  attempt_id uuid NOT NULL UNIQUE,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(started_at))
);
ALTER TABLE public.platform_token_refresh_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_token_refresh_attempts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.platform_token_refresh_attempts TO service_role;

CREATE FUNCTION public.platform_token_refresh_claim(
  p_owner text, p_actor text, p_platform text, p_link_id uuid,
  p_link_version timestamptz, p_attempt_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_owner IS NULL OR p_actor IS NULL OR p_owner IS DISTINCT FROM p_actor
    OR p_owner <> lower(btrim(p_owner)) OR length(p_owner) = 0
    OR p_platform IS NULL OR p_platform NOT IN ('gitlab','bitbucket','codeberg')
    OR p_link_id IS NULL OR p_link_version IS NULL OR NOT isfinite(p_link_version)
    OR p_attempt_id IS NULL THEN RAISE EXCEPTION 'Invalid refresh authorization'; END IF;
  -- All mutation paths use subject -> current link -> attempt lock order.
  PERFORM 1 FROM public.scoring_v7_subjects
    WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current consent required'; END IF;
  PERFORM 1 FROM public.user_platforms
    WHERE id=p_link_id AND handle=p_owner AND platform=p_platform AND updated_at=p_link_version FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','stale'); END IF;
  PERFORM 1 FROM public.platform_token_refresh_attempts WHERE link_id=p_link_id FOR UPDATE;
  -- Even the same attempt UUID retry is busy: a lost claim response is not
  -- permission to repeat an uncertain provider request. Ordinary link-version
  -- changes do not prove that the underlying refresh grant changed.
  IF FOUND THEN RETURN jsonb_build_object('status','busy'); END IF;
  INSERT INTO public.platform_token_refresh_attempts(link_id,link_version,attempt_id)
    VALUES(p_link_id,p_link_version,p_attempt_id);
  RETURN jsonb_build_object('status','claimed','attemptId',p_attempt_id);
END $$;

CREATE FUNCTION public.platform_token_refresh_finish(
  p_owner text, p_actor text, p_platform text, p_link_id uuid,
  p_link_version timestamptz, p_attempt_id uuid,
  p_access_token text, p_refresh_token text, p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_version timestamptz;
BEGIN
  IF p_owner IS NULL OR p_actor IS NULL OR p_owner IS DISTINCT FROM p_actor
    OR p_owner <> lower(btrim(p_owner)) OR length(p_owner) = 0
    OR p_platform IS NULL OR p_platform NOT IN ('gitlab','bitbucket','codeberg')
    OR p_link_id IS NULL OR p_link_version IS NULL OR NOT isfinite(p_link_version)
    OR p_attempt_id IS NULL OR p_access_token IS NULL OR length(btrim(p_access_token))=0
    OR (p_refresh_token IS NOT NULL AND length(btrim(p_refresh_token))=0)
    OR (p_expires_at IS NOT NULL AND NOT isfinite(p_expires_at)) THEN RAISE EXCEPTION 'Invalid refresh completion'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects
    WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current consent required'; END IF;
  PERFORM 1 FROM public.user_platforms
    WHERE id=p_link_id AND handle=p_owner AND platform=p_platform AND updated_at=p_link_version FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','stale'); END IF;
  PERFORM 1 FROM public.platform_token_refresh_attempts
    WHERE link_id=p_link_id AND link_version=p_link_version AND attempt_id=p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','stale'); END IF;
  UPDATE public.user_platforms
    SET access_token=p_access_token, refresh_token=p_refresh_token, token_expires_at=p_expires_at
    WHERE id=p_link_id RETURNING updated_at INTO new_version;
  IF new_version IS NULL OR NOT isfinite(new_version) OR new_version<=p_link_version THEN
    RAISE EXCEPTION 'Refresh version did not advance';
  END IF;
  DELETE FROM public.platform_token_refresh_attempts
    WHERE link_id=p_link_id AND link_version=p_link_version AND attempt_id=p_attempt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refresh attempt changed'; END IF;
  -- Token update and barrier removal commit together. A known successful
  -- response may retain the same reusable refresh token; it is not ambiguous.
  RETURN jsonb_build_object('status','updated','id',p_link_id,'updatedAt',new_version);
END $$;

REVOKE ALL ON FUNCTION public.platform_token_refresh_claim(text,text,text,uuid,timestamptz,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_token_refresh_finish(text,text,text,uuid,timestamptz,uuid,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_token_refresh_claim(text,text,text,uuid,timestamptz,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_token_refresh_finish(text,text,text,uuid,timestamptz,uuid,text,text,timestamptz) TO service_role;

-- A new authorization grant supersedes any attempt made against an older link
-- version. Release is the documented disconnect/reconnect recovery: without it
-- a reconnect that upserts the same row (onConflict handle,platform) inherits
-- the stuck barrier and the connection can never refresh again. It deletes only
-- superseded attempts, never one claimed against the version it is given, so a
-- provider request that is still in flight against the current grant keeps its
-- barrier. It requires no consent: recovery must remain available to withdrawn
-- and pre-v7 subjects, and it removes capability rather than granting it.
CREATE FUNCTION public.platform_token_refresh_release(
  p_owner text, p_actor text, p_platform text, p_link_id uuid, p_link_version timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cleared integer;
BEGIN
  IF p_owner IS NULL OR p_actor IS NULL OR p_owner IS DISTINCT FROM p_actor
    OR p_owner <> lower(btrim(p_owner)) OR length(p_owner) = 0
    OR p_platform IS NULL OR p_platform NOT IN ('gitlab','bitbucket','codeberg')
    OR p_link_id IS NULL OR p_link_version IS NULL OR NOT isfinite(p_link_version) THEN
    RAISE EXCEPTION 'Invalid refresh release';
  END IF;
  -- Link -> attempt, the same relative order claim and finish use.
  PERFORM 1 FROM public.user_platforms
    WHERE id=p_link_id AND handle=p_owner AND platform=p_platform AND updated_at=p_link_version FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','stale'); END IF;
  DELETE FROM public.platform_token_refresh_attempts
    WHERE link_id=p_link_id AND link_version IS DISTINCT FROM p_link_version;
  GET DIAGNOSTICS cleared = ROW_COUNT;
  RETURN jsonb_build_object('status','released','cleared',cleared);
END $$;

REVOKE ALL ON FUNCTION public.platform_token_refresh_release(text,text,text,uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_token_refresh_release(text,text,text,uuid,timestamptz) TO service_role;
