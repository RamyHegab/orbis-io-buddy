## Goal

1. When a user confirms an itinerary, email their line manager an approval request. The manager can approve/reject via a one-click link. Trip stays editable after approval.
2. Send periodic reminder emails for:
   - Outstanding checklist items on upcoming trips.
   - Trips left in Draft / In progress (not submitted) for too long.

## Prerequisites (one-time)

- Set up the project email domain (custom sender). Required before any email sending. UI will prompt the user with the Set up email domain dialog.
- Provision shared email infrastructure (queues, send log, suppression).
- Scaffold the app email sender (single `/lovable/email/transactional/send` route + React Email templates).

## Schema changes

- `profiles`: add `line_manager_email TEXT`, `line_manager_name TEXT`, `reminder_opt_in BOOLEAN DEFAULT true`.
- `trips`: add
  - `approval_status` enum: `not_submitted | pending | approved | rejected` (default `not_submitted`)
  - `submitted_at TIMESTAMPTZ`, `approved_at TIMESTAMPTZ`, `approval_token UUID` (unique, used for the manager's one-click link), `manager_decision_note TEXT`, `last_reminder_sent_at TIMESTAMPTZ`.
- `trips` stays editable in every status — no DB lock; the UI keeps the existing "Reopen for edits" flow and editing remains allowed after `approved`.

## Settings UI

- New "Line manager" section in `/settings` to set `line_manager_email`, `line_manager_name`, and a reminders toggle.

## Submit-for-approval flow

- In `_authenticated.trips.$tripId.tsx`, the existing **Confirm itinerary** dialog becomes **Submit for approval**:
  - Sets `status = confirmed`, `approval_status = pending`, generates `approval_token`, stores `submitted_at`.
  - Calls server fn `submitTripForApproval(tripId)` which sends the `itinerary-approval-request` email to the saved line manager (or prompts if missing).
- Adds badges: Pending approval / Approved / Rejected.
- "Reopen for edits" still works in any status. Editing an `approved` trip shows an inline note; user can re-submit to notify the manager again.

## Manager decision route

- Public route `src/routes/trip-approval.$token.tsx` (no auth) showing trip summary + Approve / Reject buttons with optional note.
- Backed by `/api/public/trip-approval` server route that validates token, updates `approval_status`, sets `approved_at`, sends a confirmation email back to the trip owner.

## Reminder emails (cron)

- Server route `src/routes/api/public/hooks/trip-reminders.ts` (apikey-protected) that:
  - For trips starting in ≤14 days with incomplete checklist items → `checklist-reminder` email to the trip owner (one per trip per 3 days, tracked via `last_reminder_sent_at`).
  - For trips in `planning` or `active` with no activity update in 5+ days and `approval_status = not_submitted` → `itinerary-continue` email.
  - Respects `profiles.reminder_opt_in`. Includes unsubscribe-style toggle link to `/settings`.
- `pg_cron` job runs daily at 09:00 UTC, posting to the route.

## Email templates (React Email, in `src/lib/email-templates/`)

- `itinerary-approval-request.tsx` — to line manager, includes trip title, dates, destinations, Approve / Reject buttons (tokenized link).
- `itinerary-approved.tsx` / `itinerary-rejected.tsx` — to trip owner, includes manager note.
- `checklist-reminder.tsx` — to trip owner, lists outstanding checklist items + trip link.
- `itinerary-continue.tsx` — to trip owner, nudge to finish the itinerary.

All branded with the project's existing palette/typography. Unsubscribe footer auto-appended by the system.

## Files

- Migration: profile + trip columns, enum, indexes, GRANTs/policies.
- New: `src/lib/email/send.ts`, `src/lib/trip-approval.functions.ts`, `src/routes/trip-approval.$token.tsx`, `src/routes/api/public/trip-approval.ts`, `src/routes/api/public/hooks/trip-reminders.ts`, six email templates, registry update.
- Edited: `src/routes/_authenticated.trips.$tripId.tsx` (submit-for-approval UI + badges), `src/routes/_authenticated.settings.tsx` (line manager fields), `src/components/upcoming-checklist.tsx` (small status hint), `src/integrations/supabase/types.ts` (regen via migration).

## Out of scope

- Multi-approver workflows / approval history table (single line manager only).
- SMS / in-app push reminders.
