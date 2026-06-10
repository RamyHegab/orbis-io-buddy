CREATE TABLE public.pending_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('school','agent','agent_branch')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitter_name TEXT,
  submitter_email TEXT,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_submissions TO authenticated;
GRANT INSERT ON public.pending_submissions TO anon;
GRANT ALL ON public.pending_submissions TO service_role;

ALTER TABLE public.pending_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit" ON public.pending_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "Authenticated can read" ON public.pending_submissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update" ON public.pending_submissions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete" ON public.pending_submissions
  FOR DELETE TO authenticated USING (true);

CREATE INDEX pending_submissions_status_idx ON public.pending_submissions(status, created_at DESC);