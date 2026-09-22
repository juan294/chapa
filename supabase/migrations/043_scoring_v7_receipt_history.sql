-- Refs #1308. Atomic immutable receipts and unrounded, point-only trend history.
-- Service-only RPCs derive callers from application authentication; no browser DB grants.
ALTER TABLE public.scoring_v7_receipts DROP CONSTRAINT scoring_v7_receipts_owner_handle_reference_time_revision_key;
ALTER TABLE public.scoring_v7_receipts ADD CONSTRAINT scoring_v7_receipts_owner_policy_reference_revision_key UNIQUE(owner_handle,policy_version,reference_time,revision);
-- The trigger gives useful errors; this index arbitrates cross-owner concurrent roots.
CREATE UNIQUE INDEX scoring_v7_receipts_root_family_unique ON public.scoring_v7_receipts ((public_receipt->>'receiptId')) WHERE supersedes_id IS NULL;


CREATE OR REPLACE FUNCTION public.scoring_v7_check_receipt_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE prior public.scoring_v7_receipts;
BEGIN
  IF EXISTS(SELECT 1 FROM public.scoring_v7_revocations WHERE receipt_id=NEW.id) THEN RAISE EXCEPTION 'Revoked receipt identity'; END IF;
  IF NEW.public_receipt->>'schemaVersion' IS DISTINCT FROM 'v7'
    OR NEW.public_receipt->>'revisionId' IS DISTINCT FROM NEW.id::text
    OR NEW.public_receipt->>'policyVersion' IS DISTINCT FROM NEW.policy_version
    OR (NEW.public_receipt->>'revision')::integer IS DISTINCT FROM NEW.revision
    OR (NEW.public_receipt #>> '{window,referenceTime}')::timestamptz IS DISTINCT FROM NEW.reference_time
    OR (NEW.public_receipt->>'recordedAt')::timestamptz IS DISTINCT FROM NEW.issued_at
    OR NEW.public_receipt->>'supersedesRevisionId' IS DISTINCT FROM NEW.supersedes_id::text
    OR (NEW.public_receipt->>'receiptId') IS NULL THEN RAISE EXCEPTION 'Receipt row/payload mismatch'; END IF;
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO prior FROM public.scoring_v7_receipts WHERE id=NEW.supersedes_id;
    IF prior.id IS NULL OR prior.owner_handle<>NEW.owner_handle OR prior.policy_version<>NEW.policy_version OR prior.reference_time<>NEW.reference_time
      OR prior.revision+1<>NEW.revision OR prior.public_receipt->>'receiptId' IS DISTINCT FROM NEW.public_receipt->>'receiptId'
      OR NEW.issued_at<prior.issued_at OR NEW.public_receipt->>'action' IS NULL OR NEW.public_receipt->>'action' NOT IN ('correct','retract') THEN RAISE EXCEPTION 'Invalid receipt lineage'; END IF;
  ELSE
    IF NEW.public_receipt->>'action' IS DISTINCT FROM 'create' THEN RAISE EXCEPTION 'Invalid first receipt action'; END IF;
    IF EXISTS(SELECT 1 FROM public.scoring_v7_receipts WHERE public_receipt->>'receiptId'=NEW.public_receipt->>'receiptId') THEN RAISE EXCEPTION 'Receipt family already exists'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.scoring_v7_check_trend_anchor()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE prior public.scoring_v7_trend_anchors; issued public.scoring_v7_receipts; expected double precision; retention double precision;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.owner_handle||':'||NEW.policy_version,7));
  IF TG_OP='UPDATE' AND (OLD.owner_handle,OLD.policy_version,OLD.date) IS DISTINCT FROM (NEW.owner_handle,NEW.policy_version,NEW.date) THEN RAISE EXCEPTION 'Trend identity is immutable'; END IF;
  IF EXISTS(SELECT 1 FROM public.scoring_v7_trend_anchors WHERE owner_handle=NEW.owner_handle AND policy_version=NEW.policy_version AND date>NEW.date) THEN RAISE EXCEPTION 'Historical anchor is immutable'; END IF;
  SELECT * INTO issued FROM public.scoring_v7_receipts WHERE id=NEW.receipt_id;
  IF issued.id IS NULL OR issued.owner_handle<>NEW.owner_handle OR issued.policy_version<>NEW.policy_version OR (issued.reference_time AT TIME ZONE 'UTC')::date<>NEW.date THEN RAISE EXCEPTION 'Trend receipt identity mismatch'; END IF;
  IF issued.public_receipt->>'action'='retract' OR issued.public_receipt #>> '{core,composite,kind}' IS DISTINCT FROM 'point' OR (issued.public_receipt #>> '{core,composite,value}')::double precision IS DISTINCT FROM NEW.raw_value THEN RAISE EXCEPTION 'Trend requires issued raw point'; END IF;
  SELECT * INTO prior FROM public.scoring_v7_trend_anchors WHERE owner_handle=NEW.owner_handle AND policy_version=NEW.policy_version AND date<NEW.date ORDER BY date DESC LIMIT 1;
  IF (NEW.previous_receipt_id,NEW.previous_date,NEW.previous_value) IS DISTINCT FROM (prior.receipt_id,prior.date,prior.value) THEN RAISE EXCEPTION 'Trend requires latest preceding anchor'; END IF;
  IF prior.receipt_id IS NULL THEN expected:=NEW.raw_value;
  ELSE retention:=power(0.85::double precision,(NEW.date-prior.date)::double precision); expected:=retention*prior.value+(1-retention)*NEW.raw_value; END IF;
  IF abs(NEW.value-expected)>1e-10 THEN RAISE EXCEPTION 'Incorrect trend arithmetic'; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.scoring_v7_protect_anchor_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF current_setting('chapa.scoring_withdrawal',true) IS NOT DISTINCT FROM OLD.owner_handle THEN RETURN OLD; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(OLD.owner_handle||':'||OLD.policy_version,7));
  IF EXISTS(SELECT 1 FROM public.scoring_v7_trend_anchors WHERE owner_handle=OLD.owner_handle AND policy_version=OLD.policy_version AND date>OLD.date) THEN RAISE EXCEPTION 'Historical anchor is immutable'; END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER scoring_v7_anchor_delete BEFORE DELETE ON public.scoring_v7_trend_anchors FOR EACH ROW EXECUTE FUNCTION public.scoring_v7_protect_anchor_delete();

