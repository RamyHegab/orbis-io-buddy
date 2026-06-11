## Problem
The `Global footprint` card on the dashboard is a fixed-height box (`lg:h-[420px]`), but `WorldMap` renders the SVG with `width: 100%; height: auto`. The aspect ratio of the Equal Earth projection (~2.05:1) rarely matches the card, so the map either overflows or leaves big empty bands at the top/bottom and looks off-center.

## Fix (presentation only)
Edit `src/components/world-map.tsx`:

1. Change the outer wrapper from `relative w-full` to `relative w-full h-full flex items-center justify-center`.
2. Update `<ComposableMap>` so it scales to the container instead of forcing its own aspect:
   - Keep `projection="geoEqualEarth"`.
   - Add an explicit `width={800}` / `height={400}` (matches the projection's natural ratio for the viewBox).
   - Set `style={{ width: "100%", height: "100%" }}`.
   - Add `preserveAspectRatio="xMidYMid meet"` (via the underlying svg props) so the map is centered and uniformly scaled with no clipping.
   - Drop the hard-coded `projectionConfig={{ scale: 155 }}` (let the viewBox + meet handle sizing so it always fits).

No changes to `_authenticated.dashboard.tsx` — the card already constrains height; once the SVG respects both axes, the map will sit centered and fully visible inside the box.

## Out of scope
- No data, routing, or layout-grid changes.
- Reports page and checklist panel untouched.