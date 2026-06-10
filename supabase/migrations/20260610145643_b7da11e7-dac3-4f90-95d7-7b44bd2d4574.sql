
DROP POLICY IF EXISTS "Auth read school campuses" ON storage.objects;
CREATE POLICY "Auth read own school campuses" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'school-campuses' AND owner = auth.uid());

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
