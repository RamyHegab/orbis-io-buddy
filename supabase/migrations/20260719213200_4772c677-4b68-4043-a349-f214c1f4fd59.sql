
-- Helper: split a comma-separated string into a text array (trimmed, non-empty)
CREATE OR REPLACE FUNCTION public._split_csv(_s text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT btrim(x)
      FROM regexp_split_to_table(COALESCE(_s, ''), ',') AS x
      WHERE btrim(x) <> ''
    ),
    ARRAY[]::text[]
  );
$$;

CREATE OR REPLACE FUNCTION public.process_agent_signup_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fi record;
  d jsonb;
  ref jsonb;
  doc jsonb;
  sup jsonb;
BEGIN
  SELECT id, form_type, related_agent_id
    INTO fi
  FROM public.form_instances
  WHERE id = NEW.instance_id;

  IF fi.form_type IS DISTINCT FROM 'agent_signup'::form_type THEN
    RETURN NEW;
  END IF;
  IF fi.related_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  d := COALESCE(NEW.data, '{}'::jsonb);

  -- Backfill agent core fields
  UPDATE public.agents SET
    trading_name           = COALESCE(NULLIF(d->>'__locked__agent_name', ''), trading_name),
    website                = COALESCE(NULLIF(d->>'__locked__website', ''), website),
    hq_country             = COALESCE(NULLIF(d->>'__locked__hq_country', ''), hq_country),
    countries_of_operation = CASE
      WHEN COALESCE(d->>'__locked__countries_of_operation', '') = '' THEN countries_of_operation
      ELSE public._split_csv(d->>'__locked__countries_of_operation')
    END,
    main_contact_name      = COALESCE(NULLIF(d->>'__locked__contact_person', ''), main_contact_name),
    main_contact_email     = COALESCE(NULLIF(d->>'__locked__contact_email', ''), main_contact_email),
    main_contact_phone     = COALESCE(NULLIF(d->>'__locked__contact_phone', ''), main_contact_phone),
    status                 = 'onboarding'::agent_status,
    updated_at             = now()
  WHERE id = fi.related_agent_id;

  -- Declared number of branches (numeric text -> int, ignore invalid)
  BEGIN
    UPDATE public.agent_onboarding
       SET declared_branches = NULLIF(d->>'__locked__num_branches', '')::int,
           updated_at        = now()
     WHERE agent_id = fi.related_agent_id;
  EXCEPTION WHEN invalid_text_representation THEN
    -- leave declared_branches unchanged if not a valid number
    NULL;
  END;

  -- References
  IF jsonb_typeof(d->'__locked__references') = 'array' THEN
    -- Wipe out any previous auto-loaded rows for this agent that haven't been contacted yet,
    -- so resubmissions don't duplicate. Rows already sent (request_sent_at NOT NULL) are kept.
    DELETE FROM public.agent_references
     WHERE agent_id = fi.related_agent_id
       AND request_sent_at IS NULL;

    FOR ref IN SELECT * FROM jsonb_array_elements(d->'__locked__references') LOOP
      IF COALESCE(ref->>'ref_email', '') <> '' THEN
        INSERT INTO public.agent_references (agent_id, name, email, institution, role)
        VALUES (
          fi.related_agent_id,
          COALESCE(NULLIF(ref->>'ref_name', ''), ref->>'ref_email'),
          ref->>'ref_email',
          NULLIF(ref->>'ref_institution', ''),
          NULLIF(ref->>'ref_role', '')
        );
      END IF;
    END LOOP;
  END IF;

  -- British Council documents
  IF jsonb_typeof(d->'__locked__british_council') = 'array' THEN
    FOR doc IN SELECT * FROM jsonb_array_elements(d->'__locked__british_council') LOOP
      IF COALESCE(doc->>'path', '') <> '' THEN
        INSERT INTO public.agent_documents (agent_id, category, title, file_name, file_path, content_type, size_bytes)
        VALUES (
          fi.related_agent_id,
          'british_council'::agent_doc_category,
          NULLIF(doc->>'name', ''),
          NULLIF(doc->>'name', ''),
          doc->>'path',
          NULLIF(doc->>'content_type', ''),
          NULLIF(doc->>'size', '')::bigint
        );
      END IF;
    END LOOP;
  END IF;

  -- Company registration documents
  IF jsonb_typeof(d->'__locked__company_registration') = 'array' THEN
    FOR doc IN SELECT * FROM jsonb_array_elements(d->'__locked__company_registration') LOOP
      IF COALESCE(doc->>'path', '') <> '' THEN
        INSERT INTO public.agent_documents (agent_id, category, title, file_name, file_path, content_type, size_bytes)
        VALUES (
          fi.related_agent_id,
          'company_registration'::agent_doc_category,
          NULLIF(doc->>'name', ''),
          NULLIF(doc->>'name', ''),
          doc->>'path',
          NULLIF(doc->>'content_type', ''),
          NULLIF(doc->>'size', '')::bigint
        );
      END IF;
    END LOOP;
  END IF;

  -- Supporting documents (repeatable group: doc_title + doc_file)
  IF jsonb_typeof(d->'__locked__supporting_docs') = 'array' THEN
    FOR sup IN SELECT * FROM jsonb_array_elements(d->'__locked__supporting_docs') LOOP
      doc := sup->'doc_file';
      IF doc IS NOT NULL AND COALESCE(doc->>'path', '') <> '' THEN
        INSERT INTO public.agent_documents (agent_id, category, title, file_name, file_path, content_type, size_bytes)
        VALUES (
          fi.related_agent_id,
          'supporting'::agent_doc_category,
          COALESCE(NULLIF(sup->>'doc_title', ''), NULLIF(doc->>'name', '')),
          NULLIF(doc->>'name', ''),
          doc->>'path',
          NULLIF(doc->>'content_type', ''),
          NULLIF(doc->>'size', '')::bigint
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_agent_signup ON public.form_submissions;
CREATE TRIGGER trg_process_agent_signup
AFTER INSERT ON public.form_submissions
FOR EACH ROW EXECUTE FUNCTION public.process_agent_signup_submission();

-- Storage: allow admins to read files in agent-documents bucket (for the onboarding review UI + doc grants).
-- Public writes still go through the token-validated API route only.
DROP POLICY IF EXISTS "agent-documents admin read" ON storage.objects;
CREATE POLICY "agent-documents admin read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-documents'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
