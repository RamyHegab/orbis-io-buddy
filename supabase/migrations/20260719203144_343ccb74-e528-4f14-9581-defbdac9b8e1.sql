
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS sender_subdomain text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_local_part text;

-- validation
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_sender_subdomain_format;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_sender_subdomain_format
  CHECK (sender_subdomain IS NULL OR sender_subdomain ~ '^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_local_part_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_local_part_format
  CHECK (email_local_part IS NULL OR email_local_part ~ '^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$');

-- unique local part (case-insensitive) across the account
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_local_part_unique
  ON public.profiles (lower(email_local_part))
  WHERE email_local_part IS NOT NULL;
