-- Private component identity makes report-only and full refresh no-ops agree.
ALTER TABLE public.scoring_v7_receipts ADD COLUMN core_semantic_digest text CHECK(core_semantic_digest IS NULL OR core_semantic_digest ~ '^[0-9a-f]{64}$');
CREATE OR REPLACE FUNCTION public.scoring_observed_publish_receipt(p_owner text,p_actor text,p_receipt jsonb,p_canonical text,p_semantic_digest text,p_core_semantic_digest text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target uuid; reference timestamptz; day date; existing public.scoring_v7_receipts; current_receipt public.scoring_v7_receipts;
  prior public.scoring_v7_trend_anchors; raw double precision; retention double precision; trend_value double precision;
  publication_status text:='inserted'; selected_current boolean:=false;
BEGIN
  IF p_owner IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_owner !~ '^[a-z0-9][a-z0-9-]{0,38}$' THEN RAISE EXCEPTION 'Receipt owner access denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Public evidence consent required' USING ERRCODE='42501'; END IF;
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
  RETURN jsonb_build_object('status',publication_status,'revisionId',existing.id,'policyVersion','v7.2','canonicalReceipt',existing.canonical_receipt,'semanticDigest',existing.semantic_digest,'coreSemanticDigest',existing.core_semantic_digest,
    'contentHash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(existing.canonical_receipt,'UTF8')),'hex'),
    'isCurrent',EXISTS(SELECT 1 FROM public.scoring_observed_current WHERE owner_handle=p_owner AND receipt_id=existing.id),
    'trend',(SELECT to_jsonb(t) FROM public.scoring_v7_trend_anchors t WHERE t.receipt_id=existing.id));
END;
$$;

-- Preserve the historical five-argument service API without overloading defaults.
CREATE OR REPLACE FUNCTION public.scoring_observed_publish_receipt(p_owner text,p_actor text,p_receipt jsonb,p_canonical text,p_semantic_digest text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT public.scoring_observed_publish_receipt(p_owner,p_actor,p_receipt,p_canonical,p_semantic_digest,NULL);
$$;
REVOKE ALL ON FUNCTION public.scoring_observed_publish_receipt(text,text,jsonb,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_observed_publish_receipt(text,text,jsonb,text,text,text) TO service_role;
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
  RETURN jsonb_build_object('revisionId',selected.id,'policyVersion','v7.2','semanticDigest',selected.semantic_digest,'coreSemanticDigest',selected.core_semantic_digest,
    'contentHash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(selected.canonical_receipt,'UTF8')),'hex'),
    'isCurrent',EXISTS(SELECT 1 FROM public.scoring_observed_current WHERE owner_handle=p_owner AND receipt_id=selected.id),
    'trend',(SELECT to_jsonb(t) FROM public.scoring_v7_trend_anchors t WHERE t.receipt_id=selected.id));
END;
$$;

-- v7.2 report numerics survive raw-body expiry. These tables contain no raw labels.
CREATE TABLE public.report_craft_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_handle text NOT NULL REFERENCES public.scoring_v7_subjects(owner_handle) ON DELETE CASCADE,
  content_digest text NOT NULL CHECK(content_digest ~ '^[0-9a-f]{64}$'),
  declared_start date NOT NULL,
  declared_end date NOT NULL CHECK(declared_end>=declared_start),
  captured_at timestamptz NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL CHECK(period_end>period_start AND period_end<=captured_at),
  period_basis text NOT NULL CHECK(period_basis='declared_dates_first_capture_v7.2'),
  canonical_inputs jsonb NOT NULL CHECK(canonical_inputs->>'policyVersion'='v7.2'),
  result jsonb NOT NULL CHECK(result->>'status' IN ('scored','insufficient_report_data')),
  supersedes_id uuid,
  UNIQUE(owner_handle,id), UNIQUE(owner_handle,content_digest), UNIQUE(supersedes_id),
  FOREIGN KEY(owner_handle,supersedes_id) REFERENCES public.report_craft_reports(owner_handle,id)
);
CREATE TRIGGER report_craft_immutable BEFORE UPDATE ON public.report_craft_reports FOR EACH ROW EXECUTE FUNCTION public.scoring_v7_reject_update();
CREATE INDEX report_craft_period ON public.report_craft_reports(owner_handle,declared_start,declared_end,captured_at DESC);
CREATE TABLE public.report_craft_selection (
  owner_handle text PRIMARY KEY REFERENCES public.scoring_v7_subjects(owner_handle) ON DELETE CASCADE,
  selected_report_id uuid,
  evaluated_at timestamptz,
  generation bigint NOT NULL DEFAULT 0 CHECK(generation BETWEEN 0 AND 9007199254740991),
  FOREIGN KEY(owner_handle,selected_report_id) REFERENCES public.report_craft_reports(owner_handle,id) ON DELETE CASCADE
);
ALTER TABLE public.report_craft_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_craft_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.report_craft_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_craft_selection FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.report_craft_reports,public.report_craft_selection FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.report_craft_reports,public.report_craft_selection TO service_role;

-- A scored correction replaces its scored ancestors even across insufficient
-- intermediate revisions. Separate reports compete by their actual observed end.
CREATE OR REPLACE FUNCTION public.scoring_report_craft_choose(p_owner text,p_reference timestamptz)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH RECURSIVE replaced(id) AS (
    SELECT supersedes_id FROM public.report_craft_reports WHERE owner_handle=p_owner AND result->>'status'='scored' AND supersedes_id IS NOT NULL AND period_end<=p_reference
    UNION
    SELECT r.supersedes_id FROM public.report_craft_reports r JOIN replaced old ON r.id=old.id WHERE r.owner_handle=p_owner AND r.supersedes_id IS NOT NULL
  )
  SELECT r.id FROM public.report_craft_reports r WHERE r.owner_handle=p_owner AND r.result->>'status'='scored'
    AND r.period_end<=p_reference AND r.period_start>=(((p_reference AT TIME ZONE 'UTC')::date-364)::timestamp AT TIME ZONE 'UTC')
    AND NOT EXISTS(SELECT 1 FROM replaced old WHERE old.id=r.id)
  ORDER BY r.period_end DESC,r.period_start DESC,r.captured_at DESC,r.id DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.scoring_report_craft_store(p_owner text,p_actor text,p_prepared jsonb,p_acknowledged boolean,p_supersedes uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
<<admission>>
DECLARE admitted public.scoring_v7_subjects; existing public.report_craft_reports; previous public.report_craft_reports;
  selected public.report_craft_reports; pointer public.report_craft_selection; target uuid:=gen_random_uuid();
  received timestamptz; period_start timestamptz; period_end timestamptz; declared_start date; declared_end date;
  inputs jsonb; result jsonb; selection text; lower_bound timestamptz; evaluation timestamptz; chosen uuid;
BEGIN
  IF p_owner IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_owner !~ '^[a-z0-9][a-z0-9-]{0,38}$' THEN RAISE EXCEPTION 'Report owner access denied' USING ERRCODE='42501'; END IF;
  -- Same consent serialization as the ledger; later publication locks this subject too.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner,11));
  SELECT * INTO admitted FROM public.scoring_v7_subjects WHERE owner_handle=p_owner FOR UPDATE;
  IF (admitted.owner_handle IS NULL OR NOT admitted.public_evidence_consent) AND p_acknowledged IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('status','consent_required','persisted',false);
  END IF;
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
  INSERT INTO public.scoring_v7_subjects(owner_handle,public_evidence_consent,consent_recorded_at) VALUES(p_owner,true,received)
    ON CONFLICT(owner_handle) DO UPDATE SET public_evidence_consent=true,consent_recorded_at=CASE WHEN scoring_v7_subjects.public_evidence_consent THEN scoring_v7_subjects.consent_recorded_at ELSE excluded.consent_recorded_at END;
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
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
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
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Public evidence consent required' USING ERRCODE='42501'; END IF;
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
REVOKE ALL ON FUNCTION public.scoring_report_craft_store(text,text,jsonb,boolean,uuid),public.scoring_report_craft_choose(text,timestamptz),public.scoring_report_craft_read(text,timestamptz),public.scoring_observed_publish_with_report(text,text,jsonb,text,text,uuid,bigint,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_report_craft_store(text,text,jsonb,boolean,uuid),public.scoring_report_craft_choose(text,timestamptz),public.scoring_report_craft_read(text,timestamptz),public.scoring_observed_publish_with_report(text,text,jsonb,text,text,uuid,bigint,uuid,text) TO service_role;
