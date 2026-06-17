ALTER TABLE public.pending_submissions
  ADD CONSTRAINT pending_submissions_source_url_http
  CHECK (source_url IS NULL OR source_url ~* '^https?://');