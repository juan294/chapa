-- Policy-qualified daily winners and admin ordering. Historical views stay intact.
CREATE FUNCTION public.scoring_observed_history(p_owner text,p_from date DEFAULT NULL,p_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle=p_owner AND public_evidence_consent FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('canonicalReceipt',r.canonical_receipt,'trend',to_jsonb(t)) ORDER BY t.date),'[]'::jsonb) INTO result
  FROM public.scoring_v7_trend_anchors t JOIN public.scoring_v7_receipts r ON r.id=t.receipt_id AND r.owner_handle=t.owner_handle AND r.policy_version=t.policy_version
  WHERE t.owner_handle=p_owner AND t.policy_version='v7.2' AND r.public_receipt->>'action'<>'retract'
    AND (p_from IS NULL OR t.date>=p_from) AND (p_to IS NULL OR t.date<=p_to);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.scoring_observed_history(text,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_observed_history(text,date,date) TO service_role;

CREATE VIEW public.admin_users_observed WITH (security_invoker=true) AS
SELECT a.*,
  CASE WHEN r.id IS NULL THEN 'v6' ELSE 'v7.2' END AS current_policy_version,
  CASE WHEN r.id IS NULL THEN a.adjusted_composite ELSE (r.public_receipt #>> '{core,composite,displayValue}')::double precision END AS current_display_score,
  CASE WHEN r.id IS NULL THEN a.composite_score ELSE (r.public_receipt #>> '{core,composite,exact}')::double precision END AS current_exact_score,
  CASE WHEN r.id IS NULL THEN a.tier ELSE r.public_receipt #>> '{core,tier}' END AS current_tier,
  CASE WHEN r.id IS NULL THEN a.archetype ELSE r.public_receipt #>> '{core,archetype}' END AS current_archetype,
  CASE WHEN r.id IS NULL THEN a.confidence ELSE NULL END AS current_confidence,
  CASE WHEN r.id IS NULL THEN a.snapshot_date ELSE (r.reference_time AT TIME ZONE 'UTC')::date END AS current_snapshot_date,
  CASE WHEN r.id IS NULL THEN a.snapshot_captured_at ELSE r.reference_time END AS current_fetched_at,
  r.id AS current_revision_id,
  CASE WHEN r.id IS NOT NULL THEN pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.canonical_receipt,'UTF8')),'hex') END AS current_content_hash
FROM public.admin_users a
LEFT JOIN public.scoring_v7_subjects s ON s.owner_handle=a.handle AND s.public_evidence_consent
LEFT JOIN public.scoring_observed_current c ON c.owner_handle=s.owner_handle
LEFT JOIN public.scoring_v7_receipts r ON r.id=c.receipt_id AND r.owner_handle=a.handle AND r.policy_version='v7.2' AND r.public_receipt->>'action'<>'retract';
REVOKE ALL ON public.admin_users_observed FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.admin_users_observed TO service_role;
