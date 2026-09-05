-- Private workflow metadata extends immutable foundation records; existing withdrawal
-- and administrative deletion inventory covers both columns without a new table.
ALTER TABLE public.scoring_v7_evidence ADD COLUMN ledger_context jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(ledger_context)='object');
ALTER TABLE public.scoring_v7_assessments ADD COLUMN ledger_payload jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(ledger_payload)='object');

CREATE FUNCTION public.scoring_v7_ledger_write(p_owner text, p_actor text, p_action text, p_data jsonb)
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
  IF p_action IN ('claim','grant','consent') THEN
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
    IF p_data->>'publicationAcknowledged' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Publication acknowledgment required' USING ERRCODE='22023'; END IF;
    IF p_data->>'enabled'='false' THEN
      PERFORM public.scoring_v7_withdraw(p_owner);
    ELSE
      UPDATE public.scoring_v7_subjects SET public_evidence_consent=true,consent_recorded_at=received WHERE owner_handle=p_owner;
    END IF;
    RETURN jsonb_build_object('success',true);
  ELSIF p_action='withdraw' THEN
    IF p_data->>'publicationAcknowledged' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Withdrawal acknowledgment required' USING ERRCODE='22023'; END IF;
    PERFORM public.scoring_v7_withdraw(p_owner);
    RETURN jsonb_build_object('success',true);
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

CREATE FUNCTION public.scoring_v7_ledger_read(p_owner text,p_actor text,p_reference timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_actor IS NULL OR p_owner IS NULL OR (p_actor<>p_owner AND NOT public.scoring_v7_can_review(p_owner,p_actor)) THEN RAISE EXCEPTION 'Ledger access denied' USING ERRCODE='42501'; END IF;
  IF p_reference IS NULL OR NOT isfinite(p_reference) THEN RAISE EXCEPTION 'Invalid ledger time' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('ownerId',p_owner,
    'publicConsent',coalesce((SELECT public_evidence_consent FROM public.scoring_v7_subjects WHERE owner_handle=p_owner),false),
    'claims',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY recorded_at,id),'[]') FROM public.scoring_v7_evidence e WHERE owner_handle=p_owner AND category<>'craft' AND recorded_at<=p_reference),
    'assessments',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY recorded_at,id),'[]') FROM public.scoring_v7_assessments a WHERE owner_handle=p_owner AND recorded_at<=p_reference),
    'references',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY reference_id),'[]') FROM public.scoring_v7_evidence_references r WHERE owner_handle=p_owner AND recorded_at<=p_reference AND retention='until_owner_withdrawal'));
END;
$$;
REVOKE ALL ON FUNCTION public.scoring_v7_ledger_write(text,text,text,jsonb),public.scoring_v7_ledger_read(text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_ledger_write(text,text,text,jsonb),public.scoring_v7_ledger_read(text,text,timestamptz) TO service_role;

-- A single bounded artifact body is available only to its current authorized reader.
-- Raw expiry uses current time, even when an earlier scoring reference is requested.
CREATE FUNCTION public.scoring_v7_ledger_artifact(p_owner text,p_actor text,p_reference_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_actor IS NULL OR p_owner IS NULL OR (p_actor<>p_owner AND NOT public.scoring_v7_can_review(p_owner,p_actor)) THEN RAISE EXCEPTION 'Artifact access denied' USING ERRCODE='42501'; END IF;
  RETURN (SELECT jsonb_build_object('referenceId',r.reference_id,'body',b.body,'expiresAt',b.expires_at)
    FROM public.scoring_v7_evidence_references r JOIN public.scoring_v7_raw_artifacts b ON b.id::text=r.reference_id AND b.owner_handle=r.owner_handle
    WHERE r.owner_handle=p_owner AND r.reference_id=p_reference_id AND b.expires_at>now() AND octet_length(b.body)<=65536);
END;
$$;
REVOKE ALL ON FUNCTION public.scoring_v7_ledger_artifact(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_ledger_artifact(text,text,text) TO service_role;
