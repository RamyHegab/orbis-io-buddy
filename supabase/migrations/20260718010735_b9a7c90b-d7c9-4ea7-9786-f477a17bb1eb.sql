-- Scalar text country columns
UPDATE public.agents SET hq_country = 'Türkiye' WHERE hq_country = 'Turkey';
UPDATE public.agent_branches SET country = 'Türkiye' WHERE country = 'Turkey';
UPDATE public.schools SET country = 'Türkiye' WHERE country = 'Turkey';
UPDATE public.trip_countries SET country = 'Türkiye' WHERE country = 'Turkey';
UPDATE public.activities SET to_country = 'Türkiye' WHERE to_country = 'Turkey';
UPDATE public.activities SET from_country = 'Türkiye' WHERE from_country = 'Turkey';
UPDATE public.event_cities SET country = 'Türkiye' WHERE country = 'Turkey';

-- Text-array country columns
UPDATE public.agents SET countries_of_operation = array_replace(countries_of_operation, 'Turkey', 'Türkiye')
  WHERE 'Turkey' = ANY(countries_of_operation);
UPDATE public.trips SET destinations = array_replace(destinations, 'Turkey', 'Türkiye')
  WHERE 'Turkey' = ANY(destinations);
UPDATE public.planned_activities SET countries = array_replace(countries, 'Turkey', 'Türkiye')
  WHERE 'Turkey' = ANY(countries);
UPDATE public.events_catalog SET countries = array_replace(countries, 'Turkey', 'Türkiye')
  WHERE 'Turkey' = ANY(countries);
