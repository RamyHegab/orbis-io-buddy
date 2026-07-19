
-- Trigger to extract agent references and documents from Agent Signup submissions
-- and populate agent_references / agent_documents.

CREATE OR REPLACE FUNCTION public.handle_agent_signup_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_form_type text;
  v_ref jsonb;
  v_doc jsonb;
  v_docs jsonb;
  v_onboarding_id uuid;
BEGIN
  SELECT fi.form_type, fi.related_agent_id
    INTO v_form_type, v_agent_id
  FROM public.form_instances fi
  WHERE fi.id = NEW.instance_id;

  IF v_form_type <> 'agent_signup' OR v_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- References: __locked__references is an array of {ref_name, ref_email, ref_institution, ref_role}
  IF jsonb_typeof(NEW.data -> '__locked__references') = 'array' THEN
    FOR v_ref IN SELECT * FROM jsonb_array_elements(NEW.data -> '__locked__references')
    LOOP
      IF COALESCE(v_ref ->> 'ref_email','') <> '' THEN
        INSERT INTO public.agent_references (agent_id, name, email, institution, role, submission_id)
        VALUES (
          v_agent_id,
          NULLIF(v_ref ->> 'ref_name',''),
          v_ref ->> 'ref_email',
          NULLIF(v_ref ->> 'ref_institution',''),
          NULLIF(v_ref ->> 'ref_role',''),
          NEW.id
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Documents: three known file fields
  FOR v_docs, v_ref IN
    SELECT NEW.data -> '__locked__british_council', 'british_council'::text
    UNION ALL SELECT NEW.data -> '__locked__company_registration', 'company_registration'::text
  LOOP
    -- placeholder; PostgreSQL doesn't allow multiple loop patterns; rewrite below
    NULL;
  END LOOP;

  -- Simple per-field extraction:
  PERFORM public.ingest_agent_signup_files(v_agent_id, NEW.id, NEW.data);

  -- Auto-tick signup_form_sent on the linked onboarding
  SELECT id INTO v_onboarding_id
  FROM public.agent_onboarding
  WHERE agent_id = v_agent_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_onboarding_id IS NOT NULL THEN
    UPDATE public.agent_onboarding_checklist
    SET done = true, done_at = now()
    WHERE onboarding_id = v_onboarding_id
      AND item_key = 'signup_form_sent'
      AND done = false;
  END IF;

  RETURN NEW;
END;
$$;

-- Helper to ingest file arrays for the three known file fields into agent_documents.
CREATE OR REPLACE FUNCTION public.ingest_agent_signup_files(
  p_agent_id uuid,
  p_submission_id uuid,
  p_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file jsonb;
BEGIN
  -- British Council
  IF jsonb_typeof(p_data -> '__locked__british_council') = 'array' THEN
    FOR v_file IN SELECT * FROM jsonb_array_elements(p_data -> '__locked__british_council') LOOP
      IF COALESCE(v_file ->> 'path','') <> '' THEN
        INSERT INTO public.agent_documents (agent_id, category, title, file_path, file_name, content_type, size_bytes)
        VALUES (
          p_agent_id, 'british_council', 'British Council certificate',
          v_file ->> 'path', v_file ->> 'name', v_file ->> 'content_type',
          NULLIF(v_file ->> 'size','')::bigint
        );
      END IF;
    END LOOP;
  END IF;

  -- Company registration
  IF jsonb_typeof(p_data -> '__locked__company_registration') = 'array' THEN
    FOR v_file IN SELECT * FROM jsonb_array_elements(p_data -> '__locked__company_registration') LOOP
      IF COALESCE(v_file ->> 'path','') <> '' THEN
        INSERT INTO public.agent_documents (agent_id, category, title, file_path, file_name, content_type, size_bytes)
        VALUES (
          p_agent_id, 'company_registration', 'Company registration',
          v_file ->> 'path', v_file ->> 'name', v_file ->> 'content_type',
          NULLIF(v_file ->> 'size','')::bigint
        );
      END IF;
    END LOOP;
  END IF;

  -- Supporting docs: repeatable group of {doc_title, doc_file}
  IF jsonb_typeof(p_data -> '__locked__supporting_docs') = 'array' THEN
    FOR v_file IN SELECT * FROM jsonb_array_elements(p_data -> '__locked__supporting_docs') LOOP
      -- doc_file may itself be an array (file input) or an object
      DECLARE
        v_inner jsonb := v_file -> 'doc_file';
        v_title text := NULLIF(v_file ->> 'doc_title','');
        v_actual jsonb;
      BEGIN
        IF v_inner IS NULL THEN CONTINUE; END IF;
        IF jsonb_typeof(v_inner) = 'array' THEN
          FOR v_actual IN SELECT * FROM jsonb_array_elements(v_inner) LOOP
            IF COALESCE(v_actual ->> 'path','') <> '' THEN
              INSERT INTO public.agent_documents (agent_id, category, title, file_path, file_name, content_type, size_bytes)
              VALUES (
                p_agent_id, 'other', COALESCE(v_title, v_actual ->> 'name', 'Supporting document'),
                v_actual ->> 'path', v_actual ->> 'name', v_actual ->> 'content_type',
                NULLIF(v_actual ->> 'size','')::bigint
              );
            END IF;
          END LOOP;
        ELSIF jsonb_typeof(v_inner) = 'object' AND COALESCE(v_inner ->> 'path','') <> '' THEN
          INSERT INTO public.agent_documents (agent_id, category, title, file_path, file_name, content_type, size_bytes)
          VALUES (
            p_agent_id, 'other', COALESCE(v_title, v_inner ->> 'name', 'Supporting document'),
            v_inner ->> 'path', v_inner ->> 'name', v_inner ->> 'content_type',
            NULLIF(v_inner ->> 'size','')::bigint
          );
        END IF;
      END;
    END LOOP;
  END IF;
END;
$$;

-- Now redefine the handler without the placeholder loop
CREATE OR REPLACE FUNCTION public.handle_agent_signup_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_form_type text;
  v_ref jsonb;
  v_onboarding_id uuid;
BEGIN
  SELECT fi.form_type, fi.related_agent_id
    INTO v_form_type, v_agent_id
  FROM public.form_instances fi
  WHERE fi.id = NEW.instance_id;

  IF v_form_type <> 'agent_signup' OR v_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.data -> '__locked__references') = 'array' THEN
    FOR v_ref IN SELECT * FROM jsonb_array_elements(NEW.data -> '__locked__references')
    LOOP
      IF COALESCE(v_ref ->> 'ref_email','') <> '' THEN
        INSERT INTO public.agent_references (agent_id, name, email, institution, role, submission_id)
        VALUES (
          v_agent_id,
          NULLIF(v_ref ->> 'ref_name',''),
          v_ref ->> 'ref_email',
          NULLIF(v_ref ->> 'ref_institution',''),
          NULLIF(v_ref ->> 'ref_role',''),
          NEW.id
        );
      END IF;
    END LOOP;
  END IF;

  PERFORM public.ingest_agent_signup_files(v_agent_id, NEW.id, NEW.data);

  SELECT id INTO v_onboarding_id
  FROM public.agent_onboarding
  WHERE agent_id = v_agent_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_onboarding_id IS NOT NULL THEN
    UPDATE public.agent_onboarding_checklist
    SET done = true, done_at = now()
    WHERE onboarding_id = v_onboarding_id
      AND item_key = 'signup_form_sent'
      AND done = false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_signup_submission ON public.form_submissions;
CREATE TRIGGER trg_agent_signup_submission
  AFTER INSERT ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_agent_signup_submission();
