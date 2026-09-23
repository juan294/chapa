-- 053 — recover from a refresh claim that never needed to be permanent.
--
-- 046 documented "No timeout takeover exists" for the refresh barrier, and
-- that was correct for the case it was built for: a genuinely ambiguous
-- provider outcome (no HTTP response was ever observed) can never be safely
-- retried, because a rotating refresh token may already have been consumed
-- by the lost request. #1332 found the barrier was also being left in place
-- for outcomes that are NOT ambiguous at all:
--
--   1. The post-claim consent/linkage recheck fails before any provider
--      request was ever sent.
--   2. The provider returned a definitive HTTP response with no new tokens
--      (a non-invalid_grant error, or an ok response with no access_token).
--
-- Both of those are known outcomes — no request is in flight, so there is
-- nothing left to protect. Application code (`platform_token_refresh_result`
-- classification in `apps/web/lib/auth/{bitbucket,gitlab,codeberg}.ts`) now
-- distinguishes these "definitive" outcomes from a genuinely "ambiguous" one,
-- and this migration adds a release path for them:
-- `platform_token_refresh_release_attempt` deletes the exact attempt this
-- caller just claimed, in the same call, and can mark the connection
-- `needs_reconnect` in the same statement when the outcome was a definitive
-- revoke — the durable, owner-visible signal this repo had no way to raise
-- before (production evidence:
-- `docs/logs/2026-09-22-badge-load-error-linked-source-refresh.md`,
-- `juan294`'s Bitbucket link stayed blocked until a manual disconnect/
-- reconnect since nothing could ever release its claim).
--
-- This migration also reverses 046's "No timeout takeover exists" for the
-- genuinely ambiguous case, but narrowly: `platform_token_refresh_takeover`
-- allows exactly ONE retry of an unresolved attempt, and only once it is
-- older than the longest a claiming serverless function can possibly still
-- be running (see `REFRESH_CLAIM_TAKEOVER_THRESHOLD_SECONDS` in
-- `apps/web/lib/db/platform-token-refresh.ts` plus safety margin) — past
-- that point the platform has certainly torn the original function down, so
-- no response for the original request can still arrive. `takeover_used`
-- makes that retry non-repeatable: once a taken-over attempt is itself
-- ambiguous, the row can never be taken over again and the connection must
-- go through `needs_reconnect`. See
-- `docs/decisions/2026-09-23-refresh-claim-recovery.md` for why this is safe
-- (the worst case is identical to before this migration: a reconnect
-- prompt) and why a bare timeout-delete was rejected. 046 and 048 are
-- unmodified — this migration adds new functions and new columns only.

ALTER TABLE public.platform_token_refresh_attempts
  ADD COLUMN takeover_used boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_platforms
  ADD COLUMN needs_reconnect boolean NOT NULL DEFAULT false;

