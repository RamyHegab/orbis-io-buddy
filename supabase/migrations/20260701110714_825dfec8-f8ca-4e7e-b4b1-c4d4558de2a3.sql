
UPDATE public.trip_hotels
  SET map_url = NULL
  WHERE map_url IS NOT NULL AND map_url !~* '^https?://';

UPDATE public.activities
  SET map_url = NULL
  WHERE map_url IS NOT NULL AND map_url !~* '^https?://';

ALTER TABLE public.trip_hotels
  ADD CONSTRAINT trip_hotels_map_url_http
  CHECK (map_url IS NULL OR map_url ~* '^https?://');

ALTER TABLE public.activities
  ADD CONSTRAINT activities_map_url_http
  CHECK (map_url IS NULL OR map_url ~* '^https?://');
