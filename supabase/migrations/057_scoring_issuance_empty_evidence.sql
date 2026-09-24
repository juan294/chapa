-- Refs #1335. A full recompute that can't take the Craft-only short-circuit
-- could not tell "nothing was collected" (a disconnected/unlinked source, or
-- a completed-but-empty collection round -- phase 3's read-only source
-- coordinator has no way to distinguish either from genuine zero activity)
-- apart from a real source_error, so an empty evidence set silently
-- overwrote an established, non-trivial receipt with zero. The refusal now
-- records its own reason, distinct from source_error, so an operator reading
-- scoring_issuance_attempts can tell which defense actually fired.
ALTER TABLE public.scoring_issuance_attempts DROP CONSTRAINT scoring_issuance_attempts_reason_check;
ALTER TABLE public.scoring_issuance_attempts ADD CONSTRAINT scoring_issuance_attempts_reason_check
  CHECK (reason IS NULL OR (reason = ANY (ARRAY['storage_error'::text, 'source_error'::text, 'craft_error'::text, 'empty_evidence'::text])));
