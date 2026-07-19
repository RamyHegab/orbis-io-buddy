
DROP POLICY IF EXISTS "Managers can view reports trip_countries" ON public.trip_countries;
DROP POLICY IF EXISTS "Managers can view reports trip_hotels" ON public.trip_hotels;
DROP POLICY IF EXISTS "Managers can view reports activity_comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Line managers can view reports trips" ON public.trips;
DROP POLICY IF EXISTS "Line managers can view reports activities" ON public.activities;
DROP POLICY IF EXISTS "Line managers can view reports trip_reports" ON public.trip_reports;

DROP POLICY IF EXISTS "pa_owner_or_traveller_select" ON public.planned_activities;
CREATE POLICY "pa_owner_or_traveller_select" ON public.planned_activities
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR traveller_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Manager can view their approvals" ON public.trip_approvals;
DROP POLICY IF EXISTS "Manager can update their approval" ON public.trip_approvals;

CREATE POLICY "Admin can update approvals" ON public.trip_approvals
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.trip_approvals ALTER COLUMN manager_id DROP NOT NULL;

DROP FUNCTION IF EXISTS public.is_line_manager_of(uuid, uuid);
ALTER TABLE public.profiles DROP COLUMN IF EXISTS line_manager_id;
