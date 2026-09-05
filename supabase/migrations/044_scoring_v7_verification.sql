-- S14: service-only receipt issuance, current authorization and content-free cleanup.
-- HMAC validation is a trusted server assertion, NOT performed by these SQL RPCs.
CREATE FUNCTION public.scoring_v7_issue_verification(p_owner text, p_actor text, p_revision uuid, p_key_version text, p_signature text, p_canonical text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE existing public.scoring_v7_verification;
BEGIN
  IF p_owner IS NULL OR p_owner IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Owner authorization required'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current consent required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.scoring_v7_receipts WHERE id=p_revision AND owner_handle=p_owner AND canonical_receipt=p_canonical) THEN RAISE EXCEPTION 'Receipt binding mismatch'; END IF;
  SELECT * INTO existing FROM public.scoring_v7_verification WHERE receipt_id=p_revision AND key_version=p_key_version;
  IF FOUND THEN
    IF existing.signature IS DISTINCT FROM p_signature THEN RAISE EXCEPTION 'Issuance conflict'; END IF;
    RETURN;
  END IF;
  INSERT INTO public.scoring_v7_verification(signature,receipt_id,key_version) VALUES(p_signature,p_revision,p_key_version);
END $$;

CREATE FUNCTION public.scoring_v7_read_verification(p_revision uuid, p_signature text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE receipt public.scoring_v7_receipts; issuance public.scoring_v7_verification;
BEGIN
  -- Tombstones authenticate no signature. They only identify a revoked revision.
  IF EXISTS(SELECT 1 FROM public.scoring_v7_revocations WHERE receipt_id=p_revision) THEN RETURN jsonb_build_object('status','revoked'); END IF;
  SELECT r.* INTO receipt FROM public.scoring_v7_receipts r JOIN public.scoring_v7_subjects s ON s.owner_handle=r.owner_handle WHERE r.id=p_revision AND s.public_evidence_consent FOR SHARE OF s;
  IF NOT FOUND THEN
    IF EXISTS(SELECT 1 FROM public.scoring_v7_revocations WHERE receipt_id=p_revision) THEN RETURN jsonb_build_object('status','revoked'); END IF;
    RETURN NULL;
  END IF;
  SELECT * INTO issuance FROM public.scoring_v7_verification WHERE receipt_id=p_revision AND signature=p_signature;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('status', CASE WHEN receipt.public_receipt->>'action'='retract' THEN 'retracted' WHEN EXISTS(SELECT 1 FROM public.scoring_v7_receipts WHERE supersedes_id=p_revision) THEN 'superseded' ELSE 'current' END,
    'canonical',receipt.canonical_receipt,'keyVersion',issuance.key_version);
END $$;

CREATE FUNCTION public.scoring_v7_withdraw_with_receipts(p_owner text,p_actor text,p_acknowledged boolean)
RETURNS uuid[] LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE revisions uuid[];
BEGIN
  IF p_owner IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_acknowledged IS DISTINCT FROM true THEN RAISE EXCEPTION 'Acknowledged owner authorization required'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO revisions FROM public.scoring_v7_receipts WHERE owner_handle=p_owner;
  PERFORM public.scoring_v7_withdraw(p_owner);
  RETURN revisions;
END $$;

CREATE FUNCTION public.scoring_v7_delete_user_with_receipts(p_handle text)
RETURNS uuid[] LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE revisions uuid[];
BEGIN
  IF p_handle IS NULL OR length(btrim(p_handle))=0 THEN RAISE EXCEPTION 'Owner required'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_handle FOR UPDATE;
  SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO revisions FROM public.scoring_v7_receipts WHERE owner_handle=p_handle;
  PERFORM public.scoring_v7_delete_user(p_handle);
  RETURN revisions;
END $$;

CREATE FUNCTION public.scoring_v7_revocation_batch(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS SETOF uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>1000 THEN RAISE EXCEPTION 'Invalid batch limit'; END IF;
  RETURN QUERY SELECT receipt_id FROM public.scoring_v7_revocations WHERE p_after IS NULL OR receipt_id>p_after ORDER BY receipt_id LIMIT p_limit;
END $$;

-- All raw artifact kinds and raw locators; bounded work preserves the existing RPC contract.
CREATE OR REPLACE FUNCTION public.scoring_v7_purge_expired_raw()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE bodies integer; locators integer;
BEGIN
  WITH batch AS (SELECT id FROM public.scoring_v7_raw_artifacts WHERE expires_at<=now() ORDER BY expires_at,id LIMIT 1000 FOR UPDATE SKIP LOCKED)
  DELETE FROM public.scoring_v7_raw_artifacts r USING batch b WHERE r.id=b.id;
  GET DIAGNOSTICS bodies = ROW_COUNT;
  WITH batch AS (SELECT owner_handle,reference_id FROM public.scoring_v7_evidence_references WHERE retention='raw_30_days' AND expires_at<=now() ORDER BY expires_at,owner_handle,reference_id LIMIT 1000 FOR UPDATE SKIP LOCKED)
  DELETE FROM public.scoring_v7_evidence_references r USING batch b WHERE r.owner_handle=b.owner_handle AND r.reference_id=b.reference_id;
  GET DIAGNOSTICS locators = ROW_COUNT;
  RETURN bodies+locators;
END $$;

REVOKE ALL ON FUNCTION public.scoring_v7_issue_verification(text,text,uuid,text,text,text), public.scoring_v7_read_verification(uuid,text), public.scoring_v7_withdraw_with_receipts(text,text,boolean), public.scoring_v7_delete_user_with_receipts(text), public.scoring_v7_revocation_batch(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_issue_verification(text,text,uuid,text,text,text), public.scoring_v7_read_verification(uuid,text), public.scoring_v7_withdraw_with_receipts(text,text,boolean), public.scoring_v7_delete_user_with_receipts(text), public.scoring_v7_revocation_batch(uuid,integer) TO service_role;
