import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deriveLocalPartFromName, isValidLocalPart, sanitizeLocalPart } from "@/lib/system-email";

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

function clampCaps(
  requested: CapMap,
  inviter: Record<Capability, boolean>,
): Record<Capability, boolean> {
  const out = {} as Record<Capability, boolean>;
  for (const c of CAPS) out[c] = !!requested[c] && !!inviter[c];
  return out;
}

// Returns [callerId, ...all descendants transitively]. Depth-capped.
async function getManagerTree(admin: any, callerId: string): Promise<string[]> {
  const collected = new Set<string>([callerId]);
  let frontier = [callerId];
  for (let depth = 0; depth < 20 && frontier.length; depth++) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .in("line_manager_id", frontier);
    const next: string[] = [];
    for (const row of data ?? []) {
      if (!collected.has(row.id)) {
        collected.add(row.id);
        next.push(row.id);
      }
    }
    frontier = next;
  }
  return Array.from(collected);
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, first_name, last_name, job_role, line_manager_id, frozen_at, email, status, created_at, email_local_part, " +
          CAPS.join(","),
      )
      .order("created_at", { ascending: true });
    if (pErr) throw new Error(pErr.message);

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    const { data: assignments } = await supabaseAdmin
      .from("user_agent_assignments")
      .select("user_id, agent_id");

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

    const agentsByUser = new Map<string, string[]>();
    for (const a of assignments ?? []) {
      const arr = agentsByUser.get(a.user_id) ?? [];
      arr.push(a.agent_id);
      agentsByUser.set(a.user_id, arr);
    }

    return (profiles ?? []).map((p: any) => {
      const userRoles = rolesById.get(p.id) ?? [];
      const role: Role = userRoles.includes("admin") ? "admin" : "user";
      return {
        id: p.id as string,
        full_name: p.full_name as string | null,
        first_name: p.first_name as string | null,
        last_name: p.last_name as string | null,
        job_role: p.job_role as string | null,
        line_manager_id: p.line_manager_id as string | null,
        frozen_at: p.frozen_at as string | null,
        email: p.email as string | null,
        status: p.status as string,
        role,
        email_local_part: (p.email_local_part as string | null) ?? null,
        assigned_agent_ids: agentsByUser.get(p.id) ?? [],
        can_manage_agents: !!p.can_manage_agents,
        can_manage_schools: !!p.can_manage_schools,
        can_view_all_trips: !!p.can_view_all_trips,
        can_manage_templates: !!p.can_manage_templates,
        can_manage_users: !!p.can_manage_users,
        last_sign_in_at: lastSignInById.get(p.id) ?? null,
      };
    });
  });

// Managers the caller can assign as line manager: caller + descendants (or all if admin)
export const listAssignableManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isAdmin = await getIsAdmin(context);
    let ids: string[] | null = null;
    if (!isAdmin) ids = await getManagerTree(supabaseAdmin, context.userId);
    let q = supabaseAdmin
      .from("profiles")
      .select("id, full_name, first_name, last_name, email, job_role")
      .neq("status", "disabled")
      .order("full_name", { ascending: true });
    if (ids) q = q.in("id", ids);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getRoleDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { jobRole: string }) => i)
  .handler(async ({ data, context }) => {
    await assertCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const jr = (data.jobRole || "").trim().toLowerCase();
    if (!jr) return null;
    const { data: row } = await supabaseAdmin
      .from("role_permission_defaults")
      .select(CAPS.join(","))
      .eq("job_role", jr)
      .maybeSingle();
    return row ?? null;
  });

async function saveRoleDefaults(
  admin: any,
  jobRole: string | null | undefined,
  caps: Record<Capability, boolean>,
  updatedBy: string,
) {
  const jr = (jobRole || "").trim().toLowerCase();
  if (!jr) return;
  await admin.from("role_permission_defaults").upsert(
    { job_role: jr, ...caps, updated_by: updatedBy, updated_at: new Date().toISOString() },
    { onConflict: "job_role" },
  );
}

async function replaceAgentAssignments(
  admin: any,
  userId: string,
  agentIds: string[],
  createdBy: string,
) {
  await admin.from("user_agent_assignments").delete().eq("user_id", userId);
  if (!agentIds.length) return;
  const rows = agentIds.map((id) => ({ user_id: userId, agent_id: id, created_by: createdBy }));
  await admin.from("user_agent_assignments").insert(rows);
}

