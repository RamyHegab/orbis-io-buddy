
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS theme_primary text,
  ADD COLUMN IF NOT EXISTS theme_accent text,
  ADD COLUMN IF NOT EXISTS theme_sidebar text;

-- Allow anon SELECT on app_settings so the branding shows on the public /auth page too
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='app_settings public read') THEN
    CREATE POLICY "app_settings public read" ON public.app_settings FOR SELECT TO anon USING (true);
  END IF;
END $$;

GRANT SELECT ON public.app_settings TO anon;
