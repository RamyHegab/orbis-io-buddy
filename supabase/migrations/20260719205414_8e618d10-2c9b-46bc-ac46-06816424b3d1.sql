
-- Columns
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

ALTER TABLE public.form_templates ALTER COLUMN created_by DROP NOT NULL;

-- Tighten existing "template managers" policies so special types are admin-only.
DROP POLICY IF EXISTS "Template managers can insert templates" ON public.form_templates;
DROP POLICY IF EXISTS "Template managers can update templates" ON public.form_templates;
DROP POLICY IF EXISTS "Template managers can delete templates" ON public.form_templates;

CREATE POLICY "Template managers can insert non-special templates"
ON public.form_templates FOR INSERT
WITH CHECK (
  has_capability(auth.uid(), 'can_manage_templates')
  AND form_type NOT IN ('agent_signup','reference_request','agent_branch')
);

CREATE POLICY "Template managers can update non-special templates"
ON public.form_templates FOR UPDATE
USING (
  has_capability(auth.uid(), 'can_manage_templates')
  AND is_system = false
  AND form_type NOT IN ('agent_signup','reference_request','agent_branch')
)
WITH CHECK (
  has_capability(auth.uid(), 'can_manage_templates')
  AND form_type NOT IN ('agent_signup','reference_request','agent_branch')
);

CREATE POLICY "Template managers can delete non-special templates"
ON public.form_templates FOR DELETE
USING (
  has_capability(auth.uid(), 'can_manage_templates')
  AND is_system = false
  AND form_type NOT IN ('agent_signup','reference_request','agent_branch')
);

-- Block deletion of system rows outright (even admins) — replace admin delete policy.
DROP POLICY IF EXISTS "Admins can delete templates" ON public.form_templates;
CREATE POLICY "Admins can delete non-system templates"
ON public.form_templates FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) AND is_system = false);

-- Seed three blank system templates (idempotent via unique form_type+is_system).
CREATE UNIQUE INDEX IF NOT EXISTS form_templates_system_type_unique
  ON public.form_templates (form_type) WHERE is_system = true;

INSERT INTO public.form_templates (name, description, form_type, fields, parts, is_system, is_active, created_by)
VALUES
  ('Agent Signup Form',
   'Multi-part signup form for prospective agents. Configure and activate before sharing.',
   'agent_signup', '[]'::jsonb, '[]'::jsonb, true, false, NULL),
  ('Reference Request Form',
   'Sent to referees provided by an agent during onboarding. Configure and activate before use.',
   'reference_request', '[]'::jsonb, '[]'::jsonb, true, false, NULL),
  ('Agent Branch Form',
   'Collects branch details from an approved agent, one submission per branch. Configure and activate before use.',
   'agent_branch', '[]'::jsonb, '[]'::jsonb, true, false, NULL)
ON CONFLICT DO NOTHING;
