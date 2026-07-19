
REVOKE ALL ON FUNCTION public.handle_agent_signup_submission() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ingest_agent_signup_files(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
