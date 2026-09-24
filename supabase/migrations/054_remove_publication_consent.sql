-- Refs #1335 (phase 2). Owner decision 2026-09-23: publication consent is
-- retired completely — UI, API action, SQL predicates and the
-- source-authorization gate. A registered subject (a `scoring_v7_subjects`
-- row) needs no opt-in to be collected, published, verified or read.
--
-- Expand only: `public_evidence_consent` and `consent_recorded_at` are NOT
-- dropped here (docs/runbooks/migrations.md:122 — migrations apply before the
-- code that depends on them, so the release still running when this lands
-- reads those columns). Every subject's consent is backfilled to true and the
-- column defaults to true, so the old code keeps working unchanged until the
-- release. The contract migration that drops these columns is 058 (phase 5),
-- applied only after the release.
--
-- Every function below is copied from the latest migration that defined it,
-- with only the consent predicate/guard removed — never the rest of the body.

-- 043 — receipt publish/manifest/read (legacy v7 receipt family).
CREATE OR REPLACE FUNCTION public.scoring_v7_publish_receipt(p_owner text,p_actor text,p_receipt jsonb,p_canonical text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target uuid; reference timestamptz; day date; policy text; prior public.scoring_v7_trend_anchors; existing public.scoring_v7_receipts;
  raw double precision; retention double precision; trend_value double precision; status text:='inserted'; is_current boolean;
BEGIN
  IF p_owner IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_owner !~ '^[a-z0-9][a-z0-9-]{0,38}$' THEN RAISE EXCEPTION 'Receipt owner access denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registered subject required' USING ERRCODE='42501'; END IF;
  IF p_receipt IS NULL OR p_canonical IS NULL OR octet_length(p_canonical)>2097152 OR p_canonical::jsonb IS DISTINCT FROM p_receipt THEN RAISE EXCEPTION 'Invalid receipt payload'; END IF;
  target:=(p_receipt->>'revisionId')::uuid; reference:=(p_receipt #>> '{window,referenceTime}')::timestamptz; day:=(reference AT TIME ZONE 'UTC')::date; policy:=p_receipt->>'policyVersion';
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner||':'||policy,7));
  SELECT * INTO existing FROM public.scoring_v7_receipts WHERE id=target;
  IF existing.id IS NOT NULL THEN
    IF existing.owner_handle<>p_owner OR existing.canonical_receipt IS DISTINCT FROM p_canonical THEN RAISE EXCEPTION 'Conflicting immutable receipt'; END IF;
    status:='duplicate';
  ELSE
    INSERT INTO public.scoring_v7_receipts(id,owner_handle,policy_version,reference_time,revision,supersedes_id,canonical_receipt,public_receipt,issued_at)
    VALUES(target,p_owner,policy,reference,(p_receipt->>'revision')::integer,(p_receipt->>'supersedesRevisionId')::uuid,p_canonical,p_receipt,(p_receipt->>'recordedAt')::timestamptz);
    -- Append historical corrections without rewriting a consumed trend or replacing a newer same-day reference.
    is_current:=NOT EXISTS(SELECT 1 FROM public.scoring_v7_receipts WHERE owner_handle=p_owner AND policy_version=policy AND reference_time>reference)
      AND NOT EXISTS(SELECT 1 FROM public.scoring_v7_trend_anchors WHERE owner_handle=p_owner AND policy_version=policy AND date>day);
    IF is_current THEN
      IF p_receipt->>'action'<>'retract' AND p_receipt #>> '{core,composite,kind}'='point' THEN
        SELECT * INTO prior FROM public.scoring_v7_trend_anchors WHERE owner_handle=p_owner AND policy_version=policy AND date<day ORDER BY date DESC LIMIT 1;
        raw:=(p_receipt #>> '{core,composite,value}')::double precision;
        IF prior.receipt_id IS NULL THEN trend_value:=raw; ELSE retention:=power(0.85::double precision,(day-prior.date)::double precision); trend_value:=retention*prior.value+(1-retention)*raw; END IF;
        INSERT INTO public.scoring_v7_trend_anchors(owner_handle,policy_version,date,receipt_id,previous_receipt_id,previous_date,previous_value,raw_value,value)
        VALUES(p_owner,policy,day,target,prior.receipt_id,prior.date,prior.value,raw,trend_value)
        ON CONFLICT(owner_handle,policy_version,date) DO UPDATE SET receipt_id=excluded.receipt_id,previous_receipt_id=excluded.previous_receipt_id,previous_date=excluded.previous_date,previous_value=excluded.previous_value,raw_value=excluded.raw_value,value=excluded.value;
      ELSE
        DELETE FROM public.scoring_v7_trend_anchors WHERE owner_handle=p_owner AND policy_version=policy AND date=day;
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('status',status,'canonicalReceipt',p_canonical,'trend',(SELECT to_jsonb(t) FROM public.scoring_v7_trend_anchors t WHERE t.receipt_id=target));
END;
$$;

-- 050 — the legacy `v7` policy-qualified adapter of the receipt manifest.
CREATE OR REPLACE FUNCTION public.scoring_v7_receipt_manifest(p_owner text,p_revision uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE selected public.scoring_v7_receipts;
BEGIN
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO selected FROM public.scoring_v7_receipts WHERE owner_handle=p_owner AND policy_version='v7' AND (p_revision IS NULL OR id=p_revision) ORDER BY reference_time DESC,revision DESC LIMIT 1;
  IF selected.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('revisionId',selected.id,'policyVersion',selected.policy_version,'trend',(SELECT to_jsonb(t) FROM public.scoring_v7_trend_anchors t WHERE t.receipt_id=selected.id));
END;
$$;

-- 044 — verification issuance/read.
CREATE OR REPLACE FUNCTION public.scoring_v7_issue_verification(p_owner text, p_actor text, p_revision uuid, p_key_version text, p_signature text, p_canonical text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE existing public.scoring_v7_verification;
BEGIN
  IF p_owner IS NULL OR p_owner IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Owner authorization required'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registered subject required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.scoring_v7_receipts WHERE id=p_revision AND owner_handle=p_owner AND canonical_receipt=p_canonical) THEN RAISE EXCEPTION 'Receipt binding mismatch'; END IF;
  SELECT * INTO existing FROM public.scoring_v7_verification WHERE receipt_id=p_revision AND key_version=p_key_version;
  IF FOUND THEN
    IF existing.signature IS DISTINCT FROM p_signature THEN RAISE EXCEPTION 'Issuance conflict'; END IF;
    RETURN;
  END IF;
  INSERT INTO public.scoring_v7_verification(signature,receipt_id,key_version) VALUES(p_signature,p_revision,p_key_version);
END $$;

CREATE OR REPLACE FUNCTION public.scoring_v7_read_verification(p_revision uuid, p_signature text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE receipt public.scoring_v7_receipts; issuance public.scoring_v7_verification;
BEGIN
  -- Tombstones authenticate no signature. They only identify a revoked revision.
  IF EXISTS(SELECT 1 FROM public.scoring_v7_revocations WHERE receipt_id=p_revision) THEN RETURN jsonb_build_object('status','revoked'); END IF;
  SELECT r.* INTO receipt FROM public.scoring_v7_receipts r JOIN public.scoring_v7_subjects s ON s.owner_handle=r.owner_handle WHERE r.id=p_revision FOR SHARE OF s;
  IF NOT FOUND THEN
    IF EXISTS(SELECT 1 FROM public.scoring_v7_revocations WHERE receipt_id=p_revision) THEN RETURN jsonb_build_object('status','revoked'); END IF;
    RETURN NULL;
  END IF;
  SELECT * INTO issuance FROM public.scoring_v7_verification WHERE receipt_id=p_revision AND signature=p_signature;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('status', CASE WHEN receipt.public_receipt->>'action'='retract' THEN 'retracted' WHEN EXISTS(SELECT 1 FROM public.scoring_v7_receipts WHERE supersedes_id=p_revision) THEN 'superseded' ELSE 'current' END,
    'canonical',receipt.canonical_receipt,'keyVersion',issuance.key_version);
END $$;

-- 045 — source context lock and CAS link-token rotation.
CREATE OR REPLACE FUNCTION public.scoring_v7_lock_source_context(
 p_owner text, p_actor text, p_requested jsonb, p_access text, p_scope jsonb,
 p_link_id uuid, p_link_version timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF p_owner IS NULL OR p_actor IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_owner <> lower(btrim(p_owner)) OR length(p_owner)=0 THEN
   RAISE EXCEPTION 'Source authorization required';
 END IF;
 PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Registered subject required'; END IF;
 IF jsonb_typeof(p_requested) IS DISTINCT FROM 'object' OR p_requested - ARRAY['provider','host','login'] <> '{}'::jsonb
   OR p_requested->>'provider' IS NULL OR p_requested->>'provider' NOT IN ('github','gitlab','bitbucket','codeberg')
   OR jsonb_typeof(p_requested->'host') IS DISTINCT FROM 'string' OR jsonb_typeof(p_requested->'login') IS DISTINCT FROM 'string' OR coalesce(length(p_requested->>'host'),0)=0 OR coalesce(length(p_requested->>'login'),0)=0
   OR p_access IS NULL OR p_access !~ '^[a-f0-9]{64}$'
   OR jsonb_typeof(p_scope) IS DISTINCT FROM 'object' OR p_scope - ARRAY['discovery','repositoryIds','eventKinds'] <> '{}'::jsonb
   OR p_scope->>'discovery' IS NULL OR p_scope->>'discovery' NOT IN ('owned_and_contributed','contribution_search','registered_ledger','explicit_repositories','legacy_upload') OR NOT public.scoring_v7_source_strings(p_scope->'repositoryIds') OR jsonb_typeof(p_scope->'repositoryIds') IS DISTINCT FROM 'array'
   OR jsonb_typeof(p_scope->'eventKinds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid source context'; END IF;
 IF p_requested->>'provider' = 'github' THEN
   IF lower(p_requested->>'login') IS DISTINCT FROM p_owner OR p_link_id IS NOT NULL OR p_link_version IS NOT NULL THEN RAISE EXCEPTION 'Invalid source link'; END IF;
 ELSE
   IF p_link_id IS NULL OR p_link_version IS NULL OR NOT isfinite(p_link_version) THEN RAISE EXCEPTION 'Current source link required'; END IF;
   PERFORM 1 FROM public.user_platforms WHERE id=p_link_id AND handle=p_owner AND platform=p_requested->>'provider' AND remote_login=p_requested->>'login' AND updated_at=p_link_version FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Current source link required'; END IF;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.scoring_v7_cas_link_tokens(
 p_owner text, p_actor text, p_platform text, p_id uuid, p_version timestamptz,
 p_action text, p_access_token text, p_refresh_token text, p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_id uuid; new_version timestamptz;
BEGIN
 IF p_owner IS NULL OR p_actor IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_owner<>lower(btrim(p_owner)) OR length(p_owner)=0 THEN RAISE EXCEPTION 'Link authorization required'; END IF;
 PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Registered subject required'; END IF;
 IF p_id IS NULL OR p_version IS NULL OR p_platform IS NULL OR p_platform NOT IN ('gitlab','bitbucket','codeberg') OR NOT isfinite(p_version) OR (p_expires_at IS NOT NULL AND NOT isfinite(p_expires_at)) OR p_action IS NULL OR p_action NOT IN ('update','delete') THEN RAISE EXCEPTION 'Invalid link update'; END IF;
 SELECT id INTO current_id FROM public.user_platforms WHERE id=p_id AND handle=p_owner AND platform=p_platform AND updated_at=p_version FOR UPDATE;
 IF current_id IS NULL THEN RETURN jsonb_build_object('status','stale'); END IF;
 IF p_action='delete' THEN
   DELETE FROM public.user_platforms WHERE id=current_id;
   RETURN jsonb_build_object('status','deleted');
 END IF;
 IF p_access_token IS NULL OR length(btrim(p_access_token))=0 THEN RAISE EXCEPTION 'Encrypted credential required'; END IF;
 UPDATE public.user_platforms SET access_token=p_access_token,refresh_token=p_refresh_token,token_expires_at=p_expires_at WHERE id=current_id RETURNING updated_at INTO new_version;
 RETURN jsonb_build_object('status','updated','id',current_id,'updatedAt',new_version);
END $$;

-- 048 — pre-v7 tolerant platform-token refresh claim/finish. The v7 consent
-- check they carried is gone outright: it was already legacy-tolerant
-- (skipped when no subject row existed), and consent no longer exists to
-- check for the subjects that do have a row.
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

-- 053 — genuinely-ambiguous refresh-claim takeover. Same consent removal as 048.
CREATE OR REPLACE FUNCTION public.platform_token_refresh_takeover(
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

-- 052 — v7.2 observed receipt publish/manifest (with core_semantic_digest).
CREATE OR REPLACE FUNCTION public.scoring_observed_publish_receipt(p_owner text,p_actor text,p_receipt jsonb,p_canonical text,p_semantic_digest text,p_core_semantic_digest text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target uuid; reference timestamptz; day date; existing public.scoring_v7_receipts; current_receipt public.scoring_v7_receipts;
  prior public.scoring_v7_trend_anchors; raw double precision; retention double precision; trend_value double precision;
  publication_status text:='inserted'; selected_current boolean:=false;
BEGIN
  IF p_owner IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_owner !~ '^[a-z0-9][a-z0-9-]{0,38}$' THEN RAISE EXCEPTION 'Receipt owner access denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registered subject required' USING ERRCODE='42501'; END IF;
  IF p_receipt IS NULL OR p_canonical IS NULL OR octet_length(p_canonical)>2097152 OR p_canonical::jsonb IS DISTINCT FROM p_receipt
    OR (p_core_semantic_digest IS NOT NULL AND p_core_semantic_digest !~ '^[0-9a-f]{64}$')
    OR p_semantic_digest IS NULL OR p_semantic_digest !~ '^[0-9a-f]{64}$'
    OR p_receipt->>'policyVersion' IS DISTINCT FROM 'v7.2' OR p_receipt #>> '{algorithm,revision}' IS DISTINCT FROM 'v7.2'
    OR p_receipt #>> '{core,composite,kind}' IS DISTINCT FROM 'point'
    OR jsonb_typeof(p_receipt #> '{core,composite,exact}') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid observed receipt payload'; END IF;
  raw:=(p_receipt #>> '{core,composite,exact}')::double precision;
  IF raw NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid observed score'; END IF;
  target:=(p_receipt->>'revisionId')::uuid;
  reference:=(p_receipt #>> '{window,referenceTime}')::timestamptz;
  day:=(reference AT TIME ZONE 'UTC')::date;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner||':v7.2',7));
  SELECT r.* INTO current_receipt FROM public.scoring_observed_current c JOIN public.scoring_v7_receipts r ON r.id=c.receipt_id WHERE c.owner_handle=p_owner;
  SELECT * INTO existing FROM public.scoring_v7_receipts WHERE id=target;
  IF existing.id IS NOT NULL THEN
    IF existing.owner_handle<>p_owner OR existing.policy_version<>'v7.2' OR existing.canonical_receipt IS DISTINCT FROM p_canonical OR existing.semantic_digest IS DISTINCT FROM p_semantic_digest OR (p_core_semantic_digest IS NOT NULL AND existing.core_semantic_digest IS DISTINCT FROM p_core_semantic_digest) THEN RAISE EXCEPTION 'Conflicting immutable receipt'; END IF;
    publication_status:='duplicate';
  ELSIF current_receipt.id IS NOT NULL AND (current_receipt.reference_time AT TIME ZONE 'UTC')::date=day AND current_receipt.semantic_digest=p_semantic_digest
    AND (p_core_semantic_digest IS NULL OR current_receipt.core_semantic_digest=p_core_semantic_digest)
    AND current_receipt.public_receipt->>'action'<>'retract' AND p_receipt->>'action'='create' THEN
    -- Only the currently selected publication can win a semantic no-op. Never search history.
    existing:=current_receipt;
    target:=existing.id;
    publication_status:='duplicate';
  ELSE
    INSERT INTO public.scoring_v7_receipts(id,owner_handle,policy_version,reference_time,revision,supersedes_id,canonical_receipt,public_receipt,issued_at,semantic_digest,core_semantic_digest)
    VALUES(target,p_owner,'v7.2',reference,(p_receipt->>'revision')::integer,(p_receipt->>'supersedesRevisionId')::uuid,p_canonical,p_receipt,(p_receipt->>'recordedAt')::timestamptz,p_semantic_digest,p_core_semantic_digest)
    RETURNING * INTO existing;
    -- New observation roots may share a clock value. Historical family corrections
    -- at that clock cannot replace a different, newer publication family.
    selected_current:=current_receipt.id IS NULL OR reference>current_receipt.reference_time
      OR (reference=current_receipt.reference_time AND (existing.supersedes_id IS NULL OR existing.supersedes_id=current_receipt.id));
    IF selected_current THEN
      INSERT INTO public.scoring_observed_current(owner_handle,receipt_id) VALUES(p_owner,target)
      ON CONFLICT(owner_handle) DO UPDATE SET receipt_id=excluded.receipt_id;
      IF p_receipt->>'action'<>'retract' THEN
        SELECT * INTO prior FROM public.scoring_v7_trend_anchors WHERE owner_handle=p_owner AND policy_version='v7.2' AND date<day ORDER BY date DESC LIMIT 1;
        IF prior.receipt_id IS NULL THEN trend_value:=raw; ELSE retention:=power(0.85::double precision,(day-prior.date)::double precision); trend_value:=retention*prior.value+(1-retention)*raw; END IF;
        INSERT INTO public.scoring_v7_trend_anchors(owner_handle,policy_version,date,receipt_id,previous_receipt_id,previous_date,previous_value,raw_value,value)
        VALUES(p_owner,'v7.2',day,target,prior.receipt_id,prior.date,prior.value,raw,trend_value)
        ON CONFLICT(owner_handle,policy_version,date) DO UPDATE SET receipt_id=excluded.receipt_id,previous_receipt_id=excluded.previous_receipt_id,previous_date=excluded.previous_date,previous_value=excluded.previous_value,raw_value=excluded.raw_value,value=excluded.value;
      ELSE
        DELETE FROM public.scoring_v7_trend_anchors WHERE owner_handle=p_owner AND policy_version='v7.2' AND date=day;
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('status',publication_status,'revisionId',existing.id,'policyVersion','v7.2','canonicalReceipt',existing.canonical_receipt,'semanticDigest',existing.semantic_digest,'coreSemanticDigest',existing.core_semantic_digest,
    'contentHash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(existing.canonical_receipt,'UTF8')),'hex'),
    'isCurrent',EXISTS(SELECT 1 FROM public.scoring_observed_current WHERE owner_handle=p_owner AND receipt_id=existing.id),
    'trend',(SELECT to_jsonb(t) FROM public.scoring_v7_trend_anchors t WHERE t.receipt_id=existing.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.scoring_observed_receipt_manifest(p_owner text,p_revision uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE selected public.scoring_v7_receipts;
BEGIN
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_revision IS NULL THEN
    SELECT r.* INTO selected FROM public.scoring_observed_current c JOIN public.scoring_v7_receipts r ON r.id=c.receipt_id WHERE c.owner_handle=p_owner AND r.owner_handle=p_owner AND r.policy_version='v7.2';
  ELSE
    SELECT * INTO selected FROM public.scoring_v7_receipts WHERE id=p_revision AND owner_handle=p_owner AND policy_version='v7.2';
  END IF;
  IF selected.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('revisionId',selected.id,'policyVersion','v7.2','semanticDigest',selected.semantic_digest,'coreSemanticDigest',selected.core_semantic_digest,
    'contentHash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(selected.canonical_receipt,'UTF8')),'hex'),
    'isCurrent',EXISTS(SELECT 1 FROM public.scoring_observed_current WHERE owner_handle=p_owner AND receipt_id=selected.id),
    'trend',(SELECT to_jsonb(t) FROM public.scoring_v7_trend_anchors t WHERE t.receipt_id=selected.id));
END;
$$;

-- 051 — report Craft store/read/publish-with-report.
CREATE OR REPLACE FUNCTION public.scoring_report_craft_store(p_owner text,p_actor text,p_prepared jsonb,p_acknowledged boolean,p_supersedes uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
<<admission>>
DECLARE admitted public.scoring_v7_subjects; existing public.report_craft_reports; previous public.report_craft_reports;
  selected public.report_craft_reports; pointer public.report_craft_selection; target uuid:=gen_random_uuid();
  received timestamptz; period_start timestamptz; period_end timestamptz; declared_start date; declared_end date;
  inputs jsonb; result jsonb; selection text; lower_bound timestamptz; evaluation timestamptz; chosen uuid;
BEGIN
  -- p_acknowledged is no longer read: publication needs no acknowledgment now
  -- that it is not opt-in. Kept only so the service RPC signature is stable.
  IF p_owner IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_owner !~ '^[a-z0-9][a-z0-9-]{0,38}$' THEN RAISE EXCEPTION 'Report owner access denied' USING ERRCODE='42501'; END IF;
  -- Same serialization as the ledger; later publication locks this subject too.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner,11));
  SELECT * INTO admitted FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  IF p_prepared IS NULL OR p_prepared->>'contentDigest' !~ '^[0-9a-f]{64}$'
    OR p_prepared->>'periodBasis' IS DISTINCT FROM 'declared_dates_first_capture_v7.2'
    OR p_prepared #>> '{calculation,status}' IS DISTINCT FROM 'valid'
    OR p_prepared->>'canonicalBody' IS NULL OR octet_length(p_prepared->>'canonicalBody')>262144
    OR pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_prepared->>'canonicalBody','UTF8')),'hex') IS DISTINCT FROM p_prepared->>'contentDigest' THEN RAISE EXCEPTION 'Invalid report payload'; END IF;
  received:=(p_prepared->>'capturedAt')::timestamptz;
  declared_start:=(p_prepared #>> '{declaredPeriod,start}')::date; declared_end:=(p_prepared #>> '{declaredPeriod,end}')::date;
  inputs:=p_prepared #> '{calculation,inputs}'; result:=p_prepared #> '{calculation,result}';
  period_start:=(inputs #>> '{reportPeriod,startInclusive}')::timestamptz; period_end:=(inputs #>> '{reportPeriod,endExclusive}')::timestamptz;
  lower_bound:=((received AT TIME ZONE 'UTC')::date-364)::timestamp AT TIME ZONE 'UTC';
  IF received IS NULL OR NOT isfinite(received) OR declared_start IS NULL OR declared_end IS NULL OR declared_start>declared_end
    OR declared_end>(received AT TIME ZONE 'UTC')::date OR period_start IS DISTINCT FROM (declared_start::timestamp AT TIME ZONE 'UTC')
    OR period_end IS DISTINCT FROM least(((declared_end+1)::timestamp AT TIME ZONE 'UTC'),received)
    OR period_start>=period_end OR inputs->>'policyVersion' IS DISTINCT FROM 'v7.2'
    OR inputs->>'classifierRevision' IS DISTINCT FROM 'cc-outcomes-v7.2'
    OR result->>'status' IS NULL OR result->>'status' NOT IN ('scored','insufficient_report_data') THEN RAISE EXCEPTION 'Invalid report period or calculation'; END IF;
  INSERT INTO public.scoring_v7_subjects(owner_handle) VALUES(p_owner) ON CONFLICT DO NOTHING;
  INSERT INTO public.report_craft_selection(owner_handle) VALUES(p_owner) ON CONFLICT DO NOTHING;
  SELECT * INTO pointer FROM public.report_craft_selection WHERE owner_handle=p_owner FOR UPDATE;
  evaluation:=greatest(received,pointer.evaluated_at);
  SELECT * INTO existing FROM public.report_craft_reports WHERE owner_handle=p_owner AND content_digest=p_prepared->>'contentDigest';
  IF existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('status','stored','persisted',true,'reportId',existing.id,'selectedReportId',pointer.selected_report_id,'generation',pointer.generation,'consented',true,'selection','unchanged');
  END IF;
  SELECT r.* INTO previous FROM public.report_craft_reports r WHERE r.owner_handle=p_owner AND r.declared_start=admission.declared_start AND r.declared_end=admission.declared_end
    AND NOT EXISTS(SELECT 1 FROM public.report_craft_reports child WHERE child.supersedes_id=r.id) ORDER BY r.captured_at DESC,r.id DESC LIMIT 1;
  IF (previous.id IS NOT NULL AND p_supersedes IS DISTINCT FROM previous.id) OR (previous.id IS NULL AND p_supersedes IS NOT NULL) THEN
    RETURN jsonb_build_object('status','correction_required','persisted',false,'supersedesReportId',previous.id);
  END IF;
  INSERT INTO public.report_craft_reports(id,owner_handle,content_digest,declared_start,declared_end,captured_at,period_start,period_end,period_basis,canonical_inputs,result,supersedes_id)
    VALUES(target,p_owner,p_prepared->>'contentDigest',declared_start,declared_end,received,period_start,period_end,p_prepared->>'periodBasis',inputs,result,p_supersedes);
  INSERT INTO public.scoring_v7_raw_artifacts(id,owner_handle,kind,body,created_at,expires_at)
    VALUES(target,p_owner,'insights',p_prepared->>'canonicalBody',received,received+interval '30 days');
  chosen:=public.scoring_report_craft_choose(p_owner,evaluation);
  IF chosen IS NOT NULL AND chosen IS DISTINCT FROM pointer.selected_report_id THEN
    UPDATE public.report_craft_selection SET selected_report_id=chosen,generation=generation+1,evaluated_at=evaluation WHERE owner_handle=p_owner RETURNING * INTO pointer;
  ELSE
    UPDATE public.report_craft_selection SET evaluated_at=evaluation WHERE owner_handle=p_owner RETURNING * INTO pointer;
  END IF;
  IF result->>'status'<>'scored' THEN
    selection:='insufficient';
    IF pointer.selected_report_id IS NULL AND period_start>=lower_bound THEN
      UPDATE public.report_craft_selection SET generation=generation+1 WHERE owner_handle=p_owner RETURNING * INTO pointer;
    END IF;
  ELSIF pointer.selected_report_id=target THEN selection:='selected';
  ELSIF period_start<lower_bound OR period_end<=lower_bound THEN selection:='outside_window';
  ELSE selection:='older'; END IF;
  RETURN jsonb_build_object('status','stored','persisted',true,'reportId',target,'selectedReportId',pointer.selected_report_id,'generation',pointer.generation,'consented',true,'selection',selection);
END;
$$;

CREATE OR REPLACE FUNCTION public.scoring_report_craft_read(p_owner text,p_reference timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE pointer public.report_craft_selection; chosen uuid; evaluation timestamptz;
BEGIN
  IF p_reference IS NULL OR NOT isfinite(p_reference) THEN RAISE EXCEPTION 'Invalid report selection context'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO pointer FROM public.report_craft_selection WHERE owner_handle=p_owner;
  IF pointer.owner_handle IS NOT NULL THEN
    -- Selection moves forward with the observed clock. An old in-flight reader
    -- cannot restore a report that a later window already made ineligible.
    evaluation:=greatest(p_reference,pointer.evaluated_at);
    chosen:=public.scoring_report_craft_choose(p_owner,evaluation);
    UPDATE public.report_craft_selection SET
      selected_report_id=coalesce(chosen,selected_report_id),
      generation=generation+CASE WHEN chosen IS NOT NULL AND chosen IS DISTINCT FROM selected_report_id THEN 1 ELSE 0 END,
      evaluated_at=evaluation WHERE owner_handle=p_owner RETURNING * INTO pointer;
  END IF;
  RETURN jsonb_build_object('selectedReportId',pointer.selected_report_id,'generation',coalesce(pointer.generation,0),
    'selected',(SELECT to_jsonb(r)-'content_digest' FROM public.report_craft_reports r WHERE r.owner_handle=p_owner AND r.id=pointer.selected_report_id),
    'insufficient',(SELECT to_jsonb(r)-'content_digest' FROM public.report_craft_reports r WHERE r.owner_handle=p_owner AND r.result->>'status'='insufficient_report_data' ORDER BY r.period_end DESC,r.captured_at DESC,r.id DESC LIMIT 1));
END;
$$;

CREATE OR REPLACE FUNCTION public.scoring_observed_publish_with_report(p_owner text,p_actor text,p_receipt jsonb,p_canonical text,p_semantic_digest text,p_selected_report uuid,p_generation bigint,p_expected_receipt uuid DEFAULT NULL,p_core_semantic_digest text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE pointer public.report_craft_selection; selected public.report_craft_reports; report jsonb; state text;
BEGIN
  IF p_owner IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Report owner access denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registered subject required' USING ERRCODE='42501'; END IF;
  SELECT * INTO pointer FROM public.report_craft_selection WHERE owner_handle=p_owner;
  IF p_generation IS DISTINCT FROM coalesce(pointer.generation,0) OR p_selected_report IS DISTINCT FROM pointer.selected_report_id THEN RAISE EXCEPTION 'Report selection changed'; END IF;
  IF p_expected_receipt IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.scoring_observed_current WHERE owner_handle=p_owner AND receipt_id=p_expected_receipt) THEN RAISE EXCEPTION 'Core baseline changed'; END IF;
  state:=p_receipt #>> '{craft,status}';
  IF p_selected_report IS NOT NULL THEN
    SELECT * INTO selected FROM public.report_craft_reports WHERE owner_handle=p_owner AND id=p_selected_report;
    report:=CASE WHEN state='scored' THEN p_receipt #> '{craft,report}' ELSE p_receipt #> '{craft,lastReport}' END;
    IF state NOT IN ('scored','expired','unavailable') OR report->>'reportRef' IS DISTINCT FROM selected.id::text
      OR ((report->'inputs')-'window') IS DISTINCT FROM (selected.canonical_inputs-'window')
      OR report->'result' IS DISTINCT FROM selected.result OR report->>'supersedesReportRef' IS DISTINCT FROM selected.supersedes_id::text THEN RAISE EXCEPTION 'Receipt report identity mismatch'; END IF;
  ELSE
    -- Match the same latest insufficient candidate used by the service reader,
    -- then evaluate its eligibility against the receipt's immutable window.
    SELECT r.* INTO selected FROM public.report_craft_reports r WHERE r.owner_handle=p_owner AND r.result->>'status'='insufficient_report_data'
      ORDER BY r.period_end DESC,r.captured_at DESC,r.id DESC LIMIT 1;
    IF selected.id IS NOT NULL AND selected.period_end<=(p_receipt #>> '{window,referenceTime}')::timestamptz
      AND selected.period_start>=(p_receipt #>> '{window,startInclusive}')::timestamptz THEN
      report:=p_receipt #> '{craft,report}';
      IF state IS DISTINCT FROM 'insufficient_report_data'
        OR ((report->'inputs')-'window') IS DISTINCT FROM (selected.canonical_inputs-'window')
        OR report->'result' IS DISTINCT FROM selected.result THEN RAISE EXCEPTION 'Receipt insufficient report mismatch'; END IF;
    ELSIF state IS DISTINCT FROM 'no_report' THEN RAISE EXCEPTION 'Receipt has no eligible report'; END IF;
  END IF;
  RETURN public.scoring_observed_publish_receipt(p_owner,p_actor,p_receipt,p_canonical,p_semantic_digest,p_core_semantic_digest);
END;
$$;

-- 052 — daily trend history and the admin observed projection view.
CREATE OR REPLACE FUNCTION public.scoring_observed_history(p_owner text,p_from date DEFAULT NULL,p_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('canonicalReceipt',r.canonical_receipt,'trend',to_jsonb(t)) ORDER BY t.date),'[]'::jsonb) INTO result
  FROM public.scoring_v7_trend_anchors t JOIN public.scoring_v7_receipts r ON r.id=t.receipt_id AND r.owner_handle=t.owner_handle AND r.policy_version=t.policy_version
  WHERE t.owner_handle=p_owner AND t.policy_version='v7.2' AND r.public_receipt->>'action'<>'retract'
    AND (p_from IS NULL OR t.date>=p_from) AND (p_to IS NULL OR t.date<=p_to);
  RETURN result;
END;
$$;

CREATE OR REPLACE VIEW public.admin_users_observed WITH (security_invoker=true) AS
SELECT a.*,
  CASE WHEN r.id IS NULL THEN 'v6' ELSE 'v7.2' END AS current_policy_version,
  CASE WHEN r.id IS NULL THEN a.adjusted_composite ELSE (r.public_receipt #>> '{core,composite,displayValue}')::double precision END AS current_display_score,
  CASE WHEN r.id IS NULL THEN a.composite_score ELSE (r.public_receipt #>> '{core,composite,exact}')::double precision END AS current_exact_score,
  CASE WHEN r.id IS NULL THEN a.tier ELSE r.public_receipt #>> '{core,tier}' END AS current_tier,
  CASE WHEN r.id IS NULL THEN a.archetype ELSE r.public_receipt #>> '{core,archetype}' END AS current_archetype,
  CASE WHEN r.id IS NULL THEN a.confidence ELSE NULL END AS current_confidence,
  CASE WHEN r.id IS NULL THEN a.snapshot_date ELSE (r.reference_time AT TIME ZONE 'UTC')::date END AS current_snapshot_date,
  CASE WHEN r.id IS NULL THEN a.snapshot_captured_at ELSE r.reference_time END AS current_fetched_at,
  r.id AS current_revision_id,
  CASE WHEN r.id IS NOT NULL THEN pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.canonical_receipt,'UTF8')),'hex') END AS current_content_hash
FROM public.admin_users a
LEFT JOIN public.scoring_v7_subjects s ON s.owner_handle=a.handle
LEFT JOIN public.scoring_observed_current c ON c.owner_handle=s.owner_handle
LEFT JOIN public.scoring_v7_receipts r ON r.id=c.receipt_id AND r.owner_handle=a.handle AND r.policy_version='v7.2' AND r.public_receipt->>'action'<>'retract';
REVOKE ALL ON public.admin_users_observed FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.admin_users_observed TO service_role;

-- 041 — the ledger. 'consent' and 'withdraw' are retired actions: publication
-- is no longer opt-in, so there is nothing left to consent to or withdraw.
-- Owner-data deletion stays available directly through `scoring_v7_withdraw`/
-- `scoring_v7_withdraw_with_receipts`/`scoring_v7_delete_user_with_receipts`
-- for `scripts/delete-user.ts` — only the ledger action is retired.
CREATE OR REPLACE FUNCTION public.scoring_v7_ledger_write(p_owner text, p_actor text, p_action text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  received timestamptz := now(); new_revision_id uuid := gen_random_uuid(); old public.scoring_v7_evidence;
  prior public.scoring_v7_assessments; target public.scoring_v7_evidence;
  grant_row public.scoring_v7_reviewer_grants; claim jsonb; ref jsonb; authority jsonb; fact jsonb;
  old_id uuid; next_revision integer; claim_id uuid; work_id text; requested_channel text;
BEGIN
  IF p_owner IS NULL OR p_actor IS NULL OR p_owner !~ '^[a-z0-9][a-z0-9-]{0,38}$' OR p_actor !~ '^[a-z0-9][a-z0-9-]{0,38}$'
    OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR octet_length(p_data::text)>524288 THEN
    RAISE EXCEPTION 'Invalid ledger request' USING ERRCODE='22023';
  END IF;
  IF p_action <> 'assessment' AND p_actor <> p_owner THEN
    RAISE EXCEPTION 'Ledger owner access denied' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner, 11));
  IF p_action IN ('claim','grant') THEN
    INSERT INTO public.scoring_v7_subjects(owner_handle) VALUES(p_owner) ON CONFLICT DO NOTHING;
  END IF;
  IF p_action='grant' THEN
    IF p_data->>'reviewer'=p_owner OR p_data->>'reviewer' IS NULL THEN RAISE EXCEPTION 'Invalid reviewer' USING ERRCODE='22023'; END IF;
    IF (p_data->>'enabled')::boolean THEN
      INSERT INTO public.scoring_v7_reviewer_grants(owner_handle,reviewer_handle,granted_by,granted_at,revoked_at)
      VALUES(p_owner,p_data->>'reviewer',p_owner,received,NULL)
      ON CONFLICT(owner_handle,reviewer_handle) DO UPDATE SET granted_at=CASE WHEN public.scoring_v7_reviewer_grants.revoked_at IS NULL THEN public.scoring_v7_reviewer_grants.granted_at ELSE excluded.granted_at END, revoked_at=NULL;
    ELSE
      UPDATE public.scoring_v7_reviewer_grants SET revoked_at=received WHERE owner_handle=p_owner AND reviewer_handle=p_data->>'reviewer';
    END IF;
    RETURN jsonb_build_object('success',true);
  ELSIF p_action='consent' THEN
    RAISE EXCEPTION 'retired action' USING ERRCODE='22023';
  ELSIF p_action='withdraw' THEN
    RAISE EXCEPTION 'retired action' USING ERRCODE='22023';
  ELSIF p_action='claim' THEN
    claim := p_data->'claim';
    requested_channel := p_data->>'channel';
    old_id := nullif(p_data->>'previousRevisionId','')::uuid;
    IF claim IS NULL OR jsonb_typeof(claim)<>'object' OR requested_channel NOT IN ('core','craft')
      OR claim->>'ownerId' IS DISTINCT FROM p_owner OR claim->>'provenance' IS DISTINCT FROM 'self_reported'
      OR claim->>'workItemId' NOT LIKE 'portfolio:' || p_owner || ':%'
      OR p_data->>'occurredAt' IS NULL OR claim#>>'{observationPeriod,startInclusive}' IS NULL OR claim#>>'{observationPeriod,endExclusive}' IS NULL
      OR NOT isfinite((claim#>>'{observationPeriod,startInclusive}')::timestamptz)
      OR jsonb_typeof(p_data->'references') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'references') NOT BETWEEN 1 AND 32
      OR jsonb_typeof(claim->'evidenceReferenceIds') IS DISTINCT FROM 'array' OR jsonb_array_length(claim->'evidenceReferenceIds')<>jsonb_array_length(p_data->'references')
      OR NOT isfinite((p_data->>'occurredAt')::timestamptz) OR (p_data->>'occurredAt')::timestamptz>received
      OR (claim#>>'{observationPeriod,startInclusive}')::timestamptz >= (claim#>>'{observationPeriod,endExclusive}')::timestamptz
      OR NOT isfinite((claim#>>'{observationPeriod,endExclusive}')::timestamptz) OR (claim#>>'{observationPeriod,endExclusive}')::timestamptz>received THEN
      RAISE EXCEPTION 'Invalid claim' USING ERRCODE='22023';
    END IF;
    IF old_id IS NOT NULL THEN
      SELECT * INTO old FROM public.scoring_v7_evidence WHERE owner_handle=p_owner AND id=old_id FOR UPDATE;
      IF old.id IS NULL OR old.channel<>requested_channel OR old.category='craft' OR old.action='retract' OR EXISTS(SELECT 1 FROM public.scoring_v7_evidence WHERE supersedes_id=old_id) THEN
        RAISE EXCEPTION 'Claim revision conflict' USING ERRCODE='40001';
      END IF;
    END IF;
    next_revision := coalesce(old.revision,0)+1; claim_id := coalesce(old.claim_id,(claim->>'claimId')::uuid); work_id := coalesce(old.work_item_id,claim->>'workItemId');
    claim := claim || jsonb_build_object('revisionId',new_revision_id,'claimId',claim_id,'workItemId',work_id,'revision',next_revision,'recordedAt',received,'supersedesRevisionId',old_id,'action',CASE WHEN old_id IS NULL THEN 'create' ELSE 'correct' END);
    INSERT INTO public.scoring_v7_evidence(id,owner_handle,claim_id,revision,supersedes_id,action,channel,work_item_id,category,occurred_at,period_start,period_end,payload,recorded_at,ledger_context)
    VALUES(new_revision_id,p_owner,claim_id,next_revision,old_id,CASE WHEN old_id IS NULL THEN 'create' ELSE 'correct' END,requested_channel,work_id,claim->>'category',(p_data->>'occurredAt')::timestamptz,
      (claim#>>'{observationPeriod,startInclusive}')::timestamptz,(claim#>>'{observationPeriod,endExclusive}')::timestamptz,claim,received,jsonb_build_object('version','ledger-v1','submittedBy',p_actor));
    FOR ref IN SELECT value FROM jsonb_array_elements(p_data->'references') LOOP
      IF ref->>'ownerId' IS DISTINCT FROM p_owner OR ref->>'retention' IS DISTINCT FROM 'until_owner_withdrawal' OR ref->>'observedAt' IS NULL OR NOT isfinite((ref->>'observedAt')::timestamptz) OR (ref->>'observedAt')::timestamptz>received
        OR ref->>'artifactRevision' IS DISTINCT FROM claim->>'artifactRevision' OR NOT (claim->'evidenceReferenceIds' ? (ref->>'referenceId')) THEN
        RAISE EXCEPTION 'Invalid evidence reference' USING ERRCODE='22023';
      END IF;
      INSERT INTO public.scoring_v7_evidence_references(owner_handle,reference_id,artifact_uri,artifact_revision,observed_at,retention,recorded_at)
      VALUES(p_owner,ref->>'referenceId',ref->>'artifactUri',ref->>'artifactRevision',(ref->>'observedAt')::timestamptz,'until_owner_withdrawal',received);
    END LOOP;
    FOR ref IN SELECT value FROM jsonb_array_elements(coalesce(p_data->'bodies','[]')) LOOP
      IF ref->>'body' IS NULL OR octet_length(ref->>'body')>65536 OR NOT (claim->'evidenceReferenceIds' ? (ref->>'referenceId')) THEN RAISE EXCEPTION 'Artifact too large' USING ERRCODE='22023'; END IF;
      INSERT INTO public.scoring_v7_raw_artifacts(id,owner_handle,kind,body,created_at,expires_at) VALUES((ref->>'referenceId')::uuid,p_owner,'supplemental',ref->>'body',received,received+interval '30 days');
    END LOOP;
    RETURN jsonb_build_object('revisionId',new_revision_id,'claimId',claim_id,'workItemId',work_id,'referenceIds',claim->'evidenceReferenceIds');
  ELSIF p_action='retract' THEN
    old_id := (p_data->>'revisionId')::uuid;
    SELECT * INTO old FROM public.scoring_v7_evidence WHERE owner_handle=p_owner AND id=old_id FOR UPDATE;
    IF old.id IS NULL OR old.category='craft' OR old.action='retract' OR EXISTS(SELECT 1 FROM public.scoring_v7_evidence WHERE supersedes_id=old_id) THEN
      RAISE EXCEPTION 'Claim revision conflict' USING ERRCODE='40001';
    END IF;
    claim := old.payload || jsonb_build_object('revisionId',new_revision_id,'revision',old.revision+1,'recordedAt',received,'supersedesRevisionId',old_id,'action','retract');
    INSERT INTO public.scoring_v7_evidence(id,owner_handle,claim_id,revision,supersedes_id,action,state,channel,work_item_id,category,occurred_at,period_start,period_end,payload,recorded_at,ledger_context)
    VALUES(new_revision_id,p_owner,old.claim_id,old.revision+1,old_id,'retract','retracted',old.channel,old.work_item_id,old.category,old.occurred_at,old.period_start,old.period_end,claim,received,jsonb_build_object('version','ledger-v1','submittedBy',p_actor,'retractionRationale',p_data->>'rationale'));
    RETURN jsonb_build_object('revisionId',new_revision_id,'claimId',old.claim_id);
  ELSIF p_action='assessment' THEN
    IF p_actor=p_owner OR NOT public.scoring_v7_can_review(p_owner,p_actor) THEN RAISE EXCEPTION 'Reviewer access denied' USING ERRCODE='42501'; END IF;
    SELECT * INTO grant_row FROM public.scoring_v7_reviewer_grants WHERE owner_handle=p_owner AND reviewer_handle=p_actor FOR SHARE;
    SELECT * INTO target FROM public.scoring_v7_evidence WHERE owner_handle=p_owner AND id=(p_data->>'claimRevisionId')::uuid FOR SHARE;
    IF target.id IS NULL OR target.category='craft' OR target.action='retract' OR EXISTS(SELECT 1 FROM public.scoring_v7_evidence WHERE supersedes_id=target.id) THEN RAISE EXCEPTION 'Inactive claim' USING ERRCODE='40001'; END IF;
    IF p_data ?| ARRAY['authorization','authorizationGrantedAt','authorizedAt','evaluatorId','provenance'] OR p_data->>'rubricVersion' IS DISTINCT FROM 'v7'
      OR (p_data->>'independentlyCorroborated'='true' AND (p_data->>'evaluatorType'<>'human' OR jsonb_array_length(p_data->'conflicts')<>0))
      OR jsonb_typeof(p_data->'referenceIds') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'referenceIds') NOT BETWEEN 1 AND 32
      OR jsonb_typeof(p_data->'conflicts') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'conflicts')>32
      OR target.period_end>received OR grant_row.granted_at>received OR grant_row.revoked_at IS NOT NULL
      OR ((target.channel='craft') IS DISTINCT FROM ((p_data->>'criterion') IN ('framing','verification_debugging','tool_judgment','accepted_outcome'))) THEN
      RAISE EXCEPTION 'Invalid accountable assessment' USING ERRCODE='22023';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_data->'referenceIds') r(id) WHERE NOT EXISTS(
      SELECT 1 FROM public.scoring_v7_evidence_references e WHERE e.owner_handle=p_owner AND e.reference_id=r.id AND e.retention='until_owner_withdrawal'
      AND e.artifact_revision=target.payload->>'artifactRevision' AND e.observed_at<=received AND target.payload->'evidenceReferenceIds' ? r.id)) THEN
      RAISE EXCEPTION 'Assessment references do not match claim' USING ERRCODE='22023';
    END IF;
    fact := p_data->'facts';
    IF fact IS NOT NULL AND fact<>'null'::jsonb THEN
      IF jsonb_typeof(fact)<>'object' OR fact->>'occurredAt' IS NULL OR NOT isfinite((fact->>'occurredAt')::timestamptz) OR (fact->>'occurredAt')::timestamptz>received
        OR jsonb_typeof(fact#>'{identity,referenceIds}') IS DISTINCT FROM 'array' OR jsonb_array_length(fact#>'{identity,referenceIds}')<1
        OR nullif(btrim(fact#>>'{identity,projectKey}'),'') IS NULL OR nullif(btrim(fact#>>'{identity,workKey}'),'') IS NULL
        OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(fact#>'{identity,referenceIds}') r(value) WHERE NOT (p_data->'referenceIds' ? r.value)) THEN
        RAISE EXCEPTION 'Invalid reviewed identity' USING ERRCODE='22023';
      END IF;
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(fact->'categories') c(value),jsonb_array_elements_text(c.value->'referenceIds') r(value) WHERE NOT (p_data->'referenceIds' ? r.value)) THEN
        RAISE EXCEPTION 'Category backing outside assessment' USING ERRCODE='22023';
      END IF;
      IF fact->'acceptance' IS NOT NULL AND fact->'acceptance'<>'null'::jsonb THEN
        IF fact#>>'{acceptance,acceptedAt}' IS NULL OR NOT isfinite((fact#>>'{acceptance,acceptedAt}')::timestamptz) OR (fact#>>'{acceptance,acceptedAt}')::timestamptz>received
          OR nullif(btrim(fact#>>'{acceptance,acceptedResultId}'),'') IS NULL OR jsonb_array_length(fact#>'{acceptance,referenceIds}')<1
          OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(fact#>'{acceptance,referenceIds}') r(value) WHERE NOT (p_data->'referenceIds' ? r.value))
          OR NOT (CASE fact->>'kind' WHEN 'accepted_change' THEN fact#>>'{acceptance,method}' IN ('merged_change','linked_issue_result')
            WHEN 'authored_commit' THEN fact#>>'{acceptance,method}'='default_branch_first_reachability' WHEN 'issue_work' THEN fact#>>'{acceptance,method}'='linked_issue_result'
            WHEN 'documentation_design' THEN fact#>>'{acceptance,method}'='accepted_artifact' WHEN 'maintenance' THEN fact#>>'{acceptance,method}'='accepted_artifact' ELSE false END) THEN
          RAISE EXCEPTION 'Invalid reviewed acceptance' USING ERRCODE='22023';
        END IF;
      END IF;
    END IF;
    old_id := nullif(p_data->>'previousRevisionId','')::uuid;
    IF old_id IS NOT NULL THEN
      SELECT * INTO prior FROM public.scoring_v7_assessments WHERE owner_handle=p_owner AND id=old_id FOR UPDATE;
      IF prior.id IS NULL OR prior.evaluator_handle<>p_actor OR prior.evidence_id<>target.id OR prior.criterion<>p_data->>'criterion' OR EXISTS(SELECT 1 FROM public.scoring_v7_assessments WHERE supersedes_id=old_id) THEN
        RAISE EXCEPTION 'Assessment revision conflict' USING ERRCODE='40001';
      END IF;
    END IF;
    IF old_id IS NULL AND p_data->>'status'='retracted' THEN RAISE EXCEPTION 'Retraction requires previous revision' USING ERRCODE='22023'; END IF;
    authority := jsonb_build_object('version','ledger-authority-v1','ownerId',p_owner,'evaluatorId',p_actor,'grantedAt',grant_row.granted_at,'assessedAt',received,'recordedAt',received);
    INSERT INTO public.scoring_v7_assessments(id,owner_handle,evidence_id,assessment_id,work_item_id,revision,action,recorded_at,supersedes_id,criterion,verdict,evaluator_handle,evaluator_type,evaluator_version,evaluator_independent,independently_corroborated,provenance,rubric_version,rationale,reason_code,evidence_reference_ids,assessed_at,ledger_payload)
    VALUES(new_revision_id,p_owner,target.id,coalesce(prior.assessment_id,gen_random_uuid()),target.work_item_id,coalesce(prior.revision,0)+1,
      CASE WHEN old_id IS NULL THEN 'create' WHEN p_data->>'status'='retracted' THEN 'retract' ELSE 'correct' END,received,old_id,p_data->>'criterion',p_data->>'status',p_actor,p_data->>'evaluatorType',p_data->>'evaluatorVersion',
      (p_data->>'independentlyCorroborated')::boolean,(p_data->>'independentlyCorroborated')::boolean,
      CASE WHEN p_data->>'independentlyCorroborated'='true' THEN 'independently_corroborated' WHEN p_data->>'evaluatorType'='model' THEN 'automated_assessment' ELSE 'human_assessed' END,
      'v7',p_data->>'rationale',CASE p_data->>'status' WHEN 'accepted' THEN 'criterion_demonstrated' WHEN 'rejected' THEN 'criterion_not_demonstrated' WHEN 'retracted' THEN 'retracted' ELSE 'not_assessed' END,p_data->'referenceIds',received,
      jsonb_build_object('version','ledger-v1','authorization',authority,'conflicts',p_data->'conflicts','facts',p_data->'facts'));
    RETURN jsonb_build_object('revisionId',new_revision_id,'claimRevisionId',target.id);
  END IF;
  RAISE EXCEPTION 'Unknown ledger operation' USING ERRCODE='22023';
END;
$$;

-- 041 — ledger read. `publicConsent` is dropped from the returned envelope
-- entirely (not just left `true`): the app-level `EngineeringLedgerSnapshot`
-- type stops carrying the field in the same commit (#1335 phase 2).
CREATE OR REPLACE FUNCTION public.scoring_v7_ledger_read(p_owner text,p_actor text,p_reference timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_actor IS NULL OR p_owner IS NULL OR (p_actor<>p_owner AND NOT public.scoring_v7_can_review(p_owner,p_actor)) THEN RAISE EXCEPTION 'Ledger access denied' USING ERRCODE='42501'; END IF;
  IF p_reference IS NULL OR NOT isfinite(p_reference) THEN RAISE EXCEPTION 'Invalid ledger time' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('ownerId',p_owner,
    'claims',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY recorded_at,id),'[]') FROM public.scoring_v7_evidence e WHERE owner_handle=p_owner AND category<>'craft' AND recorded_at<=p_reference),
    'assessments',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY recorded_at,id),'[]') FROM public.scoring_v7_assessments a WHERE owner_handle=p_owner AND recorded_at<=p_reference),
    'references',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY reference_id),'[]') FROM public.scoring_v7_evidence_references r WHERE owner_handle=p_owner AND recorded_at<=p_reference AND retention='until_owner_withdrawal'));
END;
$$;

-- New: the authenticated-signup-side subject registration entry point. Called
-- from the OAuth callback after `dbUpsertUser` (`lib/db/scoring-subjects.ts`),
-- mirroring the #1239 rule that only the authenticated signup boundary may
-- create durable per-handle state — never a public badge/share-page read.
CREATE FUNCTION public.scoring_v7_ensure_subject(p_owner text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.scoring_v7_subjects(owner_handle) VALUES (lower(btrim(p_owner))) ON CONFLICT DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.scoring_v7_ensure_subject(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_ensure_subject(text) TO service_role;

-- Backfill: every already signed-up user becomes a registered scoring subject
-- (decision 5 — a signed-up user is a handle with a `user_platforms` row for
-- `github`, the same sharp test #1239 already established for a real signup).
INSERT INTO public.scoring_v7_subjects(owner_handle)
  SELECT DISTINCT lower(btrim(handle)) FROM public.user_platforms WHERE platform = 'github'
  ON CONFLICT DO NOTHING;

-- Expand only (see header): keep every subject's consent columns valid for
-- the running release, which still reads `public_evidence_consent` directly
-- in a few places (e.g. `source-authorization.ts` before this deploys).
UPDATE public.scoring_v7_subjects SET public_evidence_consent = true, consent_recorded_at = coalesce(consent_recorded_at, now());
ALTER TABLE public.scoring_v7_subjects ALTER COLUMN public_evidence_consent SET DEFAULT true;
-- The table's own CHECK (NOT public_evidence_consent OR consent_recorded_at
-- IS NOT NULL) predates this migration and still applies: defaulting consent
-- to true without also defaulting this column would make every bare
-- `INSERT INTO scoring_v7_subjects(owner_handle) VALUES (...)` — which is
-- exactly what `scoring_v7_ensure_subject` and the ledger's `claim`/`grant`
-- admission now do — violate that CHECK.
ALTER TABLE public.scoring_v7_subjects ALTER COLUMN consent_recorded_at SET DEFAULT now();
