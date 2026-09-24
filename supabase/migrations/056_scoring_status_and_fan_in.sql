-- Refs #1335 (phase 4). Issuance fan-in and the owner-visible scoring status
-- surface. A receipt is issued exactly when all of an owner's connected
-- sources for the day are complete (lib/collection/fan-in.ts), and every
-- outcome -- issued, unchanged, or a specific failure reason -- is recorded
-- here rather than silently dropped. See
-- docs/plans/2026-09-23-universal-v72-reliable-collection-phases/phase-4.md.

-- One row per fan-in attempt for an (owner, day). The most recent
-- issued/unchanged row for a day is that day's "fan-in marker": its presence
-- is what stops runCollectionTick's retry sweep from re-issuing a day whose
-- jobs are all complete. A `failed` row records the reason without setting
-- that marker, so the next tick retries.
CREATE TABLE public.scoring_issuance_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_handle text NOT NULL REFERENCES public.scoring_v7_subjects(owner_handle) ON DELETE CASCADE,
  reference_date date NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('issued','unchanged','failed')),
  reason text CHECK (reason IS NULL OR reason IN ('storage_error','source_error','craft_error','empty_evidence')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scoring_issuance_attempts_owner_date ON public.scoring_issuance_attempts (owner_handle, reference_date, created_at DESC);

ALTER TABLE public.scoring_issuance_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_issuance_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.scoring_issuance_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.scoring_issuance_attempts TO service_role;

-- Read-only: an owner's collection jobs for one reference date, across every
-- connected provider. Backs lib/collection/read-scoring-status.ts (called
-- with today's UTC date, computed in TS the same way every other UTC-day key
-- in this codebase is: toDateString(new Date())) and fan-in's retry sweep
-- (called with a possibly-earlier pending day). A plain SELECT would work
-- too (service_role bypasses RLS, matching isCollectionJobInProgress's
-- existing pattern in lib/db/collection-queue.ts) -- this RPC exists so the
-- shape is typed and ordered the same way at every call site.
CREATE FUNCTION public.scoring_status(p_owner text, p_reference_date date)
RETURNS SETOF public.scoring_collection_jobs
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT * FROM public.scoring_collection_jobs
  WHERE owner_handle = p_owner AND reference_date = p_reference_date
  ORDER BY provider;
$$;
REVOKE ALL ON FUNCTION public.scoring_status(text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_status(text, date) TO service_role;

-- Every (owner, day) whose jobs are all complete but has no successful
-- (issued or unchanged) issuance attempt recorded -- either fan-in never ran
-- (a worker crash between the last job completing and onJobComplete) or it
-- ran and failed every time so far. runCollectionTick re-runs fan-in for
-- each of these at the start of every tick (phase-4.md step 2: "the job
-- stays complete; the fan-in marker is not set until publication succeeds").
-- Bounded by p_limit so one tick's retry sweep cannot itself run unbounded.
CREATE FUNCTION public.scoring_collection_pending_fan_in(p_limit integer)
RETURNS TABLE(owner_handle text, reference_date date, reference_time timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT j.owner_handle, j.reference_date, max(j.reference_time) AS reference_time
  FROM public.scoring_collection_jobs j
  WHERE NOT EXISTS (
    SELECT 1 FROM public.scoring_collection_jobs other
    WHERE other.owner_handle = j.owner_handle AND other.reference_date = j.reference_date AND other.state <> 'complete'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.scoring_issuance_attempts a
    WHERE a.owner_handle = j.owner_handle AND a.reference_date = j.reference_date AND a.outcome IN ('issued','unchanged')
  )
  GROUP BY j.owner_handle, j.reference_date
  ORDER BY j.reference_date
  LIMIT GREATEST(coalesce(p_limit, 0), 0);
$$;
REVOKE ALL ON FUNCTION public.scoring_collection_pending_fan_in(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_collection_pending_fan_in(integer) TO service_role;

-- Aggregate queue health, shared by /api/health's `scoringQueue` block and
-- runCollectionTick's `scoring_queue_stuck` check (#1335 phase 4) -- one
-- read, not two independently-maintained queries over the same table.
CREATE FUNCTION public.scoring_collection_queue_health()
RETURNS TABLE(
  queued bigint,
  running bigint,
  retrying bigint,
  waiting_rate_limit bigint,
  failed_today bigint,
  oldest_queued_age_ms bigint,
  expired_leases bigint,
  oldest_expired_lease_age_ms bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    count(*) FILTER (WHERE state = 'queued'),
    count(*) FILTER (WHERE state = 'running'),
    count(*) FILTER (WHERE state = 'retrying'),
    count(*) FILTER (WHERE state = 'waiting_rate_limit'),
    (SELECT count(*) FROM public.scoring_collection_jobs WHERE state = 'failed' AND updated_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
    (SELECT coalesce(extract(epoch FROM (now() - min(next_run_at))) * 1000, 0)::bigint FROM public.scoring_collection_jobs WHERE state = 'queued'),
    count(*) FILTER (WHERE state = 'running' AND lease_expires_at < now()),
    (SELECT coalesce(extract(epoch FROM (now() - min(lease_expires_at))) * 1000, 0)::bigint FROM public.scoring_collection_jobs WHERE state = 'running' AND lease_expires_at < now())
  FROM public.scoring_collection_jobs;
$$;
REVOKE ALL ON FUNCTION public.scoring_collection_queue_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_collection_queue_health() TO service_role;
