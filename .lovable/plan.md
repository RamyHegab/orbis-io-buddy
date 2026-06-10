## Goal

Add Google Maps Platform to every location field so users can autocomplete an address while typing and view/click an embedded map preview. Coverage: recruitment event venue, agent branch address, school address, plus links in the trip day list and PDF/Word exports.

## Setup

- Link the **Google Maps Platform** connector. This injects `GOOGLE_MAPS_API_KEY` (gateway), `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, and `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID`.
- DB: add `lat numeric`, `lng numeric`, `place_id text`, `formatted_address text` to:
  - `activities` (used by event venue when `type = recruitment_event`)
  - `agent_branches`
  - `schools`

## New shared component: `<AddressAutocomplete>`

- Loads Maps JS API once (`loading=async`, `callback=initMap`, channel param) using the browser key.
- Uses Places API (New) `AutocompleteSuggestion.fetchAutocompleteSuggestions` (debounced, session token) for type-ahead.
- On select, returns `{ formatted_address, place_id, lat, lng }`. The visible text input still acts as a free-form fallback if the user ignores suggestions.
- Right side of the input: a small "Open in Maps" icon-link.
- Below the input: a compact embedded preview using `google.maps.Map` + `google.maps.Marker` (no `mapId`, no AdvancedMarkerElement), centred on selected lat/lng, or hidden when empty.

## Wire-up per surface

1. **Activity editor — recruitment event venue** (`src/routes/_authenticated.trips.$tripId.tsx`): replace the existing `location` Input + `map_url` Input + manual embed block with `<AddressAutocomplete>`. Persist `lat/lng/place_id/formatted_address` alongside existing `location` and `map_url`. Keep current behaviour for hotels (already has its own embed).
2. **Agent branch form & list** (`src/routes/_authenticated.agents.$agentId.tsx`): swap the branch "Address / Maps URL" Input for `<AddressAutocomplete>`. In the branch list card, when `lat/lng` exists show a small inline static-style preview (same `<Map>` component, height ~120px) and a "View on Maps" link; otherwise just a link built from `formatted_address`.
3. **School form & detail** (`src/routes/_authenticated.schools.tsx`): same swap for the school address field; show preview + link on the school card.
4. **Itinerary day list** (`src/routes/_authenticated.trips.$tripId.tsx`, day view): next to event/agent/school rows, render a Maps link icon when an address/lat is available.
5. **Exports** (`src/lib/trip-export.ts`):
   - PDF: append a "Map" hyperlink under each activity that has a location (uses `https://www.google.com/maps/search/?api=1&query=...` or `&query_place_id=...`).
   - Word: same link inline with the activity details.

## Server work

- Migration adds the four columns to each of the three tables (nullable, no defaults, no policy changes — existing user-owned RLS still applies).
- No new server function needed; autocomplete runs in the browser with the referrer-restricted browser key. Geocoding fallback (when a user types an address but never picks a suggestion) goes through a small `createServerFn` that calls the gateway `maps/api/geocode/json` with the server `GOOGLE_MAPS_API_KEY`, so the browser key is never used for server-side APIs.

## Guardrails

- Use legacy `google.maps.Marker` (per project rules) and never set `mapId`.
- Never call Geocoding/Routes with the browser key — always via the connector gateway from a server function.
- Debounce autocomplete (250ms) and reuse a session token per editing session to keep Places billing predictable.
- If the connector is not linked at runtime, the components degrade to a plain text input plus a "Search on Google Maps" link (existing behaviour) and skip the embed.

## Files touched

- New: `src/components/address-autocomplete.tsx`, `src/components/map-preview.tsx`, `src/lib/google-maps.ts` (script loader), `src/lib/geocode.functions.ts`.
- Edited: trip detail route, agent detail route, schools route, `trip-export.ts`, plus one migration.