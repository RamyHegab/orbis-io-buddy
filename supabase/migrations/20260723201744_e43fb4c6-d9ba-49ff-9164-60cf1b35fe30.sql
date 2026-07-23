
-- Profiles new fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS job_role text,
  ADD COLUMN IF NOT EXISTS line_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_line_manager ON public.profiles(line_manager_id);

-- User <-> Agent assignments
CREATE TABLE IF NOT EXISTS public.user_agent_assignments (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, agent_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_agent_assignments TO authenticated;
GRANT ALL ON public.user_agent_assignments TO service_role;
ALTER TABLE public.user_agent_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own assignments"
  ON public.user_agent_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_capability(auth.uid(), 'can_manage_users'));

CREATE POLICY "Managers write assignments"
  ON public.user_agent_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_capability(auth.uid(), 'can_manage_users'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_capability(auth.uid(), 'can_manage_users'));

-- Role permission defaults
CREATE TABLE IF NOT EXISTS public.role_permission_defaults (
  job_role text PRIMARY KEY,
  can_manage_agents boolean NOT NULL DEFAULT false,
  can_manage_schools boolean NOT NULL DEFAULT false,
  can_view_all_trips boolean NOT NULL DEFAULT false,
  can_manage_templates boolean NOT NULL DEFAULT false,
  can_manage_users boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permission_defaults TO authenticated;
GRANT ALL ON public.role_permission_defaults TO service_role;
ALTER TABLE public.role_permission_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers read role defaults"
  ON public.role_permission_defaults FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_capability(auth.uid(), 'can_manage_users'));

CREATE POLICY "Managers write role defaults"
  ON public.role_permission_defaults FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_capability(auth.uid(), 'can_manage_users'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_capability(auth.uid(), 'can_manage_users'));

-- Helper: is manager (walks line_manager_id chain, depth-capped)
CREATE OR REPLACE FUNCTION public.is_manager_of(_manager uuid, _user uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur uuid := _user;
  depth int := 0;
BEGIN
  IF _manager IS NULL OR _user IS NULL OR _manager = _user THEN
    RETURN false;
  END IF;
  WHILE cur IS NOT NULL AND depth < 20 LOOP
    SELECT line_manager_id INTO cur FROM public.profiles WHERE id = cur;
    IF cur = _manager THEN RETURN true; END IF;
    depth := depth + 1;
  END LOOP;
  RETURN false;
END;
$$;
