Plan: Import Notion yearly cycle planning data into the CRM

Goal
----
Pull the two Notion databases (trips/activities and events) into the existing CRM Yearly Activities Timeline feature as `planned_activities` and `events_catalog` records.

Current state
-------------
- The planning feature is live at `/planning` in `src/routes/_authenticated.planning.tsx`.
- Data is stored in `planned_activities` (26 columns) and `events_catalog` (14 columns).
- There is no active Notion integration; a previous Notion sync was removed and only unused `schools` columns remain as scaffolding.
- The existing generic importer (`src/components/import-list-dialog.tsx` + `src/lib/import-mapping.ts`) only supports `school`, `agent`, and `agent_branch` — not planning data.

Approach
--------
Build a Notion-to-planning import flow that works from the shared Notion links you provide. The cleanest way is to use the Notion API behind a server function: you make the two databases public, create a Notion integration, share the databases with the integration, and the CRM fetches the rows, maps them to CRM fields, and inserts them.

Steps
-----
1. Collect the two Notion links/IDs from you and the database schema you want mapped.
2. Add a new `import-notion` server function in `src/lib/notion-planning.functions.ts` that:
   - Reads `NOTION_API_KEY` and the two database IDs from environment variables.
   - Queries each Notion database via `https://api.notion.com/v1/databases/{id}/query`.
   - Maps Notion properties to CRM fields:
     - Trips → `planned_activities`: title, start_date, end_date, countries, event_types, traveller, academic_support, costs, status, objectives, notes.
     - Events → `events_catalog`: title, start_date, end_date, countries, cities, cost, currency, status, traveller, notes.
3. Add a new UI section in the Planning page (e.g., "Import from Notion" button) that calls the server function and shows progress/errors.
4. Add `NOTION_API_KEY` to project secrets via the secure secrets form.
5. Run the import once and verify the records appear in the Timeline and Events catalog tabs.

Fallback / alternative
----------------------
If you prefer not to create a Notion integration, you can export each Notion database to CSV/Excel and we can extend the existing `ImportListDialog` to support `planned_activity` and `event_catalog` with the same column-mapping UI used for schools/agents.

What I need from you
--------------------
- The two Notion links (or database IDs) for trips and events.
- A quick description of the column names in each Notion database (e.g., "Trip name", "Start date", "Countries", "Cost", etc.) so the mapping is accurate.
- Confirm whether you want the direct Notion API import or a CSV/Excel upload import.

Notes
-----
- The direct Notion API import is a one-time operation; it does not keep the data in sync after the first import.
- No new tables or schema changes are needed unless you also want to store the original Notion page IDs for future reference.