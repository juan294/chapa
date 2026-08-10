-- Fail closed on malformed lease inputs while preserving complete expired
-- groups for byte-identical provider retries.
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
  candidates AS MATERIALIZED (
    SELECT sends.id
    FROM public.campaign_sends AS sends
    WHERE p_limit IS NOT NULL
      AND p_limit > 0
      AND NULLIF(btrim(p_lease_token), '') IS NOT NULL
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
          AND sends.status = 'pending'
        )
      )
    ORDER BY sends.id
    LIMIT CASE
      WHEN EXISTS (SELECT 1 FROM expired_group) THEN 2147483647
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
      lease_token = p_lease_token
    FROM candidates
    WHERE sends.id = candidates.id
    RETURNING sends.*
  )
  SELECT *
  FROM claimed
  ORDER BY id;
$$;

-- Apply every provider outcome for a non-empty lease, or none of them.
CREATE OR REPLACE FUNCTION public.acknowledge_campaign_sends(
  p_lease_token TEXT,
  p_results JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected_count INTEGER;
  distinct_count INTEGER;
  valid_count INTEGER;
  lease_count INTEGER;
  matched_count INTEGER;
  updated_count INTEGER;
BEGIN
  IF NULLIF(btrim(p_lease_token), '') IS NULL
    OR p_results IS NULL
    OR jsonb_typeof(p_results) IS DISTINCT FROM 'array'
  THEN
    RETURN false;
  END IF;

  expected_count := jsonb_array_length(p_results);
  IF expected_count = 0 THEN
    RETURN false;
  END IF;

  SELECT
    count(DISTINCT input.id),
    count(*) FILTER (WHERE input.status IN ('sent', 'failed'))
  INTO distinct_count, valid_count
  FROM jsonb_to_recordset(p_results) AS input(
    id UUID,
    status TEXT,
    error TEXT
  );

  IF distinct_count <> expected_count OR valid_count <> expected_count THEN
    RETURN false;
  END IF;

  WITH input AS MATERIALIZED (
    SELECT id, status, error
    FROM jsonb_to_recordset(p_results) AS result(
      id UUID,
      status TEXT,
      error TEXT
    )
  ),
  locked AS MATERIALIZED (
    SELECT sends.id
    FROM public.campaign_sends AS sends
    WHERE sends.status = 'processing'
      AND sends.lease_token = p_lease_token
    FOR UPDATE OF sends
  )
  SELECT count(*), count(input.id)
  INTO lease_count, matched_count
  FROM locked
  LEFT JOIN input ON input.id = locked.id;

  IF lease_count <> expected_count OR matched_count <> expected_count THEN
    RETURN false;
  END IF;

  WITH input AS MATERIALIZED (
    SELECT id, status, error
    FROM jsonb_to_recordset(p_results) AS result(
      id UUID,
      status TEXT,
      error TEXT
    )
  )
  UPDATE public.campaign_sends AS sends
  SET
    status = input.status,
    sent_at = CASE WHEN input.status = 'sent' THEN now() ELSE NULL END,
    error = CASE WHEN input.status = 'failed' THEN input.error ELSE NULL END,
    claimed_at = NULL,
    lease_expires_at = NULL,
    lease_token = NULL
  FROM input
  WHERE sends.id = input.id
    AND sends.status = 'processing'
    AND sends.lease_token = p_lease_token;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = expected_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_campaign_sends(UUID, INTEGER, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_sends(UUID, INTEGER, TEXT, TIMESTAMPTZ)
  TO service_role;

REVOKE ALL ON FUNCTION public.acknowledge_campaign_sends(TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_campaign_sends(TEXT, JSONB)
  TO service_role;
