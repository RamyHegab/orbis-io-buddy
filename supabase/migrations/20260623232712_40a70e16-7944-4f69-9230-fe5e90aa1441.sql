
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS line_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS profiles_line_manager_idx ON public.profiles(line_manager_id);

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email <> u.email);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count int;
  existing_profile uuid;
BEGIN
  SELECT id INTO existing_profile FROM public.profiles WHERE id = NEW.id;

  IF existing_profile IS NULL THEN
    INSERT INTO public.profiles (id, full_name, avatar_url, email, status)
    VALUES (NEW.id,
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.email,
            'active');
  ELSE
    UPDATE public.profiles
      SET email = NEW.email,
          status = CASE WHEN status = 'invited' THEN 'active' ELSE status END
      WHERE id = NEW.id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    SELECT count(*) INTO user_count FROM public.user_roles;
    IF user_count = 0 THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_line_manager_of(_manager uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user AND line_manager_id = _manager
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_line_manager_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_line_manager_of(uuid, uuid) TO authenticated, service_role;

-- trips
DROP POLICY IF EXISTS "Admins can view all trips" ON public.trips;
CREATE POLICY "Admins can view all trips" ON public.trips
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Managers can view reports trips" ON public.trips;
CREATE POLICY "Managers can view reports trips" ON public.trips
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager') AND is_line_manager_of(auth.uid(), user_id));

-- activities
DROP POLICY IF EXISTS "Admins can view all activities" ON public.activities;
CREATE POLICY "Admins can view all activities" ON public.activities
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Managers can view reports activities" ON public.activities;
CREATE POLICY "Managers can view reports activities" ON public.activities
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager') AND is_line_manager_of(auth.uid(), user_id));

-- trip_countries
DROP POLICY IF EXISTS "Admins can view all trip_countries" ON public.trip_countries;
CREATE POLICY "Admins can view all trip_countries" ON public.trip_countries
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Managers can view reports trip_countries" ON public.trip_countries;
CREATE POLICY "Managers can view reports trip_countries" ON public.trip_countries
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager') AND is_line_manager_of(auth.uid(), user_id));

-- trip_hotels
DROP POLICY IF EXISTS "Admins can view all trip_hotels" ON public.trip_hotels;
CREATE POLICY "Admins can view all trip_hotels" ON public.trip_hotels
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Managers can view reports trip_hotels" ON public.trip_hotels;
CREATE POLICY "Managers can view reports trip_hotels" ON public.trip_hotels
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager') AND is_line_manager_of(auth.uid(), user_id));

-- trip_reports
DROP POLICY IF EXISTS "Admins can view all trip_reports" ON public.trip_reports;
CREATE POLICY "Admins can view all trip_reports" ON public.trip_reports
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Managers can view reports trip_reports" ON public.trip_reports;
CREATE POLICY "Managers can view reports trip_reports" ON public.trip_reports
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager') AND is_line_manager_of(auth.uid(), user_id));

-- activity_comments
DROP POLICY IF EXISTS "Admins can view all activity_comments" ON public.activity_comments;
CREATE POLICY "Admins can view all activity_comments" ON public.activity_comments
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Managers can view reports activity_comments" ON public.activity_comments;
CREATE POLICY "Managers can view reports activity_comments" ON public.activity_comments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager') AND is_line_manager_of(auth.uid(), user_id));

-- user_roles: admins manage all
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- profiles: admins can manage any
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
