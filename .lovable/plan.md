## Goal

Let admins automatically find an agent's branch offices from the web and drop the candidates into the existing **Inbox** review queue — nothing writes to `agent_branches` until a human approves.

Available in two places:
1. **Per-agent button** on the agent detail page ("Discover branches from web").
2. **Onboarding step** — first time an admin lands on the CRM with agents already in the list, a banner offers "Discover branches for all your agents" (one-click bulk, runs in background, results land in Inbox). Dismissible + re-runnable from Settings.

## How discovery works

For each agent, the server function runs this pipeline:

```text
agent (name, website, hq_country)
   │
   ▼
1. Site scrape (Firecrawl)
   • map agent website → find /offices, /branches, /contact, /locations
   • scrape those pages as markdown
   │
   ▼  (if no usable result)
2. Web search fallback (Lovable AI + Firecrawl search)
   • query: "<agent name> branch offices contact"
   • scrape top 3 results
   │
   ▼
3. Extract with Gemini (structured output / Zod schema)
   • returns array of { branch_name, city, country, address,
     contact_name, contact_email, contact_phone, source_url, confidence }
   │
   ▼
4. Insert each row into `pending_submissions`
   (type=agent_branch, agent_id, source="auto_discovery", payload=...)
```

Every candidate goes through the existing Inbox review UI — same per-field approve/merge flow already built for spreadsheet imports. Source URL is shown on each row so the reviewer can verify.

## Where it lives in the UI

- **Agent detail page** (`_authenticated.agents.$agentId.tsx`): new button next to "Add branch" → "Discover from web" (admin only). Shows a toast "Searching… results will appear in Inbox" and kicks off the server fn.
- **Dashboard / first-run banner**: if `agents.count > 0` and the admin has never run discovery, show a one-time card "Auto-discover branches for your N agents → Start". Dismiss stored in `profiles` or a new `user_settings` row.
- **Settings → Data**: "Re-run branch discovery" button (admin only).
- **Inbox**: discovered rows show a `Auto-discovered` badge and the source URL.

## Permissions

Admin only (uses `has_role(auth.uid(), 'admin')`). Non-admins don't see the button or the banner. Enforced both client-side (hide UI) and server-side (server fn throws 403).

## Technical details

**New files**
- `src/lib/branch-discovery.functions.ts` — `discoverBranchesForAgent({ agentId })` and `discoverBranchesForAllAgents()`. Both use `requireSupabaseAuth`, verify admin role, then run the pipeline. Bulk version processes agents sequentially with a small delay to respect rate limits and returns `{ queued: N }` immediately while continuing in the background isn't possible on Workers — instead it processes in batches and returns progress; UI polls a `discovery_jobs` row for status.
- `src/lib/firecrawl.server.ts` — thin wrapper around Firecrawl SDK (`scrape`, `map`, `search`).
- `src/components/discover-branches-button.tsx` — per-agent button.
- `src/components/discovery-banner.tsx` — onboarding banner on dashboard.

**Migration**
- `discovery_jobs` table: `id, user_id, agent_id (nullable for bulk), status (queued|running|done|failed), found_count, error, created_at, updated_at` + RLS (`user_id = auth.uid()`) + grants.
- Extend `pending_submissions` if needed: add `source TEXT` and `source_url TEXT` columns (currently has payload jsonb — can stash there, but a column is cleaner for filtering).
- New `user_settings` table OR a `discovery_dismissed_at` column on `profiles` to remember the banner dismissal.

**Connectors / secrets**
- **Firecrawl** — not yet linked. Will need `standard_connectors--connect firecrawl` before this works. I'll surface the connect button if missing.
- **Lovable AI** — `LOVABLE_API_KEY` already present. Uses `google/gemini-3-flash-preview` with `Output.object({ schema })` for structured extraction.

**Cost / rate-limit guardrails**
- Cap bulk run at first 50 agents per click; show "Run again for next batch" when more remain.
- Hard timeout per agent: 30s site scrape + 30s search.
- Skip agents that already have ≥3 branches unless user opts in to "Re-scan all".
- All AI/Firecrawl errors swallowed per-agent and logged to `discovery_jobs.error`; one bad agent doesn't break the batch.

**Accuracy expectations** — Set in the UI: "Auto-discovery is best-effort and depends on what each agent publishes online. Always review before approving." Confidence score from the AI is shown on each candidate.

## Out of scope (for this pass)

- Auto-discovering branches for **schools** (same pattern could be added later).
- Scheduled re-runs (cron).
- Per-row source attachment files; we only store the URL.

## Approval checklist before I build

- Firecrawl connector needs linking — I'll prompt for that as the first step in build mode.
- Confirm: store banner-dismissed flag on `profiles` (simplest) vs new `user_settings` table?
