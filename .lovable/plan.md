
# User Management Overhaul

Rebuild the user invite/edit flow as a multi-step wizard with line manager hierarchy, agent assignments, per-role permission defaults, and a freeze-first delete policy.

## Database changes (one migration)

New columns on `profiles`:
- `first_name text`, `last_name text`, `job_role text`
- `line_manager_id uuid references auth.users(id) on delete set null`
- `frozen_at timestamptz` (freeze = disabled + timestamp; distinct from "invited")

New table `public.user_agent_assignments`:
- `user_id uuid`, `agent_id uuid`, `created_at`
- PK `(user_id, agent_id)`, FK to `auth.users` and `agents`
- RLS: user reads own row; admins / `can_manage_users` read all and write

New table `public.role_permission_defaults`:
- Keyed by `job_role text primary key`, columns for each capability + `updated_by`, `updated_at`
- On invite, the last-saved defaults for that `job_role` pre-fill permissions; admin can override

Helper SQL function `public.is_manager_of(_manager uuid, _user uuid)` — recursive walk up `line_manager_id` chain (cap depth 20). Used by RLS on invite/update.

Trigger to auto-set `frozen_at` when `status` transitions to `disabled` via freeze action, and clear it on `active`.

Grants + RLS follow the standard pattern for every new table.

## Server functions (`src/lib/users.functions.ts`)

Extend existing `listUsers` / `inviteUser` / `updateUser`:
- `listUsers` returns new fields + `line_manager_id`, `assigned_agent_ids[]`, `frozen_at`.
- `inviteUser` accepts `{ firstName, lastName, jobRole, lineManagerId, assignedAgentIds, capabilities, role }`. Defaults `lineManagerId` to caller. Validates chain (line manager must be caller or descendant of caller unless caller is admin). Persists agent assignments. Upserts `role_permission_defaults` for that `jobRole` with the submitted caps (so next invite for same role pre-fills).
- `updateUser` gains same optional fields.
- New `freezeUser({ userId })` — sets status `disabled`, `frozen_at = now()`, bans in auth admin. Reversible via `updateUser({ status: 'active' })`.
- New `deleteUser({ userId, confirmation })` — requires `confirmation === email`, admin-only, hard block if user has direct reports (must reassign first). Calls `auth.admin.deleteUser`.
- New `listAssignableManagers()` — returns caller + descendants (or all for admin).
- New `getRoleDefaults(jobRole)` — returns saved defaults for pre-filling.

## Invite wizard UI (`src/routes/_authenticated.users.tsx`)

Replace single-page `InviteDialog` with a 4-step wizard inside the dialog:

**Step 1 — Basics**: First name, Last name, Job role (free text with autocomplete from existing roles), Email, System email local part.

**Step 2 — Line manager**: Explanatory blurb ("Line managers approve trips, receive escalations, and can add/manage users beneath them in their tree."). Select defaults to current admin. Options = caller + descendants (admin sees all). Radio: "Report to me" / "Report to someone else".

**Step 3 — Assign agents**: Multi-select agent list with search + filters (HQ country, operating country). Chips show selected agents.

**Step 4 — Permissions**: Auto-populated from `role_permission_defaults[jobRole]` if present; otherwise sensible role-based defaults (e.g. minimal read for "User"). Admin can toggle each. Note: "These defaults will be remembered for the next '<jobRole>' user."

Final submit → invite email fires.

## Edit dialog

Same tabs (Basics / Line manager / Agents / Permissions), plus a **Danger zone** tab:
- **Freeze account** (primary destructive-outline button): explains "user keeps their data and assignments; can be reactivated anytime". Instant.
- **Delete account** (destructive, hidden behind an expander "Advanced"): requires typing the user's email to confirm, blocked if they have reports, admin-only. Warning banner recommends freezing instead.

Users list gains: Line manager column, Assigned agents count column, Frozen badge (distinct from Disabled).

## Notes

- Trip approvals continue to go to admins (existing behavior). Line manager hierarchy is stored for future approval routing but does not change approval flow in this pass.
- No changes to existing capability model — just extends with defaults per job role.
- Email invitation flow unchanged (already sends via `supabase.auth.admin.inviteUserByEmail`).

## Out of scope

- Rerouting trip approvals through line managers (kept for a follow-up).
- Bulk agent assignment / CSV import.
