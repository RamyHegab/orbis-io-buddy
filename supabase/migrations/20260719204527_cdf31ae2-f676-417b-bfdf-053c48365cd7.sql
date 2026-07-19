
-- === Enums ================================================================
ALTER TYPE public.agent_status ADD VALUE IF NOT EXISTS 'onboarding';
ALTER TYPE public.agent_status ADD VALUE IF NOT EXISTS 'pending_approval';

DO $$ BEGIN
  CREATE TYPE public.form_type AS ENUM ('activity','agent_signup','reference_request','agent_branch','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.agent_doc_category AS ENUM ('british_council','company_registration','supporting');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- === form_templates: parts + form_type ====================================
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS form_type public.form_type NOT NULL DEFAULT 'activity',
  ADD COLUMN IF NOT EXISTS parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ALTER COLUMN activity_type DROP NOT NULL;

-- === form_instances: token + onboarding linkage ===========================
ALTER TABLE public.form_instances
  ALTER COLUMN activity_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS token text UNIQUE,
  ADD COLUMN IF NOT EXISTS form_type public.form_type NOT NULL DEFAULT 'activity',
  ADD COLUMN IF NOT EXISTS related_agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS related_reference_id uuid;

CREATE INDEX IF NOT EXISTS form_instances_token_idx ON public.form_instances(token);
CREATE INDEX IF NOT EXISTS form_instances_agent_idx ON public.form_instances(related_agent_id);

-- === onboarding checklist templates =======================================
CREATE TABLE IF NOT EXISTS public.onboarding_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  order_index int NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'pre_approval', -- 'pre_approval' | 'post_approval'
  is_system boolean NOT NULL DEFAULT false,   -- system items can't be deleted
  auto_tick_rule text,                        -- e.g. 'all_references_sent'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.onboarding_checklist_templates TO authenticated;
GRANT ALL ON public.onboarding_checklist_templates TO service_role;
ALTER TABLE public.onboarding_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read checklist templates" ON public.onboarding_checklist_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write checklist templates" ON public.onboarding_checklist_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER onboarding_checklist_templates_updated
  BEFORE UPDATE ON public.onboarding_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === agent_onboarding =====================================================
CREATE TABLE IF NOT EXISTS public.agent_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES public.agents(id) ON DELETE CASCADE,
  started_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_email text NOT NULL,
  declared_branches int,
  status text NOT NULL DEFAULT 'in_progress', -- in_progress | pending_approval | approved | rejected | completed
  submitted_for_approval_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_onboarding TO authenticated;
GRANT ALL ON public.agent_onboarding TO service_role;
ALTER TABLE public.agent_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read onboarding" ON public.agent_onboarding
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "agent managers write onboarding" ON public.agent_onboarding
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'can_manage_agents'))
  WITH CHECK (public.has_capability(auth.uid(), 'can_manage_agents'));
CREATE TRIGGER agent_onboarding_updated
  BEFORE UPDATE ON public.agent_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === agent_onboarding_checklist ===========================================
CREATE TABLE IF NOT EXISTS public.agent_onboarding_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES public.agent_onboarding(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  label text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'pre_approval',
  done boolean NOT NULL DEFAULT false,
  done_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  done_at timestamptz,
  auto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (onboarding_id, item_key)
);
CREATE INDEX IF NOT EXISTS agent_onboarding_checklist_ob_idx ON public.agent_onboarding_checklist(onboarding_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_onboarding_checklist TO authenticated;
GRANT ALL ON public.agent_onboarding_checklist TO service_role;
ALTER TABLE public.agent_onboarding_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read checklist" ON public.agent_onboarding_checklist
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "agent managers write checklist" ON public.agent_onboarding_checklist
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'can_manage_agents'))
  WITH CHECK (public.has_capability(auth.uid(), 'can_manage_agents'));
CREATE TRIGGER agent_onboarding_checklist_updated
  BEFORE UPDATE ON public.agent_onboarding_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === agent_references =====================================================
