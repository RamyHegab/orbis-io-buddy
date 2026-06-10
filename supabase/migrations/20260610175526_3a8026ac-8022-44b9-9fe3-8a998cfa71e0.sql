
-- Per-country date ranges within a trip
CREATE TABLE public.trip_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  country text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_countries TO authenticated;
GRANT ALL ON public.trip_countries TO service_role;
ALTER TABLE public.trip_countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own trip_countries"
  ON public.trip_countries FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_trip_countries_updated_at
  BEFORE UPDATE ON public.trip_countries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX trip_countries_trip_idx ON public.trip_countries(trip_id);

-- Activity enrichments
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS transport_mode text,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS airline text,
  ADD COLUMN IF NOT EXISTS flight_number text,
  ADD COLUMN IF NOT EXISTS cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS cost_currency text,
  ADD COLUMN IF NOT EXISTS resting_type text,
  ADD COLUMN IF NOT EXISTS description text;
