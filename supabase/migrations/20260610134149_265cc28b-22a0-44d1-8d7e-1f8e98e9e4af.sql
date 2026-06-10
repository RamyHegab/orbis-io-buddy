
-- Enum for agent status
CREATE TYPE public.agent_status AS ENUM ('active', 'inactive', 'prospect');

-- AGENTS reshape
ALTER TABLE public.agents
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS headquarters_country,
  DROP COLUMN IF EXISTS notes;

ALTER TABLE public.agents
  ADD COLUMN trading_name text NOT NULL DEFAULT '',
  ADD COLUMN legal_name text,
  ADD COLUMN account_manager text,
  ADD COLUMN status public.agent_status NOT NULL DEFAULT 'active',
  ADD COLUMN hq_country text,
  ADD COLUMN hq_address text,
  ADD COLUMN agent_code text,
  ADD COLUMN agreement_start_date date,
  ADD COLUMN agreement_end_date date,
  ADD COLUMN countries_of_operation text[] NOT NULL DEFAULT '{}',
  ADD COLUMN main_contact_name text,
  ADD COLUMN main_contact_email text,
  ADD COLUMN main_contact_phone text;

ALTER TABLE public.agents ALTER COLUMN trading_name DROP DEFAULT;
CREATE UNIQUE INDEX agents_user_trading_legal_uniq
  ON public.agents (user_id, lower(trading_name), lower(coalesce(legal_name,'')));

-- AGENT_BRANCHES reshape
ALTER TABLE public.agent_branches
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS notes;

ALTER TABLE public.agent_branches
  ADD COLUMN branch_name text,
  ADD COLUMN address text,
  ADD COLUMN contact_first_name text,
  ADD COLUMN contact_last_name text,
  ADD COLUMN contact_email text,
  ADD COLUMN contact_position text,
  ADD COLUMN contact_phone text,
  ADD COLUMN in_country_trading_name text,
  ADD COLUMN agency_name text;

ALTER TABLE public.agent_branches
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN country DROP NOT NULL;

-- ACTIVITIES — link to branch
ALTER TABLE public.activities
  ADD COLUMN branch_id uuid REFERENCES public.agent_branches(id) ON DELETE SET NULL;

-- SCHOOLS — add Notion sync fields + flexible properties bag
ALTER TABLE public.schools
  ADD COLUMN notion_page_id text,
  ADD COLUMN status text,
  ADD COLUMN properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN last_synced_at timestamptz;

CREATE UNIQUE INDEX schools_user_notion_page_uniq
  ON public.schools (user_id, notion_page_id) WHERE notion_page_id IS NOT NULL;
