-- Phase 2: bounded collection writes and immutable, generation-backed observations.
-- Old workers retain the legacy RPCs for jobs that have not entered row mode.

CREATE TABLE public.scoring_collection_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_handle text NOT NULL REFERENCES public.scoring_v7_subjects(owner_handle) ON DELETE CASCADE,
  job_id uuid REFERENCES public.scoring_collection_jobs(id) ON DELETE SET NULL,
  provider text,
  host text,
  subject_id text,
  event_count integer NOT NULL DEFAULT 0 CHECK (event_count BETWEEN 0 AND 50000),
  legacy_total integer,
  legacy_cursor text,
  legacy_import_done boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_handle, id),
  CHECK ((provider IS NULL AND host IS NULL AND subject_id IS NULL)
    OR (provider IS NOT NULL AND host IS NOT NULL AND subject_id IS NOT NULL)),
  CHECK (legacy_total IS NULL OR legacy_total BETWEEN 0 AND 50000)
);
CREATE INDEX scoring_collection_generations_job ON public.scoring_collection_generations(job_id);

CREATE TABLE public.scoring_collection_generation_events (
  generation_id uuid NOT NULL REFERENCES public.scoring_collection_generations(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  repository_id text NOT NULL,
  event jsonb NOT NULL,
  PRIMARY KEY (generation_id, event_key)
);
CREATE INDEX scoring_collection_generation_repository
  ON public.scoring_collection_generation_events(generation_id, repository_id);

ALTER TABLE public.scoring_collection_jobs ADD COLUMN current_generation_id uuid;
ALTER TABLE public.scoring_collection_jobs
  ADD CONSTRAINT scoring_collection_jobs_current_generation_fk
  FOREIGN KEY (owner_handle, current_generation_id)
  REFERENCES public.scoring_collection_generations(owner_handle, id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.scoring_v7_source_observations
  ADD COLUMN event_storage_mode text NOT NULL DEFAULT 'jsonb'
    CHECK (event_storage_mode IN ('jsonb','rows')),
  ADD COLUMN event_generation_id uuid,
  ADD CONSTRAINT scoring_v7_observation_storage_ck CHECK (
    (event_storage_mode = 'jsonb' AND event_generation_id IS NULL)
    OR (event_storage_mode = 'rows' AND event_generation_id IS NOT NULL)
  ),
  ADD CONSTRAINT scoring_v7_observation_generation_fk
    FOREIGN KEY (owner_handle, event_generation_id)
    REFERENCES public.scoring_collection_generations(owner_handle, id)
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT scoring_v7_observation_generation_unique UNIQUE (event_generation_id);

ALTER TABLE public.scoring_collection_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_collection_generations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_collection_generation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_collection_generation_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.scoring_collection_generations, public.scoring_collection_generation_events FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.scoring_collection_generations,
  public.scoring_collection_generation_events FROM service_role;
GRANT SELECT ON public.scoring_collection_generations,
  public.scoring_collection_generation_events TO service_role;

-- This key uses the same nested JSON.stringify shape as engineeringEventKey:
-- JSON.stringify([JSON.stringify([provider, lower(host), repositoryId]), actorId, kind, eventId]).
CREATE FUNCTION public.scoring_collection_event_key(p_event jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT '[' || to_json(
    '[' || to_json(p_event->>'provider')::text || ',' ||
    to_json(lower(p_event->>'host'))::text || ',' ||
    to_json(p_event->>'repositoryId')::text || ']'
  )::text || ',' || to_json(p_event->>'actorId')::text || ',' ||
  to_json(p_event->>'kind')::text || ',' || to_json(p_event->>'eventId')::text || ']'
$$;

-- Event checks extracted from 057. Coverage repository membership remains at
-- finish, because a checkpoint has no final coverage document.
CREATE FUNCTION public.scoring_v7_validate_source_event(
  p_event jsonb, p_source jsonb, p_window jsonb
) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE e jsonb := p_event; m jsonb; c jsonb; field text;
  ref timestamptz; start_at timestamptz;
BEGIN
  ref := (p_window->>'referenceTime')::timestamptz;
  start_at := (p_window->>'startInclusive')::timestamptz;
  IF jsonb_typeof(e) IS DISTINCT FROM 'object' OR
    e - ARRAY['provider','host','subjectId','repositoryId','actorId','eventId','schemaVersion','kind','occurredAt','dataThrough','canonicalProjectId','workItemId','artifactRevision','artifactReferenceIds','attribution','provenance','coverage','measurements','categories','acceptance'] <> '{}'::jsonb
    OR e->>'schemaVersion' IS DISTINCT FROM 'v7'
    OR e->>'provider' IS DISTINCT FROM p_source->>'provider'
    OR e->>'host' IS DISTINCT FROM p_source->>'host'
    OR e->>'subjectId' IS DISTINCT FROM p_source->>'subjectId'
    OR NOT public.scoring_v7_source_instant(e->'occurredAt')
    OR NOT public.scoring_v7_source_instant(e->'dataThrough')
    OR NOT isfinite((e->>'occurredAt')::timestamptz)
    OR NOT isfinite((e->>'dataThrough')::timestamptz)
    OR (e->>'occurredAt')::timestamptz < start_at
    OR (e->>'occurredAt')::timestamptz > ref
    OR (e->>'occurredAt')::timestamptz > (e->>'dataThrough')::timestamptz
    OR (e->>'dataThrough')::timestamptz > ref
    OR jsonb_typeof(e->'measurements') IS DISTINCT FROM 'object'
    OR (e->'measurements') - ARRAY['changedFiles','additions','deletions','leadTimeHours','hasDescription','hasIssueLink','usesFeatureBranch'] <> '{}'::jsonb
    OR jsonb_typeof(e->'categories') IS DISTINCT FROM 'array'
    OR jsonb_array_length(e->'categories') > 4 THEN
    RAISE EXCEPTION 'Invalid normalized source event';
  END IF;
  FOREACH field IN ARRAY ARRAY['repositoryId','actorId','eventId','canonicalProjectId','workItemId','artifactRevision'] LOOP
    IF jsonb_typeof(e->field) IS DISTINCT FROM 'string'
      OR coalesce(length(e->>field),0) NOT BETWEEN 1 AND 1024
      OR e->>field ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Invalid event identity'; END IF;
  END LOOP;
  IF e->>'kind' IS NULL OR e->>'kind' NOT IN ('accepted_change','authored_commit','review','issue_work','documentation_design','maintenance','practice_evidence')
    OR e->>'attribution' IS NULL OR e->>'attribution' NOT IN ('individual','team_participation','unclear')
    OR e->>'provenance' IS NULL OR e->>'provenance' NOT IN ('source_observed','self_reported','automated_assessment','human_assessed','independently_corroborated')
    OR e->>'coverage' IS NULL OR e->>'coverage' NOT IN ('complete','partial','unavailable','stale','legacy')
    OR NOT public.scoring_v7_source_strings(e->'artifactReferenceIds',1000) THEN
    RAISE EXCEPTION 'Invalid event metadata';
  END IF;
  FOREACH field IN ARRAY ARRAY['changedFiles','additions','deletions','leadTimeHours','hasDescription','hasIssueLink','usesFeatureBranch'] LOOP
    IF NOT coalesce(public.scoring_v7_source_observation_valid(e->'measurements'->field,field),false)
      THEN RAISE EXCEPTION 'Invalid measurement'; END IF;
  END LOOP;
  IF NOT coalesce(public.scoring_v7_source_observation_valid(e->'acceptance','acceptance'),false)
    THEN RAISE EXCEPTION 'Invalid acceptance'; END IF;
  IF e->'acceptance'->>'status'='observed' THEN
    IF (e->'acceptance'->'value'->>'acceptedAt')::timestamptz > (e->>'dataThrough')::timestamptz
      OR (e->'acceptance'->'value'->>'acceptedAt')::timestamptz > ref
      OR (e->>'kind'='accepted_change' AND
        (e->'acceptance'->'value'->>'acceptedAt')::timestamptz IS DISTINCT FROM (e->>'occurredAt')::timestamptz)
      THEN RAISE EXCEPTION 'Invalid acceptance event time'; END IF;
  END IF;
  FOR c IN SELECT value FROM jsonb_array_elements(e->'categories') LOOP
    IF jsonb_typeof(c) IS DISTINCT FROM 'object'
      OR c - ARRAY['category','evidenceReferenceIds'] <> '{}'::jsonb
      OR c->>'category' IS NULL
      OR c->>'category' NOT IN ('implementation','verification_review','documentation_design','maintenance_support')
      OR NOT public.scoring_v7_source_strings(c->'evidenceReferenceIds',1000)
      THEN RAISE EXCEPTION 'Invalid normalized category'; END IF;
  END LOOP;
  FOR m IN SELECT value FROM jsonb_each(e->'measurements') UNION ALL SELECT e->'acceptance' LOOP
    IF jsonb_typeof(m) IS DISTINCT FROM 'object'
      OR m - ARRAY['status','value','coverage','provenance','reasonCode'] <> '{}'::jsonb
      OR m->>'status' IS NULL OR m->>'status' NOT IN ('observed','unknown')
      THEN RAISE EXCEPTION 'Invalid normalized observation'; END IF;
  END LOOP;
  IF e->'acceptance'->>'status'='observed'
    AND (jsonb_typeof(e->'acceptance'->'value') IS DISTINCT FROM 'object'
      OR (e->'acceptance'->'value') - ARRAY['method','acceptedAt','acceptedResultId'] <> '{}'::jsonb)
    THEN RAISE EXCEPTION 'Invalid normalized acceptance'; END IF;
END $$;

-- The legacy append validator retains its coverage checks and delegates event
-- checks to the bounded checkpoint validator.
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
   PERFORM public.scoring_v7_validate_source_event(e,p_source,p_window);
   IF NOT ((p_coverage->'repositoryIds') @> jsonb_build_array(e->>'repositoryId'))
     OR (p_scope->>'discovery'='explicit_repositories'
       AND NOT ((p_scope->'repositoryIds') @> jsonb_build_array(e->>'repositoryId')))
     THEN RAISE EXCEPTION 'Event repository outside recorded scope'; END IF;
 END LOOP;
END $$;

-- Once published, event rows cannot be changed by a direct table operation.
-- Cascading deletion from the subject is allowed for withdrawal/user deletion.
CREATE FUNCTION public.scoring_collection_protect_events() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM public.scoring_collection_generations
      WHERE id = NEW.generation_id AND published_at IS NOT NULL)
      THEN RAISE EXCEPTION 'Published generation events are immutable'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Generation events are immutable'; END IF;
  IF pg_trigger_depth() <= 1 AND EXISTS (
    SELECT 1 FROM public.scoring_collection_generations
    WHERE id = OLD.generation_id AND published_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'Published generation events are immutable'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER scoring_collection_protect_events
  BEFORE INSERT OR UPDATE OR DELETE ON public.scoring_collection_generation_events
  FOR EACH ROW EXECUTE FUNCTION public.scoring_collection_protect_events();

-- Legacy jobs remain visible to old workers until a v2 checkpoint creates a
-- generation. New workers may claim either kind of job.
CREATE OR REPLACE FUNCTION public.scoring_collection_claim(p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.scoring_collection_jobs
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH candidates AS (
    SELECT id FROM public.scoring_collection_jobs
    WHERE p_limit IS NOT NULL AND p_limit > 0
      AND p_lease_seconds IS NOT NULL AND p_lease_seconds > 0
      AND current_generation_id IS NULL
      AND ((state IN ('queued','waiting_rate_limit','retrying') AND next_run_at <= now())
        OR (state = 'running' AND lease_expires_at < now()))
    ORDER BY next_run_at
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.scoring_collection_jobs AS jobs
    SET state = 'running', lease_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds), updated_at = now()
    FROM candidates WHERE jobs.id = candidates.id RETURNING jobs.*
  )
  SELECT * FROM claimed ORDER BY next_run_at;
$$;

CREATE FUNCTION public.scoring_collection_claim_v2(p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.scoring_collection_jobs
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH candidates AS (
    SELECT id FROM public.scoring_collection_jobs
    WHERE p_limit IS NOT NULL AND p_limit > 0
      AND p_lease_seconds IS NOT NULL AND p_lease_seconds > 0
      AND ((state IN ('queued','waiting_rate_limit','retrying') AND next_run_at <= now())
        OR (state = 'running' AND lease_expires_at < now()))
    ORDER BY next_run_at
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.scoring_collection_jobs AS jobs
    SET state = 'running', lease_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds), updated_at = now()
    FROM candidates WHERE jobs.id = candidates.id RETURNING jobs.*
  )
  SELECT * FROM claimed ORDER BY next_run_at;
$$;

-- Preserve the old function bodies and signatures for in-flight old workers.
ALTER FUNCTION public.scoring_collection_checkpoint(uuid,uuid,jsonb,text[],jsonb[],jsonb,boolean)
  RENAME TO scoring_collection_checkpoint_legacy_internal;
CREATE FUNCTION public.scoring_collection_checkpoint(
  p_job_id uuid, p_lease_token uuid, p_checkpoint jsonb,
  p_event_keys text[], p_events jsonb[], p_progress jsonb, p_release boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row_mode uuid;
BEGIN
  SELECT current_generation_id INTO row_mode FROM public.scoring_collection_jobs
    WHERE id = p_job_id FOR UPDATE;
  IF row_mode IS NOT NULL THEN
    RAISE EXCEPTION 'Row-mode job requires checkpoint_v2';
  END IF;
  RETURN public.scoring_collection_checkpoint_legacy_internal(
    p_job_id,p_lease_token,p_checkpoint,p_event_keys,p_events,p_progress,p_release);
END $$;

ALTER FUNCTION public.scoring_collection_finish(uuid,uuid,jsonb,uuid,jsonb,text,jsonb,uuid,timestamptz)
  RENAME TO scoring_collection_finish_legacy_internal;
CREATE FUNCTION public.scoring_collection_finish(
  p_job_id uuid, p_lease_token uuid, p_coverage jsonb, p_observation uuid,
  p_requested jsonb, p_access text, p_scope jsonb, p_link_id uuid, p_link_version timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row_mode uuid; owner text;
BEGIN
  SELECT owner_handle INTO owner FROM public.scoring_collection_jobs WHERE id = p_job_id;
  IF owner IS NULL THEN RETURN jsonb_build_object('status','lease_mismatch'); END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle = owner FOR UPDATE;
  SELECT current_generation_id INTO row_mode FROM public.scoring_collection_jobs
    WHERE id = p_job_id FOR UPDATE;
  IF row_mode IS NOT NULL THEN
    RAISE EXCEPTION 'Row-mode job requires finish_v2';
  END IF;
  RETURN public.scoring_collection_finish_legacy_internal(
    p_job_id,p_lease_token,p_coverage,p_observation,
    p_requested,p_access,p_scope,p_link_id,p_link_version);
END $$;

CREATE FUNCTION public.scoring_collection_checkpoint_v2(
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
  IF generation.event_count + new_count > 50000 THEN
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

CREATE FUNCTION public.scoring_collection_finish_v2(
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
  IF actual_count IS DISTINCT FROM generation.event_count OR actual_count > 50000
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

-- The old reader selects its winner first, then rejects row-mode observations.
-- It cannot mistake the metadata marker for a complete empty source.
CREATE OR REPLACE FUNCTION public.scoring_v7_read_source(
  p_owner text, p_actor text, p_source jsonb, p_requested jsonb, p_access text, p_scope jsonb,
  p_link_id uuid, p_link_version timestamptz, p_window jsonb, p_prior boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE selected public.scoring_v7_source_observations%ROWTYPE; result jsonb;
BEGIN
  PERFORM public.scoring_v7_lock_source_context(
    p_owner,p_actor,p_requested,p_access,p_scope,p_link_id,p_link_version);
  IF p_source->>'provider' IS DISTINCT FROM p_requested->>'provider'
    OR p_source->>'host' IS DISTINCT FROM p_requested->>'host'
    OR coalesce(length(p_source->>'subjectId'),0) = 0
    THEN RAISE EXCEPTION 'Canonical source identity required'; END IF;
  PERFORM public.scoring_v7_validate_source_window(p_window);
  IF p_prior IS NULL THEN RAISE EXCEPTION 'Source selection required'; END IF;
  SELECT o.* INTO selected
  FROM public.scoring_v7_sources s
  JOIN public.scoring_v7_source_observations o
    ON o.source_id = s.id AND o.owner_handle = s.owner_handle
  WHERE s.owner_handle = p_owner AND s.provider = p_source->>'provider'
    AND s.host = p_source->>'host' AND s.subject_id = p_source->>'subjectId'
    AND s.access_context_id = p_access AND s.declared_scope = p_scope
    AND o.reference_time = (o.coverage->'window'->>'referenceTime')::timestamptz
    AND o.window_start = (o.coverage->'window'->>'startInclusive')::timestamptz
    AND o.window_end = (o.coverage->'window'->>'endExclusive')::timestamptz
    AND o.data_through IS NOT DISTINCT FROM (o.coverage->>'dataThrough')::timestamptz
    AND ((NOT p_prior AND o.coverage->'window' = p_window)
      OR (p_prior AND o.reference_time < (p_window->>'referenceTime')::timestamptz))
  ORDER BY o.reference_time DESC,(o.coverage->>'status'='complete') DESC,
    o.recorded_at DESC,o.id DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF selected.event_storage_mode = 'rows' THEN
    RAISE EXCEPTION 'Generation observation requires v2 source reader';
  END IF;
  result := jsonb_build_object('id',selected.id,'window',selected.coverage->'window',
    'coverage',selected.coverage,'events',selected.payload->'events');
  PERFORM public.scoring_v7_validate_source_value(
    p_source,p_scope,result->'window',result->'coverage',
    jsonb_build_object('events',result->'events'));
  RETURN result;
END $$;

-- Preserve migration 058's transient retry policy. Structural reset and
-- same-day refresh get a fresh generation; the old published one remains
-- referenced by its observation.
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
  IF existing.state = 'failed' AND p_reason = 'retry'
    AND existing.last_stop->>'stopKind' IN ('http','network','deadline','budget') THEN
    UPDATE public.scoring_collection_jobs SET
      state = 'queued',attempt = 0,next_run_at = now(),lease_token = NULL,
      lease_expires_at = NULL,last_stop = NULL,enqueue_reason = p_reason,updated_at = now()
    WHERE id = existing.id RETURNING * INTO result;
    RETURN result;
  END IF;
  IF (existing.state = 'failed' AND p_reason IN ('retry','reconnect','refresh'))
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

REVOKE ALL ON FUNCTION public.scoring_collection_event_key(jsonb),
  public.scoring_v7_validate_source_event(jsonb,jsonb,jsonb),
  public.scoring_collection_protect_events(),
  public.scoring_collection_claim_v2(integer,integer),
  public.scoring_collection_checkpoint_v2(uuid,uuid,jsonb,text[],jsonb[],jsonb,boolean),
  public.scoring_collection_finish_v2(uuid,uuid,jsonb,uuid,jsonb,text,jsonb,uuid,timestamptz),
  public.scoring_collection_checkpoint_legacy_internal(uuid,uuid,jsonb,text[],jsonb[],jsonb,boolean),
  public.scoring_collection_finish_legacy_internal(uuid,uuid,jsonb,uuid,jsonb,text,jsonb,uuid,timestamptz),
  public.scoring_collection_checkpoint(uuid,uuid,jsonb,text[],jsonb[],jsonb,boolean),
  public.scoring_collection_finish(uuid,uuid,jsonb,uuid,jsonb,text,jsonb,uuid,timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION
  public.scoring_collection_event_key(jsonb),
  public.scoring_v7_validate_source_event(jsonb,jsonb,jsonb),
  public.scoring_collection_protect_events(),
  public.scoring_collection_checkpoint_legacy_internal(uuid,uuid,jsonb,text[],jsonb[],jsonb,boolean),
  public.scoring_collection_finish_legacy_internal(uuid,uuid,jsonb,uuid,jsonb,text,jsonb,uuid,timestamptz)
  FROM service_role;
GRANT EXECUTE ON FUNCTION public.scoring_collection_claim_v2(integer,integer),
  public.scoring_collection_checkpoint_v2(uuid,uuid,jsonb,text[],jsonb[],jsonb,boolean),
  public.scoring_collection_finish_v2(uuid,uuid,jsonb,uuid,jsonb,text,jsonb,uuid,timestamptz),
  public.scoring_collection_checkpoint(uuid,uuid,jsonb,text[],jsonb[],jsonb,boolean),
  public.scoring_collection_finish(uuid,uuid,jsonb,uuid,jsonb,text,jsonb,uuid,timestamptz)
  TO service_role;
