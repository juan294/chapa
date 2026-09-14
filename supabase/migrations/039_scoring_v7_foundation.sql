-- Refs #1296. Additive v7 evidence/receipt foundation; v6 rows are untouched.
-- GitHub sessions are authenticated by the application, not Supabase Auth.
-- Only the trusted service role can invoke these functions/read these tables.
-- Routes must derive actor handles from verified sessions, never request JSON.

CREATE TABLE public.scoring_v7_subjects (
  owner_handle text PRIMARY KEY CHECK (owner_handle = lower(btrim(owner_handle)) AND length(owner_handle) BETWEEN 1 AND 100),
  public_evidence_consent boolean NOT NULL DEFAULT false,
  consent_recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT public_evidence_consent OR consent_recorded_at IS NOT NULL)
);

CREATE TABLE public.scoring_v7_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_handle text NOT NULL REFERENCES public.scoring_v7_subjects ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('github','gitlab','bitbucket','codeberg','supplemental','portfolio')),
  host text NOT NULL CHECK (length(btrim(host)) > 0),
  subject_id text NOT NULL CHECK (length(btrim(subject_id)) > 0),
  access_context_id text NOT NULL CHECK (length(btrim(access_context_id)) > 0),
  declared_scope jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(declared_scope) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_handle, id),
  UNIQUE (owner_handle, provider, host, subject_id, access_context_id)
);

CREATE TABLE public.scoring_v7_source_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  owner_handle text NOT NULL,
  reference_time timestamptz NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  data_through timestamptz,
  coverage jsonb NOT NULL CHECK (jsonb_typeof(coverage) = 'object'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (owner_handle, source_id) REFERENCES public.scoring_v7_sources (owner_handle, id) ON DELETE CASCADE,
  UNIQUE (owner_handle, id),
  CHECK (window_start = (date_trunc('day', reference_time AT TIME ZONE 'UTC') - interval '364 days') AT TIME ZONE 'UTC'),
  CHECK (window_end = (date_trunc('day', reference_time AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC'),
  CHECK (data_through <= reference_time)
);
CREATE INDEX scoring_v7_observations_source_time ON public.scoring_v7_source_observations (source_id, reference_time DESC);

CREATE TABLE public.scoring_v7_reviewer_grants (
  owner_handle text NOT NULL REFERENCES public.scoring_v7_subjects ON DELETE CASCADE,
  reviewer_handle text NOT NULL CHECK (reviewer_handle = lower(btrim(reviewer_handle)) AND length(reviewer_handle) BETWEEN 1 AND 100),
  granted_by text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (owner_handle, reviewer_handle),
  CHECK (granted_by = owner_handle AND reviewer_handle <> owner_handle)
);

CREATE TABLE public.scoring_v7_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_handle text NOT NULL REFERENCES public.scoring_v7_subjects ON DELETE CASCADE,
  claim_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  supersedes_id uuid UNIQUE,
  action text NOT NULL DEFAULT 'create' CHECK (action IN ('create','correct','retract')),
  state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','retracted')),
  channel text NOT NULL CHECK (channel IN ('core','craft')),
  work_item_id text NOT NULL CHECK (length(btrim(work_item_id)) > 0),
  category text NOT NULL CHECK (category IN ('delivered_benefit','correctness_security','performance_accessibility','reliability_cost','design_documentation','mentoring_review','maintenance_incident_recovery','implementation','verification_review','documentation_design','maintenance_support','craft')),
  occurred_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  source_observation_id uuid,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_handle, id),
  UNIQUE (owner_handle, claim_id, revision),
  FOREIGN KEY (owner_handle, supersedes_id) REFERENCES public.scoring_v7_evidence (owner_handle, id),
  FOREIGN KEY (owner_handle, source_observation_id) REFERENCES public.scoring_v7_source_observations (owner_handle, id),
  CHECK ((revision = 1 AND supersedes_id IS NULL) OR (revision > 1 AND supersedes_id IS NOT NULL)),
  CHECK ((action = 'retract') = (state = 'retracted')),
  CHECK ((revision = 1 AND action = 'create') OR (revision > 1 AND action IN ('correct','retract'))),
  CHECK ((period_start IS NULL AND period_end IS NULL) OR (period_start IS NOT NULL AND period_end IS NOT NULL AND period_start <= period_end))
);
CREATE INDEX scoring_v7_evidence_owner_work ON public.scoring_v7_evidence (owner_handle, work_item_id, channel);

CREATE TABLE public.scoring_v7_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_handle text NOT NULL,
  evidence_id uuid NOT NULL,
  assessment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  work_item_id text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  action text NOT NULL DEFAULT 'create' CHECK (action IN ('create','correct','retract')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  provenance text NOT NULL DEFAULT 'human_assessed' CHECK (provenance IN ('source_observed','self_reported','automated_assessment','human_assessed','independently_corroborated')),
  supersedes_id uuid UNIQUE,
  criterion text NOT NULL CHECK (criterion IN ('rationale','verification','review_or_correction','outcome_followup','framing','verification_debugging','tool_judgment','accepted_outcome')),
  verdict text NOT NULL CHECK (verdict IN ('accepted','rejected','unassessed','retracted')),
  evaluator_handle text NOT NULL,
  evaluator_type text NOT NULL CHECK (evaluator_type IN ('human','model')),
  evaluator_version text NOT NULL DEFAULT 'human',
  evaluator_independent boolean NOT NULL DEFAULT false,
  independently_corroborated boolean NOT NULL DEFAULT false,
  rubric_version text NOT NULL CHECK (length(btrim(rubric_version)) > 0),
  rationale text NOT NULL CHECK (length(btrim(rationale)) > 0),
  reason_code text NOT NULL CHECK (reason_code ~ '^[a-z][a-z0-9_]{0,79}$'),
  evidence_reference_ids jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(evidence_reference_ids) = 'array'),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_handle, id),
  UNIQUE (owner_handle, assessment_id, revision),
  CHECK ((revision = 1 AND supersedes_id IS NULL AND action = 'create') OR (revision > 1 AND supersedes_id IS NOT NULL AND action IN ('correct','retract'))),
  CHECK ((action = 'retract') = (verdict = 'retracted')),
  CHECK ((provenance = 'independently_corroborated') = independently_corroborated),
  FOREIGN KEY (owner_handle, evidence_id) REFERENCES public.scoring_v7_evidence (owner_handle, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_handle, supersedes_id) REFERENCES public.scoring_v7_assessments (owner_handle, id) ON DELETE CASCADE,
  CHECK (NOT independently_corroborated OR (evaluator_handle <> owner_handle AND evaluator_type = 'human' AND evaluator_independent))
);
CREATE INDEX scoring_v7_assessments_evidence ON public.scoring_v7_assessments (evidence_id, assessed_at DESC);

