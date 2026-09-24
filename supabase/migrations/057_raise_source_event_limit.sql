-- Raise the per-source evidence limit from 10,000 to 50,000 events (#1335).
--
-- 2026-09-24: juan294's GitHub source staged 11,124 in-window authored
-- commits before its pull request, review and issue steps ran, and the job
-- failed with event_limit. The limit was a size bound only; no scoring rule
-- depends on it. The three functions below are the 045/055 definitions,
-- unchanged except for the limit.

CREATE OR REPLACE FUNCTION public.scoring_v7_validate_source_value(p_source jsonb, p_scope jsonb, p_window jsonb, p_coverage jsonb, p_payload jsonb)
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
 OR jsonb_typeof(p_payload->'events') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'events')>50000 THEN RAISE EXCEPTION 'Invalid normalized source payload'; END IF;
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

CREATE OR REPLACE FUNCTION public.scoring_collection_checkpoint(
  p_job_id uuid, p_lease_token uuid, p_checkpoint jsonb,
  p_event_keys text[], p_events jsonb[], p_progress jsonb, p_release boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE job public.scoring_collection_jobs%ROWTYPE; staged_count integer;
BEGIN
  SELECT * INTO job FROM public.scoring_collection_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR job.lease_token IS DISTINCT FROM p_lease_token OR job.state <> 'running' OR job.lease_expires_at < now() THEN
    RETURN jsonb_build_object('status','lease_mismatch');
  END IF;
  IF coalesce(array_length(p_event_keys,1),0) <> coalesce(array_length(p_events,1),0) THEN
    RAISE EXCEPTION 'Event key/value length mismatch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(p_event_keys, ARRAY[]::text[]), coalesce(p_events, ARRAY[]::jsonb[])) AS incoming(event_key, event)
    JOIN public.scoring_collection_staged_events existing
      ON existing.job_id = p_job_id AND existing.event_key = incoming.event_key
    WHERE existing.event IS DISTINCT FROM incoming.event
  ) THEN RAISE EXCEPTION 'Conflicting staged event content for job %', p_job_id; END IF;
  INSERT INTO public.scoring_collection_staged_events(job_id, event_key, event)
  SELECT p_job_id, k, e FROM unnest(coalesce(p_event_keys, ARRAY[]::text[]), coalesce(p_events, ARRAY[]::jsonb[])) AS t(k, e)
  ON CONFLICT (job_id, event_key) DO NOTHING;
  SELECT count(*) INTO staged_count FROM public.scoring_collection_staged_events WHERE job_id = p_job_id;
  IF staged_count > 50000 THEN
    UPDATE public.scoring_collection_jobs SET
      state = 'failed',
      last_stop = jsonb_build_object('provider', job.provider, 'operation', 'event_limit', 'stopKind', 'protocol', 'httpStatus', NULL, 'retryAfterSeconds', NULL),
      progress = jsonb_set(coalesce(p_progress, job.progress), '{events}', to_jsonb(staged_count)),
      lease_token = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE id = p_job_id;
    RETURN jsonb_build_object('status','event_limit','stagedCount',staged_count);
  END IF;
  IF p_release THEN
    UPDATE public.scoring_collection_jobs SET
      checkpoint = p_checkpoint, progress = p_progress, state = 'queued',
      next_run_at = now(), lease_token = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE id = p_job_id;
  ELSE
    UPDATE public.scoring_collection_jobs SET
      checkpoint = p_checkpoint, progress = p_progress,
      lease_expires_at = now() + interval '120 seconds', updated_at = now()
    WHERE id = p_job_id;
  END IF;
  RETURN jsonb_build_object('status','ok','stagedCount',staged_count);
END $$;

CREATE OR REPLACE FUNCTION public.scoring_collection_finish(
  p_job_id uuid, p_lease_token uuid, p_coverage jsonb, p_observation uuid,
  p_requested jsonb, p_access text, p_scope jsonb, p_link_id uuid, p_link_version timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE job public.scoring_collection_jobs%ROWTYPE; payload jsonb; appended jsonb; event_count integer;
BEGIN
  SELECT * INTO job FROM public.scoring_collection_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR job.lease_token IS DISTINCT FROM p_lease_token OR job.state <> 'running' THEN
    RETURN jsonb_build_object('status','lease_mismatch');
  END IF;
  SELECT count(*), coalesce(jsonb_agg(event ORDER BY event_key), '[]'::jsonb)
  INTO event_count, payload
  FROM public.scoring_collection_staged_events WHERE job_id = p_job_id;
  IF event_count > 50000 THEN
    UPDATE public.scoring_collection_jobs SET
      state = 'failed',
      last_stop = jsonb_build_object('provider', job.provider, 'operation', 'event_limit', 'stopKind', 'protocol', 'httpStatus', NULL, 'retryAfterSeconds', NULL),
      progress = jsonb_set(job.progress, '{events}', to_jsonb(event_count)),
      lease_token = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE id = p_job_id;
    RETURN jsonb_build_object('status','event_limit','stagedCount',event_count);
  END IF;
  appended := public.scoring_v7_append_source(
    job.owner_handle, job.owner_handle, p_coverage->'source', p_requested, p_access, p_scope,
    p_link_id, p_link_version, p_observation, p_coverage->'window', p_coverage,
    jsonb_build_object('events', payload)
  );
  DELETE FROM public.scoring_collection_staged_events WHERE job_id = p_job_id;
  UPDATE public.scoring_collection_jobs SET
    state = 'complete', observation_id = p_observation, checkpoint = '{}'::jsonb,
    last_stop = NULL, lease_token = NULL, lease_expires_at = NULL, updated_at = now()
  WHERE id = p_job_id;
  RETURN jsonb_build_object('status','ok','observationId',p_observation,'appended',appended);
END $$;
