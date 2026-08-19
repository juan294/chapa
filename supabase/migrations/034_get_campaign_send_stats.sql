-- Campaign terminal-state decisions need all status counts from one database
-- snapshot. Separate PostgREST count requests can observe opposite sides of a
-- concurrent status transition and produce an impossible all-zero total.
CREATE OR REPLACE FUNCTION public.get_campaign_send_stats(
  p_campaign_id UUID
)
RETURNS TABLE (
  sent BIGINT,
  pending BIGINT,
  processing BIGINT,
  failed BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE sends.status = 'sent') AS sent,
    count(*) FILTER (WHERE sends.status = 'pending') AS pending,
    count(*) FILTER (WHERE sends.status = 'processing') AS processing,
    count(*) FILTER (WHERE sends.status = 'failed') AS failed
  FROM public.campaign_sends AS sends
  WHERE sends.campaign_id = p_campaign_id;
$$;

REVOKE ALL ON FUNCTION public.get_campaign_send_stats(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_send_stats(UUID)
  TO service_role;
