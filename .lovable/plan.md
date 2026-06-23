## Goal

Add a Users page where admins invite people by email, assign a role (Admin / Manager / Member), and set each user's line manager. Regular members only see their own trips/forms; managers can additionally see and approve their direct reports' itineraries.

## 1. Roles model

Extend the `app_role` enum to include `manager` alongside the existing `admin` and `member`. Existing `has_role(user_id, role)` security-definer function is reused — no recursive RLS risk.

New helper functions (all `SECURITY DEFINER`):
- `is_line_manager_of(_manager uuid, _user uuid)` → bool, checks `profiles.line_manager_id`.
- `can_view_trip(_user uuid, _trip_owner uuid)` → bool: true if same user, admin, or line manager of owner.

## 2. Profiles changes

Add to `public.profiles`:
- `email text` (mirrored from `auth.users` for admin listing)
- `line_manager_id uuid` (nullable, FK → `profiles.id`)
- `status text` default `'active'` (`invited | active | disabled`)

`handle_new_user` trigger updated to copy email and set `status='active'` on first sign-in; invited rows are pre-created with `status='invited'`.

## 3. Onboarding flow (admin invites)

Users page (`/_authenticated/users`, admin-only):
- Table of all users: name, email, role, line manager, status, last sign-in.
- "Invite user" dialog: email, full name, role, line manager (dropdown of existing users).
- On submit, a server function using `supabaseAdmin` calls `auth.admin.inviteUserByEmail` with `redirectTo=/reset-password`, then inserts the profile row + `user_roles` row + line-manager link.
- "Edit user" dialog: change role, change line manager, disable/enable account (status flip + optional `auth.admin.updateUserById({ ban_duration })`).
- "Resend invite" button for users whose status is still `invited`.

The invite email is the existing Lovable auth "invite" template — already covered by the email infrastructure being set up.

## 4. Data restrictions (RLS rewrites)

Tighten policies on user-owned tables. Owner column is `created_by` (or `user_id` where it exists — confirmed during implementation):

- **Members**: can SELECT/INSERT/UPDATE/DELETE only rows where `created_by = auth.uid()`.
- **Managers**: members' rules PLUS SELECT on rows where they are the owner's line manager.
- **Admins**: full access via `has_role(auth.uid(),'admin')`.

Tables affected: `trips`, `trip_countries`, `trip_hotels`, `trip_reports`, `activities`, `activity_comments`, `form_instances`, `form_submissions`, `pending_submissions`. Templates (`form_templates`) stay admin-managed; everyone can read.

## 5. Manager approval surface

Managers get an "Approvals" entry in the nav showing trips submitted by their direct reports with `approval_status='pending'`. This dovetails with the line-manager email plan already in progress — the same `submitTripForApproval` flow now also resolves the manager from `profiles.line_manager_id`, not a free-text email.

Trips remain editable after approval (existing "Reopen for edits" behavior preserved).

## 6. Navigation / gating

- `/users` route lives under `_authenticated/`, with a `beforeLoad` admin check via `has_role`.
- Sidebar links shown conditionally: Users (admin), Approvals (manager/admin), Templates (admin), Settings (everyone).
- Removes the "user sets line manager themselves" plan — Settings keeps only reminder opt-in toggle.

## Out of scope

- Public self-signup, SSO, custom permission matrix beyond the three roles, audit log of admin actions.

## Files (high level)

- New migration: enum value `manager`, profile columns, helper fns, rewritten RLS on listed tables.
- New `src/lib/users.functions.ts` (invite, update role, set line manager, disable user — all `requireSupabaseAuth` + admin check, then `supabaseAdmin` inside the handler).
- New `src/routes/_authenticated.users.tsx` (table + invite/edit dialogs).
- New `src/routes/_authenticated.approvals.tsx` (manager queue).
- Edit `src/components/app-shell.tsx` for conditional nav.
- Edit `src/hooks/use-auth.ts` to add `useIsManager()` and expose `lineManagerId`.
