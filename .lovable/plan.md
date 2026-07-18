# Archive past cycles and trips

Give users a way to close out a completed cycle so old trips and planned activities disappear from the active Planning/Trips views but stay fully browsable in a read-only Archive.

## Concept

- A "cycle" is the recruitment year already defined in `cycle_settings` (start/end month + year).
- Users can **archive** a cycle when it ends. Everything dated inside that cycle window becomes read-only and hidden from the default Planning + Trips views.
- Nothing is deleted. Archived items remain visible under a new **Archive** tab, filterable by cycle.

## User-facing changes

1. **Planning page → "Archive cycle" button** (admins only)
   - Opens a small dialog: "Archive cycle {Sep 2024 – Aug 2025}? This will move all trips and planned activities in this window to the archive."
   - On confirm: stamps affected rows with the cycle label and marks them archived.
   - After archiving, the cycle settings roll forward to the next year automatically (user can adjust).

2. **New "Archive" tab** on both Planning and Trips pages
   - Cycle picker at the top (e.g. "2024–2025", "2023–2024").
   - Shows the same timeline/calendar/trip cards, but read-only: no edit, delete, cancel, status-change, or "Create trip from activity" buttons. Detail dialogs open in view-only mode.
   - KPI tiles + per-country breakdown still render for the selected archived cycle.

3. **Default views hide archived rows**
   - Planning timeline/calendar/events and Trips index (Draft / In progress / Approved / Past) filter out `archived = true`.
   - "Past trips" in Trips index keeps its current meaning (completed, non-archived). Once archived, they leave "Past trips" and appear under Archive.

4. **Manual archive/restore per item** (admin only, from the item's detail dialog)
   - "Move to archive" / "Restore from archive" — useful for one-off cleanup outside a full-cycle archive.

## Technical details

Schema (single migration):
- Add to `trips`, `planned_activities`, `events_catalog`:
  - `archived boolean NOT NULL DEFAULT false`
  - `archived_cycle text` (e.g. "2024-2025")
  - `archived_at timestamptz`
- Index `(archived, archived_cycle)` on each table.
- RLS: keep existing policies; add no new access, admins archive/restore via existing update policies.

Server functions (`src/lib/archive.functions.ts`):
- `archiveCycle({ startMonth, startYear, endMonth, endYear })` — admin-gated via `has_role`; sets `archived=true`, `archived_cycle`, `archived_at` on rows whose date falls in the window.
- `restoreCycle(cycle)` — reverse.
- `archiveItem` / `restoreItem` for single-row toggles.

UI:
- `src/routes/_authenticated.planning.tsx`: add `archived=false` filter to all queries; add "Archive" tab + cycle picker; add "Archive cycle" action button; read-only rendering when viewing archive.
- `src/routes/_authenticated.trips.index.tsx` + `_authenticated.trips.$tripId.tsx`: same filter + read-only mode when `archived=true`.
- Reuse existing dialogs with an `isReadOnly` prop that hides mutation buttons.

Out of scope: deleting archived data, exporting archives, multi-tenant cycle definitions.
