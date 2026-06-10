CREATE POLICY "Auth read school campuses" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'school-campuses');
CREATE POLICY "Auth upload school campuses" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'school-campuses' AND owner = auth.uid());
CREATE POLICY "Auth update own school campuses" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'school-campuses' AND owner = auth.uid());
CREATE POLICY "Auth delete own school campuses" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'school-campuses' AND owner = auth.uid());