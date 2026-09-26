-- Phase 3: select an observation once, then read immutable generation rows
-- in bounded key order. Every request rechecks the live source/link context.

-- The writer still enforces 50,000 in checkpoint_v2/finish_v2. This schema
-- headroom permits a disposable direct 100,000-row read fixture in Phase 3.
ALTER TABLE public.scoring_collection_generations
  DROP CONSTRAINT scoring_collection_generations_event_count_check;
ALTER TABLE public.scoring_collection_generations
  ADD CONSTRAINT scoring_collection_generations_event_count_check
  CHECK (event_count BETWEEN 0 AND 100000);

-- Use UTF-8 byte order throughout the page contract, independent of the
-- database's default locale. The existing PK has the default text collation.
CREATE INDEX scoring_collection_generation_events_key_c
  ON public.scoring_collection_generation_events(generation_id, event_key COLLATE "C");

CREATE FUNCTION public.scoring_v7_read_source_manifest(
  p_owner text, p_actor text, p_source jsonb, p_requested jsonb, p_access text, p_scope jsonb,
  p_link_id uuid, p_link_version timestamptz, p_window jsonb, p_prior boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE selected public.scoring_v7_source_observations%ROWTYPE;
  generation public.scoring_collection_generations%ROWTYPE;
  actual_count integer; key_bytes bigint; keys_sha256 text;
BEGIN
  PERFORM public.scoring_v7_lock_source_context(
    p_owner,p_actor,p_requested,p_access,p_scope,p_link_id,p_link_version);
  IF p_source->>'provider' IS DISTINCT FROM p_requested->>'provider'
    OR p_source->>'host' IS DISTINCT FROM p_requested->>'host'
    OR coalesce(length(p_source->>'subjectId'),0) = 0
    THEN RAISE EXCEPTION 'Canonical source identity required'; END IF;
  PERFORM public.scoring_v7_validate_source_window(p_window);
  IF p_prior IS NULL THEN RAISE EXCEPTION 'Source selection required'; END IF;

  -- Same winner and ordering as the legacy read RPC in migration 061.
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

  IF selected.event_storage_mode = 'jsonb' THEN
    PERFORM public.scoring_v7_validate_source_value(
      p_source,p_scope,selected.coverage->'window',selected.coverage,selected.payload);
    RETURN jsonb_build_object(
      'id',selected.id,'window',selected.coverage->'window','coverage',selected.coverage,
      'storageMode','jsonb','eventCount',jsonb_array_length(selected.payload->'events'),
      'eventGenerationId',NULL,'eventKeysSha256',NULL);
  END IF;

  SELECT * INTO generation FROM public.scoring_collection_generations
    WHERE id = selected.event_generation_id AND owner_handle = p_owner;
  IF NOT FOUND OR generation.published_at IS NULL
    OR (generation.provider,generation.host,generation.subject_id)
      IS DISTINCT FROM (p_source->>'provider',p_source->>'host',p_source->>'subjectId')
    THEN RAISE EXCEPTION 'Published generation unavailable'; END IF;
  PERFORM public.scoring_v7_validate_source_value(
    p_source,p_scope,selected.coverage->'window',selected.coverage,
    jsonb_build_object('events','[]'::jsonb));

  -- pgcrypto's SHA256 input is one value. Aggregate keys only, never event
  -- bodies, after an index-only byte/count pass. The 64 MiB bound makes this
  -- exact ordered digest fail explicitly rather than allocate unbounded RAM.
  SELECT count(*),coalesce(sum(octet_length(event_key)),0)
    INTO actual_count,key_bytes
  FROM public.scoring_collection_generation_events
  WHERE generation_id = generation.id;
  IF actual_count IS DISTINCT FROM generation.event_count
    OR actual_count > 100000 OR key_bytes + greatest(actual_count - 1,0) > 67108864
    THEN RAISE EXCEPTION 'Generation key digest budget/count mismatch'; END IF;
  SELECT encode(extensions.digest(convert_to(
    coalesce(string_agg(event_key,E'\n' ORDER BY event_key COLLATE "C"),''),'UTF8'),'sha256'),'hex')
    INTO keys_sha256
  FROM public.scoring_collection_generation_events
  WHERE generation_id = generation.id;
  RETURN jsonb_build_object(
    'id',selected.id,'window',selected.coverage->'window','coverage',selected.coverage,
    'storageMode','rows','eventCount',actual_count,
    'eventGenerationId',generation.id,'eventKeysSha256',keys_sha256);
END $$;

CREATE FUNCTION public.scoring_v7_read_source_page(
  p_owner text, p_actor text, p_source jsonb, p_requested jsonb, p_access text, p_scope jsonb,
  p_link_id uuid, p_link_version timestamptz, p_window jsonb, p_prior boolean,
  p_observation uuid, p_generation uuid, p_after_key text, p_limit integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE selected public.scoring_v7_source_observations%ROWTYPE; page jsonb;
BEGIN
  PERFORM public.scoring_v7_lock_source_context(
    p_owner,p_actor,p_requested,p_access,p_scope,p_link_id,p_link_version);
  IF p_source->>'provider' IS DISTINCT FROM p_requested->>'provider'
    OR p_source->>'host' IS DISTINCT FROM p_requested->>'host'
    OR coalesce(length(p_source->>'subjectId'),0) = 0
    THEN RAISE EXCEPTION 'Canonical source identity required'; END IF;
  PERFORM public.scoring_v7_validate_source_window(p_window);
  IF p_prior IS NULL OR p_observation IS NULL OR p_generation IS NULL
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500
    THEN RAISE EXCEPTION 'Invalid source page request'; END IF;
  SELECT o.* INTO selected
  FROM public.scoring_v7_sources s
  JOIN public.scoring_v7_source_observations o
    ON o.source_id = s.id AND o.owner_handle = s.owner_handle
  JOIN public.scoring_collection_generations g
    ON g.id = o.event_generation_id AND g.owner_handle = o.owner_handle
  WHERE o.id = p_observation AND o.event_generation_id = p_generation
    AND o.event_storage_mode = 'rows' AND g.published_at IS NOT NULL
    AND g.provider = p_source->>'provider' AND g.host = p_source->>'host'
    AND g.subject_id = p_source->>'subjectId'
    AND s.owner_handle = p_owner AND s.provider = p_source->>'provider'
    AND s.host = p_source->>'host' AND s.subject_id = p_source->>'subjectId'
    AND s.access_context_id = p_access AND s.declared_scope = p_scope
    AND o.reference_time = (o.coverage->'window'->>'referenceTime')::timestamptz
    AND o.window_start = (o.coverage->'window'->>'startInclusive')::timestamptz
    AND o.window_end = (o.coverage->'window'->>'endExclusive')::timestamptz
    AND o.data_through IS NOT DISTINCT FROM (o.coverage->>'dataThrough')::timestamptz
    AND o.coverage->'source' = p_source
    AND o.coverage->>'discovery' = p_scope->>'discovery'
    AND ((NOT p_prior AND o.coverage->'window' = p_window)
      OR (p_prior AND o.reference_time < (p_window->>'referenceTime')::timestamptz));
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected source observation unavailable'; END IF;
  IF p_after_key IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.scoring_collection_generation_events
    WHERE generation_id = p_generation AND event_key = p_after_key
  ) THEN RAISE EXCEPTION 'Invalid source page cursor'; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('eventKey',event_key,'event',event)
    ORDER BY event_key COLLATE "C"),'[]'::jsonb) INTO page
  FROM (
    SELECT event_key,event FROM public.scoring_collection_generation_events
    WHERE generation_id = p_generation
      AND (p_after_key IS NULL OR event_key COLLATE "C" > p_after_key COLLATE "C")
    ORDER BY event_key COLLATE "C" LIMIT p_limit
  ) bounded;
  RETURN page;
END $$;

REVOKE ALL ON FUNCTION
  public.scoring_v7_read_source_manifest(text,text,jsonb,jsonb,text,jsonb,uuid,timestamptz,jsonb,boolean),
  public.scoring_v7_read_source_page(text,text,jsonb,jsonb,text,jsonb,uuid,timestamptz,jsonb,boolean,uuid,uuid,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.scoring_v7_read_source_manifest(text,text,jsonb,jsonb,text,jsonb,uuid,timestamptz,jsonb,boolean),
  public.scoring_v7_read_source_page(text,text,jsonb,jsonb,text,jsonb,uuid,timestamptz,jsonb,boolean,uuid,uuid,text,integer)
  TO service_role;
