ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS from_city text,
  ADD COLUMN IF NOT EXISTS from_country text,
  ADD COLUMN IF NOT EXISTS to_city text,
  ADD COLUMN IF NOT EXISTS to_country text;