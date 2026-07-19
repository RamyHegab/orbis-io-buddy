
REVOKE ALL ON FUNCTION public.process_agent_signup_submission() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._split_csv(text) FROM PUBLIC, anon, authenticated;
