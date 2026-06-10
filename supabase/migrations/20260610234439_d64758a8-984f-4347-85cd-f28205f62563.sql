-- 1. discovery_jobs
CREATE TABLE public.discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'agent_branches',
  status TEXT NOT NULL DEFAULT 'queued',
  found_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_jobs TO authenticated;
GRANT ALL ON public.discovery_jobs TO service_role;

ALTER TABLE public.discovery_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read discovery jobs" ON public.discovery_jobs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner can insert discovery jobs" ON public.discovery_jobs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner can update discovery jobs" ON public.discovery_jobs
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE INDEX discovery_jobs_user_idx ON public.discovery_jobs(user_id, created_at DESC);

CREATE TRIGGER update_discovery_jobs_updated_at
  BEFORE UPDATE ON public.discovery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. extend pending_submissions
ALTER TABLE public.pending_submissions
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- 3. profiles banner dismissal
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discovery_banner_dismissed_at TIMESTAMPTZ;