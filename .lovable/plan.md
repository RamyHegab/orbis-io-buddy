## Goal

Make the `schools` table mirror the fields in your Notion "School contact form" so what users capture in the app matches what your team already collects.

## Form fields → columns

| Notion form field | Column | Type |
|---|---|---|
| School name | `name` (exists) | text |
| City | `city` (exists) | text |
| Address | `address` *(new)* | text |
| General E-Mail address | `general_email` *(renamed from `email`)* | text |
| General contact number | `general_phone` *(renamed from `phone`)* | text |
| Primary contact person | `primary_contact_name` *(renamed from `contact_name`)* | text |
| Position | `primary_contact_position` *(new)* | text |
| Primary contact email | `primary_contact_email` *(new)* | text |
| Primary contact phone | `primary_contact_phone` *(new)* | text |
| Secondary contact person | `secondary_contact_name` *(new)* | text |
| Secondary contact email | `secondary_contact_email` *(new)* | text |
| Secondary contact phone | `secondary_contact_phone` *(new)* | text |
| Campus picture (upload) | `campus_image_url` *(new)* | text (public URL) |

Kept from existing schema: `country`, `level`, `notes`, `status`, `notion_page_id`, `properties`, `last_synced_at`, plus standard id/user_id/timestamps. `country` stays nullable (form has no country field — we'll infer from city when needed).

## Storage

Create a public `school-campuses` storage bucket so the campus image upload works from the in-app form, with RLS allowing authenticated users to insert/update their own files and public read.

## Migration steps (single migration)

1. `ALTER TABLE public.schools`:
   - rename `email` → `general_email`, `phone` → `general_phone`, `contact_name` → `primary_contact_name`
   - add new columns above
2. Create `school-campuses` bucket + storage policies.

Existing rows keep their data through the renames; new columns default to NULL.

## App updates

- **Schools page** (`_authenticated.schools.tsx`): replace the current generic create/edit form with one that mirrors the Notion form layout — sections "School", "General contact", "Primary contact", "Secondary contact", "Campus image" (upload to the new bucket).
- **Notion sync** (`notion-sync.functions.ts`): map matching Notion property names into the new columns; leave unrecognized props in the `properties` JSONB bag as today.
- **Generated types**: regenerated after migration; afterwards, update the few places that read `school.email` / `school.phone` / `school.contact_name`.

## Out of scope

- No changes to agents, branches, trips, or activities.
- No live Notion form → DB webhook (sync stays one-way pull from the Notion Schools DB you already linked).
