## Backend audit findings

The linter found 3 warnings. After inspecting the policies and functions, here's what's real and what to fix.

### 1. `pending_submissions` — overly permissive (HIGH)
Any signed-in user can currently read, update, or delete every pending submission in the system. This is the Notifications inbox — only admins should approve/reject.

Current policies:
- `SELECT` using `true` → any authenticated user
- `UPDATE` using `true` / with check `true` → any authenticated user
- `DELETE` using `true` → any authenticated user

**Fix:** Replace with admin-only policies using the existing `public.has_role(auth.uid(), 'admin')` helper. Keep the existing public-INSERT policy (the intake form needs anonymous submissions).

### 2. `handle_new_user` — SECURITY DEFINER exposed (MEDIUM)
This is a trigger function only — it should never be callable from the API. Authenticated users can currently invoke it directly.

**Fix:** `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`. The `on_auth_user_created` trigger still runs it because triggers execute regardless of grants.

### 3. `has_role` — SECURITY DEFINER callable (ACCEPT)
The linter flags this, but it is the documented Lovable/Supabase pattern for RLS role checks and must remain callable by `authenticated` (RLS policies evaluate it as the calling user). No action — this is a false positive for this use case.

### 4. `form_templates` SELECT using `true` — ACCEPT
SELECT-only `true` is intentional so any signed-in user can read templates. Linter already excludes this category; it showed up only because the others did. No action.

## Migration to apply

```sql
-- pending_submissions: replace permissive policies with admin-only
DROP POLICY IF EXISTS "Authenticated can read" ON public.pending_submissions;
DROP POLICY IF EXISTS "Authenticated can update" ON public.pending_submissions;
DROP POLICY IF EXISTS "Authenticated can delete" ON public.pending_submissions;

CREATE POLICY "Admins can read pending submissions"
  ON public.pending_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pending submissions"
  ON public.pending_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pending submissions"
  ON public.pending_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- handle_new_user: trigger-only, hide from API surface
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
```

## Verification
After the migration, re-run `supabase--linter`. Expected: warnings 1 and 2 cleared; warning 3 (`has_role`) remains as an accepted false positive.

## Heads-up
Tightening `pending_submissions` to admins-only means non-admin members will no longer see the Notifications inbox count or list. If you also want managers (or all members) to see submissions, tell me which role and I'll widen the policy accordingly.
