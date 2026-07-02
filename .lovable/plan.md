## Change country input to a dropdown in Create trip

### What
Replace the free-text "Country" field in the New trip dialog with a searchable dropdown so users can't mistype country names.

### How
1. Add a static curated country list in `src/lib/countries.ts` (~150 common countries, sorted alphabetically).
2. In `src/routes/_authenticated.trips.index.tsx`, replace the `<Input placeholder="Country" ... />` inside the legs map with a `<Select>` component from the existing UI library.
3. Populate the `<SelectContent>` with the country list; keep the same `updateLeg` state flow.
4. Add the `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` import if not already present.

### Result
When creating a new trip, each leg's country is chosen from a dropdown instead of typed free-form.
