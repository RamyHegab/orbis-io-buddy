
-- 1. Extend trip_status enum
ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'approved';

COMMIT;

-- 2. Migrate confirmed -> approved (run in new tx so new enum values are visible)
UPDATE public.trips SET status = 'approved' WHERE status = 'confirmed';

-- 3. trip_approvals
CREATE TABLE public.trip_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  manager_id uuid NOT NULL,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','approved','changes_requested')),
  note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trip_approvals_trip_idx ON public.trip_approvals(trip_id);
CREATE INDEX trip_approvals_manager_pending_idx ON public.trip_approvals(manager_id) WHERE decision = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_approvals TO authenticated;
GRANT ALL ON public.trip_approvals TO service_role;

ALTER TABLE public.trip_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own approvals" ON public.trip_approvals
  FOR SELECT TO authenticated USING (requested_by = auth.uid());
CREATE POLICY "Manager can view their approvals" ON public.trip_approvals
  FOR SELECT TO authenticated USING (manager_id = auth.uid());
CREATE POLICY "Admin can view all approvals" ON public.trip_approvals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner can insert own approval" ON public.trip_approvals
  FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());
CREATE POLICY "Manager can update their approval" ON public.trip_approvals
  FOR UPDATE TO authenticated USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());
CREATE POLICY "Owner can delete own pending approval" ON public.trip_approvals
  FOR DELETE TO authenticated USING (requested_by = auth.uid() AND decision = 'pending');

CREATE TRIGGER update_trip_approvals_updated_at BEFORE UPDATE ON public.trip_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
