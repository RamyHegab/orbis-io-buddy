
## Goal

Each Orbis user gets their own "from" address like `ramy@harvard.orbishub.co.uk`, used automatically as the sender on system emails (approval requests, reminders, notifications, etc.). The subdomain part is set once for the account; the local part is auto-generated from the user's first name and can be edited by admins.

## Prerequisite: verify the university subdomain for email

The subdomain (e.g. `harvard.orbishub.co.uk`) must be a verified Lovable email domain before any email can be sent from it. This means:
- Admin sets the desired subdomain in Orbis settings.
- Admin runs the "Set up email domain" flow for that exact subdomain (adds the NS records Lovable shows at their DNS provider).
- Until DNS is verified, system emails fall back to the current sender domain.

We surface this in the UI so the admin sees the status and the "Set up email domain" action inline.

## Data model

Add to `public.app_settings` (single-row org config):
- `sender_subdomain` — e.g. `harvard` (stored lowercase; validated `[a-z0-9-]`).

Add to `public.profiles`:
- `email_local_part` — the part before `@`, auto-generated on invite from `full_name` (first token, lowercased, non-alnum stripped), admin-editable. Unique per account.

Uniqueness enforced with a partial unique index on `lower(email_local_part)`.

## Auto-generation & admin edit

- On `inviteUser`: derive `email_local_part` from `fullName || email`. On collision, admin is prompted to override (form validates against the unique index).
- On `updateUser`: admins with `can_manage_users` can edit `email_local_part` and (Admin only) `sender_subdomain`.
- New "System email address" row in the user table and edit dialog showing the full computed address, greyed-out subdomain, editable local part.

## Sender-address wiring

Add a small helper `getSenderAddress(userId)` used by every server-side email path:
- Returns `{ from, replyTo }` where `from = "<Full Name> <local_part@sender_subdomain.orbishub.co.uk>"`.
- Falls back to the current default sender when subdomain is unset or unverified.

Update every call site that currently posts to `/lovable/email/transactional/send` to include the acting user's sender:
- `src/lib/trip-approvals.functions.ts` (submit / approve / changes-requested)
- `src/routes/api/public/hooks/checklist-reminders.ts`
- `src/routes/api/public/planning/reminders.ts`
- `src/routes/api/public/hooks/auto-archive-cycle.ts`
- Any other `sendTransactionalEmail` caller.

The transactional send route is extended to accept optional `from` / `replyTo` and pass them through to the mailer. When absent, existing behaviour is preserved.

## Admin UI

- `Settings → Branding/Account`: new "System email" section — input for university subdomain + live preview `youruser@<subdomain>.orbishub.co.uk` + status pill ("Verified" / "DNS pending" / "Not set up"). Includes the `<presentation-open-email-setup>` action when unverified.
- `Users` page: new column "System address"; edit dialog gains an editable local-part field with collision validation.

## Out of scope (flag for later)

- Inbound email / replies routed back to the user (would require MX + mailbox routing; today `replyTo` is just set on outgoing).
- Multiple university subdomains in one Orbis deployment.
- Per-user avatars/signatures in system emails.

## Technical notes

- Migration: `alter table app_settings add column sender_subdomain text;` + `alter table profiles add column email_local_part text;` + partial unique index. RLS on `profiles`: admins/self can update the local part; only admins can update `sender_subdomain` on `app_settings` (existing policies cover this).
- Generation helper is deterministic and pure; unit-test via a small util in `src/lib/system-email.ts`.
- Validation: local part `^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$`; subdomain `^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$`.
- No change to auth login email — that remains the user's real inbox address in `profiles.email`. The new field is sender-identity only.
