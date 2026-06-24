
# Onboarding Guide: Admins and Users

No code changes are needed — the system is already built. Here's how to use it.

## 1. The first admin (you)

The very first person to sign up automatically becomes an **Admin**. This is handled by the `handle_new_user` trigger: if no roles exist yet in the database, the new account is granted the `admin` role. Everyone else who signs up later defaults to `member`.

So: open the app, sign up with your email/password (or Google), and you're the admin.

## 2. Inviting other admins or managers

Once signed in as an admin, you'll see a **Users** link in the sidebar (only visible to admins).

On the Users page:
1. Click **Invite user**.
2. Enter their **email**, **full name**, and pick a **role**:
   - **Admin** — full access; can manage users and templates.
   - **Manager** — can see and approve trips/forms for their direct reports.
   - **Member** — can only see their own trips and forms.
3. Optionally pick a **Line manager** from the dropdown (the manager who approves their itineraries).
4. Send the invite.

The invitee receives a branded email from `notify.orbishub.co.uk` with a secure link to set their password and sign in. On first sign-in, their profile flips from `invited` → `active`.

## 3. Inviting end users (members)

Same flow as above — use the Users page, pick **Member** as the role, and assign their line manager. Members will:
- See only their own trips, activities, forms, and reports.
- Have their submitted itineraries routed to their assigned line manager for approval.

## 4. Editing or disabling users

From the Users page, open any row to:
- Change their **role** (e.g. promote a member to manager).
- Reassign their **line manager**.
- **Disable** the account (revokes access without deleting data) or re-enable it.

## 5. Recommended rollout

1. You sign up first → become admin automatically.
2. Invite your **managers** first, with no line manager (or another admin) assigned.
3. Then invite **members** and assign each one to their manager.
4. Members submit itineraries → their manager gets an approval email → they approve from the Approvals page.

## Notes

- There is no public signup form — the only way in is via an admin invite (or being the first user). This is intentional based on the earlier decision.
- Invitation emails use the existing Lovable Email infrastructure on `notify.orbishub.co.uk`. If DNS is still propagating, invites queue and send once the domain is verified.
- If you ever lose access to the admin account, a new admin can be granted directly in the database by inserting into `user_roles`, but this should only be done as a recovery measure.
