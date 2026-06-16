## Add "Lookup flight" to Air Travel activities

When users add/edit a Travel activity with transport mode "Air travel", they'll get a **Lookup** button next to the Flight number field. Clicking it pulls real flight data and prefills the form.

### What it does
1. User enters flight number (e.g. `BA286`) and ensures the activity's start date is set.
2. Clicks **Lookup** → calls AeroDataBox via RapidAPI using the activity's start date.
3. On success, prefills:
   - **Airline** (e.g. "British Airways")
   - **From** (departure airport: `LHR — Heathrow`)
   - **To** (arrival airport: `SFO — San Francisco Intl`)
   - **Start date/time** (scheduled departure, local time)
   - **End date/time** (scheduled arrival, local time)
4. Shows a toast on error (invalid number, no flight on that date, API limit, etc.). User can still edit fields manually.

### Setup needed from you
- A **RapidAPI key** with AeroDataBox subscribed (free tier = 500 req/month). I'll prompt you to add it as a secret named `RAPIDAPI_KEY` once you approve the plan. Get it at https://rapidapi.com/aedbx-aedbx/api/aerodatabox.

### Technical details
- New server function `lookupFlight` in `src/lib/flights.functions.ts` using `createServerFn` + `requireSupabaseAuth` (so the RapidAPI key never leaves the server).
- Calls `GET https://aerodatabox.p.rapidapi.com/flights/number/{number}/{YYYY-MM-DD}` with header `X-RapidAPI-Key`.
- Maps response → `{ airline, from, to, startsAt, endsAt }`. If multiple legs returned (codeshares), picks the first.
- UI change in `src/routes/_authenticated.trips.$tripId.tsx`: add a "Lookup" button next to the flight number input inside the Air travel branch; disabled while loading or if no flight number / start date.
- No DB schema changes.
