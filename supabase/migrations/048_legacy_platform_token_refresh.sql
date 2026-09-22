-- 048 — let a pre-v7 platform connection renew its own token.
--
-- 046 gated the refresh claim and completion on a v7 consent row:
--
--   PERFORM 1 FROM public.scoring_v7_subjects
--     WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
--   IF NOT FOUND THEN RAISE EXCEPTION 'Current consent required'; END IF;
--
-- The v7 consent flow is not live, so `scoring_v7_subjects` is empty and every
-- refresh raised. GitLab and Bitbucket access tokens last about two hours, and
-- `getStats` refuses to score an aggregate that silently drops a connected
-- source, so two hours after linking a platform the user's whole profile
-- returns null. The only recovery was to unlink and relink, every two hours.
--
-- Consent governs publishing v7 evidence. It does not govern renewing an OAuth
-- grant the user already gave, which is what a refresh is. So: a subject row
-- that exists must still consent (v7 semantics unchanged), and a connection
-- with no subject row at all is treated as the legacy connection it is.

CREATE OR REPLACE FUNCTION public.platform_token_refresh_claim(
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
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  IF FOUND THEN
    PERFORM 1 FROM public.scoring_v7_subjects
      WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Current consent required'; END IF;
  END IF;
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

CREATE OR REPLACE FUNCTION public.platform_token_refresh_finish(
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
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  IF FOUND THEN
    PERFORM 1 FROM public.scoring_v7_subjects
      WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Current consent required'; END IF;
  END IF;
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
