
-- 1. Update Trading Name label + add Legal Name field in existing agent_signup templates.
--    Fields are stored as jsonb array in form_templates.fields; each part references field ids.
DO $$
DECLARE
  t record;
  new_fields jsonb;
  new_parts jsonb;
  has_legal boolean;
BEGIN
  FOR t IN SELECT id, fields, parts FROM public.form_templates WHERE form_type = 'agent_signup' LOOP
    -- Update trading name label
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'id' = '__locked__agent_name'
          THEN jsonb_set(elem, '{label}', '"Trading Name (Known in the Market as)"'::jsonb)
        ELSE elem
      END
    ) INTO new_fields
    FROM jsonb_array_elements(t.fields) elem;

    -- Check for legal_name presence
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(new_fields) e WHERE e->>'id' = '__locked__legal_name'
    ) INTO has_legal;

    IF NOT has_legal THEN
      -- Insert legal_name right after agent_name
      SELECT jsonb_agg(elem ORDER BY ord) INTO new_fields
      FROM (
        SELECT elem, ord FROM (
          SELECT elem, (ord * 10)::numeric AS ord
          FROM jsonb_array_elements(new_fields) WITH ORDINALITY AS x(elem, ord)
        ) base
        UNION ALL
        SELECT
          jsonb_build_object(
            'id', '__locked__legal_name',
            'type', 'text',
            'label', 'Legal Name (Name as in official registration documents)',
            'required', true,
            'locked', true
          ) AS elem,
          (
            SELECT (ord * 10)::numeric + 1
            FROM jsonb_array_elements(new_fields) WITH ORDINALITY AS y(elem, ord)
            WHERE elem->>'id' = '__locked__agent_name'
            LIMIT 1
          ) AS ord
      ) merged;

      -- Also add id into any part that already contains agent_name
      SELECT jsonb_agg(
        CASE
          WHEN part->'field_ids' ? '__locked__agent_name'
               AND NOT (part->'field_ids' ? '__locked__legal_name')
            THEN jsonb_set(
              part,
              '{field_ids}',
              (
                SELECT jsonb_agg(x) FROM (
                  SELECT jsonb_array_elements_text(part->'field_ids') AS x
                  UNION ALL SELECT '__locked__legal_name'
                ) s
              )
            )
          ELSE part
        END
      ) INTO new_parts
      FROM jsonb_array_elements(COALESCE(t.parts, '[]'::jsonb)) part;
    ELSE
      new_parts := t.parts;
    END IF;

    UPDATE public.form_templates
       SET fields = COALESCE(new_fields, fields),
           parts  = COALESCE(new_parts, parts),
           updated_at = now()
     WHERE id = t.id;
  END LOOP;
END $$;

-- 2. Trigger: on every agent_signup submission, also record an agent_documents row
--    referencing the printable copy so it lives in the agent record.
CREATE OR REPLACE FUNCTION public.record_agent_application_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_form_type text;
  v_trading_name text;
BEGIN
  SELECT fi.form_type, fi.related_agent_id
    INTO v_form_type, v_agent_id
  FROM public.form_instances fi
  WHERE fi.id = NEW.instance_id;

  IF v_form_type <> 'agent_signup' OR v_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT trading_name INTO v_trading_name FROM public.agents WHERE id = v_agent_id;

  INSERT INTO public.agent_documents (
    agent_id, category, title, file_path, file_name, content_type
  ) VALUES (
    v_agent_id,
    'other',
    'Agent Application Form — ' || COALESCE(v_trading_name, 'agent') ||
      ' — ' || to_char(now(), 'YYYY-MM-DD'),
    'app:application-form/' || NEW.id::text,
    'agent-application-form.html',
    'text/html'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_agent_application_document ON public.form_submissions;
CREATE TRIGGER trg_record_agent_application_document
AFTER INSERT ON public.form_submissions
FOR EACH ROW EXECUTE FUNCTION public.record_agent_application_document();
