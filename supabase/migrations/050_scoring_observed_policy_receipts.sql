-- v7.2 observed receipt publication. Historical receipts and canonical bytes stay immutable.
-- Service-only APIs; semantic digests identify private calculation context and are never public.
ALTER TABLE public.scoring_v7_receipts ADD COLUMN semantic_digest text CHECK (semantic_digest IS NULL OR semantic_digest ~ '^[0-9a-f]{64}$');
ALTER TABLE public.scoring_v7_receipts DROP CONSTRAINT scoring_v7_receipts_owner_policy_reference_revision_key;
CREATE UNIQUE INDEX scoring_v7_historical_reference_revision ON public.scoring_v7_receipts(owner_handle,policy_version,reference_time,revision) WHERE policy_version <> 'v7.2';
CREATE UNIQUE INDEX scoring_receipt_family_revision ON public.scoring_v7_receipts((public_receipt->>'receiptId'),revision);
CREATE INDEX scoring_observed_owner_policy_time ON public.scoring_v7_receipts(owner_handle,policy_version,reference_time DESC);

CREATE TABLE public.scoring_observed_current (
  owner_handle text PRIMARY KEY REFERENCES public.scoring_v7_subjects(owner_handle) ON DELETE CASCADE,
  receipt_id uuid NOT NULL,
  FOREIGN KEY(owner_handle,receipt_id) REFERENCES public.scoring_v7_receipts(owner_handle,id) ON DELETE CASCADE
);
ALTER TABLE public.scoring_observed_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_observed_current FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.scoring_observed_current FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.scoring_observed_current TO service_role;

