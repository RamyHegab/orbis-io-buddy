## Goal
Refresh the visual style across the app while keeping every existing feature, route, and data flow exactly as-is.

**Palette**
- Background: warm **sand** (`oklch(0.955 0.022 85)`)
- Primary / sidebar / frames: **deep navy** (`oklch(0.22–0.26 0.07 260)`)
- Accent: **gold** (`oklch(0.78 0.13 85)`) — logo, active states, highlights, key badges
- Ink: navy on sand; gold on navy

## Changes

### 1. `src/styles.css` — global tokens (one edit)
Rewrite the `:root` (and matching `.dark`) token block to the navy/gold/sand system above. This recolors everything that already uses semantic tokens (cards, buttons, badges, dialogs, inputs, sidebar) in one shot — no component code changes needed.

Also:
- Tighten `--radius` from `0.75rem` → `0.5rem` for a crisper, more square frame feel.
- Add `--gold` token for explicit gold use.

### 2. `src/components/app-shell.tsx` — sidebar polish
- Logo tile: navy → **gold** background with navy globe icon. Brand text in gold.
- Active nav item: gold left-border accent + gold text (instead of teal-tinted bg).
- Notification badge: gold pill with navy text.
- No structural/layout changes.

### 3. `src/components/page-header.tsx`
- Add a thin gold underline rule under the H1 to echo the framed look.

### 4. `src/routes/_authenticated.trips.index.tsx` — Trips page restyle only
Functionality unchanged (rows, checklist, create dialog, selection all behave the same). Visual updates only:
- Each row wrapped in a **navy-framed panel** (border + subtle navy header bar showing section name + count) sitting on the sand background.
- Trip cards become **square-feel tiles** (aspect closer to 1:1, fixed width ~14rem, navy 1px frame, sand interior, gold accent strip on top for status). Selected upcoming card uses a thicker gold frame instead of teal ring.
- Plane icon tile: navy bg, gold icon.
- "Confirmed" / destination badges restyled: confirmed → gold; destinations → navy outline chips.
- Checklist panel: navy header band, gold check marks for Done, gold Yes/No active state, gold "Good luck" banner.

### 5. Other routes
No code changes — they automatically pick up the new tokens (cards, buttons, inputs, dialogs all theme-driven).

## Out of scope
- No changes to data, routing, queries, mutations, RLS, or component APIs.
- No changes to dark mode beyond keeping it valid (navy deepened, gold preserved).
- No font change (keeps Inter).

## Acceptance
- Sand page background, navy sidebar with gold logo + active accents.
- Trips page rows are framed panels with square-feel tiles inside.
- All existing buttons / dialogs / forms still work and look cohesive in the new palette.
