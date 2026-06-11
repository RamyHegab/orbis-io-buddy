## Goal

Make the Agents and Schools list pages much shorter on first view by grouping entries under country headers that are **collapsed by default**. Users click a country to expand and see its agents/schools.

## Changes

### `src/routes/_authenticated.schools.index.tsx`
- Schools are already grouped by country, but every group is rendered open. Wrap each country block in a `Collapsible` (from `@/components/ui/collapsible`) with `defaultOpen={false}`.
- Country header becomes the `CollapsibleTrigger`: a full-width row showing flag/name, the count badge, and a chevron that rotates when open.
- The school cards grid moves into `CollapsibleContent`.
- When the user types in the search box, auto-expand any country that has matches (so search results are visible without manual clicks). Empty search = all collapsed.

### `src/routes/_authenticated.agents.index.tsx`
- Currently a flat grid of agent cards. Add the same country grouping the Schools page uses, keyed off `hq_country` (fallback `"—"`). Sort countries alphabetically, agents alphabetically inside.
- Wrap each country group in the same `Collapsible` pattern (collapsed by default, auto-expand on active search).
- Keep the existing card markup, search input, header actions, and empty state untouched.

### Shared behavior
- Collapsed header style: subtle bordered row, `py-2 px-3`, hover background, chevron-right icon that rotates 90° when open. Matches existing muted-uppercase country label styling so it doesn't feel like a new component language.
- No changes to data fetching, mutations, dialogs, routing, or card internals.

## Technical notes

- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` already exist at `src/components/ui/collapsible.tsx`.
- Use `useState<Record<string, boolean>>` to track open state per country so toggling and the search-driven auto-open can coexist (derive effective open state as `openMap[country] ?? !!filter && hasMatches`).
- No new dependencies, no backend changes.
