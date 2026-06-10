## Add to itinerary from agents/schools

Add a single reusable button + dialog so users can drop an agent, agent branch, or school straight onto a trip day from any list/detail card.

### New component
`src/components/add-to-itinerary-button.tsx`
- Props: `{ source: "agent" | "agent_branch" | "school", id, name, address?, lat?, lng?, place_id?, formatted_address?, agentId? (for branches) }`
- Renders a small "Add to itinerary" icon button (`CalendarPlus`) that opens a dialog.

### Dialog contents
1. **Trip select** — `useQuery(["trips","upcoming"])` → `supabase.from("trips").select("id,title,start_date,end_date").gte("end_date", today).order("start_date")`.
2. **Day picker** — appears once a trip is chosen. Use shadcn Calendar in `single` mode with `disabled={{ before: trip.start_date, after: trip.end_date }}` so the user can only pick valid days. Also shows the date range as helper text.
3. **Save** button.

### Save logic
Insert into `activities` with:
- `trip_id`, `user_id: auth.uid()`, `day_date`, `start_time: null`, `end_time: null`.
- `type`: `"agent_visit"` for agent/branch, `"school_visit"` for school.
- `title`: agent trading name / branch name / school name.
- For `agent` or `agent_branch`: `agent_id` (parent agent), `branch_id` if source is branch.
- For `school`: `school_id`.
- Copy location columns when present: `location` (address), `formatted_address`, `place_id`, `lat`, `lng` — same fields the activity editor saves.

After insert: invalidate `["activities", trip_id]`, toast "Added to <trip title>", close dialog, offer a "View trip" link via toast action.

### Where the button gets wired in
- **`src/routes/_authenticated.agents.index.tsx`** — on each agent card row.
- **`src/routes/_authenticated.agents.$agentId.tsx`** — on the agent header AND on each branch card (branch passes `source="agent_branch"`).
- **`src/routes/_authenticated.schools.tsx`** — on each school card.

### Out of scope
- No multi-select / bulk add (per user choice).
- No time picker (per user choice — time stays blank, user fills it later in the trip view).
- No schema changes — `activities` already has all the columns we need.
