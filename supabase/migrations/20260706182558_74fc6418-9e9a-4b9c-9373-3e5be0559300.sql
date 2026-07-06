
-- Per-user capability flags on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_manage_agents boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_schools boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_all_trips boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_templates boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_users boolean NOT NULL DEFAULT false;

-- Security-definer helper: admins implicitly have every capability
CREATE OR REPLACE FUNCTION public.has_capability(_user_id uuid, _cap text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v boolean;
BEGIN
  IF public.has_role(_user_id, 'admin'::app_role) THEN
    RETURN true;
  END IF;
  EXECUTE format('SELECT %I FROM public.profiles WHERE id = $1', _cap)
    INTO v USING _user_id;
  RETURN COALESCE(v, false);
END;
$$;

-- Agents: allow capability-bearers to edit any agent
DROP POLICY IF EXISTS "Agent managers can insert agents" ON public.agents;
DROP POLICY IF EXISTS "Agent managers can update agents" ON public.agents;
DROP POLICY IF EXISTS "Agent managers can delete agents" ON public.agents;
CREATE POLICY "Agent managers can insert agents" ON public.agents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(auth.uid(), 'can_manage_agents'));
CREATE POLICY "Agent managers can update agents" ON public.agents
  FOR UPDATE TO authenticated
  USING (public.has_capability(auth.uid(), 'can_manage_agents'))
  WITH CHECK (public.has_capability(auth.uid(), 'can_manage_agents'));
CREATE POLICY "Agent managers can delete agents" ON public.agents
  FOR DELETE TO authenticated
  USING (public.has_capability(auth.uid(), 'can_manage_agents'));

-- Agent branches: same
DROP POLICY IF EXISTS "Agent managers can insert branches" ON public.agent_branches;
DROP POLICY IF EXISTS "Agent managers can update branches" ON public.agent_branches;
DROP POLICY IF EXISTS "Agent managers can delete branches" ON public.agent_branches;
CREATE POLICY "Agent managers can insert branches" ON public.agent_branches
  FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(auth.uid(), 'can_manage_agents'));
CREATE POLICY "Agent managers can update branches" ON public.agent_branches
  FOR UPDATE TO authenticated
  USING (public.has_capability(auth.uid(), 'can_manage_agents'))
  WITH CHECK (public.has_capability(auth.uid(), 'can_manage_agents'));
CREATE POLICY "Agent managers can delete branches" ON public.agent_branches
  FOR DELETE TO authenticated
  USING (public.has_capability(auth.uid(), 'can_manage_agents'));

-- Schools
DROP POLICY IF EXISTS "School managers can insert schools" ON public.schools;
DROP POLICY IF EXISTS "School managers can update schools" ON public.schools;
DROP POLICY IF EXISTS "School managers can delete schools" ON public.schools;
CREATE POLICY "School managers can insert schools" ON public.schools
  FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(auth.uid(), 'can_manage_schools'));
CREATE POLICY "School managers can update schools" ON public.schools
  FOR UPDATE TO authenticated
  USING (public.has_capability(auth.uid(), 'can_manage_schools'))
  WITH CHECK (public.has_capability(auth.uid(), 'can_manage_schools'));
CREATE POLICY "School managers can delete schools" ON public.schools
  FOR DELETE TO authenticated
  USING (public.has_capability(auth.uid(), 'can_manage_schools'));

-- Trips visibility: capability-bearers can view all trips/activities/reports
DROP POLICY IF EXISTS "Trip viewers can view all trips" ON public.trips;
CREATE POLICY "Trip viewers can view all trips" ON public.trips
  FOR SELECT TO authenticated
  USING (public.has_capability(auth.uid(), 'can_view_all_trips'));

DROP POLICY IF EXISTS "Trip viewers can view all activities" ON public.activities;
CREATE POLICY "Trip viewers can view all activities" ON public.activities
  FOR SELECT TO authenticated
  USING (public.has_capability(auth.uid(), 'can_view_all_trips'));

DROP POLICY IF EXISTS "Trip viewers can view all trip_reports" ON public.trip_reports;
CREATE POLICY "Trip viewers can view all trip_reports" ON public.trip_reports
  FOR SELECT TO authenticated
  USING (public.has_capability(auth.uid(), 'can_view_all_trips'));

-- Form templates: capability-bearers can manage
DROP POLICY IF EXISTS "Template managers can insert templates" ON public.form_templates;
DROP POLICY IF EXISTS "Template managers can update templates" ON public.form_templates;
DROP POLICY IF EXISTS "Template managers can delete templates" ON public.form_templates;
CREATE POLICY "Template managers can insert templates" ON public.form_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_capability(auth.uid(), 'can_manage_templates'));
CREATE POLICY "Template managers can update templates" ON public.form_templates
  FOR UPDATE TO authenticated
  USING (public.has_capability(auth.uid(), 'can_manage_templates'))
  WITH CHECK (public.has_capability(auth.uid(), 'can_manage_templates'));
CREATE POLICY "Template managers can delete templates" ON public.form_templates
  FOR DELETE TO authenticated
  USING (public.has_capability(auth.uid(), 'can_manage_templates'));

-- Grant admins all capabilities implicitly through has_capability; also
-- backfill existing admin profiles so the profile row reflects the truth.
UPDATE public.profiles p
SET can_manage_agents = true,
    can_manage_schools = true,
    can_view_all_trips = true,
    can_manage_templates = true,
    can_manage_users = true
WHERE public.has_role(p.id, 'admin'::app_role);
