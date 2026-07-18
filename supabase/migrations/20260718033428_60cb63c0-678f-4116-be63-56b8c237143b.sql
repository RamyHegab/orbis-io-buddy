-- Drop anon public read on app_settings (internal config); authenticated read remains.
DROP POLICY IF EXISTS "app_settings public read" ON public.app_settings;
REVOKE SELECT ON public.app_settings FROM anon;

-- Tighten event_cities INSERT policy: no more WITH CHECK (true).
DROP POLICY IF EXISTS "cities_insert" ON public.event_cities;
CREATE POLICY "cities_insert" ON public.event_cities
  FOR INSERT TO authenticated
  WITH CHECK (
    country IS NOT NULL AND length(btrim(country)) > 0
    AND city IS NOT NULL AND length(btrim(city)) > 0
  );

-- Revoke public/anon EXECUTE on the SECURITY DEFINER form lookup;
-- public form access now flows through /api/public/form-instance/:id (uses service role).
REVOKE EXECUTE ON FUNCTION public.get_public_form_instance(uuid) FROM anon, PUBLIC;
