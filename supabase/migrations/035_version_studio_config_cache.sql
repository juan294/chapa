-- Give each Studio configuration write a database-ordered revision so Redis
-- can reject stale publications from another serverless instance.

CREATE SEQUENCE IF NOT EXISTS public.studio_config_revision_seq AS BIGINT;

ALTER TABLE public.studio_configs
  ADD COLUMN IF NOT EXISTS revision BIGINT;

UPDATE public.studio_configs
SET revision = nextval('public.studio_config_revision_seq')
WHERE revision IS NULL;

ALTER TABLE public.studio_configs
  ALTER COLUMN revision SET DEFAULT nextval('public.studio_config_revision_seq'),
  ALTER COLUMN revision SET NOT NULL;

ALTER SEQUENCE public.studio_config_revision_seq
  OWNED BY public.studio_configs.revision;

CREATE OR REPLACE FUNCTION public.set_studio_config_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.revision := nextval('public.studio_config_revision_seq');
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_studio_config_revision() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_studio_config_revision() TO service_role;

DROP TRIGGER IF EXISTS set_studio_config_revision ON public.studio_configs;
CREATE TRIGGER set_studio_config_revision
BEFORE UPDATE ON public.studio_configs
FOR EACH ROW
EXECUTE FUNCTION public.set_studio_config_revision();

REVOKE ALL ON SEQUENCE public.studio_config_revision_seq FROM anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.studio_config_revision_seq TO service_role;
