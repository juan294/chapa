-- Refs #1335 (phase 3). Durable, resumable, checkpointed evidence collection.
-- A queue job survives crashes, deadlines and rate limits across as many
-- short cron slices as it needs; no run starts over from scratch. See
-- docs/plans/2026-09-23-universal-v72-reliable-collection-phases/phase-3.md.
--
-- Pattern mirrors the campaign-send lease machinery (023/029-033): a
-- SECURITY DEFINER RPC per lifecycle step, `FOR UPDATE SKIP LOCKED` claiming,
-- and lease-token-gated writes so a stale worker can never clobber a fresher
-- claim. RLS block mirrors 039:299-318 (service_role only; SUPABASE_SERVICE_
-- ROLE_KEY bypasses RLS entirely per 002_enable_rls.sql, so grants here are
-- defense in depth, matching existing convention).

CREATE TYPE public.scoring_collection_state AS ENUM
  ('queued','running','waiting_rate_limit','retrying','complete','failed');

-- Structural validators for the two JSONB columns below. Kept permissive on
-- shape but strict on key set, mirroring scoring_v7_validate_source_value's
-- style (045) without duplicating its private-secret-bearing checks — a
-- collection checkpoint is provider cursor/state data, never a URL, token or
-- response body (see CollectorCheckpoint, lib/collection/plan.ts).
CREATE FUNCTION public.scoring_collection_valid_checkpoint(p_checkpoint jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE op jsonb;
BEGIN
  IF jsonb_typeof(p_checkpoint) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  -- The pre-first-slice sentinel: enqueue writes '{}' rather than the full
  -- EMPTY_CHECKPOINT shape, since the SQL default cannot reference a TS
  -- constant. lib/db/collection-queue.ts maps '{}' to EMPTY_CHECKPOINT on read.
  IF p_checkpoint = '{}'::jsonb THEN RETURN true; END IF;
  IF p_checkpoint - ARRAY['version','operations','discovered','state'] <> '{}'::jsonb THEN RETURN false; END IF;
  IF p_checkpoint->>'version' IS DISTINCT FROM '1' THEN RETURN false; END IF;
  IF jsonb_typeof(p_checkpoint->'operations') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  FOR op IN SELECT value FROM jsonb_array_elements(p_checkpoint->'operations') LOOP
    IF jsonb_typeof(op) IS DISTINCT FROM 'object' OR op - ARRAY['key','cursor','done'] <> '{}'::jsonb
      OR jsonb_typeof(op->'key') IS DISTINCT FROM 'string'
      OR (jsonb_typeof(op->'cursor') NOT IN ('string','null'))
      OR jsonb_typeof(op->'done') IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
  END LOOP;
  IF jsonb_typeof(p_checkpoint->'discovered') IS DISTINCT FROM 'object'
    OR (p_checkpoint->'discovered') - ARRAY['repositoryIds','itemIds'] <> '{}'::jsonb
    OR jsonb_typeof(p_checkpoint->'discovered'->'repositoryIds') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF p_checkpoint ? 'state' AND jsonb_typeof(p_checkpoint->'state') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.scoring_collection_valid_checkpoint(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_collection_valid_checkpoint(jsonb) TO service_role;

CREATE FUNCTION public.scoring_collection_valid_progress(p_progress jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_progress) = 'object' AND (
    p_progress = '{}'::jsonb OR (
      p_progress - ARRAY['operationsDone','operationsKnown','events','requests'] = '{}'::jsonb
      AND jsonb_typeof(p_progress->'operationsDone') = 'number'
      AND jsonb_typeof(p_progress->'operationsKnown') = 'number'
      AND jsonb_typeof(p_progress->'events') = 'number'
      AND jsonb_typeof(p_progress->'requests') = 'number'
    )
  )
$$;
REVOKE ALL ON FUNCTION public.scoring_collection_valid_progress(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_collection_valid_progress(jsonb) TO service_role;

-- SourceDiagnostic (lib/platform/evidence-diagnostics.ts). Never a URL,
-- request/response body or token -- only provider, a stable operation name,
-- the stop kind and an HTTP status.
CREATE FUNCTION public.scoring_collection_valid_stop(p_stop jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_stop IS NULL OR (
    jsonb_typeof(p_stop) = 'object'
    AND p_stop - ARRAY['provider','operation','stopKind','httpStatus','retryAfterSeconds'] = '{}'::jsonb
    AND p_stop->>'provider' IN ('github','bitbucket','gitlab','codeberg')
    AND jsonb_typeof(p_stop->'operation') = 'string'
    AND p_stop->>'stopKind' IN ('budget','deadline','rate_limited','http','graphql','network','protocol','parse','not_accessible')
  )
$$;
REVOKE ALL ON FUNCTION public.scoring_collection_valid_stop(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_collection_valid_stop(jsonb) TO service_role;

CREATE TABLE public.scoring_collection_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_handle text NOT NULL REFERENCES public.scoring_v7_subjects(owner_handle) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('github','bitbucket','gitlab','codeberg')),
  reference_date date NOT NULL,
  reference_time timestamptz NOT NULL,
  state public.scoring_collection_state NOT NULL DEFAULT 'queued',
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (public.scoring_collection_valid_checkpoint(checkpoint)),
  progress jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (public.scoring_collection_valid_progress(progress)),
  attempt int NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_stop jsonb CHECK (public.scoring_collection_valid_stop(last_stop)),
  enqueue_reason text NOT NULL CHECK (enqueue_reason IN ('signup','refresh','daily','reconnect','admin','retry')),
  observation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_handle, provider, reference_date)
);
CREATE INDEX idx_scoring_collection_jobs_claim ON public.scoring_collection_jobs (state, next_run_at);

CREATE TABLE public.scoring_collection_staged_events (
  job_id uuid NOT NULL REFERENCES public.scoring_collection_jobs(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event jsonb NOT NULL,
  PRIMARY KEY (job_id, event_key)
);

ALTER TABLE public.scoring_collection_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_collection_jobs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.scoring_collection_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_collection_jobs TO service_role;

ALTER TABLE public.scoring_collection_staged_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_collection_staged_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.scoring_collection_staged_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.scoring_collection_staged_events TO service_role;

-- Upserts on the day key. A `failed` job re-enqueued with a recovery reason
-- resets to queued/attempt 0/empty checkpoint and clears staged events. A
-- `complete` job is left alone unless the reason is `refresh`: the UNIQUE
-- (owner,provider,reference_date) constraint means "a fresh job for the same
-- day" is this same row reset in place, not a second physical row.
CREATE FUNCTION public.scoring_collection_enqueue(
  p_owner text, p_provider text, p_reason text, p_reference_time timestamptz
) RETURNS public.scoring_collection_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d date; existing public.scoring_collection_jobs; result public.scoring_collection_jobs;
BEGIN
  IF p_owner IS NULL OR p_owner <> lower(btrim(p_owner)) OR length(p_owner) = 0
    OR p_provider IS NULL OR p_provider NOT IN ('github','bitbucket','gitlab','codeberg')
    OR p_reason IS NULL OR p_reason NOT IN ('signup','refresh','daily','reconnect','admin','retry')
    OR p_reference_time IS NULL OR NOT isfinite(p_reference_time) THEN
    RAISE EXCEPTION 'Invalid collection enqueue request';
  END IF;
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle = p_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registered subject required'; END IF;
  d := (p_reference_time AT TIME ZONE 'UTC')::date;
  SELECT * INTO existing FROM public.scoring_collection_jobs
    WHERE owner_handle = p_owner AND provider = p_provider AND reference_date = d FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.scoring_collection_jobs(owner_handle, provider, reference_date, reference_time, enqueue_reason)
    VALUES (p_owner, p_provider, d, p_reference_time, p_reason)
    RETURNING * INTO result;
    RETURN result;
  END IF;
  IF existing.state = 'failed' AND p_reason IN ('retry','reconnect','refresh') THEN
    DELETE FROM public.scoring_collection_staged_events WHERE job_id = existing.id;
    UPDATE public.scoring_collection_jobs SET
      state = 'queued', attempt = 0, checkpoint = '{}'::jsonb, progress = '{}'::jsonb,
      next_run_at = now(), lease_token = NULL, lease_expires_at = NULL, last_stop = NULL,
      enqueue_reason = p_reason, observation_id = NULL, updated_at = now()
    WHERE id = existing.id RETURNING * INTO result;
    RETURN result;
  END IF;
  IF existing.state = 'complete' AND p_reason = 'refresh' THEN
    DELETE FROM public.scoring_collection_staged_events WHERE job_id = existing.id;
    UPDATE public.scoring_collection_jobs SET
      state = 'queued', attempt = 0, checkpoint = '{}'::jsonb, progress = '{}'::jsonb,
      next_run_at = now(), lease_token = NULL, lease_expires_at = NULL, last_stop = NULL,
      enqueue_reason = p_reason, observation_id = NULL, updated_at = now()
    WHERE id = existing.id RETURNING * INTO result;
    RETURN result;
  END IF;
  -- queued/running/waiting_rate_limit/retrying, or complete+non-refresh: idempotent no-op.
  RETURN existing;
END $$;

-- FOR UPDATE SKIP LOCKED so two concurrent cron ticks never claim the same
-- row. Recovers a `running` job whose lease has expired (crash/timeout) in
-- the same pass as ordinary queued/retrying/waiting_rate_limit work.
CREATE FUNCTION public.scoring_collection_claim(p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.scoring_collection_jobs
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH candidates AS (
    SELECT id FROM public.scoring_collection_jobs
    WHERE p_limit IS NOT NULL AND p_limit > 0 AND p_lease_seconds IS NOT NULL AND p_lease_seconds > 0
      AND (
        (state IN ('queued','waiting_rate_limit','retrying') AND next_run_at <= now())
        OR (state = 'running' AND lease_expires_at < now())
      )
    ORDER BY next_run_at
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.scoring_collection_jobs AS jobs
    SET state = 'running', lease_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds), updated_at = now()
    FROM candidates
    WHERE jobs.id = candidates.id
    RETURNING jobs.*
  )
  SELECT * FROM claimed ORDER BY next_run_at;
$$;

-- Upserts staged events with ON CONFLICT DO NOTHING; a key collision with
-- DIFFERENT content raises (mirrors the immutable-identity rule elsewhere in
-- the v7 ledger). p_release=true is the budget/deadline path: the job is
-- handed back to `queued` with next_run_at=now() so the *same* cron tick's
-- outer claim loop can pick it straight back up for another slice, instead of
-- waiting out its lease.
CREATE FUNCTION public.scoring_collection_checkpoint(
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
  IF staged_count > 10000 THEN
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

-- Calls the existing append path (scoring_v7_append_source, 045) with the
-- staged events as the payload, in the same transaction as the state
-- transition. p_requested/p_access/p_scope/p_link_id/p_link_version extend
-- the plan's minimal (job_id, lease_token, coverage, observation_id) sketch:
-- scoring_v7_append_source's own lock (scoring_v7_lock_source_context)
-- requires them, and the private access-context HMAC (p_access) can only be
-- computed in TS (lib/platform/source-context.ts holds the signing secret),
-- never inside SQL. The caller (worker.ts) already has all of these from the
-- same credential resolution it used to run the slice.
CREATE FUNCTION public.scoring_collection_finish(
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
  IF event_count > 10000 THEN
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

-- retry_at NULL -> terminal `failed`. Otherwise -> `retrying` or
-- `waiting_rate_limit` (chosen by stop.stopKind), attempt+1, next_run_at =
-- retry_at.
CREATE FUNCTION public.scoring_collection_fail(
  p_job_id uuid, p_lease_token uuid, p_stop jsonb, p_retry_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE job public.scoring_collection_jobs%ROWTYPE; next_state public.scoring_collection_state;
BEGIN
  SELECT * INTO job FROM public.scoring_collection_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR job.lease_token IS DISTINCT FROM p_lease_token OR job.state <> 'running' THEN
    RETURN jsonb_build_object('status','lease_mismatch');
  END IF;
  IF jsonb_typeof(p_stop) IS DISTINCT FROM 'object' OR p_stop->>'stopKind' IS NULL THEN
    RAISE EXCEPTION 'Invalid stop diagnostic';
  END IF;
  IF p_retry_at IS NULL THEN
    UPDATE public.scoring_collection_jobs SET
      state = 'failed', last_stop = p_stop, lease_token = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE id = p_job_id;
    RETURN jsonb_build_object('status','failed');
  END IF;
  next_state := CASE WHEN p_stop->>'stopKind' = 'rate_limited' THEN 'waiting_rate_limit'::public.scoring_collection_state ELSE 'retrying'::public.scoring_collection_state END;
  UPDATE public.scoring_collection_jobs SET
    state = next_state, last_stop = p_stop, attempt = attempt + 1, next_run_at = p_retry_at,
    lease_token = NULL, lease_expires_at = NULL, updated_at = now()
  WHERE id = p_job_id;
  RETURN jsonb_build_object('status', next_state::text);
END $$;

REVOKE ALL ON FUNCTION public.scoring_collection_enqueue(text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoring_collection_claim(integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoring_collection_checkpoint(uuid,uuid,jsonb,text[],jsonb[],jsonb,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoring_collection_finish(uuid,uuid,jsonb,uuid,jsonb,text,jsonb,uuid,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoring_collection_fail(uuid,uuid,jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_collection_enqueue(text,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.scoring_collection_claim(integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.scoring_collection_checkpoint(uuid,uuid,jsonb,text[],jsonb[],jsonb,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.scoring_collection_finish(uuid,uuid,jsonb,uuid,jsonb,text,jsonb,uuid,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.scoring_collection_fail(uuid,uuid,jsonb,timestamptz) TO service_role;
