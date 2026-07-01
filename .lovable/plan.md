# Fix: Unvalidated map_url XSS (`map_url_href_xss`)

Prevent `javascript:` (or other non-http) URLs stored in `trip_hotels.map_url` (and `activities.map_url`) from being rendered as live anchor `href`s.

## Changes

### 1. Client-side render guard
Add a small helper and use it everywhere a user-supplied URL is rendered as an `<a href>`.

- New file: `src/lib/safe-url.ts`
  ```ts
  export function safeHttpUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
      const u = new URL(url, window.location.origin);
      return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
    } catch {
      return null;
    }
  }
  ```
- `src/routes/_authenticated.trips.$tripId.tsx` (~line 1002): wrap `stay.map_url` with `safeHttpUrl(...)`; only render the `<a>` when truthy, otherwise render the hotel name as plain text.
- Apply the same guard to any other render sites of `trip_hotels.map_url`, `activities.map_url`, and `schools` website/map fields rendered as anchors. I'll grep for `href={` against these fields before editing.

### 2. Database CHECK constraints (defense in depth)
Migration adding scheme guards mirroring the existing `pending_submissions_source_url_http` pattern:

```sql
ALTER TABLE public.trip_hotels
  ADD CONSTRAINT trip_hotels_map_url_http
  CHECK (map_url IS NULL OR map_url ~* '^https?://');

ALTER TABLE public.activities
  ADD CONSTRAINT activities_map_url_http
  CHECK (map_url IS NULL OR map_url ~* '^https?://');
```

If any existing rows violate the constraint, the migration will list and null them out before adding the constraint.

### 3. Mark finding fixed
Call `manage_security_finding` with `mark_as_fixed` for `map_url_href_xss` after the edits + migration land.

## Out of scope
The three other findings shown in the scan panel (`agents_schools_branches_cross_user_read`, `form_instances_missing_select_policy`, `SUPA_anon_security_definer_function_executable`) — only the requested one is addressed here.
