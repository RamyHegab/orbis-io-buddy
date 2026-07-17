## Yearly Activities Timeline

A new "Planning" section where users can lay out their recruitment cycle year, manage a reusable events catalog (fairs, conferences), and promote planned activities into real trips in the itinerary planner.

### Navigation
- Add "Planning" to the app shell sidebar, with two sub-routes/tabs:
  - `/planning/timeline` — activity cards (default)
  - `/planning/calendar` — calendar view
- Add "Events catalog" as a sub-page (managed by admins / capability-gated), reachable from the timeline page and sidebar.

### Data model (new tables)

**`cycle_settings`** (per user)
- `user_id`, `cycle_start_month` (1-12), `cycle_start_year`, `cycle_end_month`, `cycle_end_year`
- Used to bound the timeline / calendar views. Editable from a small "Cycle settings" dialog on the timeline page.

**`events_catalog`** (shared, admin-managed like agents/schools)
- `title`, `month`, `start_date`, `end_date`
- `countries text[]`, `cities text[]` (freeform-with-suggestions)
- `cost numeric`, `currency`
- `status`: `proposed | planning | confirmed | done`
- `traveller_id` (profile), `notes`
- Standard timestamps + `created_by`

**`event_cities`** (suggestions store)
- `country`, `city`, unique per pair
- Seeded lazily: when a user types a new city for a country, it's added here so it appears in future dropdowns.

**`planned_activities`** (the timeline rows)
- `user_id` (owner), `title`
- `start_date`, `end_date` (drives the "Month/Year" and "Date from → to" columns)
- `countries text[]` (multi-select from `COUNTRIES`)
- `event_ids uuid[]` (multi-select from `events_catalog`)
- `event_types text[]` — one or more of: `agents_visits`, `school_visits`, `recruitment_events`, `other`
- `traveller_id` (profile, defaults to owner; can be delegated to any user)
- `academic_support`: `required | preferred | not_required`
- Costs: `events_cost` (auto-summed from selected `event_ids`, editable override), `travel_cost`, `hotel_cost`, `subsistence_cost`, computed `total_cost`
- `actual_events_cost`, `actual_travel_cost`, `actual_hotel_cost`, `actual_subsistence_cost` (filled after trip)
- `status`: `proposed | planning | confirmed | done`
- `objectives`, `notes`
- `trip_id` (nullable) — set once "Create trip" promotes this row into a real trip
- `reminder_sent_at` (nullable) — for the 2-month reminder
- `actual_cost_reminder_sent_at` (nullable)

RLS on `planned_activities`: owner + assigned traveller can read/write; line managers can read their reports'; admins full access.
RLS on `events_catalog`: all authenticated read; admins (or `can_manage_templates`) write.
RLS on `event_cities`: authenticated read; authenticated insert.

### Timeline view (`/planning/timeline`)
- Full-width cards, one per `planned_activity`, sorted by `start_date` within the cycle window.
- Header strip: cycle range, filter by status, filter by traveller, "New activity" button.
- Each card shows: month + year badge, date range, title, country chips, event chips, event-type chips, traveller avatar/name, academic support pill, cost summary (Events / Travel / Hotel / Subsistence / **Total**), status badge.
- Card actions: **Edit**, **Create trip** (only if not yet linked to a trip; opens the New Trip dialog pre-filled with title, countries, dates; on save, links `trip_id`), **Submit actual costs** (visible when status = confirmed or done; opens a small dialog collecting the four `actual_*` fields).
- Add/Edit dialog:
  - Title
  - Date range (start / end)
  - Countries — multi-select from the shared country list
  - Events — multi-select from `events_catalog` (searchable), auto-fills `events_cost`
  - Event types — multi-checkbox
  - Traveller — searchable select of profiles (defaults to self)
  - Academic support — segmented control
  - Costs — 4 inputs + auto Total
  - Status — segmented control
  - Objectives / notes — textareas
  - Objectives-empty confirm prompt (matches existing trip pattern).

### Calendar view (`/planning/calendar`)
- Monthly grid covering the cycle window (paginated by month, "Prev/Next" + jump-to-month).
- Each planned activity renders as a colored bar spanning its date range (color = status).
- Click a bar → opens the same Edit dialog.
- Uses a lightweight custom grid built with `date-fns` (no new heavy calendar dependency).

### Events catalog page (`/planning/events`)
- Table of `events_catalog` rows with the same columns as the sub-form: Title, Month, Start, End, Countries, Cities, Cost, Status, Traveller, Notes.
- "New event" / "Edit" dialog:
  - Title, month (derived from start_date), start/end dates
  - Countries multi-select (from `COUNTRIES`)
  - Cities multi-select: for each selected country, show known cities from `event_cities` and allow typing a new one; new entries get inserted into `event_cities`.
  - Cost + currency, status, traveller, notes.
- Read for all; create/edit gated to admins or `can_manage_templates`.

### "Create trip" promotion
- Reuses existing `trips` insert logic in `_authenticated.trips.index.tsx`, extracted into a small helper.
- On success, updates `planned_activities.trip_id` and navigates to `/trips/$tripId`.
- Editing a planned activity linked to a trip no longer changes the trip; only the planning row.

### Reminder emails (via existing email queue)
- New scheduled server route `/api/public/planning/reminders` (cron via `pg_cron` + `pg_net`, `apikey` auth as documented):
  - **Itinerary start reminder**: for `planned_activities` where `trip_id IS NULL`, `status IN ('planning','confirmed')`, `start_date` is between 55–65 days out, and `reminder_sent_at IS NULL`. Sends `planning-itinerary-reminder` template to the traveller. Stamps `reminder_sent_at`.
  - **Actual costs reminder**: for rows where `status IN ('confirmed','done')`, `end_date < today`, one of the `actual_*` fields is null, and `actual_cost_reminder_sent_at IS NULL`. Sends `planning-actual-costs-reminder` template. Stamps `actual_cost_reminder_sent_at`.
- Also creates in-app `notifications` rows for both cases.
- Two new React Email templates registered in `src/lib/email-templates/registry.ts`.
- Cron: daily at 08:00 UTC.

### Files added / changed (technical)
- Migration: create the 4 tables, RLS, GRANTs, indexes on `(user_id, start_date)` and `(status)`.
- `src/lib/planning.functions.ts` — server fns: list/create/update/delete planned activities, list/create/update events, list/upsert cities, promote-to-trip, submit-actual-costs.
- `src/routes/_authenticated.planning.tsx` — outlet layout with tab nav.
- `src/routes/_authenticated.planning.timeline.tsx`
- `src/routes/_authenticated.planning.calendar.tsx`
- `src/routes/_authenticated.planning.events.tsx`
- `src/components/planned-activity-dialog.tsx`
- `src/components/event-catalog-dialog.tsx`
- `src/components/multi-country-select.tsx` and `src/components/multi-city-select.tsx` (reusable)
- `src/lib/email-templates/planning-itinerary-reminder.tsx`
- `src/lib/email-templates/planning-actual-costs-reminder.tsx`
- Update `src/lib/email-templates/registry.ts` and `src/components/app-shell.tsx` (sidebar link).
- New route `src/routes/api/public/planning/reminders.ts` + `pg_cron` schedule in the migration.

### Out of scope for this pass
- Multi-currency conversion (single currency, defaulting to what's already used elsewhere).
- Drag-to-reschedule in the calendar (click-to-edit only for v1).
- Sharing/exporting the timeline as PDF.

Confirm and I'll implement in one pass.
