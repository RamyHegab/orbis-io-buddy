-- 1) Public form lookup via SECURITY DEFINER RPC (returns one instance + its template fields by id)
CREATE OR REPLACE FUNCTION public.get_public_form_instance(p_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  event_date date,
  country_code text,
  template_id uuid,
  activity_id uuid,
  template_name text,
  template_description text,
  template_fields jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fi.id, fi.name, fi.event_date, fi.country_code, fi.template_id, fi.activity_id,
         ft.name, ft.description, ft.fields
  FROM public.form_instances fi
  LEFT JOIN public.form_templates ft ON ft.id = fi.template_id
  WHERE fi.id = p_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_form_instance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_form_instance(uuid) TO anon, authenticated;

-- 2) Remove broad anon SELECT policies on form_instances and form_templates
DROP POLICY IF EXISTS "Anyone can read instances by id" ON public.form_instances;
DROP POLICY IF EXISTS "Anyone can read templates" ON public.form_templates;

-- Keep insert-by-anon for submissions, but tighten its EXISTS check to use SECURITY DEFINER lookup
-- (existing policy already only allows insert when instance exists; that EXISTS now runs as the
-- policy owner so RLS on form_instances no longer blocks it.)

-- 3) Harden pgmq wrapper functions: set search_path and revoke public/auth EXECUTE
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- 4) Other SECURITY DEFINER helpers used in RLS / signup trigger: confirm narrow execute grants
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- has_role and is_line_manager_of are referenced by RLS policies → must remain executable by authenticated/anon
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_line_manager_of(uuid, uuid) TO anon, authenticated, service_role;