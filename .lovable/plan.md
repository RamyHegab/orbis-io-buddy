
## Goal

Replace the placeholder Agents / Branches / Schools schemas with ones modeled on your real Airtable (Agents + Offices) and Notion (Schools) data, import the CSV rows on first run, and use the Offices "Itinerary Planner" timestamps to pre-populate trip activities.

---

## 1. Reshape `agents` table

Mirror the Airtable "Agents List" columns. Drop the old generic fields, add:

- `trading_name` (was `name`)
- `legal_name`
- `account_manager`
- `status` (enum: active, inactive, prospect)
- `website`
- `hq_country`, `hq_address`
- `agent_code` (unique per agent)
- `agreement_start_date`, `agreement_end_date`
- `countries_of_operation` (text[])
- `main_contact_name`, `main_contact_email`, `main_contact_phone`

Dedupe rule on import: collapse rows sharing the same `trading_name` + `legal_name`; when agreement dates differ, keep the latest `agreement_end_date`.

## 2. Reshape `agent_branches` table

Mirror the Airtable "Offices" columns:

- `branch_name` (e.g. "Gullberg, Lahore")
- `country`, `city`, `address` (the Maps URL goes here)
- `contact_first_name`, `contact_last_name`, `contact_email`, `contact_position`, `contact_phone`
- `in_country_trading_name`, `agency_name`
- `agent_id` → `agents.id` (matched by trading_name during import)

## 3. Reshape `schools` table to match Notion

I'll connect Ramy's Notion and read the Schools database schema, then mirror its properties 1:1 (name, country, city, plus whatever level/type/contact/status/notes properties exist). The current generic schools schema will be replaced.

Action required from you after this plan is approved:
1. I'll trigger the Notion connector link.
2. In the Notion OAuth screen, explicitly share the **Schools** database with the integration (otherwise it's invisible).
3. I'll read the database schema and mirror it; then optionally import existing rows.

## 4. Itinerary Planner columns → trip activities

The Offices CSV has `Itinerary Planner` and `Itinerary Planner 2` timestamp columns (e.g. `2/10/2025 12:00`). Treatment:

- Not stored on the branch itself.
- During CSV import, for each non-empty timestamp create an `activity` row of type `agent_visit` linked to that branch, with `scheduled_at` set to the timestamp. These will need a trip to attach to — I'll create a placeholder trip "Pakistan — Oct 2025" (inferred from the dates present) and attach them there so they show up immediately in the calendar planner.
- Going forward, branches and trip activities stay linked via `activity.branch_id`.

## 5. Seed data (one-shot)

CSV rows from `Agents List-Grid view.csv` and `Offices-Grid view.csv` get inserted via an admin-only server function `seedFromAirtableCsv` that runs once (idempotent: skipped if `agents` table is non-empty). Files ship in `src/data/seed/`.

## 6. Update the UI

- Agents list: show trading name, status badge, account manager, agreement window.
- Agent detail: legal name, agent code, HQ, countries-of-operation chips, agreement dates, contact block.
- Branches: card shows branch name, city/country, contact, agency name, link to Maps address.
- Schools page: fields adjusted to whatever Notion returns (filled in after Notion is linked).

## 7. Notion sync mode

One-time pull on demand via an admin "Sync from Notion" button on the Schools page. No live two-way sync in this iteration.

---

## Technical notes

- Migration: rename/drop columns on `agents`, `agent_branches`, `schools`; add new ones; keep RLS + GRANTs intact.
- Seed runs in a `createServerFn` with `requireSupabaseAuth` + admin role check; CSVs parsed with `papaparse`.
- Notion fetch runs in a `createServerFn` using `process.env.NOTION_API_KEY` via the connector gateway, with pagination.
- Activities import depends on the existing `activities` table accepting `branch_id`; if it doesn't, the migration adds it.

## What I need from you to proceed after plan approval

1. Approve linking the Notion connector (prompt will appear).
2. Share the Schools database with the Notion integration during OAuth.
3. Confirm the placeholder trip name for the seeded itinerary slots, or tell me to skip activity seeding and only import agents/branches.
