
-- Line-manager view access no longer requires the legacy 'manager' role;
-- being someone's line_manager_id (set by an admin) is enough.
DROP POLICY IF EXISTS "Managers can view reports trips" ON public.trips;
CREATE POLICY "Line managers can view reports trips" ON public.trips
  FOR SELECT TO authenticated
  USING (public.is_line_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Managers can view reports activities" ON public.activities;
CREATE POLICY "Line managers can view reports activities" ON public.activities
  FOR SELECT TO authenticated
  USING (public.is_line_manager_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "Managers can view reports trip_reports" ON public.trip_reports;
CREATE POLICY "Line managers can view reports trip_reports" ON public.trip_reports
  FOR SELECT TO authenticated
  USING (public.is_line_manager_of(auth.uid(), user_id));
