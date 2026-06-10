## Finish the deferred Google Maps work

Two remaining items from the previous turn:

### 1. Add Google Maps links to itinerary exports
Edit `src/lib/trip-export.ts` so every activity row with a location renders a "View on Google Maps" hyperlink, using the same precedence as the in-app itinerary:
- `place_id` → `https://www.google.com/maps/search/?api=1&query=<addr>&query_place_id=<id>`
- else `lat`/`lng` → `query=<lat>,<lng>`
- else `formatted_address` / `location` / joined agent branch / school address → `query=<encoded address>`

Apply to:
- **PDF export** — append a clickable link line under the venue/agent/school address for each activity.
- **Word (.docx) export** — same, using `ExternalHyperlink` so it's clickable in Word.

Also pull the new `place_id` / `formatted_address` / `lat` / `lng` fields for `agent_branches` and `schools` in the trip-data query feeding the export, if not already selected.

### 2. Mini-map preview on Schools list cards
In `src/routes/_authenticated.schools.tsx`, render `<MapPreview>` (≈120px tall) inside each school card when the school has `lat`/`lng` (or `place_id`), matching the agent-branch card treatment. Add a small "Open in Maps" icon-link next to the address.

### Out of scope
No schema changes, no new components, no other surfaces touched.
