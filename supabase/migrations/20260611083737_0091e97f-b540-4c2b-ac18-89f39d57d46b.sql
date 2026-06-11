-- Tighten pending_submissions: admin-only read/update/delete
DROP POLICY IF EXISTS "Authenticated can read" ON public.pending_submissions;
DROP POLICY IF EXISTS "Authenticated can update" ON public.pending_submissions;
DROP POLICY IF EXISTS "Authenticated can delete" ON public.pending_submissions;

CREATE POLICY "Admins can read pending submissions"
  ON public.pending_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pending submissions"
  ON public.pending_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pending submissions"
  ON public.pending_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- handle_new_user is a trigger function; remove API-callable execute rights
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
