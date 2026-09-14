-- Refs #1302. Immutable dated declarations reuse the private source tables and
-- their owner-withdrawal cascade. No raw artifact contents or reviewer verdicts.
ALTER TABLE public.scoring_v7_source_observations ADD COLUMN upload_digest text CHECK (upload_digest ~ '^[a-f0-9]{64}$');
CREATE UNIQUE INDEX scoring_v7_supplemental_digest ON public.scoring_v7_source_observations(source_id,upload_digest) WHERE upload_digest IS NOT NULL;

CREATE FUNCTION public.scoring_v7_store_supplemental(p_owner text,p_actor text,p_upload uuid,p_digest text,p_value jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  received timestamptz := date_trunc('milliseconds',now()); v_source_id uuid; existing public.scoring_v7_source_observations;
  source_key text; period_start timestamptz; period_end timestamptz; through_time timestamptz; event jsonb; happened timestamptz; field text;
BEGIN
  IF p_owner IS NULL OR p_actor IS DISTINCT FROM p_owner OR p_owner !~ '^[a-z0-9][a-z0-9-]{0,38}$' THEN
    RAISE EXCEPTION 'Supplemental owner access denied' USING ERRCODE='42501';
  END IF;
  IF p_upload IS NULL OR p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$' OR p_value IS NULL OR jsonb_typeof(p_value)<>'object' OR octet_length(p_value::text)>524288
    OR p_value->>'schemaVersion' IS DISTINCT FROM 'supplemental-v2' OR lower(p_value->>'targetHandle') IS DISTINCT FROM p_owner
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_value) k WHERE k NOT IN ('schemaVersion','targetHandle','source','observationPeriod','observedThrough','events'))
    OR jsonb_typeof(p_value->'source') IS DISTINCT FROM 'object' OR jsonb_typeof(p_value->'observationPeriod') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_value->'events') IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->'events')>1000 THEN
    RAISE EXCEPTION 'Invalid supplemental upload' USING ERRCODE='22023';
  END IF;
  IF p_value#>>'{source,provider}' IS NULL OR p_value#>>'{source,provider}' NOT IN ('github','gitlab','bitbucket','codeberg')
    OR nullif(btrim(p_value#>>'{source,subjectId}'),'') IS NULL OR nullif(btrim(p_value#>>'{source,host}'),'') IS NULL
    OR nullif(btrim(p_value#>>'{source,handle}'),'') IS NULL OR (p_value#>>'{source,provider}'='github' AND lower(p_value#>>'{source,handle}')=p_owner)
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_value->'source') k WHERE k NOT IN ('provider','host','subjectId','handle')) THEN
    RAISE EXCEPTION 'Invalid supplemental source declaration' USING ERRCODE='22023';
  END IF;
  period_start := (p_value#>>'{observationPeriod,startInclusive}')::timestamptz;
  period_end := (p_value#>>'{observationPeriod,endExclusive}')::timestamptz;
  through_time := (p_value->>'observedThrough')::timestamptz;
  IF period_start IS NULL OR period_end IS NULL OR through_time IS NULL OR NOT isfinite(period_start) OR NOT isfinite(period_end) OR NOT isfinite(through_time)
    OR period_start>=period_end OR period_end>received OR through_time<period_start OR through_time>period_end THEN
    RAISE EXCEPTION 'Invalid supplemental observation period' USING ERRCODE='22023';
  END IF;
  FOR event IN SELECT value FROM jsonb_array_elements(p_value->'events') LOOP
    IF jsonb_typeof(event)<>'object' OR event->>'actorId' IS DISTINCT FROM p_value#>>'{source,subjectId}'
      OR event->>'kind' IS NULL OR event->>'kind' NOT IN ('accepted_change','authored_commit','review','issue_work','documentation_design','maintenance','practice_evidence')
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(event) k WHERE k NOT IN ('eventId','repositoryId','actorId','workItemId','kind','occurredAt','artifactRevision','files','additions','deletions','leadTimeHours','hasDescription','hasIssueLink','usesFeatureBranch','acceptance')) THEN
      RAISE EXCEPTION 'Invalid supplemental event' USING ERRCODE='22023';
    END IF;
    FOREACH field IN ARRAY ARRAY['eventId','repositoryId','workItemId','artifactRevision'] LOOP
      IF jsonb_typeof(event->field) IS DISTINCT FROM 'string' OR length(btrim(event->>field)) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'Invalid supplemental event identity' USING ERRCODE='22023'; END IF;
    END LOOP;
    happened := (event->>'occurredAt')::timestamptz;
    IF happened IS NULL OR NOT isfinite(happened) OR happened<period_start OR happened>=period_end OR happened>through_time THEN RAISE EXCEPTION 'Invalid supplemental event time' USING ERRCODE='22023'; END IF;
    FOREACH field IN ARRAY ARRAY['additions','deletions','leadTimeHours'] LOOP
      IF event ? field AND (jsonb_typeof(event->field) IS DISTINCT FROM 'number' OR (event->>field)::numeric<0 OR (event->>field)::numeric>CASE WHEN field='leadTimeHours' THEN 1000000 ELSE 10000000 END
        OR (field<>'leadTimeHours' AND trunc((event->>field)::numeric)<>(event->>field)::numeric)) THEN RAISE EXCEPTION 'Invalid supplemental measurement' USING ERRCODE='22023'; END IF;
    END LOOP;
    FOREACH field IN ARRAY ARRAY['hasDescription','hasIssueLink','usesFeatureBranch'] LOOP
      IF event ? field AND jsonb_typeof(event->field) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid supplemental boolean' USING ERRCODE='22023'; END IF;
    END LOOP;
    IF event ? 'files' AND (jsonb_typeof(event->'files') IS DISTINCT FROM 'array' OR jsonb_array_length(event->'files')>1000
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(event->'files') f WHERE jsonb_typeof(f)<>'string' OR length(btrim(f#>>'{}')) NOT BETWEEN 1 AND 1024)) THEN RAISE EXCEPTION 'Invalid supplemental file list' USING ERRCODE='22023'; END IF;
    IF event ? 'acceptance' AND (jsonb_typeof(event->'acceptance') IS DISTINCT FROM 'object'
      OR event#>>'{acceptance,method}' IS NULL OR event#>>'{acceptance,method}' NOT IN ('merged_change','default_branch_first_reachability','linked_issue_result','accepted_artifact')
      OR (event#>>'{acceptance,acceptedAt}')::timestamptz IS DISTINCT FROM happened OR nullif(btrim(event#>>'{acceptance,acceptedResultId}'),'') IS NULL
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(event->'acceptance') k WHERE k NOT IN ('method','acceptedAt','acceptedResultId'))) THEN RAISE EXCEPTION 'Invalid supplemental acceptance declaration' USING ERRCODE='22023'; END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner,12));
  INSERT INTO public.scoring_v7_subjects(owner_handle) VALUES(p_owner) ON CONFLICT DO NOTHING;
  source_key := jsonb_build_array(p_value#>>'{source,provider}',p_value#>>'{source,host}',p_value#>>'{source,subjectId}')::text;
  INSERT INTO public.scoring_v7_sources(owner_handle,provider,host,subject_id,access_context_id,declared_scope)
    VALUES(p_owner,'supplemental','chapa-upload',source_key,'owner-upload-v2',jsonb_build_object('provenance','self_reported','declaredSource',p_value->'source')) ON CONFLICT DO NOTHING;
  SELECT s.id INTO v_source_id FROM public.scoring_v7_sources s WHERE s.owner_handle=p_owner AND s.provider='supplemental' AND s.host='chapa-upload' AND s.subject_id=source_key AND s.access_context_id='owner-upload-v2';
  SELECT o.* INTO existing FROM public.scoring_v7_source_observations o WHERE o.source_id=v_source_id AND o.upload_digest=p_digest;
  IF existing.id IS NOT NULL THEN
    IF existing.payload IS DISTINCT FROM p_value THEN RAISE EXCEPTION 'Supplemental digest collision' USING ERRCODE='22023'; END IF;
    RETURN jsonb_build_object('uploadId',existing.id,'uploadedAt',existing.recorded_at,'value',existing.payload);
  END IF;
  -- Event identity matches the shared event key: repository, actor, kind, eventId
  -- within this stable source. Only immutable work/date/revision facts conflict.
  -- Optional diagnostic/acceptance observations remain mergeable (including unknown).
  -- The owner lock serializes validation and insertion across concurrent uploads.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_value->'events') e
    GROUP BY e->>'repositoryId',e->>'actorId',e->>'kind',e->>'eventId'
    HAVING count(DISTINCT jsonb_build_array(e->>'workItemId',(e->>'occurredAt')::timestamptz,e->>'artifactRevision'))>1
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_value->'events') incoming
    JOIN (
      SELECT old_event.value AS event FROM public.scoring_v7_source_observations observation
      CROSS JOIN LATERAL jsonb_array_elements(observation.payload->'events') old_event
      WHERE observation.source_id=v_source_id AND observation.owner_handle=p_owner AND observation.upload_digest IS NOT NULL
    ) prior ON prior.event->>'repositoryId'=incoming->>'repositoryId' AND prior.event->>'actorId'=incoming->>'actorId'
      AND prior.event->>'kind'=incoming->>'kind' AND prior.event->>'eventId'=incoming->>'eventId'
    WHERE jsonb_build_array(prior.event->>'workItemId',(prior.event->>'occurredAt')::timestamptz,prior.event->>'artifactRevision')
      IS DISTINCT FROM jsonb_build_array(incoming->>'workItemId',(incoming->>'occurredAt')::timestamptz,incoming->>'artifactRevision')
  ) THEN
    RAISE EXCEPTION 'Conflicting immutable supplemental event' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.scoring_v7_source_observations(id,source_id,owner_handle,reference_time,window_start,window_end,data_through,coverage,payload,recorded_at,upload_digest)
    VALUES(p_upload,v_source_id,p_owner,received,(date_trunc('day',received AT TIME ZONE 'UTC')-interval '364 days') AT TIME ZONE 'UTC',
      (date_trunc('day',received AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC',through_time,
      jsonb_build_object('status','partial','provenance','self_reported','reasonCodes',jsonb_build_array('attribution_unknown','alias_unresolved','not_assessed')),p_value,received,p_digest);
  RETURN jsonb_build_object('uploadId',p_upload,'uploadedAt',received,'value',p_value);
END;
$$;

CREATE FUNCTION public.scoring_v7_supplemental_manifest(p_owner text,p_actor text,p_reference timestamptz,p_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_owner IS NULL OR p_actor IS DISTINCT FROM p_owner THEN RAISE EXCEPTION 'Supplemental owner access denied' USING ERRCODE='42501'; END IF;
  IF p_reference IS NULL OR NOT isfinite(p_reference) OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1001 THEN RAISE EXCEPTION 'Invalid supplemental manifest request' USING ERRCODE='22023'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('uploadId',o.id,'uploadedAt',o.recorded_at) ORDER BY o.id),'[]') FROM
    (SELECT id,recorded_at FROM public.scoring_v7_source_observations WHERE owner_handle=p_owner AND upload_digest IS NOT NULL AND recorded_at<=p_reference ORDER BY id LIMIT p_limit) o);
END;
$$;
CREATE FUNCTION public.scoring_v7_read_supplemental(p_owner text,p_actor text,p_upload_ids uuid[],p_reference timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_owner IS NULL OR p_actor IS DISTINCT FROM p_owner THEN RAISE EXCEPTION 'Supplemental owner access denied' USING ERRCODE='42501'; END IF;
  IF p_reference IS NULL OR NOT isfinite(p_reference) OR p_upload_ids IS NULL OR cardinality(p_upload_ids)>1000 THEN RAISE EXCEPTION 'Invalid supplemental payload request' USING ERRCODE='22023'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('uploadId',o.id,'uploadedAt',o.recorded_at,'value',o.payload) ORDER BY o.id),'[]')
    FROM public.scoring_v7_source_observations o WHERE o.owner_handle=p_owner AND o.upload_digest IS NOT NULL AND o.id=ANY(p_upload_ids) AND o.recorded_at<=p_reference);
END;
$$;
REVOKE ALL ON FUNCTION public.scoring_v7_store_supplemental(text,text,uuid,text,jsonb),public.scoring_v7_supplemental_manifest(text,text,timestamptz,integer),public.scoring_v7_read_supplemental(text,text,uuid[],timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_store_supplemental(text,text,uuid,text,jsonb),public.scoring_v7_supplemental_manifest(text,text,timestamptz,integer),public.scoring_v7_read_supplemental(text,text,uuid[],timestamptz) TO service_role;
