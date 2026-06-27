
CREATE POLICY "Authenticated can read all agents"
  ON public.agents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read all schools"
  ON public.schools FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read all agent_branches"
  ON public.agent_branches FOR SELECT TO authenticated USING (true);
