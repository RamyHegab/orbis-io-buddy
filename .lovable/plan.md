## Goal
Reshape the trip workflow around four lifecycle stages — **Draft / In progress**, **Pending approval**, **Approved**, **Past** — driven by an explicit user submit + line-manager approval step, with inbox + email notifications.

## New trip lifecycle

```
planning ──save──▶ active ──submit──▶ submitted ──approve──▶ approved ──end_date passed──▶ past
                              ▲                  │
                              └──── reject ──────┘ (with note, back to active)
```

- `planning` / `active` = user is still editing (saved, not yet submitted).
- `submitted` = sent to line manager, awaiting decision. Visible in user's **In progress** panel with a **Pending approval** badge.
- `approved` = line manager approved. Trip moves to the **Approved** panel. User can still edit freely (no re-approval required).
- `past` = `end_date < today` (any status).

## Trips page panels (replaces current 3 rows)

1. **In progress** — `planning` / `active` / `submitted`. Cards in `submitted` show a yellow "Pending approval" badge; rejected trips show a red "Changes requested" badge with the manager's note on hover.
2. **Approved** — `approved` and not yet past. This is the panel the pre-trip checklist sidebar attaches to (currently "Upcoming confirmed").
3. **Past (last 3)** — `end_date < today`, regardless of final status. Clicking opens the trip in read-friendly mode for reviewing notes/report.

## Itinerary planner (single trip page)

Replace the current `Save as in progress` / `Confirm itinerary` / `Reopen for edits` action group with:

- **Save (in progress)** — always available; sets status to `active`. No notification.
- **Submit for approval** — available when status is `active`. Confirms via dialog, sets status to `submitted`, creates an approval request, notifies the line manager. Disabled (with tooltip) if the user has no line manager assigned.
- **Withdraw submission** — visible only while `submitted`; returns trip to `active`.
- Header badge reflects status: Draft / In progress / Pending approval / Approved / Changes requested.
- If a previous rejection exists, show the manager's note in an alert at the top of the page until the user re-submits.

## Manager approval surface

- **Inbox page** gets a new "Approvals" section listing trips where the signed-in user is the trip owner's line manager and status is `submitted`. Each row links to the trip and offers **Approve** / **Request changes** (with required note) buttons.
- The same actions are also available inline on the trip page when viewed by the line manager.
- On approve: status → `approved`, approval record stamped with approver + timestamp, owner notified by email + inbox entry.
- On reject: status → `active`, note stored, owner notified by email + inbox entry.

## Notifications (inbox + email)

- New `notifications` table (recipient, type, trip_id, payload, read_at) feeds the Inbox page for both managers and owners.
- Three transactional email templates: `trip-submitted-for-approval` (to manager), `trip-approved` (to owner), `trip-changes-requested` (to owner). Subjects include the trip title and dates; bodies include a link back to the trip page and the manager's note when applicable.
- Sends go through the existing Lovable app-email infrastructure (idempotency key = `<trip_id>-<event>`).

## Technical details (for reference)

- DB migration:
  - Extend allowed `trips.status` values: keep `planning`, `active`; add `submitted`, `approved`, `rejected_unused` (existing `confirmed` rows auto-migrated to `approved`).
  - New `trip_approvals` table: `id`, `trip_id`, `requested_by`, `manager_id`, `decision` (`pending|approved|changes_requested`), `note`, `decided_at`, timestamps. RLS: owner can see their own; manager can see/update where `manager_id = auth.uid()`; admin full read. GRANTs for `authenticated` and `service_role`.
  - New `notifications` table: `id`, `user_id`, `type`, `trip_id`, `title`, `body`, `read_at`, `created_at`. RLS: user sees/updates own; service_role full. GRANTs for `authenticated` and `service_role`.
- Server functions (`src/lib/trip-approvals.functions.ts`) with `requireSupabaseAuth`:
  - `submitTripForApproval({ tripId })` — checks owner, ensures `line_manager_id` exists, sets status `submitted`, inserts pending approval row, inserts manager notification, enqueues email.
  - `decideTripApproval({ approvalId, decision, note })` — checks caller is `manager_id`, updates approval + trip status (`approved` or back to `active`), inserts owner notification, enqueues email.
  - `withdrawTripSubmission({ tripId })` — owner reverts `submitted` → `active`.
- Frontend:
  - `src/routes/_authenticated.trips.index.tsx` — replace `bucketOf` with new four-bucket logic and rename row titles.
  - `src/routes/_authenticated.trips.$tripId.tsx` — replace the action button group, render rejection banner, render manager approve/reject controls when applicable.
  - `src/routes/_authenticated.inbox.tsx` — add Approvals list (queries `trip_approvals` where manager = current user, status pending) and Notifications feed (queries `notifications`).
- Email templates added in `src/lib/email-templates/` and registered.
- The existing pre-trip checklist sidebar keeps working — its source query simply switches from `status = 'confirmed'` to `status = 'approved'`.

## Out of scope

- No auto-revert to "needs re-approval" when editing after approval (per your choice).
- Bulk approvals, approval reminders, and SLA timers.
- Marketing/recap emails.