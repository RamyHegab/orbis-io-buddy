## Goal

Add **hotels as multi-day stays** that show on every day they cover. Entry point is an "Add hotel" button on each day card (greyed out when that day is already covered by another stay). Hotels also surface in the daily itinerary report and the cost summary.

## Data model

New table `trip_hotels`:
- `trip_id` (FK → trips, cascade delete)
- `name` (text, required)
- `map_url` (text — the Google Maps hyperlink wrapped on the name)
- `address` (text, optional — fallback for the embedded map preview)
- `check_in_date`, `check_out_date` (date, required; check_out > check_in)
- `check_in_time`, `check_out_time` (time, optional)
- `cost` (numeric), `cost_currency` (text, default 'GBP')
- `notes` (text, optional)
- `id`, `user_id`, `created_at`, `updated_at`
- RLS scoped to `auth.uid() = user_id`, GRANT to authenticated + service_role, `update_updated_at_column` trigger

The existing `hotel` activity type is removed from the picker (`ACTIVITY_TYPES`) for new entries; legacy rows still render.

## UI — `src/routes/_authenticated.trips.$tripId.tsx`

### Day card

Header gets a second button next to **Add**:

```text
[ + Add ]   [ 🏨 Add hotel ]
```

Rules:
- If a hotel covers this day (`check_in_date ≤ day < check_out_date`):
  - "Add hotel" button is **greyed out / disabled** with tooltip "Covered by {hotel name}".
  - A pinned row appears at the top of the day's activity list:
    `🏨 {hotel name as hyperlink to map_url} · check-in 14:00` on the check-in day,
    `· check-out 11:00` on the check-out day, plain "Staying at …" in between. Clicking opens the edit dialog.
- If no hotel covers this day: "Add hotel" opens the hotel dialog with `check_in_date` prefilled to that day and `check_out_date` to the next day.

### Hotel dialog

Fields: Hotel name · Google Maps link · Address (optional) · Check-in date + time · Check-out date + time · Cost + currency (reuse `CostInput`) · Notes.
- Validation: name + check-in + check-out (out > in). Dates may sit outside the trip range; we just warn inline.
- Overlap check on save: if the new range overlaps an existing stay (other than the one being edited), block with toast "Overlaps {hotel name} ({dates})".
- Embedded map preview using `https://maps.google.com/maps?q={encodeURIComponent(address || name)}&output=embed`.
- Edit dialog reuses the same form; includes a Delete button.

### Cost summary card

`Hotels` total sums `trip_hotels.cost` per currency (replacing the current hotel-activity sum). Travel / Events / Total unchanged otherwise.

## Report — `src/lib/trip-report.functions.ts`

- Fetch `trip_hotels` alongside activities.
- Daily breakdown: prefix each day with a `Staying at {name} ({map_url})` line when a stay covers it (with check-in/out time on boundary days).
- Add an **Accommodation** section listing each stay (name, dates, nights, cost, link).
- Cost totals: pull hotel totals from `trip_hotels`.

## Technical notes

- New query key `["trip-hotels", tripId]`; invalidate after add/edit/delete and after trip date edits.
- All reads/writes via the browser supabase client with RLS.
- Helper `hotelForDay(date)` returns the covering stay for a given day — used by the day card chip and the "Add hotel" disabled state.
- Migration runs `CREATE TABLE … GRANT … ENABLE RLS … CREATE POLICY …` + updated-at trigger in one file.

## Out of scope

- Per-night cost split.
- Auto-linking a hotel to its arrival travel activity.
- Multi-room / guest tracking.
