ALTER TABLE public.agent_onboarding_checklist ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;
ALTER TABLE public.agent_references ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;