async function assertLineManagerAllowed(
  admin: any,
  callerId: string,
  callerIsAdmin: boolean,
  lineManagerId: string | null | undefined,
) {
  if (!lineManagerId) return;
  if (callerIsAdmin) return;
  if (lineManagerId === callerId) return;
  const tree = await getManagerTree(admin, callerId);
  if (!tree.includes(lineManagerId)) {
    throw new Error("Line manager must be you or someone reporting under you");
  }
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      email: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
      jobRole?: string;
      role: Role;
      capabilities?: CapMap;
      emailLocalPart?: string | null;
      lineManagerId?: string | null;
      assignedAgentIds?: string[];
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

    const fullName =
      (data.fullName && data.fullName.trim()) ||
      [data.firstName, data.lastName].filter(Boolean).join(" ").trim() ||
      null;

    // Default line manager to the caller
    const lineManagerId = data.lineManagerId ?? context.userId;
    await assertLineManagerAllowed(supabaseAdmin, context.userId, inviterIsAdmin, lineManagerId);

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
        data: { full_name: fullName },
        redirectTo,
      },
    );
    if (invErr) throw new Error(invErr.message);
    const userId = invited.user?.id;
    if (!userId) throw new Error("Invite failed: no user id returned");

    let localPart =
      data.emailLocalPart != null
        ? sanitizeLocalPart(data.emailLocalPart)
        : deriveLocalPartFromName(fullName, email);
    if (localPart && !isValidLocalPart(localPart)) localPart = "";

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        first_name: data.firstName ?? null,
        last_name: data.lastName ?? null,
        job_role: data.jobRole ? data.jobRole.trim() : null,
        line_manager_id: lineManagerId,
        status: "invited",
        email_local_part: localPart || null,
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

    await replaceAgentAssignments(
      supabaseAdmin,
      userId,
      data.assignedAgentIds ?? [],
      context.userId,
    );

    // Remember these caps as the default for this job role
    if (data.role !== "admin" && data.jobRole) {
      await saveRoleDefaults(supabaseAdmin, data.jobRole, caps, context.userId);
    }

    return { ok: true, userId };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      userId: string;
      role?: Role;
      status?: "active" | "disabled";
      fullName?: string;
      firstName?: string | null;
      lastName?: string | null;
      jobRole?: string | null;
      lineManagerId?: string | null;
      assignedAgentIds?: string[];
      capabilities?: CapMap;
      emailLocalPart?: string | null;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const inviterCaps = await assertCanManageUsers(context);
    const inviterIsAdmin = await getIsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {};
    if (data.status) {
      patch.status = data.status;
      patch.frozen_at = data.status === "disabled" ? new Date().toISOString() : null;
    }
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.firstName !== undefined) patch.first_name = data.firstName;
    if (data.lastName !== undefined) patch.last_name = data.lastName;
    if (data.jobRole !== undefined)
      patch.job_role = data.jobRole ? data.jobRole.trim() : null;
    if (data.lineManagerId !== undefined) {
      await assertLineManagerAllowed(
        supabaseAdmin,
        context.userId,
        inviterIsAdmin,
        data.lineManagerId,
      );
      if (data.lineManagerId === data.userId) {
        throw new Error("A user cannot be their own line manager");
      }
      patch.line_manager_id = data.lineManagerId;
    }
    if (data.emailLocalPart !== undefined) {
      const cleaned = data.emailLocalPart ? sanitizeLocalPart(data.emailLocalPart) : "";
      if (cleaned && !isValidLocalPart(cleaned)) {
        throw new Error("Invalid email local part. Use letters, numbers, . _ - only.");
      }
      patch.email_local_part = cleaned || null;
    }

    if (data.capabilities) {
      for (const c of CAPS) {
        if (!inviterCaps[c]) continue;
        patch[c] = !!data.capabilities[c];
      }
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

    if (data.assignedAgentIds !== undefined) {
      await replaceAgentAssignments(
        supabaseAdmin,
        data.userId,
        data.assignedAgentIds,
        context.userId,
      );
    }

    if (data.status === "disabled") {
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "876000h" });
    } else if (data.status === "active") {
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
    }

    // Persist role defaults when caps + jobRole are set together
    if (data.capabilities && data.jobRole && data.role !== "admin") {
      const clamped = clampCaps(data.capabilities, inviterCaps);
      await saveRoleDefaults(supabaseAdmin, data.jobRole, clamped, context.userId);
    }

    return { ok: true };
  });

export const freezeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.userId === context.userId) throw new Error("You cannot freeze your own account");

    // Prevent freezing the last admin
    const { data: isAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", data.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (isAdmin) {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("Cannot freeze the last admin");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: "disabled", frozen_at: new Date().toISOString() } as any)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "876000h" });
    return { ok: true };
  });

export const unfreezeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: "active", frozen_at: null } as any)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; confirmation: string }) => i)
  .handler(async ({ data, context }) => {
    const inviterIsAdmin = await getIsAdmin(context);
    if (!inviterIsAdmin) throw new Error("Only admins can delete users");
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .maybeSingle();
    if (!profile?.email) throw new Error("User not found");
    if ((data.confirmation || "").trim().toLowerCase() !== profile.email.trim().toLowerCase()) {
      throw new Error("Confirmation email does not match");
    }

    // Block if user has direct reports
    const { count: reports } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("line_manager_id", data.userId);
    if ((reports ?? 0) > 0) {
      throw new Error(
        "This user has direct reports. Reassign them to another line manager before deleting.",
      );
    }

    // Protect last admin
    const { data: isAdminRow } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", data.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (isAdminRow) {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("Cannot delete the last admin");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
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
