
-- Allow admins to update any trip (needed for archive/restore)
CREATE POLICY "Admins update all trips" ON public.trips
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to select all planned_activities (in case not already covered) — planned_activities select policy check
-- planned_activities: keep existing; already has admin via pa_owner_update for update.

-- events_catalog UPDATE already covered by events_write_admin (ALL).
