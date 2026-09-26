-- A complete provider observation can contain more than 1,000 changed paths.
-- Preserve the complete list for scoring and replay, within the existing
-- 10,000-string and 1,024-character-per-string source bounds.
-- The prior 1,000-path limit blocked receipt issuance for a valid 1,604-file
-- GitHub pull request after its collection job had completed every operation.
CREATE OR REPLACE FUNCTION public.scoring_v7_source_observation_valid(p_value jsonb, p_kind text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v jsonb;
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'object' OR p_value->>'status' IS NULL OR p_value->>'coverage' IS NULL
 OR p_value->>'coverage' NOT IN ('complete','partial','unavailable','stale','legacy') THEN RETURN false; END IF;
 IF p_value->>'status'='unknown' THEN
   RETURN p_value - ARRAY['status','coverage','reasonCode']='{}'::jsonb AND p_value->>'coverage'<>'complete'
   AND p_value->>'reasonCode' IS NOT NULL AND p_value->>'reasonCode' IN ('criterion_demonstrated','criterion_not_demonstrated','not_assessed','not_accessible','not_supported','pagination_incomplete','discovery_incomplete','source_error','stale_data','legacy_aggregate','acceptance_time_unknown','attribution_unknown','alias_unresolved','partial_files','outside_window','retracted','insufficient_evidence');
 END IF;
 IF p_value->>'status'<>'observed' OR p_value - ARRAY['status','value','coverage','provenance']<>'{}'::jsonb
 OR p_value->>'provenance' IS NULL OR p_value->>'provenance' NOT IN ('source_observed','self_reported','automated_assessment','human_assessed','independently_corroborated') THEN RETURN false; END IF;
 v := p_value->'value';
 IF p_kind='changedFiles' THEN RETURN public.scoring_v7_source_strings(v,10000); END IF;
 IF p_kind IN ('additions','deletions','leadTimeHours') THEN
   IF jsonb_typeof(v) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
   RETURN (v#>>'{}')::numeric>=0 AND (v#>>'{}')::numeric<=9007199254740991 AND (p_kind='leadTimeHours' OR trunc((v#>>'{}')::numeric)=(v#>>'{}')::numeric);
 END IF;
 IF p_kind IN ('hasDescription','hasIssueLink','usesFeatureBranch') THEN RETURN jsonb_typeof(v)='boolean'; END IF;
 IF p_kind='acceptance' THEN
   IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR v - ARRAY['method','acceptedAt','acceptedResultId']<>'{}'::jsonb
   OR v->>'method' IS NULL OR v->>'method' NOT IN ('merged_change','default_branch_first_reachability','linked_issue_result','accepted_artifact')
   OR jsonb_typeof(v->'acceptedResultId') IS DISTINCT FROM 'string' OR coalesce(length(v->>'acceptedResultId'),0) NOT BETWEEN 1 AND 1024 OR v->>'acceptedResultId' ~ '[[:cntrl:]]'
   OR jsonb_typeof(v->'acceptedAt') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
   RETURN public.scoring_v7_source_instant(v->'acceptedAt');
 END IF;
 RETURN false;
END $$;
