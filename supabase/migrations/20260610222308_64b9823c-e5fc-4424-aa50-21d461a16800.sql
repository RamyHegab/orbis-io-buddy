ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS objectives text;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS objectives text;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS visit_notes text;