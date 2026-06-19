# Forms — generate, share, fill offline

## What you'll get

1. **Admin templates** (already exists, extended)
   - Templates page already lets admins name and build templates. We'll add a new field type **Phone (with country code)** — the country code defaults to the country of the linked event/activity (e.g. Cairo → +20).

2. **Forms page** (rebuilt)
   - Lists all admin templates.
   - **"Use form" button** on each: pick an activity from your itinerary → creates a new **form instance** (the form is named "{Template name} — {Activity title}" and inherits the activity date).
   - Lists all generated instances grouped by trip, with **Share** and **Open** actions.
   - Regular users see templates read-only (cannot edit fields).

3. **Public fill page** at `/f/{instanceId}`
   - No login required (external devices can scan & fill).
   - Renders the template's fields. Phone field shows a country picker pre-selected to the event's country.
   - **Offline mode**: if the device is offline, submission is saved in the browser (IndexedDB via `localStorage`). A banner shows "X pending — will sync when online". On reconnect, queued submissions auto-upload.

4. **Share button** on each form instance
   - QR code (PNG, downloadable)
   - Copy link
   - Open in new window
   - WhatsApp, Email, and the native device share sheet (`navigator.share`) when available

5. **Users cannot edit fields**
   - Field editor only renders inside the admin templates page (already enforced by `useIsAdmin`).

## Technical details

### DB migration
- New table `form_instances` (id, template_id, activity_id, name, event_date, country_code, created_by, created_at). Public SELECT by id (anon) so the fill page works; INSERT restricted to authenticated users.
- `form_submissions`: make `user_id` nullable, add `instance_id uuid`, `submitter_name text`, `submitter_phone text`. Add a permissive INSERT-only policy for `anon` scoped to `instance_id` existing — so external devices can submit without an account but cannot read other submissions.
- Add `phone` to the allowed field types (stored in `fields` JSON; no enum change needed).

### Country code
- Small static map `country → dial code` in `src/lib/country-codes.ts` (covers the common ones). The instance row stores the resolved code at creation time, derived from `activity.to_country || from_country || location`.

### Offline sync
- `src/lib/offline-queue.ts`: tiny wrapper over `localStorage` keyed by instance id.
- Fill page: on submit, attempts `fetch` → on failure or `!navigator.onLine`, pushes to queue and shows "Saved offline".
- `window.addEventListener('online', flush)` drains the queue.

### Share
- `src/components/share-form-button.tsx`: popover with QR (using `qrcode` lib, already light), Copy, Open, WhatsApp, Email, and `navigator.share` when supported.

### Files touched
- New: migration, `src/routes/f.$instanceId.tsx` (public), `src/components/share-form-button.tsx`, `src/lib/country-codes.ts`, `src/lib/offline-queue.ts`.
- Edited: `src/routes/_authenticated.forms.tsx` (full rebuild), `src/routes/_authenticated.templates.tsx` (add `phone` field type), small types.

Confirm and I'll ship it.
