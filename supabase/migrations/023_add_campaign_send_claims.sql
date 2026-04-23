ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_token TEXT;

CREATE INDEX IF NOT EXISTS idx_campaign_sends_claims
  ON public.campaign_sends(campaign_id, status, lease_expires_at, id);

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
  WITH candidates AS (
    SELECT id
    FROM public.campaign_sends
    WHERE campaign_id = p_campaign_id
      AND (
        status = 'pending'
        OR (
          status = 'processing'
          AND lease_expires_at IS NOT NULL
          AND lease_expires_at < now()
        )
      )
    ORDER BY id
    LIMIT GREATEST(p_limit, 0)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.campaign_sends AS sends
    SET
      status = 'processing',
      error = NULL,
      claimed_at = now(),
      lease_expires_at = p_lease_expires_at,
      lease_token = p_lease_token
    FROM candidates
    WHERE sends.id = candidates.id
    RETURNING sends.*
  )
  SELECT *
  FROM claimed
  ORDER BY id;
$$;
