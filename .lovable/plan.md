
## 1. Excel import (replaces Notion sync)

**Where:** "Import list" button on Schools page, Agents page, and inside an agent's Branches section. Available to all users.

**Flow:**
1. User clicks **Import list** → dialog opens.
2. Upload `.xlsx` / `.csv` (parsed in-browser with `xlsx` package — no server upload).
3. App auto-detects columns by fuzzy-matching headers to CRM fields (e.g. `School` → `name`, `Country of HQ` → `hq_country`).
4. **Review-all mapping screen:** every CRM field listed with a dropdown of source columns (pre-filled with best guess, "— skip —" option). Required fields marked with `*`. Preview of first 3 rows updates as user adjusts.
5. **Conflict review:** before insert, app queries existing rows matching by name (schools: `name`+`country`; agents: `trading_name`; branches: `agent_id`+`name`). Each conflict shows side-by-side current vs. incoming with **Skip / Update / Create as new** radio per row.
6. **Import** → inserts/updates with `user_id = auth.uid()`. Toast with counts.

**CRM fields exposed per type:**
- Schools: name*, country*, city, status, website, contact_name, contact_email, contact_phone, address, notes
- Agents: trading_name*, legal_name, agent_code, status, website, hq_country, hq_address, account_manager, main_contact_name/email/phone
- Branches (inside an agent): name*, address, city, country, contact_name, contact_email, contact_phone

**Files:**
- `src/components/import-list-dialog.tsx` — reusable dialog (props: `type: "school" | "agent" | "agent_branch"`, optional `agentId`)
- `src/lib/import-mapping.ts` — field schemas per type, fuzzy header matcher, conflict detection
- Add button + remove Notion sync UI in: `_authenticated.schools.tsx`, `_authenticated.agents.index.tsx`, `_authenticated.agents.$agentId.tsx`
- `bun add xlsx`

## 2. Public intake form

**Public route per type** (no auth):
- `/public/intake/school`
- `/public/intake/agent`
- `/public/intake/branch`

One reusable link per type — shareable as-is. Form fields mirror the CRM schema (same fields as import). Submission writes to a new `pending_submissions` table.

**Review queue:** new page `/_authenticated/inbox` showing pending submissions with **Approve** (creates real record, deletes pending) / **Reject** (deletes pending) / **Edit then approve**. Visible to all users; admin can restrict via existing role check.

**Entry points:**
- "Share intake form" button in page header on Schools / Agents pages → copies public URL to clipboard.
- Sidebar item **Inbox** with unread badge count.

**Files:**
- `supabase/migrations/...` — `pending_submissions` table (`id`, `type`, `payload jsonb`, `submitter_name`, `submitter_email`, `agent_id` nullable, `status`, timestamps) + RLS (anon insert allowed, authenticated read/delete)
- `src/routes/public.intake.$type.tsx` — public form (rate-limit-friendly, honeypot field, zod validation)
- `src/routes/_authenticated.inbox.tsx` — review queue
- Share buttons in existing list pages

## Out of scope
- No tokenized per-invite links (one reusable link only).
- No email notifications on submission (toast + inbox badge only).
- No bulk approve in inbox (per-row actions).

Ready to build on approval.
