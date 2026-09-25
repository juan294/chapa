-- Refs #1335, #1351. Retry and attempt policy for the durable collection
-- queue (055/056/057). `attempt` now means "failures since the last
-- progress". Each rule is described at the function that enforces it.
--
-- `scoring_collection_valid_progress` also gains an optional boolean
-- `discovering` key, which phase 5 starts writing.
--
-- Each function below is `CREATE OR REPLACE` with the signature unchanged
-- from 055 (checkpoint's body is the 057 version, which raised the staged
-- event limit), so existing grants and the `scoring_collection_jobs`
-- CHECK constraint on `scoring_collection_valid_progress` keep working
-- without being redeclared.

CREATE OR REPLACE FUNCTION public.scoring_collection_valid_progress(p_progress jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_progress) = 'object' AND (
    p_progress = '{}'::jsonb OR (
      p_progress - ARRAY['operationsDone','operationsKnown','events','requests','discovering'] = '{}'::jsonb
      AND jsonb_typeof(p_progress->'operationsDone') = 'number'
      AND jsonb_typeof(p_progress->'operationsKnown') = 'number'
      AND jsonb_typeof(p_progress->'events') = 'number'
      AND jsonb_typeof(p_progress->'requests') = 'number'
      AND (NOT (p_progress ? 'discovering') OR jsonb_typeof(p_progress->'discovering') = 'boolean')
    )
  )
$$;

-- Upserts on the day key. A `failed` job re-enqueued with a recovery reason
-- resets to queued/attempt 0. When the reason is `retry` and the last stop
-- was transient (http/network/deadline/budget), the checkpoint, progress
-- and staged events survive, so the next slice resumes instead of starting
-- over. Every other recovery case (a structural last stop, reconnect,
-- refresh) still resets to an empty checkpoint, as before. A `complete` job
-- is left alone unless the reason is `refresh`.
CREATE OR REPLACE FUNCTION public.scoring_collection_enqueue(
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
  IF existing.state = 'failed' AND p_reason = 'retry'
    AND existing.last_stop->>'stopKind' IN ('http','network','deadline','budget') THEN
    UPDATE public.scoring_collection_jobs SET
      state = 'queued', attempt = 0, next_run_at = now(), lease_token = NULL,
      lease_expires_at = NULL, last_stop = NULL, enqueue_reason = p_reason, updated_at = now()
    WHERE id = existing.id RETURNING * INTO result;
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

-- Upserts staged events with ON CONFLICT DO NOTHING; a key collision with
-- DIFFERENT content raises. `attempt` resets to 0 whenever this checkpoint's
-- `operationsDone` exceeds the job's stored value -- a slice that advances
-- the job clears whatever failures came before it. `progress` on the right
-- of the CASE below is the pre-update column value (the row was already
-- locked by the SELECT ... FOR UPDATE above), never the incoming `p_progress`.
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
      attempt = CASE WHEN COALESCE((p_progress->>'operationsDone')::int, 0)
                       > COALESCE((progress->>'operationsDone')::int, 0)
                  THEN 0 ELSE attempt END,
      next_run_at = now(), lease_token = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE id = p_job_id;
  ELSE
    UPDATE public.scoring_collection_jobs SET
      checkpoint = p_checkpoint, progress = p_progress,
      attempt = CASE WHEN COALESCE((p_progress->>'operationsDone')::int, 0)
                       > COALESCE((progress->>'operationsDone')::int, 0)
                  THEN 0 ELSE attempt END,
      lease_expires_at = now() + interval '120 seconds', updated_at = now()
    WHERE id = p_job_id;
  END IF;
  RETURN jsonb_build_object('status','ok','stagedCount',staged_count);
END $$;

-- retry_at NULL -> terminal `failed`. Otherwise -> `retrying` or
-- `waiting_rate_limit` (chosen by stop.stopKind), next_run_at = retry_at.
-- `attempt` only increments for a non-`rate_limited` stop -- waiting for the
-- shared allowance to refill is not a failure against the retry budget.
CREATE OR REPLACE FUNCTION public.scoring_collection_fail(
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
    state = next_state, last_stop = p_stop,
    attempt = CASE WHEN p_stop->>'stopKind' = 'rate_limited' THEN attempt ELSE attempt + 1 END,
    next_run_at = p_retry_at,
    lease_token = NULL, lease_expires_at = NULL, updated_at = now()
  WHERE id = p_job_id;
  RETURN jsonb_build_object('status', next_state::text);
END $$;
