-- Add 'canceled' status to planning timeline statuses and trip_status enum

-- 1. Extend planned_activities status check
ALTER TABLE public.planned_activities DROP CONSTRAINT planned_activities_status_check;
ALTER TABLE public.planned_activities ADD CONSTRAINT planned_activities_status_check
  CHECK (status IN ('proposed','planning','confirmed','done','canceled'));

-- 2. Extend events_catalog status check
ALTER TABLE public.events_catalog DROP CONSTRAINT events_catalog_status_check;
ALTER TABLE public.events_catalog ADD CONSTRAINT events_catalog_status_check
  CHECK (status IN ('proposed','planning','confirmed','done','canceled'));

-- 3. Extend trip_status enum for itinerary trips
ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'canceled';
