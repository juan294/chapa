-- S08 B2a draft: trusted-server assertions, not independent provider authentication.
-- Existing source/evidence tables and withdrawal cascades remain authoritative.
-- Apply only after foundation review; no browser roles receive these capabilities.

CREATE FUNCTION public.scoring_v7_link_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT isfinite(OLD.updated_at) THEN RAISE EXCEPTION 'Invalid existing link version'; END IF;
  NEW.updated_at := greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  RETURN NEW;
END $$;
CREATE TRIGGER scoring_v7_link_version BEFORE UPDATE ON public.user_platforms
FOR EACH ROW EXECUTE FUNCTION public.scoring_v7_link_version();

CREATE FUNCTION public.scoring_v7_source_instant(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'string' OR p_value#>>'{}' !~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$' THEN RETURN false; END IF;
 RETURN isfinite((p_value#>>'{}')::timestamptz);
EXCEPTION WHEN others THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.scoring_v7_source_instant(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.scoring_v7_source_strings(p_value jsonb, p_limit integer DEFAULT 10000) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT CASE WHEN jsonb_typeof(p_value) IS DISTINCT FROM 'array' THEN false ELSE
 jsonb_array_length(p_value)<=p_limit AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_value) v WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v#>>'{}') NOT BETWEEN 1 AND 1024 OR v#>>'{}' ~ '[[:cntrl:]]') END
$$;
CREATE FUNCTION public.scoring_v7_source_observation_valid(p_value jsonb, p_kind text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v jsonb;
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'object' OR p_value->>'status' IS NULL OR p_value->>'coverage' IS NULL
 OR p_value->>'coverage' NOT IN ('complete','partial','unavailable','stale','legacy') THEN RETURN false; END IF;
 IF p_value->>'status'='unknown' THEN
   RETURN p_value - ARRAY['status','coverage','reasonCode']='{}'::jsonb AND p_value->>'coverage'<>'complete'
   AND p_value->>'reasonCode' IS NOT NULL AND p_value->>'reasonCode' IN ('criterion_demonstrated','criterion_not_demonstrated','not_assessed','not_accessible','not_supported','pagination_incomplete','discovery_incomplete','source_error','stale_data','legacy_aggregate','acceptance_time_unknown','attribution_unknown','alias_unresolved','partial_files','outside_window','retracted','insufficient_evidence');
 END IF;
 IF p_value->>'status'<>'observed' OR p_value - ARRAY['status','value','coverage','provenance']<>'{}'::jsonb
 OR p_value->>'provenance' IS NULL OR p_value->>'provenance' NOT IN ('source_observed','self_reported','automated_assessment','human_assessed','independently_corroborated') THEN RETURN false; END IF;
 v := p_value->'value';
 IF p_kind='changedFiles' THEN RETURN public.scoring_v7_source_strings(v,1000); END IF;
 IF p_kind IN ('additions','deletions','leadTimeHours') THEN
   IF jsonb_typeof(v) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
   RETURN (v#>>'{}')::numeric>=0 AND (v#>>'{}')::numeric<=9007199254740991 AND (p_kind='leadTimeHours' OR trunc((v#>>'{}')::numeric)=(v#>>'{}')::numeric);
 END IF;
 IF p_kind IN ('hasDescription','hasIssueLink','usesFeatureBranch') THEN RETURN jsonb_typeof(v)='boolean'; END IF;
 IF p_kind='acceptance' THEN
   IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR v - ARRAY['method','acceptedAt','acceptedResultId']<>'{}'::jsonb
   OR v->>'method' IS NULL OR v->>'method' NOT IN ('merged_change','default_branch_first_reachability','linked_issue_result','accepted_artifact')
   OR jsonb_typeof(v->'acceptedResultId') IS DISTINCT FROM 'string' OR coalesce(length(v->>'acceptedResultId'),0) NOT BETWEEN 1 AND 1024 OR v->>'acceptedResultId' ~ '[[:cntrl:]]'
   OR jsonb_typeof(v->'acceptedAt') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
   RETURN public.scoring_v7_source_instant(v->'acceptedAt');
 END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.scoring_v7_source_strings(jsonb,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoring_v7_source_observation_valid(jsonb,text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.scoring_v7_lock_source_context(
 p_owner text, p_actor text, p_requested jsonb, p_access text, p_scope jsonb,
 p_link_id uuid, p_link_version timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF p_owner IS NULL OR p_actor IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_owner <> lower(btrim(p_owner)) OR length(p_owner)=0 THEN
   RAISE EXCEPTION 'Source authorization required';
 END IF;
 PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current consent required'; END IF;
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

-- Strict key allowlists reject accidental raw responses, pagination progress and
-- report bodies. Private normalized identifiers/file observations are retained.
CREATE FUNCTION public.scoring_v7_validate_source_window(p_window jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE ref timestamptz; start_at timestamptz; end_at timestamptz;
BEGIN
 IF jsonb_typeof(p_window) IS DISTINCT FROM 'object' OR p_window - ARRAY['referenceTime','referenceDate','startInclusive','endExclusive','calendarDays'] <> '{}'::jsonb
 OR NOT public.scoring_v7_source_instant(p_window->'referenceTime') OR NOT public.scoring_v7_source_instant(p_window->'startInclusive') OR NOT public.scoring_v7_source_instant(p_window->'endExclusive') THEN RAISE EXCEPTION 'Invalid source window'; END IF;
 ref := (p_window->>'referenceTime')::timestamptz; start_at := (p_window->>'startInclusive')::timestamptz; end_at := (p_window->>'endExclusive')::timestamptz;
 IF NOT isfinite(ref) OR NOT isfinite(start_at) OR NOT isfinite(end_at) THEN RAISE EXCEPTION 'Finite source time required'; END IF;
 IF p_window IS DISTINCT FROM jsonb_build_object(
   'referenceTime',to_char(ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'referenceDate',to_char(ref AT TIME ZONE 'UTC','YYYY-MM-DD'),
   'startInclusive',to_char(start_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'endExclusive',to_char(end_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'calendarDays',365) THEN RAISE EXCEPTION 'Canonical source window required'; END IF;
 IF p_window->>'calendarDays' IS DISTINCT FROM '365' OR p_window->>'referenceDate' IS DISTINCT FROM to_char(ref AT TIME ZONE 'UTC','YYYY-MM-DD')
 OR start_at <> (date_trunc('day',ref AT TIME ZONE 'UTC')-interval '364 days') AT TIME ZONE 'UTC'
 OR end_at <> (date_trunc('day',ref AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC' THEN RAISE EXCEPTION 'Invalid source window'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.scoring_v7_validate_source_window(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.scoring_v7_validate_source_value(p_source jsonb, p_scope jsonb, p_window jsonb, p_coverage jsonb, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE e jsonb; m jsonb; c jsonb; o jsonb; field text; ref timestamptz; start_at timestamptz; end_at timestamptz;
BEGIN
 IF jsonb_typeof(p_source) IS DISTINCT FROM 'object' OR p_source - ARRAY['provider','host','subjectId']<>'{}'::jsonb OR jsonb_typeof(p_source->'provider') IS DISTINCT FROM 'string' OR jsonb_typeof(p_source->'host') IS DISTINCT FROM 'string' OR jsonb_typeof(p_source->'subjectId') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid canonical source'; END IF;
 FOREACH field IN ARRAY ARRAY['host','subjectId'] LOOP
   IF coalesce(length(p_source->>field),0) NOT BETWEEN 1 AND 1024 OR p_source->>field ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Invalid source identity'; END IF;
 END LOOP;
 PERFORM public.scoring_v7_validate_source_window(p_window);
 ref := (p_window->>'referenceTime')::timestamptz; start_at := (p_window->>'startInclusive')::timestamptz; end_at := (p_window->>'endExclusive')::timestamptz;
 IF jsonb_typeof(p_coverage) IS DISTINCT FROM 'object' OR p_coverage - ARRAY['source','window','dataThrough','status','discovery','repositoryIds','repositoryDiscoveryComplete','eventKinds','reasonCodes','unknownPeriods'] <> '{}'::jsonb
 OR p_coverage->'source' IS DISTINCT FROM p_source OR p_coverage->'window' IS DISTINCT FROM p_window
 OR p_coverage->>'status' IS NULL OR p_coverage->>'status' NOT IN ('complete','partial','unavailable','stale','legacy')
 OR p_coverage->>'discovery' IS DISTINCT FROM p_scope->>'discovery'
 OR jsonb_typeof(p_coverage->'repositoryIds') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_coverage->'repositoryDiscoveryComplete') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(p_coverage->'eventKinds') IS DISTINCT FROM 'object'
 OR jsonb_typeof(p_coverage->'reasonCodes') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_coverage->'unknownPeriods') IS DISTINCT FROM 'array' OR jsonb_array_length(p_coverage->'unknownPeriods')>1000
 OR NOT p_coverage ? 'dataThrough' THEN RAISE EXCEPTION 'Invalid source coverage'; END IF;
 IF p_coverage->>'dataThrough' IS NOT NULL AND NOT public.scoring_v7_source_instant(p_coverage->'dataThrough') THEN RAISE EXCEPTION 'Invalid coverage time'; END IF;
 IF p_coverage->>'dataThrough' IS NOT NULL AND (NOT isfinite((p_coverage->>'dataThrough')::timestamptz) OR (p_coverage->>'dataThrough')::timestamptz > ref) THEN RAISE EXCEPTION 'Future source coverage'; END IF;
 IF p_coverage->>'status'='complete' AND (p_coverage->>'dataThrough' IS NULL OR p_coverage->>'repositoryDiscoveryComplete'<>'true' OR (p_coverage->>'dataThrough')::timestamptz<>ref) THEN RAISE EXCEPTION 'Incomplete source discovery'; END IF;
 FOR o IN SELECT value FROM jsonb_array_elements(p_coverage->'unknownPeriods') LOOP
   IF jsonb_typeof(o) IS DISTINCT FROM 'object' OR o - ARRAY['startInclusive','endExclusive'] <> '{}'::jsonb
   OR NOT public.scoring_v7_source_instant(o->'startInclusive') OR NOT public.scoring_v7_source_instant(o->'endExclusive') OR NOT isfinite((o->>'startInclusive')::timestamptz) OR NOT isfinite((o->>'endExclusive')::timestamptz) OR (o->>'startInclusive')::timestamptz >= (o->>'endExclusive')::timestamptz
   OR (p_coverage->>'status'='complete' AND (o->>'startInclusive')::timestamptz <= ref AND (o->>'endExclusive')::timestamptz > start_at) THEN RAISE EXCEPTION 'Invalid unknown source period'; END IF;
 END LOOP;
 IF NOT public.scoring_v7_source_strings(p_coverage->'repositoryIds') OR NOT public.scoring_v7_source_strings(p_coverage->'reasonCodes',100) OR NOT public.scoring_v7_source_strings(p_scope->'eventKinds') THEN RAISE EXCEPTION 'Invalid coverage arrays'; END IF;
 IF p_scope->>'discovery'='explicit_repositories' AND (NOT ((p_scope->'repositoryIds') @> (p_coverage->'repositoryIds')) OR ((p_coverage->>'status'='complete' OR p_coverage->>'repositoryDiscoveryComplete'='true') AND NOT ((p_coverage->'repositoryIds') @> (p_scope->'repositoryIds')))) THEN RAISE EXCEPTION 'Declared repositories differ'; END IF;
 FOR field IN SELECT jsonb_array_elements_text(p_scope->'eventKinds') LOOP
   IF field NOT IN ('accepted_change','authored_commit','review','issue_work','documentation_design','maintenance','practice_evidence') OR (p_coverage->>'status'='complete' AND p_coverage->'eventKinds'->>field IS DISTINCT FROM 'complete') THEN RAISE EXCEPTION 'Declared event coverage missing'; END IF;
 END LOOP;
 FOR field,m IN SELECT key,value FROM jsonb_each(p_coverage->'eventKinds') LOOP
   IF field NOT IN ('accepted_change','authored_commit','review','issue_work','documentation_design','maintenance','practice_evidence') OR jsonb_typeof(m) IS DISTINCT FROM 'string' OR m#>>'{}' NOT IN ('complete','partial','unavailable','stale','legacy') THEN RAISE EXCEPTION 'Invalid event coverage'; END IF;
 END LOOP;
 FOR field IN SELECT jsonb_array_elements_text(p_coverage->'reasonCodes') LOOP
   IF field NOT IN ('criterion_demonstrated','criterion_not_demonstrated','not_assessed','not_accessible','not_supported','pagination_incomplete','discovery_incomplete','source_error','stale_data','legacy_aggregate','acceptance_time_unknown','attribution_unknown','alias_unresolved','partial_files','outside_window','retracted','insufficient_evidence') THEN RAISE EXCEPTION 'Invalid coverage reason'; END IF;
 END LOOP;
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR p_payload - ARRAY['events'] <> '{}'::jsonb
 OR jsonb_typeof(p_payload->'events') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'events')>10000 THEN RAISE EXCEPTION 'Invalid normalized source payload'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p_payload->'events') LOOP
   IF jsonb_typeof(e) IS DISTINCT FROM 'object' OR e - ARRAY['provider','host','subjectId','repositoryId','actorId','eventId','schemaVersion','kind','occurredAt','dataThrough','canonicalProjectId','workItemId','artifactRevision','artifactReferenceIds','attribution','provenance','coverage','measurements','categories','acceptance'] <> '{}'::jsonb
   OR e->>'schemaVersion' IS DISTINCT FROM 'v7' OR e->>'provider' IS DISTINCT FROM p_source->>'provider' OR e->>'host' IS DISTINCT FROM p_source->>'host' OR e->>'subjectId' IS DISTINCT FROM p_source->>'subjectId'
   OR NOT public.scoring_v7_source_instant(e->'occurredAt') OR NOT public.scoring_v7_source_instant(e->'dataThrough') OR NOT isfinite((e->>'occurredAt')::timestamptz) OR NOT isfinite((e->>'dataThrough')::timestamptz) OR (e->>'occurredAt')::timestamptz < start_at OR (e->>'occurredAt')::timestamptz > ref
   OR (e->>'occurredAt')::timestamptz > (e->>'dataThrough')::timestamptz OR (e->>'dataThrough')::timestamptz > ref
   OR jsonb_typeof(e->'measurements') IS DISTINCT FROM 'object' OR (e->'measurements') - ARRAY['changedFiles','additions','deletions','leadTimeHours','hasDescription','hasIssueLink','usesFeatureBranch'] <> '{}'::jsonb
   OR jsonb_typeof(e->'categories') IS DISTINCT FROM 'array' OR jsonb_array_length(e->'categories')>4 THEN RAISE EXCEPTION 'Invalid normalized source event'; END IF;
   FOREACH field IN ARRAY ARRAY['repositoryId','actorId','eventId','canonicalProjectId','workItemId','artifactRevision'] LOOP
     IF jsonb_typeof(e->field) IS DISTINCT FROM 'string' OR coalesce(length(e->>field),0) NOT BETWEEN 1 AND 1024 OR e->>field ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Invalid event identity'; END IF;
   END LOOP;
   IF NOT ((p_coverage->'repositoryIds') @> jsonb_build_array(e->>'repositoryId'))
     OR (p_scope->>'discovery'='explicit_repositories' AND NOT ((p_scope->'repositoryIds') @> jsonb_build_array(e->>'repositoryId'))) THEN RAISE EXCEPTION 'Event repository outside recorded scope'; END IF;
   IF e->>'kind' IS NULL OR e->>'kind' NOT IN ('accepted_change','authored_commit','review','issue_work','documentation_design','maintenance','practice_evidence')
     OR e->>'attribution' IS NULL OR e->>'attribution' NOT IN ('individual','team_participation','unclear')
     OR e->>'provenance' IS NULL OR e->>'provenance' NOT IN ('source_observed','self_reported','automated_assessment','human_assessed','independently_corroborated')
     OR e->>'coverage' IS NULL OR e->>'coverage' NOT IN ('complete','partial','unavailable','stale','legacy')
     OR NOT public.scoring_v7_source_strings(e->'artifactReferenceIds',1000) THEN RAISE EXCEPTION 'Invalid event metadata'; END IF;
   FOREACH field IN ARRAY ARRAY['changedFiles','additions','deletions','leadTimeHours','hasDescription','hasIssueLink','usesFeatureBranch'] LOOP
     IF NOT coalesce(public.scoring_v7_source_observation_valid(e->'measurements'->field,field),false) THEN RAISE EXCEPTION 'Invalid measurement'; END IF;
   END LOOP;
   IF NOT coalesce(public.scoring_v7_source_observation_valid(e->'acceptance','acceptance'),false) THEN RAISE EXCEPTION 'Invalid acceptance'; END IF;
   IF e->'acceptance'->>'status'='observed' THEN
     IF (e->'acceptance'->'value'->>'acceptedAt')::timestamptz > (e->>'dataThrough')::timestamptz
       OR (e->'acceptance'->'value'->>'acceptedAt')::timestamptz > ref
       OR (e->>'kind'='accepted_change' AND (e->'acceptance'->'value'->>'acceptedAt')::timestamptz IS DISTINCT FROM (e->>'occurredAt')::timestamptz) THEN RAISE EXCEPTION 'Invalid acceptance event time'; END IF;
   END IF;
   FOR c IN SELECT value FROM jsonb_array_elements(e->'categories') LOOP
     IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR c - ARRAY['category','evidenceReferenceIds'] <> '{}'::jsonb OR c->>'category' IS NULL OR c->>'category' NOT IN ('implementation','verification_review','documentation_design','maintenance_support') OR NOT public.scoring_v7_source_strings(c->'evidenceReferenceIds',1000) THEN RAISE EXCEPTION 'Invalid normalized category'; END IF;
   END LOOP;
   FOR m IN SELECT value FROM jsonb_each(e->'measurements') UNION ALL SELECT e->'acceptance' LOOP
     IF jsonb_typeof(m) IS DISTINCT FROM 'object' OR m - ARRAY['status','value','coverage','provenance','reasonCode'] <> '{}'::jsonb
     OR m->>'status' IS NULL OR m->>'status' NOT IN ('observed','unknown') THEN RAISE EXCEPTION 'Invalid normalized observation'; END IF;
   END LOOP;
   IF e->'acceptance'->>'status'='observed' AND (jsonb_typeof(e->'acceptance'->'value') IS DISTINCT FROM 'object'
     OR (e->'acceptance'->'value') - ARRAY['method','acceptedAt','acceptedResultId'] <> '{}'::jsonb) THEN RAISE EXCEPTION 'Invalid normalized acceptance'; END IF;
 END LOOP;
END $$;

CREATE FUNCTION public.scoring_v7_append_source(
 p_owner text, p_actor text, p_source jsonb, p_requested jsonb, p_access text, p_scope jsonb,
 p_link_id uuid, p_link_version timestamptz, p_observation uuid, p_window jsonb, p_coverage jsonb, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sid uuid; existing public.scoring_v7_source_observations%ROWTYPE; result jsonb;
BEGIN
 PERFORM public.scoring_v7_lock_source_context(p_owner,p_actor,p_requested,p_access,p_scope,p_link_id,p_link_version);
 IF p_source->>'provider' IS DISTINCT FROM p_requested->>'provider' OR p_source->>'host' IS DISTINCT FROM p_requested->>'host' OR coalesce(length(p_source->>'subjectId'),0)=0 THEN RAISE EXCEPTION 'Canonical source identity required'; END IF;
 PERFORM public.scoring_v7_validate_source_value(p_source,p_scope,p_window,p_coverage,p_payload);
 IF p_observation IS NULL THEN RAISE EXCEPTION 'Observation identity required'; END IF;
 INSERT INTO public.scoring_v7_sources(owner_handle,provider,host,subject_id,access_context_id,declared_scope)
 VALUES(p_owner,p_source->>'provider',p_source->>'host',p_source->>'subjectId',p_access,p_scope)
 ON CONFLICT(owner_handle,provider,host,subject_id,access_context_id) DO NOTHING;
 SELECT id INTO sid FROM public.scoring_v7_sources WHERE owner_handle=p_owner AND provider=p_source->>'provider' AND host=p_source->>'host' AND subject_id=p_source->>'subjectId' AND access_context_id=p_access AND declared_scope=p_scope;
 IF sid IS NULL THEN RAISE EXCEPTION 'Source context conflict'; END IF;
 SELECT * INTO existing FROM public.scoring_v7_source_observations WHERE id=p_observation;
 IF FOUND THEN
   IF existing.owner_handle IS DISTINCT FROM p_owner OR existing.source_id IS DISTINCT FROM sid OR existing.reference_time IS DISTINCT FROM (p_window->>'referenceTime')::timestamptz OR existing.window_start IS DISTINCT FROM (p_window->>'startInclusive')::timestamptz OR existing.window_end IS DISTINCT FROM (p_window->>'endExclusive')::timestamptz OR existing.data_through IS DISTINCT FROM (p_coverage->>'dataThrough')::timestamptz OR existing.coverage IS DISTINCT FROM p_coverage OR existing.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Observation identity conflict'; END IF;
 ELSE
   INSERT INTO public.scoring_v7_source_observations(id,owner_handle,source_id,reference_time,window_start,window_end,data_through,coverage,payload)
   VALUES(p_observation,p_owner,sid,(p_window->>'referenceTime')::timestamptz,(p_window->>'startInclusive')::timestamptz,(p_window->>'endExclusive')::timestamptz,(p_coverage->>'dataThrough')::timestamptz,p_coverage,p_payload);
 END IF;
 RETURN jsonb_build_object('id',p_observation,'window',p_window,'coverage',p_coverage,'events',p_payload->'events');
END $$;

CREATE FUNCTION public.scoring_v7_read_source(
 p_owner text, p_actor text, p_source jsonb, p_requested jsonb, p_access text, p_scope jsonb,
 p_link_id uuid, p_link_version timestamptz, p_window jsonb, p_prior boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.scoring_v7_lock_source_context(p_owner,p_actor,p_requested,p_access,p_scope,p_link_id,p_link_version);
 IF p_source->>'provider' IS DISTINCT FROM p_requested->>'provider' OR p_source->>'host' IS DISTINCT FROM p_requested->>'host' OR coalesce(length(p_source->>'subjectId'),0)=0 THEN RAISE EXCEPTION 'Canonical source identity required'; END IF;
 PERFORM public.scoring_v7_validate_source_window(p_window);
 IF p_prior IS NULL THEN RAISE EXCEPTION 'Source selection required'; END IF;
 SELECT jsonb_build_object('id',o.id,'window',o.coverage->'window','coverage',o.coverage,'events',o.payload->'events') INTO result
 FROM public.scoring_v7_sources s JOIN public.scoring_v7_source_observations o ON o.source_id=s.id AND o.owner_handle=s.owner_handle
 WHERE s.owner_handle=p_owner AND s.provider=p_source->>'provider' AND s.host=p_source->>'host' AND s.subject_id=p_source->>'subjectId'
 AND s.access_context_id=p_access AND s.declared_scope=p_scope
 AND o.reference_time=(o.coverage->'window'->>'referenceTime')::timestamptz AND o.window_start=(o.coverage->'window'->>'startInclusive')::timestamptz AND o.window_end=(o.coverage->'window'->>'endExclusive')::timestamptz AND o.data_through IS NOT DISTINCT FROM (o.coverage->>'dataThrough')::timestamptz
 AND ((NOT p_prior AND o.coverage->'window'=p_window) OR (p_prior AND o.reference_time < (p_window->>'referenceTime')::timestamptz))
 ORDER BY o.reference_time DESC,(o.coverage->>'status'='complete') DESC,o.recorded_at DESC,o.id DESC LIMIT 1;
 IF result IS NOT NULL THEN
   PERFORM public.scoring_v7_validate_source_value(p_source,p_scope,result->'window',result->'coverage',jsonb_build_object('events',result->'events'));
 END IF;
 -- Stored window/status/data-through are untouched. The coordinator labels prior
 -- observations stale; this function never presents them as current complete.
 RETURN result;
END $$;

CREATE FUNCTION public.scoring_v7_discover_source(
 p_owner text, p_actor text, p_requested jsonb, p_access text, p_scope jsonb, p_link_id uuid, p_link_version timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE identities jsonb;
BEGIN
 PERFORM public.scoring_v7_lock_source_context(p_owner,p_actor,p_requested,p_access,p_scope,p_link_id,p_link_version);
 SELECT jsonb_agg(jsonb_build_object('provider',provider,'host',host,'subjectId',subject_id)) INTO identities
 FROM (SELECT DISTINCT provider,host,subject_id FROM public.scoring_v7_sources
   WHERE owner_handle=p_owner AND provider=p_requested->>'provider' AND host=p_requested->>'host'
   AND access_context_id=p_access AND declared_scope=p_scope LIMIT 2) canonical;
 IF identities IS NULL THEN RETURN jsonb_build_object('status','missing'); END IF;
 IF jsonb_array_length(identities) <> 1 THEN RETURN jsonb_build_object('status','ambiguous'); END IF;
 RETURN jsonb_build_object('status','found','source',identities->0);
END $$;

CREATE FUNCTION public.scoring_v7_cas_link_tokens(
 p_owner text, p_actor text, p_platform text, p_id uuid, p_version timestamptz,
 p_action text, p_access_token text, p_refresh_token text, p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_id uuid; new_version timestamptz;
BEGIN
 IF p_owner IS NULL OR p_actor IS NULL OR p_owner IS DISTINCT FROM p_actor OR p_owner<>lower(btrim(p_owner)) OR length(p_owner)=0 THEN RAISE EXCEPTION 'Link authorization required'; END IF;
 PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current consent required'; END IF;
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

REVOKE ALL ON FUNCTION public.scoring_v7_link_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoring_v7_lock_source_context(text,text,jsonb,text,jsonb,uuid,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoring_v7_validate_source_value(jsonb,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoring_v7_append_source(text,text,jsonb,jsonb,text,jsonb,uuid,timestamptz,uuid,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoring_v7_read_source(text,text,jsonb,jsonb,text,jsonb,uuid,timestamptz,jsonb,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoring_v7_cas_link_tokens(text,text,text,uuid,timestamptz,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_append_source(text,text,jsonb,jsonb,text,jsonb,uuid,timestamptz,uuid,jsonb,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.scoring_v7_read_source(text,text,jsonb,jsonb,text,jsonb,uuid,timestamptz,jsonb,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.scoring_v7_cas_link_tokens(text,text,text,uuid,timestamptz,text,text,text,timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.scoring_v7_discover_source(text,text,jsonb,text,jsonb,uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_discover_source(text,text,jsonb,text,jsonb,uuid,timestamptz) TO service_role;