-- Private artifact locators persist separately from short-lived raw bodies.
CREATE TABLE public.scoring_v7_evidence_references (
  owner_handle text NOT NULL REFERENCES public.scoring_v7_subjects ON DELETE CASCADE,
  reference_id text NOT NULL CHECK (length(btrim(reference_id)) > 0),
  artifact_uri text NOT NULL CHECK (length(btrim(artifact_uri)) > 0),
  artifact_revision text NOT NULL,
  observed_at timestamptz NOT NULL,
  retention text NOT NULL CHECK (retention IN ('raw_30_days','until_owner_withdrawal')),
  expires_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_handle, reference_id),
  CHECK ((retention = 'until_owner_withdrawal' AND expires_at IS NULL) OR (retention = 'raw_30_days' AND expires_at IS NOT NULL AND expires_at <= recorded_at + interval '30 days'))
);

CREATE TABLE public.scoring_v7_raw_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_handle text NOT NULL REFERENCES public.scoring_v7_subjects ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('insights','fetched_artifact','supplemental')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 days')
);
CREATE INDEX scoring_v7_raw_expiry ON public.scoring_v7_raw_artifacts (expires_at);

CREATE TABLE public.scoring_v7_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_handle text NOT NULL REFERENCES public.scoring_v7_subjects ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 7 CHECK (schema_version = 7),
  policy_version text NOT NULL CHECK (length(btrim(policy_version)) > 0),
  reference_time timestamptz NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  supersedes_id uuid UNIQUE,
  canonical_receipt text NOT NULL,
  public_receipt jsonb NOT NULL CHECK (jsonb_typeof(public_receipt) = 'object'),
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_handle, id),
  UNIQUE (owner_handle, reference_time, revision),
  FOREIGN KEY (owner_handle, supersedes_id) REFERENCES public.scoring_v7_receipts (owner_handle, id),
  CHECK (canonical_receipt::jsonb = public_receipt),
  CHECK ((revision = 1 AND supersedes_id IS NULL) OR (revision > 1 AND supersedes_id IS NOT NULL))
);
CREATE INDEX scoring_v7_receipts_owner_time ON public.scoring_v7_receipts (owner_handle, reference_time DESC, revision DESC);

CREATE TABLE public.scoring_v7_verification (
  signature text PRIMARY KEY CHECK (signature ~ '^[0-9a-f]{64}$'),
  receipt_id uuid NOT NULL REFERENCES public.scoring_v7_receipts ON DELETE CASCADE,
  key_version text NOT NULL CHECK (length(btrim(key_version)) > 0),
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (receipt_id, key_version)
);

