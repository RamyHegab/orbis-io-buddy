# Agent Onboarding System

Large multi-part build. I'll ship it in phases so each is testable. Confirm the plan, then I'll start with Phase 1.

## Phase 1 — Foundations (DB + roles)

**Roles**
- Keep existing `app_role` enum but treat `manager` as `line_manager` in UI copy. No schema rename (avoids breaking existing RLS/`has_role` calls). Only `admin` can create/edit form templates and checklist templates — enforced in UI (already partly done) + tightened RLS.

**New tables (all with GRANTs + RLS)**
- `onboarding_checklist_templates` — ordered default items (admin-editable).
- `agent_onboarding` — one row per agent in onboarding (status, submitted_for_approval_at, approved_at, approved_by).
- `agent_onboarding_checklist` — per-agent item state (item_key, order, done, done_by, done_at, auto).
- `agent_references` — agent_id, name, email, institution, role, request_sent_at, sent_via ('system'|'external'), done, submission_id.
- `agent_documents` — agent_id, category (`british_council` | `company_registration` | `supporting` | `renewal_*`), title, file_path, uploaded_at, uploaded_by, renewal_of (nullable).
- `document_permissions` — agent_id, user_id, granted_by, granted_at.
- `emails_log` — id, to_email, from_email, reply_to, template, subject, related_agent_id, sent_by, sent_at, status.
- `form_templates.form_type` — enum extended: `agent_signup`, `reference_request`, `agent_branch`, plus existing `other`.
- `form_templates.parts` (jsonb) — array of `{ id, title, field_ids[] }` for wizard grouping.
- `form_instances` — add `token` (unguessable), `form_type`, `related_agent_id`, `related_reference_id`.
- `agents.status` — extend to include `onboarding` | `pending_approval` | `active`.

**Storage**
- New private bucket `agent-documents`. RLS on `storage.objects`: admin full access; other users only if `document_permissions` row exists; anon INSERT allowed via signed upload URL flow triggered by public form (server function issues signed upload URLs after validating form token).

## Phase 2 — Form builder (admin only)

- Forms page: gate "New template" strictly to admin (already is via `can_manage_templates`; tighten so only admin — not delegated capability — can create `agent_signup` / `reference_request` / `agent_branch` types).
- Extend template editor to support **parts** (named sections). Fields belong to a part. Add field types: `email`, `date`, `file` (single/multi), `repeatable_group` (nested fields with min/max), `dropdown` (already exists as `select`).
- **Agent Signup Form** creation flow: when admin picks type `agent_signup`, the builder auto-injects locked (non-removable) sections:
  1. Agent record fields — mirrored from `agents` columns (name, website, HQ country, countries of operation, contact person, phone, email, notes, etc.). Admin can reorder into parts but not delete.
  2. Number of branches (numeric, required).
  3. References (repeatable group, default min 2, admin can change min).
  4. British Council certificates (file, multi, min 1).
  5. Company registration docs (file, multi, min 1).
  6. Supporting documents (repeatable group: title + file, min 0).
- **Word upload path**: `POST /api/... ` server fn that accepts a `.docx`, uses `mammoth` to extract text + `docx` unzip for structured runs; heuristic parser detects lines ending with `:` / underscored blanks / tables → returns candidate fields. Admin reviews each candidate in a table (label, type dropdown, required toggle, part assignment, keep/discard) before saving. Locked sections above are still auto-appended.
- Reference Request Form: separate template type. Short: default fields are agent name (prefilled), referee comments, rating, would-recommend, plus admin-editable extras.

## Phase 3 — Public form pages (tokenized)

- New route `src/routes/f.token.$token.tsx` — resolves `form_instances` by token via a public server route (`/api/public/form-by-token/:token`) using service-role client, returns template + parts + prefilled data.
- Wizard UI: one part per step, progress bar, Back/Next, per-step Zod validation, autosave draft in localStorage.
- File uploads: server fn issues signed upload URLs bound to token; client uploads directly to `agent-documents/{agent_id}/{category}/...`.
- On submit: writes agent record fields to draft `agents` row, creates `agent_references` rows, creates `agent_documents` rows, auto-ticks nothing yet (references item still needs "Send request" per referee).
- Reference form submit: creates `form_submissions` row linked to `agent_references.submission_id`, creates in-app notification for requesting user, sends email via mock service.
- Style: sand-cream background, navy headers, matching existing public form styling.