-- Withdrawal alone may remove the complete historical anchor chain.
CREATE OR REPLACE FUNCTION public.scoring_v7_withdraw(p_owner text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE saved_withdrawal text:=current_setting('chapa.scoring_withdrawal',true);
BEGIN
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  PERFORM set_config('chapa.scoring_withdrawal',p_owner,true);
  INSERT INTO public.scoring_v7_revocations(receipt_id) SELECT id FROM public.scoring_v7_receipts WHERE owner_handle=p_owner ON CONFLICT(receipt_id) DO NOTHING;
  DELETE FROM public.scoring_v7_trend_anchors WHERE owner_handle=p_owner;
  DELETE FROM public.scoring_v7_evidence WHERE owner_handle=p_owner;
  DELETE FROM public.scoring_v7_subjects WHERE owner_handle=p_owner;
  PERFORM set_config('chapa.scoring_withdrawal',coalesce(saved_withdrawal,''),true);
END;
$$;

CREATE FUNCTION public.scoring_v7_publish_receipt(p_owner text,p_actor text,p_receipt jsonb,p_canonical text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target uuid; reference timestamptz; day date; policy text; prior public.scoring_v7_trend_anchors; existing public.scoring_v7_receipts;
  raw double precision; retention double precision; trend_value double precision; status text:='inserted'; is_current boolean;
BEGIN
  IF p_owner IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_owner !~ '^[a-z0-9][a-z0-9-]{0,38}$' THEN RAISE EXCEPTION 'Receipt owner access denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Public evidence consent required' USING ERRCODE='42501'; END IF;
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

-- Manifest is authorization + authoritative selected identity, not cached consent.
CREATE FUNCTION public.scoring_v7_receipt_manifest(p_owner text,p_revision uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE selected public.scoring_v7_receipts;
BEGIN
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO selected FROM public.scoring_v7_receipts WHERE owner_handle=p_owner AND (p_revision IS NULL OR id=p_revision) ORDER BY reference_time DESC,revision DESC LIMIT 1;
  IF selected.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('revisionId',selected.id,'policyVersion',selected.policy_version,'trend',(SELECT to_jsonb(t) FROM public.scoring_v7_trend_anchors t WHERE t.receipt_id=selected.id));
END;
$$;
CREATE FUNCTION public.scoring_v7_read_receipt(p_owner text,p_revision uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE manifest jsonb;
BEGIN
  manifest:=public.scoring_v7_receipt_manifest(p_owner,p_revision);
  IF manifest IS NULL THEN RETURN NULL; END IF;
  RETURN manifest || jsonb_build_object('canonicalReceipt',(SELECT canonical_receipt FROM public.scoring_v7_receipts WHERE id=(manifest->>'revisionId')::uuid));
END;
$$;
REVOKE ALL ON FUNCTION public.scoring_v7_protect_anchor_delete(),public.scoring_v7_publish_receipt(text,text,jsonb,text),public.scoring_v7_receipt_manifest(text,uuid),public.scoring_v7_read_receipt(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_protect_anchor_delete(),public.scoring_v7_publish_receipt(text,text,jsonb,text),public.scoring_v7_receipt_manifest(text,uuid),public.scoring_v7_read_receipt(text,uuid) TO service_role;