-- Release a specific, exactly-identified attempt this caller just claimed
-- (optionally via takeover) because its outcome is definitively known — no
-- provider request is outstanding for it. Requires no consent, matching
-- `platform_token_refresh_release` (046): recovery from a known outcome must
-- remain available to withdrawn and pre-v7 subjects, and it only ever
-- removes capability, never grants it. Same link -> attempt lock order as
-- the existing release function.
CREATE FUNCTION public.platform_token_refresh_release_attempt(
  p_owner text, p_actor text, p_platform text, p_link_id uuid,
  p_link_version timestamptz, p_attempt_id uuid, p_needs_reconnect boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_owner IS NULL OR p_actor IS NULL OR p_owner IS DISTINCT FROM p_actor
    OR p_owner <> lower(btrim(p_owner)) OR length(p_owner) = 0
    OR p_platform IS NULL OR p_platform NOT IN ('gitlab','bitbucket','codeberg')
    OR p_link_id IS NULL OR p_link_version IS NULL OR NOT isfinite(p_link_version)
    OR p_attempt_id IS NULL OR p_needs_reconnect IS NULL THEN
    RAISE EXCEPTION 'Invalid refresh release'; END IF;
  PERFORM 1 FROM public.user_platforms
    WHERE id=p_link_id AND handle=p_owner AND platform=p_platform AND updated_at=p_link_version FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','stale'); END IF;
  PERFORM 1 FROM public.platform_token_refresh_attempts
    WHERE link_id=p_link_id AND link_version=p_link_version AND attempt_id=p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','stale'); END IF;
  DELETE FROM public.platform_token_refresh_attempts
    WHERE link_id=p_link_id AND link_version=p_link_version AND attempt_id=p_attempt_id;
  -- A definitive revoke means the grant is dead; there is nothing left to
  -- retry automatically, so this is the only durable signal that turns into
  -- an owner-visible reconnect prompt (source-authorization/status route).
  -- A non-revoke definitive failure (e.g. a 5xx with a response) releases
  -- the barrier only — the next ordinary refresh attempt retries normally.
  IF p_needs_reconnect THEN
    UPDATE public.user_platforms SET needs_reconnect=true
      WHERE id=p_link_id AND updated_at=p_link_version;
  END IF;
  RETURN jsonb_build_object('status','released','needsReconnect',p_needs_reconnect);
END $$;

-- Take over a genuinely ambiguous, durably claimed attempt exactly once, and
-- only once it is provably older than any claiming function could still be
-- running. Same subject -> link -> attempt lock order as claim (046/048),
-- including 048's legacy-tolerant consent check (a connection with no v7
-- subject row at all is the legacy connection it is). The staleness check
-- and the update happen under the SAME row lock acquired by the attempt
-- SELECT ... FOR UPDATE above it, so this can never take over an attempt
-- that becomes fresh (a concurrent retry) between the check and the update,
-- and it never deletes anything — the row's identity (link_id) is preserved,
-- only its attempt_id/started_at/takeover_used are replaced.
CREATE FUNCTION public.platform_token_refresh_takeover(
  p_owner text, p_actor text, p_platform text, p_link_id uuid,
  p_link_version timestamptz, p_new_attempt_id uuid, p_max_age_seconds integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.platform_token_refresh_attempts%ROWTYPE;
BEGIN
  IF p_owner IS NULL OR p_actor IS NULL OR p_owner IS DISTINCT FROM p_actor
    OR p_owner <> lower(btrim(p_owner)) OR length(p_owner) = 0
    OR p_platform IS NULL OR p_platform NOT IN ('gitlab','bitbucket','codeberg')
    OR p_link_id IS NULL OR p_link_version IS NULL OR NOT isfinite(p_link_version)
    OR p_new_attempt_id IS NULL OR p_max_age_seconds IS NULL OR p_max_age_seconds <= 0 THEN
    RAISE EXCEPTION 'Invalid refresh takeover'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  IF FOUND THEN
    PERFORM 1 FROM public.scoring_v7_subjects
      WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Current consent required'; END IF;
  END IF;
  PERFORM 1 FROM public.user_platforms
    WHERE id=p_link_id AND handle=p_owner AND platform=p_platform AND updated_at=p_link_version FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','stale'); END IF;
  SELECT * INTO existing FROM public.platform_token_refresh_attempts
    WHERE link_id=p_link_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','gone'); END IF;
  IF existing.takeover_used THEN RETURN jsonb_build_object('status','exhausted'); END IF;
  IF existing.started_at > clock_timestamp() - make_interval(secs => p_max_age_seconds) THEN
    -- Never delete a fresher claim: the attempt is not old enough to be
    -- provably abandoned yet.
    RETURN jsonb_build_object('status','too_fresh');
  END IF;
  UPDATE public.platform_token_refresh_attempts
    SET attempt_id=p_new_attempt_id, started_at=clock_timestamp(), takeover_used=true
    WHERE link_id=p_link_id;
  RETURN jsonb_build_object('status','claimed','attemptId',p_new_attempt_id);
END $$;

REVOKE ALL ON FUNCTION public.platform_token_refresh_release_attempt(text,text,text,uuid,timestamptz,uuid,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_token_refresh_takeover(text,text,text,uuid,timestamptz,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_token_refresh_release_attempt(text,text,text,uuid,timestamptz,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_token_refresh_takeover(text,text,text,uuid,timestamptz,uuid,integer) TO service_role;
