UPDATE public.agents SET countries_of_operation = array_replace(countries_of_operation, 'Eygpt', 'Egypt') WHERE 'Eygpt' = ANY(countries_of_operation);
UPDATE public.agents SET hq_country = 'Egypt' WHERE hq_country ILIKE 'eygpt';
UPDATE public.agent_branches SET country = 'Egypt' WHERE country ILIKE 'eygpt';