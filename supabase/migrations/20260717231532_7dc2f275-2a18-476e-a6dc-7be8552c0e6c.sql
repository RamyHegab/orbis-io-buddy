
-- Cycle settings per user
CREATE TABLE public.cycle_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_start_month int NOT NULL DEFAULT 9 CHECK (cycle_start_month BETWEEN 1 AND 12),
  cycle_start_year int NOT NULL DEFAULT 2025,
  cycle_end_month int NOT NULL DEFAULT 8 CHECK (cycle_end_month BETWEEN 1 AND 12),
  cycle_end_year int NOT NULL DEFAULT 2026,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cycle_settings TO authenticated;
GRANT ALL ON public.cycle_settings TO service_role;
ALTER TABLE public.cycle_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cycle_own" ON public.cycle_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_cycle_updated BEFORE UPDATE ON public.cycle_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Event cities suggestion store
CREATE TABLE public.event_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  city text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country, city)
);
GRANT SELECT, INSERT ON public.event_cities TO authenticated;
GRANT ALL ON public.event_cities TO service_role;
ALTER TABLE public.event_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cities_read" ON public.event_cities FOR SELECT TO authenticated USING (true);
CREATE POLICY "cities_insert" ON public.event_cities FOR INSERT TO authenticated WITH CHECK (true);

-- Events catalog
CREATE TABLE public.events_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  cities text[] NOT NULL DEFAULT '{}',
  cost numeric(12,2),
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','planning','confirmed','done')),
  traveller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events_catalog TO authenticated;
GRANT ALL ON public.events_catalog TO service_role;
ALTER TABLE public.events_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_read_all" ON public.events_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_write_admin" ON public.events_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_capability(auth.uid(), 'can_manage_templates'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_capability(auth.uid(), 'can_manage_templates'));
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Planned activities (timeline)
CREATE TABLE public.planned_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  event_ids uuid[] NOT NULL DEFAULT '{}',
  event_types text[] NOT NULL DEFAULT '{}',
  traveller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  academic_support text NOT NULL DEFAULT 'not_required' CHECK (academic_support IN ('required','preferred','not_required')),
  events_cost numeric(12,2) DEFAULT 0,
  travel_cost numeric(12,2) DEFAULT 0,
  hotel_cost numeric(12,2) DEFAULT 0,
  subsistence_cost numeric(12,2) DEFAULT 0,
  actual_events_cost numeric(12,2),
  actual_travel_cost numeric(12,2),
  actual_hotel_cost numeric(12,2),
  actual_subsistence_cost numeric(12,2),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','planning','confirmed','done')),
  objectives text,
  notes text,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  reminder_sent_at timestamptz,
  actual_cost_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX planned_activities_user_start_idx ON public.planned_activities(user_id, start_date);
CREATE INDEX planned_activities_status_idx ON public.planned_activities(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_activities TO authenticated;
GRANT ALL ON public.planned_activities TO service_role;
ALTER TABLE public.planned_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_owner_or_traveller_select" ON public.planned_activities FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR traveller_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_line_manager_of(auth.uid(), user_id)
  );
CREATE POLICY "pa_owner_insert" ON public.planned_activities FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "pa_owner_update" ON public.planned_activities FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR traveller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR traveller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pa_owner_delete" ON public.planned_activities FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_pa_updated BEFORE UPDATE ON public.planned_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
