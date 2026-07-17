
-- 1) Restrict profile SELECT to self + admins
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Safe display lookup for non-admins (names/avatars only)
CREATE OR REPLACE FUNCTION public.get_user_display(_ids uuid[])
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
$$;

REVOKE ALL ON FUNCTION public.get_user_display(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_display(uuid[]) TO authenticated;

-- 3) Revoke anon EXECUTE on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_line_manager_of(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_capability(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;
