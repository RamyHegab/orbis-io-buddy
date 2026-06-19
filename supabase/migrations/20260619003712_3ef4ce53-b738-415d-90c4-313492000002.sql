
-- form_instances: per-activity generated form
CREATE TABLE public.form_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  name text NOT NULL,
  event_date date,
  country_code text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.form_instances TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_instances TO authenticated;
GRANT ALL ON public.form_instances TO service_role;

ALTER TABLE public.form_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read instances by id"
  ON public.form_instances FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create instances"
  ON public.form_instances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner or admin can delete instances"
  ON public.form_instances FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER form_instances_updated
  BEFORE UPDATE ON public.form_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Also let anon read the template fields (needed by the public fill page)
CREATE POLICY "Anyone can read templates"
  ON public.form_templates FOR SELECT
  TO anon
  USING (true);
GRANT SELECT ON public.form_templates TO anon;

-- form_submissions: allow anonymous submissions tied to an instance
ALTER TABLE public.form_submissions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS instance_id uuid REFERENCES public.form_instances(id) ON DELETE CASCADE;
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS submitter_name text;
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS submitter_phone text;

GRANT INSERT ON public.form_submissions TO anon;
GRANT SELECT ON public.form_submissions TO authenticated;

-- Drop the old policy that blocked anon and replace
DROP POLICY IF EXISTS "Users manage own submissions" ON public.form_submissions;

CREATE POLICY "Anyone can insert submissions for an existing instance"
  ON public.form_submissions FOR INSERT
  WITH CHECK (
    instance_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.form_instances WHERE id = instance_id)
  );

CREATE POLICY "Authenticated users can read submissions for their instances"
  ON public.form_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.form_instances fi
      WHERE fi.id = form_submissions.instance_id
        AND (fi.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Owner or admin can delete submissions"
  ON public.form_submissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.form_instances fi
      WHERE fi.id = form_submissions.instance_id
        AND (fi.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );
