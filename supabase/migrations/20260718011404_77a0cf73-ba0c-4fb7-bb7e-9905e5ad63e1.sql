
ALTER TABLE public.trips
  ADD COLUMN archived boolean NOT NULL DEFAULT false,
  ADD COLUMN archived_cycle text,
  ADD COLUMN archived_at timestamptz;

ALTER TABLE public.planned_activities
  ADD COLUMN archived boolean NOT NULL DEFAULT false,
  ADD COLUMN archived_cycle text,
  ADD COLUMN archived_at timestamptz;

ALTER TABLE public.events_catalog
  ADD COLUMN archived boolean NOT NULL DEFAULT false,
  ADD COLUMN archived_cycle text,
  ADD COLUMN archived_at timestamptz;

CREATE INDEX IF NOT EXISTS trips_archived_cycle_idx ON public.trips (archived, archived_cycle);
CREATE INDEX IF NOT EXISTS planned_activities_archived_cycle_idx ON public.planned_activities (archived, archived_cycle);
CREATE INDEX IF NOT EXISTS events_catalog_archived_cycle_idx ON public.events_catalog (archived, archived_cycle);