CREATE TABLE IF NOT EXISTS public.agent_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  institution text,
  role text,
  request_sent_at timestamptz,
  sent_via text, -- 'system' | 'external'
  request_form_instance_id uuid REFERENCES public.form_instances(id) ON DELETE SET NULL,
  submission_id uuid REFERENCES public.form_submissions(id) ON DELETE SET NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_references_agent_idx ON public.agent_references(agent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_references TO authenticated;
GRANT ALL ON public.agent_references TO service_role;
ALTER TABLE public.agent_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read references" ON public.agent_references
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "agent managers write references" ON public.agent_references
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'can_manage_agents'))
  WITH CHECK (public.has_capability(auth.uid(), 'can_manage_agents'));
CREATE TRIGGER agent_references_updated
  BEFORE UPDATE ON public.agent_references
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === agent_documents ======================================================
CREATE TABLE IF NOT EXISTS public.agent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  category public.agent_doc_category NOT NULL,
  title text,
  file_path text NOT NULL,
  file_name text,
  content_type text,
  size_bytes bigint,
  renewal_cycle int NOT NULL DEFAULT 0, -- 0 = initial, 1+ = renewal cycles
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_documents_agent_idx ON public.agent_documents(agent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_documents TO authenticated;
GRANT ALL ON public.agent_documents TO service_role;
ALTER TABLE public.agent_documents ENABLE ROW LEVEL SECURITY;
-- document_permissions must exist before the policy references it
CREATE TABLE IF NOT EXISTS public.document_permissions (
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_permissions TO authenticated;
GRANT ALL ON public.document_permissions TO service_role;
ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages permissions" ON public.document_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user can see own permissions" ON public.document_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "admin full access documents" ON public.agent_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "granted users read documents" ON public.agent_documents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.document_permissions dp
                 WHERE dp.agent_id = agent_documents.agent_id AND dp.user_id = auth.uid()));

-- === emails_log ===========================================================
CREATE TABLE IF NOT EXISTS public.emails_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  from_email text,
  reply_to text,
  template text,
  subject text,
  body_preview text,
  related_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emails_log_agent_idx ON public.emails_log(related_agent_id);
GRANT SELECT, INSERT ON public.emails_log TO authenticated;
GRANT ALL ON public.emails_log TO service_role;
ALTER TABLE public.emails_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read emails log" ON public.emails_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "auth insert emails log" ON public.emails_log
  FOR INSERT TO authenticated WITH CHECK (sent_by = auth.uid());

-- === Seed default checklist template ======================================
INSERT INTO public.onboarding_checklist_templates (item_key, label, order_index, phase, is_system, auto_tick_rule) VALUES
  ('signup_form_sent',        'Agent application form sent',                     10, 'pre_approval',  true, 'send_via_orbis'),
  ('reference_requests_sent', 'Reference requests sent',                         20, 'pre_approval',  true, 'all_references_sent'),
  ('references_reviewed',     'References received and reviewed',                30, 'pre_approval',  true, NULL),
  ('british_council_received','British Council certificate received',            40, 'pre_approval',  true, NULL),
  ('company_reg_received',    'Company registration and necessary documents received', 50, 'pre_approval', true, NULL),
  ('supporting_docs_received','Supporting documents received',                   60, 'pre_approval',  true, NULL),
  ('branches_received',       'Received all branch information',                 70, 'post_approval', true, 'all_branches_received'),
  ('agreement_signed',        'Agreement signed',                                80, 'post_approval', true, NULL)
ON CONFLICT (item_key) DO NOTHING;

-- === Storage RLS for agent-documents bucket ===============================
-- Bucket is created via storage_create_bucket tool; policies live here.
CREATE POLICY "admin full agent-documents"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'agent-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'agent-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "granted read agent-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'agent-documents'
    AND EXISTS (
      SELECT 1 FROM public.document_permissions dp
      WHERE dp.user_id = auth.uid()
        AND (storage.foldername(name))[1] = dp.agent_id::text
    )
  );