-- Preserve exact historical trend validation; only the new policy uses composite.exact.
CREATE OR REPLACE FUNCTION public.scoring_v7_check_trend_anchor()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE prior public.scoring_v7_trend_anchors; issued public.scoring_v7_receipts; expected double precision; retention double precision;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.owner_handle||':'||NEW.policy_version,7));
  IF TG_OP='UPDATE' AND (OLD.owner_handle,OLD.policy_version,OLD.date) IS DISTINCT FROM (NEW.owner_handle,NEW.policy_version,NEW.date) THEN RAISE EXCEPTION 'Trend identity is immutable'; END IF;
  IF EXISTS(SELECT 1 FROM public.scoring_v7_trend_anchors WHERE owner_handle=NEW.owner_handle AND policy_version=NEW.policy_version AND date>NEW.date) THEN RAISE EXCEPTION 'Historical anchor is immutable'; END IF;
  SELECT * INTO issued FROM public.scoring_v7_receipts WHERE id=NEW.receipt_id;
  IF issued.id IS NULL OR issued.owner_handle<>NEW.owner_handle OR issued.policy_version<>NEW.policy_version OR (issued.reference_time AT TIME ZONE 'UTC')::date<>NEW.date THEN RAISE EXCEPTION 'Trend receipt identity mismatch'; END IF;
  IF issued.public_receipt->>'action'='retract' OR issued.public_receipt #>> '{core,composite,kind}' IS DISTINCT FROM 'point' OR (CASE WHEN issued.policy_version='v7.2' THEN issued.public_receipt #>> '{core,composite,exact}' ELSE issued.public_receipt #>> '{core,composite,value}' END)::double precision IS DISTINCT FROM NEW.raw_value THEN RAISE EXCEPTION 'Trend requires issued raw point'; END IF;
  SELECT * INTO prior FROM public.scoring_v7_trend_anchors WHERE owner_handle=NEW.owner_handle AND policy_version=NEW.policy_version AND date<NEW.date ORDER BY date DESC LIMIT 1;
  IF (NEW.previous_receipt_id,NEW.previous_date,NEW.previous_value) IS DISTINCT FROM (prior.receipt_id,prior.date,prior.value) THEN RAISE EXCEPTION 'Trend requires latest preceding anchor'; END IF;
  IF prior.receipt_id IS NULL THEN expected:=NEW.raw_value;
  ELSE retention:=power(0.85::double precision,(NEW.date-prior.date)::double precision); expected:=retention*prior.value+(1-retention)*NEW.raw_value; END IF;
  IF abs(NEW.value-expected)>1e-10 THEN RAISE EXCEPTION 'Incorrect trend arithmetic'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.scoring_observed_publish_receipt(p_owner text,p_actor text,p_receipt jsonb,p_canonical text,p_semantic_digest text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target uuid; reference timestamptz; day date; existing public.scoring_v7_receipts; current_receipt public.scoring_v7_receipts;
  prior public.scoring_v7_trend_anchors; raw double precision; retention double precision; trend_value double precision;
  publication_status text:='inserted'; selected_current boolean:=false;
BEGIN
  IF p_owner IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_owner !~ '^[a-z0-9][a-z0-9-]{0,38}$' THEN RAISE EXCEPTION 'Receipt owner access denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Public evidence consent required' USING ERRCODE='42501'; END IF;
  IF p_receipt IS NULL OR p_canonical IS NULL OR octet_length(p_canonical)>2097152 OR p_canonical::jsonb IS DISTINCT FROM p_receipt
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
    IF existing.owner_handle<>p_owner OR existing.policy_version<>'v7.2' OR existing.canonical_receipt IS DISTINCT FROM p_canonical OR existing.semantic_digest IS DISTINCT FROM p_semantic_digest THEN RAISE EXCEPTION 'Conflicting immutable receipt'; END IF;
    publication_status:='duplicate';
  ELSIF current_receipt.id IS NOT NULL AND (current_receipt.reference_time AT TIME ZONE 'UTC')::date=day AND current_receipt.semantic_digest=p_semantic_digest
    AND current_receipt.public_receipt->>'action'<>'retract' AND p_receipt->>'action'='create' THEN
    -- Only the currently selected publication can win a semantic no-op. Never search history.
    existing:=current_receipt;
    target:=existing.id;
    publication_status:='duplicate';
  ELSE
    INSERT INTO public.scoring_v7_receipts(id,owner_handle,policy_version,reference_time,revision,supersedes_id,canonical_receipt,public_receipt,issued_at,semantic_digest)
    VALUES(target,p_owner,'v7.2',reference,(p_receipt->>'revision')::integer,(p_receipt->>'supersedesRevisionId')::uuid,p_canonical,p_receipt,(p_receipt->>'recordedAt')::timestamptz,p_semantic_digest)
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
        IF prior.receipt_id IS NULL THEN trend_value:=raw;
        ELSE retention:=power(0.85::double precision,(day-prior.date)::double precision); trend_value:=retention*prior.value+(1-retention)*raw; END IF;
        INSERT INTO public.scoring_v7_trend_anchors(owner_handle,policy_version,date,receipt_id,previous_receipt_id,previous_date,previous_value,raw_value,value)
        VALUES(p_owner,'v7.2',day,target,prior.receipt_id,prior.date,prior.value,raw,trend_value)
        ON CONFLICT(owner_handle,policy_version,date) DO UPDATE SET receipt_id=excluded.receipt_id,previous_receipt_id=excluded.previous_receipt_id,previous_date=excluded.previous_date,previous_value=excluded.previous_value,raw_value=excluded.raw_value,value=excluded.value;
      ELSE
        DELETE FROM public.scoring_v7_trend_anchors WHERE owner_handle=p_owner AND policy_version='v7.2' AND date=day;
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('status',publication_status,'revisionId',existing.id,'policyVersion','v7.2','canonicalReceipt',existing.canonical_receipt,'semanticDigest',existing.semantic_digest,
    'contentHash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(existing.canonical_receipt,'UTF8')),'hex'),
    'isCurrent',EXISTS(SELECT 1 FROM public.scoring_observed_current WHERE owner_handle=p_owner AND receipt_id=existing.id),
    'trend',(SELECT to_jsonb(t) FROM public.scoring_v7_trend_anchors t WHERE t.receipt_id=existing.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.scoring_observed_receipt_manifest(p_owner text,p_revision uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE selected public.scoring_v7_receipts;
BEGIN
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_revision IS NULL THEN
    SELECT r.* INTO selected FROM public.scoring_observed_current c JOIN public.scoring_v7_receipts r ON r.id=c.receipt_id WHERE c.owner_handle=p_owner AND r.owner_handle=p_owner AND r.policy_version='v7.2';
  ELSE
    SELECT * INTO selected FROM public.scoring_v7_receipts WHERE id=p_revision AND owner_handle=p_owner AND policy_version='v7.2';
  END IF;
  IF selected.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('revisionId',selected.id,'policyVersion','v7.2','semanticDigest',selected.semantic_digest,
    'contentHash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(selected.canonical_receipt,'UTF8')),'hex'),
    'isCurrent',EXISTS(SELECT 1 FROM public.scoring_observed_current WHERE owner_handle=p_owner AND receipt_id=selected.id),
    'trend',(SELECT to_jsonb(t) FROM public.scoring_v7_trend_anchors t WHERE t.receipt_id=selected.id));
END;
$$;
CREATE OR REPLACE FUNCTION public.scoring_observed_read_receipt(p_owner text,p_revision uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE manifest jsonb;
BEGIN
  manifest:=public.scoring_observed_receipt_manifest(p_owner,p_revision);
  IF manifest IS NULL THEN RETURN NULL; END IF;
  RETURN manifest || jsonb_build_object('canonicalReceipt',(SELECT canonical_receipt FROM public.scoring_v7_receipts WHERE id=(manifest->>'revisionId')::uuid));
END;
$$;
REVOKE ALL ON FUNCTION public.scoring_observed_publish_receipt(text,text,jsonb,text,text),public.scoring_observed_receipt_manifest(text,uuid),public.scoring_observed_read_receipt(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_observed_publish_receipt(text,text,jsonb,text,text),public.scoring_observed_receipt_manifest(text,uuid),public.scoring_observed_read_receipt(text,uuid) TO service_role;

-- Historical adapter reads stay policy-qualified when the two policies coexist.
CREATE OR REPLACE FUNCTION public.scoring_v7_receipt_manifest(p_owner text,p_revision uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE selected public.scoring_v7_receipts;
BEGIN
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO selected FROM public.scoring_v7_receipts WHERE owner_handle=p_owner AND policy_version='v7' AND (p_revision IS NULL OR id=p_revision) ORDER BY reference_time DESC,revision DESC LIMIT 1;
  IF selected.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('revisionId',selected.id,'policyVersion',selected.policy_version,'trend',(SELECT to_jsonb(t) FROM public.scoring_v7_trend_anchors t WHERE t.receipt_id=selected.id));
END;
$$;