CREATE TABLE public.scoring_v7_trend_anchors (
  owner_handle text NOT NULL,
  policy_version text NOT NULL,
  date date NOT NULL,
  receipt_id uuid NOT NULL,
  previous_receipt_id uuid,
  previous_date date,
  previous_value double precision,
  raw_value double precision NOT NULL CHECK (raw_value BETWEEN 0 AND 100),
  value double precision NOT NULL CHECK (value BETWEEN 0 AND 100),
  PRIMARY KEY (owner_handle, policy_version, date),
  FOREIGN KEY (owner_handle, receipt_id) REFERENCES public.scoring_v7_receipts (owner_handle, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_handle, previous_receipt_id) REFERENCES public.scoring_v7_receipts (owner_handle, id),
  CHECK ((previous_receipt_id IS NULL AND previous_date IS NULL AND previous_value IS NULL) OR (previous_receipt_id IS NOT NULL AND previous_date IS NOT NULL AND previous_value IS NOT NULL AND previous_date < date AND previous_value BETWEEN 0 AND 100))
);

-- No handle, reason, hash of private content or source reference survives withdrawal.
CREATE TABLE public.scoring_v7_revocations (
  receipt_id uuid PRIMARY KEY,
  revoked_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.scoring_v7_can_review(p_owner text, p_actor text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.scoring_v7_subjects WHERE owner_handle = p_owner)
    AND (p_actor = p_owner OR EXISTS (
      SELECT 1 FROM public.scoring_v7_reviewer_grants
      WHERE owner_handle = p_owner AND reviewer_handle = p_actor AND revoked_at IS NULL
    ));
$$;

CREATE FUNCTION public.scoring_v7_check_assessment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.scoring_v7_evidence WHERE id = NEW.evidence_id AND work_item_id = NEW.work_item_id) THEN
    RAISE EXCEPTION 'assessment work item must match its evidence';
  END IF;
  IF NOT public.scoring_v7_can_review(NEW.owner_handle, NEW.evaluator_handle) THEN
    RAISE EXCEPTION 'scoring reviewer access denied' USING ERRCODE = '42501';
  END IF;
  IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.scoring_v7_assessments p WHERE p.id = NEW.supersedes_id
      AND p.evidence_id = NEW.evidence_id AND p.criterion = NEW.criterion
      AND p.assessment_id = NEW.assessment_id AND p.revision + 1 = NEW.revision
  ) THEN RAISE EXCEPTION 'assessment revision must retain evidence and criterion'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER scoring_v7_assessment_access BEFORE INSERT ON public.scoring_v7_assessments FOR EACH ROW EXECUTE FUNCTION public.scoring_v7_check_assessment();

CREATE FUNCTION public.scoring_v7_check_evidence_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.scoring_v7_evidence p WHERE p.id = NEW.supersedes_id
      AND p.claim_id = NEW.claim_id AND p.owner_handle = NEW.owner_handle
      AND p.channel = NEW.channel AND p.revision + 1 = NEW.revision
  ) THEN RAISE EXCEPTION 'evidence revision must follow the same claim and channel'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER scoring_v7_evidence_revision BEFORE INSERT ON public.scoring_v7_evidence FOR EACH ROW EXECUTE FUNCTION public.scoring_v7_check_evidence_revision();

CREATE FUNCTION public.scoring_v7_check_receipt_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.scoring_v7_revocations WHERE receipt_id = NEW.id) THEN
    RAISE EXCEPTION 'revoked receipt identifiers cannot be reused';
  END IF;
  IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.scoring_v7_receipts p WHERE p.id = NEW.supersedes_id
      AND p.owner_handle = NEW.owner_handle AND p.policy_version = NEW.policy_version
      AND p.reference_time = NEW.reference_time AND p.revision + 1 = NEW.revision
  ) THEN RAISE EXCEPTION 'receipt revision must follow the same owner, policy and reference instant'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER scoring_v7_receipt_revision BEFORE INSERT ON public.scoring_v7_receipts FOR EACH ROW EXECUTE FUNCTION public.scoring_v7_check_receipt_revision();

