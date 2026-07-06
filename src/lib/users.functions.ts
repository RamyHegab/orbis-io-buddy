import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "user";
type DbRole = "admin" | "manager" | "member";

const CAPS = [
  "can_manage_agents",
  "can_manage_schools",
  "can_view_all_trips",
  "can_manage_templates",
  "can_manage_users",
] as const;
type Capability = (typeof CAPS)[number];
type CapMap = Partial<Record<Capability, boolean>>;

async function getIsAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  return !!data;
}

async function getInviterCaps(ctx: {
  supabase: any;
  userId: string;
}): Promise<Record<Capability, boolean>> {
  const isAdmin = await getIsAdmin(ctx);
  if (isAdmin) {
    return {
      can_manage_agents: true,
      can_manage_schools: true,
      can_view_all_trips: true,
      can_manage_templates: true,
      can_manage_users: true,
    };
  }
  const { data } = await ctx.supabase
    .from("profiles")
    .select(CAPS.join(","))
    .eq("id", ctx.userId)
    .maybeSingle();
  const out = {} as Record<Capability, boolean>;
  for (const c of CAPS) out[c] = !!(data as any)?.[c];
  return out;
}

async function assertCanManageUsers(ctx: { supabase: any; userId: string }) {
  const caps = await getInviterCaps(ctx);
  if (!caps.can_manage_users) throw new Error("Forbidden: user management not allowed");
  return caps;
}

// Ensure invited user's caps do not exceed inviter's caps; admins can only be created by admins.
function clampCaps(
  requested: CapMap,
  inviter: Record<Capability, boolean>,
): Record<Capability, boolean> {
  const out = {} as Record<Capability, boolean>;
  for (const c of CAPS) out[c] = !!requested[c] && !!inviter[c];
  return out;
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, email, line_manager_id, status, created_at, " + CAPS.join(","),
      )
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

    const rolesById = new Map<string, DbRole[]>();
    for (const r of roles ?? []) {
      const arr = rolesById.get(r.user_id) ?? [];
      arr.push(r.role as DbRole);
      rolesById.set(r.user_id, arr);
    }

    return (profiles ?? []).map((p: any) => {
      const userRoles = rolesById.get(p.id) ?? [];
      const role: Role = userRoles.includes("admin") ? "admin" : "user";
      return {
        id: p.id as string,
        full_name: p.full_name as string | null,
        email: p.email as string | null,
        line_manager_id: p.line_manager_id as string | null,
        status: p.status as string,
        role,
        can_manage_agents: !!p.can_manage_agents,
        can_manage_schools: !!p.can_manage_schools,
        can_view_all_trips: !!p.can_view_all_trips,
        can_manage_templates: !!p.can_manage_templates,
        can_manage_users: !!p.can_manage_users,
        last_sign_in_at: lastSignInById.get(p.id) ?? null,
      };
    });
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      email: string;
      fullName?: string;
      role: Role;
      lineManagerId?: string | null;
      capabilities?: CapMap;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const inviterCaps = await assertCanManageUsers(context);
    const inviterIsAdmin = await getIsAdmin(context);
    if (data.role === "admin" && !inviterIsAdmin) {
      throw new Error("Only admins can invite admins");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    if (!email) throw new Error("Email required");

    const caps =
      data.role === "admin"
        ? ({
            can_manage_agents: true,
            can_manage_schools: true,
            can_view_all_trips: true,
            can_manage_templates: true,
            can_manage_users: true,
          } as Record<Capability, boolean>)
        : clampCaps(data.capabilities ?? {}, inviterCaps);

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

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: data.fullName ?? null,
        line_manager_id: data.lineManagerId ?? null,
        status: "invited",
        ...caps,
      } as any,
      { onConflict: "id" },
    );

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const dbRole: DbRole = data.role === "admin" ? "admin" : "member";
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: dbRole });
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
      capabilities?: CapMap;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const inviterCaps = await assertCanManageUsers(context);
    const inviterIsAdmin = await getIsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {};
    if (data.lineManagerId !== undefined) patch.line_manager_id = data.lineManagerId;
    if (data.status) patch.status = data.status;
    if (data.fullName !== undefined) patch.full_name = data.fullName;

    if (data.capabilities) {
      const clamped = clampCaps(data.capabilities, inviterCaps);
      for (const c of CAPS) patch[c] = clamped[c];
    }

    if (data.role === "admin" && !inviterIsAdmin) {
      throw new Error("Only admins can promote users to admin");
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(patch as any)
        .eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    if (data.role) {
      const dbRole: DbRole = data.role === "admin" ? "admin" : "member";
      if (dbRole !== "admin") {
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
        .insert({ user_id: data.userId, role: dbRole });
      if (roleErr) throw new Error(roleErr.message);

      // When promoting to admin, grant all caps on the profile too.
      if (dbRole === "admin") {
        await supabaseAdmin
          .from("profiles")
          .update({
            can_manage_agents: true,
            can_manage_schools: true,
            can_view_all_trips: true,
            can_manage_templates: true,
            can_manage_users: true,
          } as any)
          .eq("id", data.userId);
      }
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
    await assertCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const redirectTo =
      (process.env.SITE_URL ?? "https://orbis-io-buddy.lovable.app") + "/reset-password";
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
