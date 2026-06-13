import { createServerFn } from "@tanstack/react-start";

export const DEMO_EMAIL = "demo@orbis.app";
const DEMO_PASSWORD = "demo-orbis-2026!";

/**
 * Public server fn. Ensures the demo user exists (idempotent) and returns
 * the demo credentials so the client can sign in as that user.
 * The credentials are constants; safe to return.
 */
export const ensureDemoUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Try to find existing demo user by listing (fast on small projects).
  // Use the auth admin API.
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(listErr.message);

  const existing = list.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);

  if (!existing) {
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Demo User" },
    });
    if (createErr) throw new Error(createErr.message);
  } else {
    // Make sure the password is in sync with our constant (in case it drifted).
    await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
  }

  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
});