CREATE FUNCTION public.scoring_v7_check_trend_anchor()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE prior public.scoring_v7_trend_anchors; issued public.scoring_v7_receipts;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.owner_handle || ':' || NEW.policy_version, 7));
  IF TG_OP = 'UPDATE' AND (OLD.owner_handle, OLD.policy_version, OLD.date) IS DISTINCT FROM (NEW.owner_handle, NEW.policy_version, NEW.date) THEN
    RAISE EXCEPTION 'trend anchor identity is immutable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.scoring_v7_trend_anchors WHERE owner_handle = NEW.owner_handle AND policy_version = NEW.policy_version AND date > NEW.date) THEN
    RAISE EXCEPTION 'a historical anchor already used by a later date is immutable';
  END IF;
  SELECT * INTO issued FROM public.scoring_v7_receipts WHERE id = NEW.receipt_id;
  IF issued.id IS NULL OR issued.owner_handle <> NEW.owner_handle OR issued.policy_version <> NEW.policy_version
    OR (issued.reference_time AT TIME ZONE 'UTC')::date <> NEW.date THEN
    RAISE EXCEPTION 'trend anchor must reference its owner, date and policy receipt';
  END IF;
  IF issued.public_receipt #>> '{core,composite,kind}' IS DISTINCT FROM 'point'
    OR (issued.public_receipt #>> '{core,composite,value}')::double precision IS DISTINCT FROM NEW.raw_value THEN
    RAISE EXCEPTION 'only the exact raw point from the referenced receipt enters a trend';
  END IF;
  SELECT * INTO prior FROM public.scoring_v7_trend_anchors
    WHERE owner_handle = NEW.owner_handle AND policy_version = NEW.policy_version AND date < NEW.date ORDER BY date DESC LIMIT 1;
  IF (NEW.previous_receipt_id, NEW.previous_date, NEW.previous_value) IS DISTINCT FROM (prior.receipt_id, prior.date, prior.value) THEN
    RAISE EXCEPTION 'trend must use the latest preceding immutable anchor';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER scoring_v7_trend_identity BEFORE INSERT OR UPDATE ON public.scoring_v7_trend_anchors FOR EACH ROW EXECUTE FUNCTION public.scoring_v7_check_trend_anchor();

CREATE FUNCTION public.scoring_v7_reject_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'scoring revisions are immutable; append a new revision'; END;
$$;

-- Withdrawal is a transaction. Cascades remove every private backing row; receipt
-- tombstones are inserted before deletion and are intentionally not foreign keys.
CREATE FUNCTION public.scoring_v7_withdraw(p_owner text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.scoring_v7_subjects WHERE owner_handle = p_owner FOR UPDATE;
  INSERT INTO public.scoring_v7_revocations (receipt_id)
    SELECT id FROM public.scoring_v7_receipts WHERE owner_handle = p_owner
    ON CONFLICT (receipt_id) DO NOTHING;
  DELETE FROM public.scoring_v7_trend_anchors WHERE owner_handle = p_owner;
  DELETE FROM public.scoring_v7_evidence WHERE owner_handle = p_owner;
  DELETE FROM public.scoring_v7_subjects WHERE owner_handle = p_owner;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['subjects','sources','source_observations','reviewer_grants','evidence','assessments','evidence_references','raw_artifacts','receipts','verification','trend_anchors','revocations'] LOOP
    EXECUTE format('ALTER TABLE public.scoring_v7_%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.scoring_v7_%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.scoring_v7_%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, DELETE ON public.scoring_v7_%I TO service_role', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['source_observations','evidence','assessments','evidence_references','receipts','verification','revocations'] LOOP
    EXECUTE format('CREATE TRIGGER scoring_v7_immutable BEFORE UPDATE ON public.scoring_v7_%I FOR EACH ROW EXECUTE FUNCTION public.scoring_v7_reject_update()', t);
  END LOOP;
END;
$$;
GRANT UPDATE ON public.scoring_v7_subjects, public.scoring_v7_sources, public.scoring_v7_reviewer_grants, public.scoring_v7_trend_anchors TO service_role;
REVOKE ALL ON FUNCTION public.scoring_v7_can_review(text,text), public.scoring_v7_withdraw(text), public.scoring_v7_check_assessment(), public.scoring_v7_check_evidence_revision(), public.scoring_v7_reject_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_can_review(text,text), public.scoring_v7_withdraw(text), public.scoring_v7_check_assessment(), public.scoring_v7_check_evidence_revision(), public.scoring_v7_reject_update() TO service_role;

REVOKE ALL ON FUNCTION public.scoring_v7_check_receipt_revision(), public.scoring_v7_check_trend_anchor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_check_receipt_revision(), public.scoring_v7_check_trend_anchor() TO service_role;

-- Account deletion also removes this person's participation as a reviewer in
-- other owners' private ledgers. Dependent assessment revisions cascade.
CREATE FUNCTION public.scoring_v7_delete_user(p_handle text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM public.scoring_v7_withdraw(p_handle);
  DELETE FROM public.scoring_v7_assessments WHERE evaluator_handle = p_handle;
  DELETE FROM public.scoring_v7_reviewer_grants WHERE reviewer_handle = p_handle;
END;
$$;
REVOKE ALL ON FUNCTION public.scoring_v7_delete_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoring_v7_delete_user(text) TO service_role;
