## Goal

Let an Admin upload a University logo and set the app's colour scheme — either auto-derived from the logo, or manually set (pickers). Applied app-wide (sidebar, header, buttons, accents). Non-admins see the branding but can't change it. Fully revertable from the same settings card.

## Where it plugs in

- **Settings page** (`src/routes/_authenticated.settings.tsx`): new "Branding" card, Admin-only, alongside existing "Account" card.
- **Storage**: reuse existing private `avatars` bucket with a `branding/` prefix (or add a `branding` bucket if you'd prefer public URLs — I'll default to a new **public** `branding` bucket so the logo renders in the sidebar/header without signed URLs).
- **DB**: extend the existing `app_settings` singleton (id=1) — no new table.
- **Theme application**: a small `BrandingProvider` mounted in `src/routes/__root.tsx` that reads settings and injects CSS variable overrides (`--primary`, `--accent`, `--sidebar`, `--ring`, `--gold`) onto `:root`. Overrides only when set; otherwise the current navy/gold theme stands.
- **Logo display**: sidebar header in `src/components/app-shell.tsx` (and the top header) shows the uploaded logo when present.

## Changes

1. **DB migration** — add to `app_settings`:
   - `logo_url text`
   - `logo_path text` (storage path for delete/replace)
   - `theme_mode text default 'default'` — `'default' | 'from_logo' | 'custom'`
   - `theme_primary text`, `theme_accent text`, `theme_sidebar text` (hex, nullable)
   - RLS already restricts writes to admin; unchanged.

2. **Storage** — create public `branding` bucket via storage tool; RLS: public SELECT, admin-only INSERT/UPDATE/DELETE (via `has_role(auth.uid(),'admin')`).

3. **Branding card** (`_authenticated.settings.tsx`, Admin-only):
   - Logo upload (drag/drop or file picker), preview, "Remove logo".
   - Radio: **Use default theme** / **Derive from logo** / **Custom colours**.
   - Derive-from-logo: client-side extract dominant + accent colour from the uploaded image using a tiny palette function (canvas + downsample; no dependency needed — or add `colorthief` if you'd prefer).
   - Custom: three colour pickers (Primary, Accent, Sidebar) with hex input.
   - "Preview" applies live via the provider; "Save" persists; "Reset to default" clears everything (this is your revert).

4. **BrandingProvider** (`src/components/branding-provider.tsx`):
   - Reads `app_settings` (via existing `useAppSettings` extended).
   - Converts hex → oklch and sets CSS vars on `document.documentElement` so Tailwind tokens pick them up automatically.
   - No override when `theme_mode='default'`.

5. **Logo rendering**:
   - `app-shell.tsx` sidebar brand area: show logo if `logo_url` else current text mark.
   - Optional: header-menu left slot mirrors the same.

## Revert path

Everything lives behind `theme_mode` and `logo_url`. Clicking **"Reset to default"** clears the fields — theme + logo revert instantly across the app, no code changes needed. If you dislike the feature entirely, revert this chat message from history and the migration/UI go away together.

## Out of scope

- Dark-mode-specific overrides (we'll override the light theme only; dark stays as-is unless you want both).
- Per-user themes.
- Full brand kit (typography, favicons) — logo + 3 colours only for this pass.

Shall I build it?