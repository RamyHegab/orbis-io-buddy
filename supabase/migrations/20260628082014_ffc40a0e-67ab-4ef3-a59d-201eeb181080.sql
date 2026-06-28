DO $$
DECLARE demo_id uuid;
BEGIN
  SELECT id INTO demo_id FROM auth.users WHERE lower(email) = 'demo@orbis.app';
  IF demo_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = demo_id;
  END IF;
END $$;