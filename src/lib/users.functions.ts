import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "manager" | "member";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, line_manager_id, status, created_at")
      .order("created_at", { ascending: true });
    if (pErr) throw new Error(pErr.message);

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const lastSignInById = new Map<string, string | null>();
    for (const u of authUsers?.users ?? []) {
      lastSignInById.set(u.id, u.last_sign_in_at ?? null);
    }

    const rolesById = new Map<string, Role[]>();
    for (const r of roles ?? []) {
      const arr = rolesById.get(r.user_id) ?? [];
      arr.push(r.role as Role);
      rolesById.set(r.user_id, arr);
    }

    return (profiles ?? []).map((p) => {
      const userRoles = rolesById.get(p.id) ?? [];
      const role: Role = userRoles.includes("admin")
        ? "admin"
        : userRoles.includes("manager")
          ? "manager"
          : "member";
      return {
        id: p.id,
        full_name: p.full_name as string | null,
        email: p.email as string | null,
        line_manager_id: p.line_manager_id as string | null,
        status: p.status as string,
        role,
        last_sign_in_at: lastSignInById.get(p.id) ?? null,
      };
    });
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { email: string; fullName?: string; role: Role; lineManagerId?: string | null }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    if (!email) throw new Error("Email required");

    const redirectTo =
      (process.env.SITE_URL ?? "https://orbis-io-buddy.lovable.app") + "/reset-password";

    const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: data.fullName ?? null },
        redirectTo,
      },
    );
    if (invErr) throw new Error(invErr.message);
    const userId = invited.user?.id;
    if (!userId) throw new Error("Invite failed: no user id returned");

    // Upsert profile with invited state + line manager
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: data.fullName ?? null,
        line_manager_id: data.lineManagerId ?? null,
        status: "invited",
      },
      { onConflict: "id" },
    );

    // Replace role row
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true, userId };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      userId: string;
      role?: Role;
      lineManagerId?: string | null;
      status?: "active" | "disabled";
      fullName?: string;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {};
    if (data.lineManagerId !== undefined) patch.line_manager_id = data.lineManagerId;
    if (data.status) patch.status = data.status;
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    if (data.role) {
      // Last-admin guard
      if (data.role !== "admin") {
        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "admin");
        const { data: isCurrentlyAdmin } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("user_id", data.userId)
          .eq("role", "admin")
          .maybeSingle();
        if (isCurrentlyAdmin && (count ?? 0) <= 1) {
          throw new Error("Cannot remove the last admin");
        }
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (roleErr) throw new Error(roleErr.message);
    }

    if (data.status === "disabled") {
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "876000h" });
    } else if (data.status === "active") {
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
    }

    return { ok: true };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const redirectTo =
      (process.env.SITE_URL ?? "https://orbis-io-buddy.lovable.app") + "/reset-password";
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
