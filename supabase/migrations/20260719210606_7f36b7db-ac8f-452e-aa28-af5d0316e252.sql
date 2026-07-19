-- Phase 3: tokenized public form access

-- 1) Ensure every form_instance has a unique token; backfill and enforce.
UPDATE public.form_instances
SET token = encode(gen_random_bytes(18), 'base64')
WHERE token IS NULL OR length(token) < 12;

-- Base64 uses +/=; strip to URL-safe.
UPDATE public.form_instances
SET token = translate(token, '+/=', '-_')
WHERE token ~ '[+/=]';

ALTER TABLE public.form_instances
  ALTER COLUMN token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS form_instances_token_key
  ON public.form_instances(token);

-- Auto-generate a URL-safe token on insert when missing.
CREATE OR REPLACE FUNCTION public.form_instance_ensure_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.token IS NULL OR length(NEW.token) < 12 THEN
    NEW.token := translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS form_instance_token_biu ON public.form_instances;
CREATE TRIGGER form_instance_token_biu
  BEFORE INSERT ON public.form_instances
  FOR EACH ROW EXECUTE FUNCTION public.form_instance_ensure_token();

-- 2) Public lookup by token — returns instance + template payload (parts + fields).
CREATE OR REPLACE FUNCTION public.get_form_instance_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  name text,
  event_date date,
  country_code text,
  template_id uuid,
  activity_id uuid,
  form_type public.form_type,
  template_name text,
  template_description text,
  template_fields jsonb,
  template_parts jsonb,
  template_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fi.id, fi.name, fi.event_date, fi.country_code, fi.template_id, fi.activity_id,
         fi.form_type,
         ft.name, ft.description, ft.fields, ft.parts, ft.is_active
  FROM public.form_instances fi
  LEFT JOIN public.form_templates ft ON ft.id = fi.template_id
  WHERE fi.token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_form_instance_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_form_instance_by_token(text) TO anon, authenticated, service_role;

-- 3) Public submission RPC: inserts into form_submissions using token, without exposing instance IDs.
CREATE OR REPLACE FUNCTION public.submit_public_form(
  p_token text,
  p_data jsonb,
  p_submitter_name text DEFAULT NULL,
  p_submitter_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fi record;
  new_sub_id uuid;
BEGIN
  SELECT id, template_id, activity_id
    INTO fi
  FROM public.form_instances
  WHERE token = p_token;

  IF fi.id IS NULL THEN
    RAISE EXCEPTION 'Invalid form token';
  END IF;

  INSERT INTO public.form_submissions (
    instance_id, template_id, activity_id, data, submitter_name, submitter_phone
  ) VALUES (
    fi.id,
    fi.template_id,
    COALESCE(fi.activity_id, fi.id),  -- activity_id is NOT NULL; fall back to instance for non-activity forms
    COALESCE(p_data, '{}'::jsonb),
    p_submitter_name,
    p_submitter_phone
  )
  RETURNING id INTO new_sub_id;

  RETURN new_sub_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_form(text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_form(text, jsonb, text, text) TO anon, authenticated, service_role;