## Phase 4 — Onboarding page

- New sidebar item **Onboarding** → `src/routes/_authenticated.onboarding.tsx`.
- Split panel: left = list of `agent_onboarding` rows (name, days in onboarding, `X/Y checks done`), right = selected agent's checklist detail.
- **Start onboarding** dialog: creates a draft `agents` row (name + contact email only), `agent_onboarding` row, seeds `agent_onboarding_checklist` from template.
- Admin-only edit mode on the right panel to reorder/add/remove template items (writes to `onboarding_checklist_templates`, does not retro-alter existing agents' checklists).

## Phase 5 — Checklist behaviour

Items (seeded):
1. **Agent application form sent** — actions: `Copy link` (manual tick after) + `Send via Orbis` (auto-tick, uses system email `{local_part}@{sender_subdomain}`, reply-to = user's real auth email).
2. **Reference requests sent** — expands to sub-rows once signup form submitted; each sub-row: `name · email(mailto) · institution · role · [Send request] · ✓`. Auto-ticks parent when all children done.
3. **References received and reviewed** — manual, but auto-hints when all `agent_references.submission_id` filled.
4. **British Council certificate received** — manual (hint: doc count > 0).
5. **Company registration and necessary documents received** — manual (hint: doc count > 0).
6. **Supporting documents received** — manual.

When all ticked → "All checks done" banner + **Submit for approval** button.

## Phase 6 — Approval

- Submitting notifies all `line_manager` users + admin (in-app + mock email).
- Approver page shows agent summary + docs + Approve / Send back (with comment).
- On approval: emails agent the **Agent Branch Form** tokenized link with instructions; appends 2 new checklist items:
  - **Received all branch information** (auto-ticks when branch form submissions count ≥ declared `number_of_branches`; manual override).
  - **Agreement signed** — manual.
- On "Agreement signed" tick: agent.status = `active`, map signup form data into `agents` columns, create `agent_branches` rows from each branch form submission, remove from onboarding list.

## Phase 7 — Documents & permissions

- Add **Documents** section to agent detail page, grouped by category, with signed-URL download links.
- Admin sees permissions sub-panel: search user + Grant view; list current grantees with Revoke.
- RLS on `agent_documents`: admin full; other users SELECT only if `has_role(admin)` OR row in `document_permissions`.
- Add **Renew contract** button on agent record: opens a mini-wizard requiring re-upload of all 3 mandatory categories; on submit, files stored with `renewal_of` set to previous renewal cycle and tagged with renewal date. Old files remain visible.

## Phase 8 — Email logging & mock service

- Wrap existing email send helper to also insert into `emails_log`.
- All onboarding emails go through it. Existing email infra reused (no new provider).

## Technical notes (skip if not needed)

- **Field ordering / mirror of `agents` columns**: read column list from `information_schema` at builder load and reconcile with a hand-curated whitelist so we don't accidentally expose internal columns.
- **Token generation**: `crypto.randomUUID()` + 24-char base32 suffix stored on `form_instances.token`; lookups via new indexed column.
- **Docx parsing**: `mammoth` for text, simple regex heuristics for `Label:` / `Label ______`. Kept intentionally best-effort; admin review screen is the source of truth.
- **RLS**: every new public table gets policies; `agent_documents` and `document_permissions` are the sensitive ones and get admin-only default plus permission-based SELECT.

## Deliverable order

I'll build Phase 1 first (migration + storage bucket + minor type extensions), verify types regenerate cleanly, then Phases 2–8 in that order. Each phase ends with a working checkpoint you can test before I move on.

Approve to start Phase 1, or tell me what to change.
