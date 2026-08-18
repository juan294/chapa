-- Expired-lease recovery deliberately returns a claimed group whole,
-- ignoring p_limit, so a provider retry replays byte-identical membership
-- (see 029/030/031). But when that whole group exceeds the remaining daily
-- send quota, re-claiming it on every attempt just refreshes its lease under
-- a fresh 10-minute window without ever making progress — stalling the
-- group until the UTC-day counter resets, burning cron invocations, and
-- deferring every other active campaign processed in the same run (#1085).
--
-- `group_token` persists a recovered group's identity across processing<->
-- pending transitions, so it can be released back to `pending` (instead of
-- re-leased) when quota can't cover it, while still being recovered as the
-- SAME indivisible group next time — never split across smaller batches,
-- which would break provider-side idempotency dedup for an earlier
-- ambiguous Resend attempt against this exact row-ID set.
ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS group_token TEXT;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_group_token
  ON public.campaign_sends(campaign_id, status, group_token)
  WHERE group_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_campaign_sends(
  p_campaign_id UUID,
  p_limit INTEGER,
  p_lease_token TEXT,
  p_lease_expires_at TIMESTAMPTZ
)
RETURNS SETOF public.campaign_sends
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH expired_group AS MATERIALIZED (
    SELECT sends.lease_token
    FROM public.campaign_sends AS sends
    WHERE sends.campaign_id = p_campaign_id
      AND sends.status = 'processing'
      AND sends.lease_token IS NOT NULL
      AND sends.lease_expires_at IS NOT NULL
      AND sends.lease_expires_at < now()
    GROUP BY sends.lease_token
    ORDER BY min(sends.id::text)
    LIMIT 1
  ),
  pending_group AS MATERIALIZED (
    SELECT sends.group_token
    FROM public.campaign_sends AS sends
    WHERE NOT EXISTS (SELECT 1 FROM expired_group)
      AND sends.campaign_id = p_campaign_id
      AND sends.status = 'pending'
      AND sends.group_token IS NOT NULL
    GROUP BY sends.group_token
    ORDER BY min(sends.id::text)
    LIMIT 1
  ),
  candidates AS MATERIALIZED (
    SELECT sends.id
    FROM public.campaign_sends AS sends
    WHERE p_limit IS NOT NULL
      AND p_limit > 0
      AND p_lease_token IS NOT NULL
      AND p_lease_token !~ '^[[:space:]]*$'
      AND p_lease_expires_at IS NOT NULL
      AND p_lease_expires_at > now()
      AND sends.campaign_id = p_campaign_id
      AND (
        (
          EXISTS (SELECT 1 FROM expired_group)
          AND sends.status = 'processing'
          AND sends.lease_token = (SELECT lease_token FROM expired_group)
        )
        OR (
          NOT EXISTS (SELECT 1 FROM expired_group)
          AND EXISTS (SELECT 1 FROM pending_group)
          AND sends.status = 'pending'
          AND sends.group_token = (SELECT group_token FROM pending_group)
        )
        OR (
          NOT EXISTS (SELECT 1 FROM expired_group)
          AND NOT EXISTS (SELECT 1 FROM pending_group)
          AND sends.status = 'pending'
        )
      )
    ORDER BY sends.id
    LIMIT CASE
      WHEN EXISTS (SELECT 1 FROM expired_group)
        OR EXISTS (SELECT 1 FROM pending_group)
      THEN 2147483647
      ELSE p_limit
    END
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.campaign_sends AS sends
    SET
      status = 'processing',
      error = NULL,
      claimed_at = now(),
      lease_expires_at = p_lease_expires_at,
      lease_token = p_lease_token,
      -- Seed group_token from the just-recovered expired lease the first
      -- time a group is ever recovered; otherwise keep whatever identity
      -- (from an earlier recovery, expired or pending) the row already
      -- carries. A plain, never-recovered pending claim leaves this NULL.
      group_token = COALESCE(
        sends.group_token,
        (SELECT lease_token FROM expired_group)
      )
    FROM candidates
    WHERE sends.id = candidates.id
    RETURNING sends.*
  )
  SELECT *
  FROM claimed
  ORDER BY id;
$$;

-- Release a claimed lease group back to `pending` without discarding its
-- `group_token`, so a later claim recovers the identical membership (and
-- therefore reproduces the same row-ID-derived provider idempotency key)
-- instead of splitting it across separate, smaller batches.
CREATE OR REPLACE FUNCTION public.release_campaign_send_lease(
  p_lease_token TEXT
)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH released AS (
    UPDATE public.campaign_sends AS sends
    SET
      status = 'pending',
      claimed_at = NULL,
      lease_expires_at = NULL,
      lease_token = NULL
    WHERE p_lease_token IS NOT NULL
      AND p_lease_token !~ '^[[:space:]]*$'
      AND sends.status = 'processing'
      AND sends.lease_token = p_lease_token
    RETURNING sends.id
  )
  SELECT count(*)::INTEGER FROM released;
$$;

REVOKE ALL ON FUNCTION public.release_campaign_send_lease(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_campaign_send_lease(TEXT)
  TO service_role;
