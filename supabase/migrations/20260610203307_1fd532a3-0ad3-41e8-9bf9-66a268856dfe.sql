CREATE TABLE public.trip_hotels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  map_url TEXT,
  address TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  cost NUMERIC,
  cost_currency TEXT DEFAULT 'GBP',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_hotels TO authenticated;
GRANT ALL ON public.trip_hotels TO service_role;

ALTER TABLE public.trip_hotels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own trip hotels"
  ON public.trip_hotels FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_trip_hotels_updated_at
  BEFORE UPDATE ON public.trip_hotels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_trip_hotels_trip_id ON public.trip_hotels(trip_id);