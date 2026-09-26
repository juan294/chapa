-- Phase 5: raise only the row-generation writer cap. Legacy JSONB payloads
-- and legacy-to-row import remain bounded at 50,000 events. Migration 062
-- already lifted the generation CHECK and paged read bound to 100,000.

CREATE OR REPLACE FUNCTION public.scoring_collection_valid_stop(p_stop jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_stop IS NULL OR (
    jsonb_typeof(p_stop) = 'object'
    AND p_stop - ARRAY['provider','operation','stopKind','httpStatus','retryAfterSeconds'] = '{}'::jsonb
    AND p_stop->>'provider' IN ('github','bitbucket','gitlab','codeberg')
    AND jsonb_typeof(p_stop->'operation') = 'string'
    AND p_stop->>'stopKind' IN ('budget','deadline','rate_limited','http','graphql','network','protocol','parse','not_accessible','storage')
  )
$$;
REVOKE ALL ON FUNCTION public.scoring_collection_valid_stop(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_collection_valid_stop(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.scoring_collection_checkpoint_v2(
  p_job_id uuid, p_lease_token uuid, p_checkpoint jsonb,
  p_event_keys text[], p_events jsonb[], p_progress jsonb, p_release boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE job public.scoring_collection_jobs%ROWTYPE;
  generation public.scoring_collection_generations%ROWTYPE;
  incoming record; source_identity jsonb; event_window jsonb;
  next_cursor text; imported integer := 0; remaining integer;
  new_count integer; inserted integer;
BEGIN
  SELECT * INTO job FROM public.scoring_collection_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR job.lease_token IS DISTINCT FROM p_lease_token
    OR job.state <> 'running' OR job.lease_expires_at < now() THEN
    RETURN jsonb_build_object('status','lease_mismatch');
  END IF;
  IF coalesce(array_length(p_event_keys,1),0) <> coalesce(array_length(p_events,1),0)
    THEN RAISE EXCEPTION 'Event key/value length mismatch'; END IF;
  IF NOT public.scoring_collection_valid_checkpoint(p_checkpoint)
    OR NOT public.scoring_collection_valid_progress(p_progress)
    OR p_release IS NULL THEN RAISE EXCEPTION 'Invalid collection checkpoint'; END IF;

  IF job.current_generation_id IS NULL THEN
    INSERT INTO public.scoring_collection_generations(owner_handle,job_id)
    VALUES(job.owner_handle,job.id) RETURNING * INTO generation;
    UPDATE public.scoring_collection_jobs SET current_generation_id = generation.id
      WHERE id = job.id;
  ELSE
    SELECT * INTO generation FROM public.scoring_collection_generations
      WHERE id = job.current_generation_id AND owner_handle = job.owner_handle
        AND job_id = job.id FOR UPDATE;
    IF NOT FOUND OR generation.published_at IS NOT NULL
      THEN RAISE EXCEPTION 'Current generation is unavailable'; END IF;
  END IF;

  IF generation.legacy_total IS NULL THEN
    SELECT count(*) INTO generation.legacy_total FROM public.scoring_collection_staged_events
      WHERE job_id = job.id;
    IF generation.legacy_total > 50000 THEN
      RAISE EXCEPTION 'Legacy staged event limit exceeded';
    END IF;
    UPDATE public.scoring_collection_generations
      SET legacy_total = generation.legacy_total,
        legacy_import_done = generation.legacy_total = 0
      WHERE id = generation.id;
    generation.legacy_import_done := generation.legacy_total = 0;
  END IF;

  -- Import one ordered page per RPC. Incoming v2 events are deliberately
  -- ignored until import reaches zero; the caller then sends that batch once.
  IF NOT generation.legacy_import_done THEN
    event_window := jsonb_build_object(
      'referenceTime',job.reference_time,
      'startInclusive',(date_trunc('day',job.reference_time AT TIME ZONE 'UTC') - interval '364 days') AT TIME ZONE 'UTC',
      'endExclusive',(date_trunc('day',job.reference_time AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC');
    FOR incoming IN
      SELECT event_key,event FROM public.scoring_collection_staged_events
      WHERE job_id = job.id AND (generation.legacy_cursor IS NULL OR event_key > generation.legacy_cursor)
      ORDER BY event_key LIMIT 2000
    LOOP
      source_identity := jsonb_build_object('provider',incoming.event->>'provider',
        'host',incoming.event->>'host','subjectId',incoming.event->>'subjectId');
      IF incoming.event->>'provider' IS DISTINCT FROM job.provider
        OR coalesce(length(incoming.event->>'host'),0) NOT BETWEEN 1 AND 1024
        OR coalesce(length(incoming.event->>'subjectId'),0) NOT BETWEEN 1 AND 1024
        OR incoming.event->>'host' ~ '[[:cntrl:]]'
        OR incoming.event->>'subjectId' ~ '[[:cntrl:]]'
        THEN RAISE EXCEPTION 'Invalid legacy source identity'; END IF;
      IF generation.provider IS NOT NULL
        AND (generation.provider, generation.host, generation.subject_id)
          IS DISTINCT FROM (incoming.event->>'provider',incoming.event->>'host',incoming.event->>'subjectId')
        THEN RAISE EXCEPTION 'Mixed source identities in generation'; END IF;
      IF generation.provider IS NULL THEN
        generation.provider := incoming.event->>'provider';
        generation.host := incoming.event->>'host';
        generation.subject_id := incoming.event->>'subjectId';
      END IF;
      PERFORM public.scoring_v7_validate_source_event(incoming.event,source_identity,event_window);
      IF incoming.event_key IS DISTINCT FROM public.scoring_collection_event_key(incoming.event)
        THEN RAISE EXCEPTION 'Legacy event key does not match canonical event'; END IF;
      INSERT INTO public.scoring_collection_generation_events(generation_id,event_key,repository_id,event)
        VALUES(generation.id,incoming.event_key,incoming.event->>'repositoryId',incoming.event);
      imported := imported + 1;
      next_cursor := incoming.event_key;
    END LOOP;
    generation.event_count := generation.event_count + imported;
    generation.legacy_cursor := coalesce(next_cursor,generation.legacy_cursor);
    remaining := generation.legacy_total - generation.event_count;
    IF remaining < 0 THEN RAISE EXCEPTION 'Legacy import count mismatch'; END IF;
    IF remaining = 0 AND (SELECT count(*) FROM public.scoring_collection_staged_events
        WHERE job_id = job.id) <> generation.event_count THEN
      RAISE EXCEPTION 'Legacy import key/count mismatch';
    END IF;
    UPDATE public.scoring_collection_generations SET
      provider = generation.provider,host = generation.host,subject_id = generation.subject_id,
      event_count = generation.event_count,legacy_cursor = generation.legacy_cursor,
      legacy_import_done = remaining = 0
      WHERE id = generation.id;
    UPDATE public.scoring_collection_jobs SET lease_expires_at = now() + interval '120 seconds',
      updated_at = now() WHERE id = job.id;
    RETURN jsonb_build_object('status','importing','importedCount',generation.event_count,
      'remainingCount',remaining);
  END IF;

  event_window := jsonb_build_object(
    'referenceTime',job.reference_time,
    'startInclusive',(date_trunc('day',job.reference_time AT TIME ZONE 'UTC') - interval '364 days') AT TIME ZONE 'UTC',
    'endExclusive',(date_trunc('day',job.reference_time AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC');
  FOR incoming IN
    SELECT event_key,event FROM unnest(coalesce(p_event_keys,ARRAY[]::text[]),
      coalesce(p_events,ARRAY[]::jsonb[])) AS t(event_key,event)
  LOOP
    source_identity := jsonb_build_object('provider',incoming.event->>'provider',
      'host',incoming.event->>'host','subjectId',incoming.event->>'subjectId');
    IF incoming.event->>'provider' IS DISTINCT FROM job.provider
      OR coalesce(length(incoming.event->>'host'),0) NOT BETWEEN 1 AND 1024
      OR coalesce(length(incoming.event->>'subjectId'),0) NOT BETWEEN 1 AND 1024
      OR incoming.event->>'host' ~ '[[:cntrl:]]'
      OR incoming.event->>'subjectId' ~ '[[:cntrl:]]'
      THEN RAISE EXCEPTION 'Invalid source identity'; END IF;
    IF generation.provider IS NOT NULL
      AND (generation.provider, generation.host, generation.subject_id)
        IS DISTINCT FROM (incoming.event->>'provider',incoming.event->>'host',incoming.event->>'subjectId')
      THEN RAISE EXCEPTION 'Mixed source identities in generation'; END IF;
    IF generation.provider IS NULL THEN
      generation.provider := incoming.event->>'provider';
      generation.host := incoming.event->>'host';
      generation.subject_id := incoming.event->>'subjectId';
    END IF;
    PERFORM public.scoring_v7_validate_source_event(incoming.event,source_identity,event_window);
    IF incoming.event_key IS NULL
      OR incoming.event_key IS DISTINCT FROM public.scoring_collection_event_key(incoming.event)
      THEN RAISE EXCEPTION 'Event key does not match canonical event'; END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(p_event_keys,ARRAY[]::text[]),
      coalesce(p_events,ARRAY[]::jsonb[])) AS t(event_key,event)
    GROUP BY event_key HAVING count(DISTINCT event) > 1
  ) THEN RAISE EXCEPTION 'Conflicting event content within batch'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(p_event_keys,ARRAY[]::text[]),
      coalesce(p_events,ARRAY[]::jsonb[])) AS t(event_key,event)
    JOIN public.scoring_collection_generation_events stored
      ON stored.generation_id = generation.id AND stored.event_key = t.event_key
    WHERE stored.event IS DISTINCT FROM t.event
  ) THEN RAISE EXCEPTION 'Conflicting staged event content for job %',job.id; END IF;
  SELECT count(*) INTO new_count FROM (
    SELECT DISTINCT event_key FROM unnest(coalesce(p_event_keys,ARRAY[]::text[])) AS t(event_key)
  ) pending_keys LEFT JOIN public.scoring_collection_generation_events stored
    ON stored.generation_id = generation.id AND stored.event_key = pending_keys.event_key
    WHERE stored.event_key IS NULL;
  IF generation.event_count + new_count > 100000 THEN
    UPDATE public.scoring_collection_jobs SET
      state = 'failed',
      last_stop = jsonb_build_object('provider',job.provider,'operation','event_limit',
        'stopKind','protocol','httpStatus',NULL,'retryAfterSeconds',NULL),
      progress = jsonb_set(coalesce(p_progress,job.progress),'{events}',to_jsonb(generation.event_count)),
      lease_token = NULL,lease_expires_at = NULL,updated_at = now()
      WHERE id = job.id;
    RETURN jsonb_build_object('status','event_limit','stagedCount',generation.event_count);
  END IF;
  INSERT INTO public.scoring_collection_generation_events(generation_id,event_key,repository_id,event)
    SELECT DISTINCT ON (event_key) generation.id,event_key,event->>'repositoryId',event
    FROM unnest(coalesce(p_event_keys,ARRAY[]::text[]),coalesce(p_events,ARRAY[]::jsonb[]))
      AS t(event_key,event) ORDER BY event_key
    ON CONFLICT (generation_id,event_key) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  generation.event_count := generation.event_count + inserted;
  UPDATE public.scoring_collection_generations SET
    provider = generation.provider,host = generation.host,subject_id = generation.subject_id,
    event_count = generation.event_count WHERE id = generation.id;
  IF p_release THEN
    UPDATE public.scoring_collection_jobs SET checkpoint = p_checkpoint,progress = p_progress,
      attempt = CASE WHEN (p_progress->>'operationsDone')::integer >
        coalesce((progress->>'operationsDone')::integer,0) THEN 0 ELSE attempt END,
      state = 'queued',next_run_at = now(),lease_token = NULL,lease_expires_at = NULL,
      updated_at = now() WHERE id = job.id;
  ELSE
    UPDATE public.scoring_collection_jobs SET checkpoint = p_checkpoint,progress = p_progress,
      attempt = CASE WHEN (p_progress->>'operationsDone')::integer >
        coalesce((progress->>'operationsDone')::integer,0) THEN 0 ELSE attempt END,
      lease_expires_at = now() + interval '120 seconds',updated_at = now() WHERE id = job.id;
  END IF;
  RETURN jsonb_build_object('status','ok','stagedCount',generation.event_count);
END $$;

CREATE OR REPLACE FUNCTION public.scoring_collection_finish_v2(
  p_job_id uuid, p_lease_token uuid, p_coverage jsonb, p_observation uuid,
  p_requested jsonb, p_access text, p_scope jsonb, p_link_id uuid, p_link_version timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner text; job public.scoring_collection_jobs%ROWTYPE;
  generation public.scoring_collection_generations%ROWTYPE;
  source_identity jsonb; source_id uuid; actual_count integer;
BEGIN
  -- Match enqueue's subject -> job lock order, including link-version checks.
  SELECT owner_handle INTO owner FROM public.scoring_collection_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','lease_mismatch'); END IF;
  PERFORM public.scoring_v7_lock_source_context(
    owner,owner,p_requested,p_access,p_scope,p_link_id,p_link_version);
  SELECT * INTO job FROM public.scoring_collection_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR job.owner_handle IS DISTINCT FROM owner
    OR job.lease_token IS DISTINCT FROM p_lease_token OR job.state <> 'running'
    OR job.lease_expires_at < now() THEN
    RETURN jsonb_build_object('status','lease_mismatch');
  END IF;
  IF job.current_generation_id IS NULL THEN
    RAISE EXCEPTION 'Generation checkpoint required before finish';
  END IF;
  SELECT * INTO generation FROM public.scoring_collection_generations
    WHERE id = job.current_generation_id AND owner_handle = owner AND job_id = job.id
    FOR UPDATE;
  IF NOT FOUND OR generation.published_at IS NOT NULL OR NOT generation.legacy_import_done
    THEN RAISE EXCEPTION 'Current generation is not ready'; END IF;
  IF p_observation IS NULL THEN RAISE EXCEPTION 'Observation identity required'; END IF;
  source_identity := p_coverage->'source';
  IF p_requested->>'provider' IS DISTINCT FROM job.provider
    OR source_identity->>'provider' IS DISTINCT FROM job.provider
    OR source_identity->>'host' IS DISTINCT FROM p_requested->>'host'
    OR coalesce(length(source_identity->>'subjectId'),0) = 0
    THEN RAISE EXCEPTION 'Canonical source identity required'; END IF;
  IF generation.provider IS NOT NULL
    AND (generation.provider,generation.host,generation.subject_id)
      IS DISTINCT FROM (source_identity->>'provider',source_identity->>'host',source_identity->>'subjectId')
    THEN RAISE EXCEPTION 'Generation source identity conflict'; END IF;
  IF (p_coverage->'window'->>'referenceTime')::timestamptz IS DISTINCT FROM job.reference_time
    THEN RAISE EXCEPTION 'Generation reference time conflict'; END IF;
  -- The existing validator checks source, window, scope, and coverage. The
  -- event validator already ran on each bounded checkpoint/import page.
  PERFORM public.scoring_v7_validate_source_value(
    source_identity,p_scope,p_coverage->'window',p_coverage,
    jsonb_build_object('events','[]'::jsonb));
  SELECT count(*) INTO actual_count FROM public.scoring_collection_generation_events
    WHERE generation_id = generation.id;
  IF actual_count IS DISTINCT FROM generation.event_count OR actual_count > 100000
    THEN RAISE EXCEPTION 'Generation event count conflict'; END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT DISTINCT repository_id FROM public.scoring_collection_generation_events
      WHERE generation_id = generation.id
    ) repositories
    WHERE NOT (p_coverage->'repositoryIds' @> jsonb_build_array(repository_id))
      OR (p_scope->>'discovery' = 'explicit_repositories'
        AND NOT (p_scope->'repositoryIds' @> jsonb_build_array(repository_id)))
  ) THEN RAISE EXCEPTION 'Event repository outside recorded scope'; END IF;

  INSERT INTO public.scoring_v7_sources(
    owner_handle,provider,host,subject_id,access_context_id,declared_scope)
  VALUES(owner,source_identity->>'provider',source_identity->>'host',
    source_identity->>'subjectId',p_access,p_scope)
  ON CONFLICT(owner_handle,provider,host,subject_id,access_context_id) DO NOTHING;
  SELECT id INTO source_id FROM public.scoring_v7_sources
    WHERE owner_handle = owner AND provider = source_identity->>'provider'
      AND host = source_identity->>'host' AND subject_id = source_identity->>'subjectId'
      AND access_context_id = p_access AND declared_scope = p_scope;
  IF source_id IS NULL THEN RAISE EXCEPTION 'Source context conflict'; END IF;
  IF EXISTS (SELECT 1 FROM public.scoring_v7_source_observations WHERE id = p_observation)
    THEN RAISE EXCEPTION 'Observation identity conflict'; END IF;
  INSERT INTO public.scoring_v7_source_observations(
    id,owner_handle,source_id,reference_time,window_start,window_end,
    data_through,coverage,payload,event_storage_mode,event_generation_id)
  VALUES(p_observation,owner,source_id,
    (p_coverage->'window'->>'referenceTime')::timestamptz,
    (p_coverage->'window'->>'startInclusive')::timestamptz,
    (p_coverage->'window'->>'endExclusive')::timestamptz,
    (p_coverage->>'dataThrough')::timestamptz,p_coverage,
    jsonb_build_object('eventStorage','generation'),'rows',generation.id);
  UPDATE public.scoring_collection_generations SET
    provider = source_identity->>'provider',host = source_identity->>'host',
    subject_id = source_identity->>'subjectId',published_at = now()
    WHERE id = generation.id;
  UPDATE public.scoring_collection_jobs SET
    state = 'complete',observation_id = p_observation,checkpoint = '{}'::jsonb,
    last_stop = NULL,lease_token = NULL,lease_expires_at = NULL,updated_at = now()
    WHERE id = job.id;
  RETURN jsonb_build_object('status','ok','observationId',p_observation,
    'eventCount',actual_count);
END $$;

REVOKE ALL ON FUNCTION
  public.scoring_collection_checkpoint_v2(uuid,uuid,jsonb,text[],jsonb[],jsonb,boolean),
  public.scoring_collection_finish_v2(uuid,uuid,jsonb,uuid,jsonb,text,jsonb,uuid,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.scoring_collection_checkpoint_v2(uuid,uuid,jsonb,text[],jsonb[],jsonb,boolean),
  public.scoring_collection_finish_v2(uuid,uuid,jsonb,uuid,jsonb,text,jsonb,uuid,timestamptz)
  TO service_role;

-- Keep terminal capacity failures visible to owners until an operator takes
-- explicit action. Existing transient retry and same-day refresh rules remain.
CREATE OR REPLACE FUNCTION public.scoring_collection_enqueue(
  p_owner text, p_provider text, p_reason text, p_reference_time timestamptz
) RETURNS public.scoring_collection_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d date; existing public.scoring_collection_jobs;
  result public.scoring_collection_jobs; next_generation uuid;
BEGIN
  IF p_owner IS NULL OR p_owner <> lower(btrim(p_owner)) OR length(p_owner) = 0
    OR p_provider IS NULL OR p_provider NOT IN ('github','bitbucket','gitlab','codeberg')
    OR p_reason IS NULL OR p_reason NOT IN ('signup','refresh','daily','reconnect','admin','retry')
    OR p_reference_time IS NULL OR NOT isfinite(p_reference_time)
    THEN RAISE EXCEPTION 'Invalid collection enqueue request'; END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle = p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registered subject required'; END IF;
  d := (p_reference_time AT TIME ZONE 'UTC')::date;
  SELECT * INTO existing FROM public.scoring_collection_jobs
    WHERE owner_handle = p_owner AND provider = p_provider AND reference_date = d FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.scoring_collection_jobs(
      owner_handle,provider,reference_date,reference_time,enqueue_reason)
    VALUES(p_owner,p_provider,d,p_reference_time,p_reason) RETURNING * INTO result;
    RETURN result;
  END IF;
  -- Capacity failures are terminal at this cap. Only the service-only admin
  -- reason may explicitly reset them after an operator reviews capacity.
  IF existing.state = 'failed' AND existing.last_stop->>'operation' = 'event_limit'
    AND p_reason IN ('retry','reconnect','refresh') THEN RETURN existing; END IF;
  IF existing.state = 'failed' AND p_reason = 'retry'
    AND existing.last_stop->>'stopKind' IN ('http','network','deadline','budget','storage') THEN
    UPDATE public.scoring_collection_jobs SET
      state = 'queued',attempt = 0,next_run_at = now(),lease_token = NULL,
      lease_expires_at = NULL,last_stop = NULL,enqueue_reason = p_reason,updated_at = now()
    WHERE id = existing.id RETURNING * INTO result;
    RETURN result;
  END IF;
  IF (existing.state = 'failed' AND p_reason IN ('retry','reconnect','refresh'))
    OR (existing.state = 'failed' AND p_reason = 'admin'
      AND existing.last_stop->>'operation' = 'event_limit')
    OR (existing.state = 'complete' AND p_reason = 'refresh') THEN
    DELETE FROM public.scoring_collection_staged_events WHERE job_id = existing.id;
    INSERT INTO public.scoring_collection_generations(owner_handle,job_id)
      VALUES(p_owner,existing.id) RETURNING id INTO next_generation;
    UPDATE public.scoring_collection_jobs SET
      state = 'queued',attempt = 0,checkpoint = '{}'::jsonb,progress = '{}'::jsonb,
      next_run_at = now(),lease_token = NULL,lease_expires_at = NULL,last_stop = NULL,
      enqueue_reason = p_reason,observation_id = NULL,
      current_generation_id = next_generation,updated_at = now()
    WHERE id = existing.id RETURNING * INTO result;
    RETURN result;
  END IF;
  RETURN existing;
END $$;

REVOKE ALL ON FUNCTION public.scoring_collection_enqueue(text,text,text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_collection_enqueue(text,text,text,timestamptz)
  TO service_role;
