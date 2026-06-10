-- Reshape schools to match Notion contact form
ALTER TABLE public.schools RENAME COLUMN email TO general_email;
ALTER TABLE public.schools RENAME COLUMN phone TO general_phone;
ALTER TABLE public.schools RENAME COLUMN contact_name TO primary_contact_name;

ALTER TABLE public.schools
  ADD COLUMN address text,
  ADD COLUMN primary_contact_position text,
  ADD COLUMN primary_contact_email text,
  ADD COLUMN primary_contact_phone text,
  ADD COLUMN secondary_contact_name text,
  ADD COLUMN secondary_contact_email text,
  ADD COLUMN secondary_contact_phone text,
  ADD COLUMN campus_image_url text;