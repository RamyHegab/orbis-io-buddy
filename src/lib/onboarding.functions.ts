import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Only admins can manage onboarding");
}

// Start onboarding for a new agent. Creates a draft agents row + agent_onboarding row +
// seeds the pre-approval checklist + generates an Agent Signup form_instance with a share token.
export const startOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tradingName: string; contactEmail: string }) => {
    const name = i.tradingName?.trim();
    const email = i.contactEmail?.trim().toLowerCase();
    if (!name) throw new Error("Agent name required");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email required");
    return { tradingName: name, contactEmail: email };
  })
  .handler(async ({ data, context }) => {
    // Any authenticated user may start a new agent onboarding. Admin-only actions
    // (list, detail, checklist toggle) remain gated below.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: agent, error: agentErr } = await supabaseAdmin
      .from("agents")
      .insert({
        trading_name: data.tradingName,
        main_contact_email: data.contactEmail,
        status: "onboarding" as const,
        user_id: userId,
      })
      .select("id")
      .single();
    if (agentErr) throw new Error(agentErr.message);

    const { data: onboarding, error: onbErr } = await supabaseAdmin
      .from("agent_onboarding")
      .insert({
        agent_id: agent.id,
        contact_email: data.contactEmail,
        started_by: userId,
        status: "in_progress",
      })
      .select("id")
      .single();
    if (onbErr) throw new Error(onbErr.message);

    // Seed the pre-approval checklist from templates
    const { data: templates } = await supabaseAdmin
      .from("onboarding_checklist_templates")
      .select("item_key, label, order_index, phase, auto_tick_rule")
      .eq("phase", "pre_approval")
      .order("order_index");

    if (templates && templates.length > 0) {
      await supabaseAdmin.from("agent_onboarding_checklist").insert(
        templates.map((t) => ({
          onboarding_id: onboarding.id,
          item_key: t.item_key,
          label: t.label,
          order_index: t.order_index,
          phase: t.phase,
          auto: !!t.auto_tick_rule,
        })),
      );
    }

    // Create a form_instance pointing at the active Agent Signup template (if configured)
    const { data: template } = await supabaseAdmin
      .from("form_templates")
      .select("id, name")
      .eq("form_type", "agent_signup")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let shareToken: string | null = null;
    if (template) {
      const { data: instance, error: fiErr } = await supabaseAdmin
        .from("form_instances")
        .insert({
          name: `${data.tradingName} — Agent signup`,
          template_id: template.id,
          form_type: "agent_signup" as const,
          related_agent_id: agent.id,
          created_by: userId,
          activity_id: null,
        } as any)
        .select("token")
        .single();
      if (fiErr) throw new Error(fiErr.message);
      shareToken = instance.token;
    }

    return { agentId: agent.id, onboardingId: onboarding.id, shareToken };
  });

export const listOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("agent_onboarding")
      .select(
        `id, status, contact_email, submitted_for_approval_at, approved_at, created_at, declared_branches,
         agent:agents!agent_onboarding_agent_id_fkey ( id, trading_name, hq_country, status ),
         checklist:agent_onboarding_checklist ( id, done )`,
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => {
      const total = r.checklist?.length ?? 0;
      const done = (r.checklist ?? []).filter((c: any) => c.done).length;
      return {
        id: r.id as string,
        agent_id: r.agent?.id as string,
        trading_name: (r.agent?.trading_name as string) ?? "(unnamed)",
        hq_country: r.agent?.hq_country as string | null,
        agent_status: r.agent?.status as string,
        status: r.status as string,
        contact_email: r.contact_email as string,
        submitted_at: r.submitted_for_approval_at as string | null,
        approved_at: r.approved_at as string | null,
        created_at: r.created_at as string,
        declared_branches: r.declared_branches as number | null,
        done,
        total,
      };
    });
  });

export const getOnboardingDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { onboardingId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: onboarding }, { data: checklist }, { data: references }, { data: docs }] =
      await Promise.all([
        supabaseAdmin
          .from("agent_onboarding")
          .select(
            `id, status, contact_email, submitted_for_approval_at, approved_at, declared_branches,
             agent:agents!agent_onboarding_agent_id_fkey ( id, trading_name, hq_country, website, main_contact_name, main_contact_email, main_contact_phone, countries_of_operation, status )`,
          )
          .eq("id", data.onboardingId)
          .maybeSingle(),
        supabaseAdmin
          .from("agent_onboarding_checklist")
          .select("*")
          .eq("onboarding_id", data.onboardingId)
          .order("order_index"),
        supabaseAdmin
          .from("agent_references")
          .select("*")
          .in(
            "agent_id",
            [(await supabaseAdmin
              .from("agent_onboarding")
              .select("agent_id")
              .eq("id", data.onboardingId)
              .maybeSingle()).data?.agent_id ?? "00000000-0000-0000-0000-000000000000"],
          )
          .order("created_at"),
        supabaseAdmin
          .from("agent_documents")
          .select("*")
          .in(
            "agent_id",
            [(await supabaseAdmin
              .from("agent_onboarding")
              .select("agent_id")
              .eq("id", data.onboardingId)
              .maybeSingle()).data?.agent_id ?? "00000000-0000-0000-0000-000000000000"],
          )
          .order("uploaded_at"),
      ]);

    if (!onboarding) throw new Error("Onboarding not found");

    // Look up the share token for this agent's Agent Signup form_instance
    const agentId = (onboarding as any).agent?.id as string;
    const { data: instance } = await supabaseAdmin
      .from("form_instances")
      .select("token")
      .eq("related_agent_id", agentId)
      .eq("form_type", "agent_signup")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      onboarding,
      checklist: checklist ?? [],
      references: references ?? [],
      documents: docs ?? [],
      shareToken: instance?.token ?? null,
    };
  });

export const toggleChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { itemId: string; done: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("agent_onboarding_checklist")
      .update({
        done: data.done,
        done_by: data.done ? context.userId : null,
        done_at: data.done ? new Date().toISOString() : null,
      })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function siteOrigin(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getRequest } = require("@tanstack/react-start/server");
    const req = getRequest();
    if (req?.url) return new URL(req.url).origin;
  } catch {}
  return process.env.SITE_URL ?? "https://orbishub.co.uk";
}

async function sendSystemEmail(opts: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData: Record<string, any>;
  senderUserId?: string | null;
}) {
  const origin = siteOrigin();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  let from: string | undefined;
  let replyTo: string | undefined;
  if (opts.senderUserId) {
    try {
      const { getSenderFor } = await import("./system-email.server");
      const s = await getSenderFor(opts.senderUserId);
      from = s.from;
      replyTo = s.replyTo;
    } catch (e) {
      console.error("sender resolution failed", e);
    }
  }
  const res = await fetch(`${origin}/lovable/email/transactional/send`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ ...opts, from, replyTo }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Email send failed: ${res.status} ${text}`);
  }
}

// Send the Agent Signup form link to the agent's main contact.
export const sendSignupInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { onboardingId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: onb } = await supabaseAdmin
      .from("agent_onboarding")
      .select("id, contact_email, agent:agents!agent_onboarding_agent_id_fkey(id, trading_name)")
      .eq("id", data.onboardingId)
      .maybeSingle();
    if (!onb) throw new Error("Onboarding not found");

    const agentId = (onb as any).agent?.id;
    const { data: instance } = await supabaseAdmin
      .from("form_instances")
      .select("token")
      .eq("related_agent_id", agentId)
      .eq("form_type", "agent_signup")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!instance?.token) throw new Error("No signup form configured — activate an Agent Signup form template first.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const formUrl = `${siteOrigin()}/f/t/${instance.token}`;
    await sendSystemEmail({
      templateName: "agent-signup-invite",
      recipientEmail: onb.contact_email,
      idempotencyKey: `signup-invite:${onb.id}:${Date.now()}`,
      senderUserId: context.userId,
      templateData: {
        agentName: (onb as any).agent?.trading_name ?? "",
        senderName: (profile as any)?.full_name ?? "",
        formUrl,
      },
    });

    await supabaseAdmin
      .from("agent_onboarding_checklist")
      .update({ done: true, done_by: context.userId, done_at: new Date().toISOString() })
      .eq("onboarding_id", data.onboardingId)
      .eq("item_key", "signup_form_sent")
      .eq("done", false);

    return { ok: true };
  });

// Send a reference request email to one referee.
export const sendReferenceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { referenceId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ref } = await supabaseAdmin
      .from("agent_references")
      .select("id, name, email, agent_id, agents:agent_id(trading_name)")
      .eq("id", data.referenceId)
      .maybeSingle();
    if (!ref) throw new Error("Reference not found");

    // Optional: create a reference_request form_instance if a template exists.
    let formUrl: string | null = null;
    const { data: tmpl } = await supabaseAdmin
      .from("form_templates")
      .select("id")
      .eq("form_type", "reference_request")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tmpl) {
      const { data: instance } = await supabaseAdmin
        .from("form_instances")
        .insert({
          name: `${(ref as any).agents?.trading_name ?? "Agent"} — reference from ${ref.name ?? ref.email}`,
          template_id: tmpl.id,
          form_type: "reference_request" as const,
          related_agent_id: ref.agent_id,
          related_reference_id: ref.id,
          created_by: context.userId,
          activity_id: null,
        } as any)
        .select("token")
        .single();
      if (instance?.token) formUrl = `${siteOrigin()}/f/t/${instance.token}`;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    await sendSystemEmail({
      templateName: "reference-request",
      recipientEmail: ref.email,
      idempotencyKey: `ref-request:${ref.id}:${Date.now()}`,
      senderUserId: context.userId,
      templateData: {
        refereeName: ref.name ?? "",
        agentName: (ref as any).agents?.trading_name ?? "",
        senderName: (profile as any)?.full_name ?? "",
        formUrl,
      },
    });

    await supabaseAdmin
      .from("agent_references")
      .update({ request_sent_at: new Date().toISOString(), sent_via: "email" })
      .eq("id", ref.id);

    return { ok: true };
  });

// Signed URLs for the attachments on an agent.
export const getAgentAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { agentId: string }) => i)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: docs } = await supabaseAdmin
      .from("agent_documents")
      .select("id, category, title, file_path, file_name, content_type, size_bytes, uploaded_at")
      .eq("agent_id", data.agentId)
      .order("uploaded_at", { ascending: false });
    const list = docs ?? [];
    const withUrls = await Promise.all(
      list.map(async (d: any) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("agent-documents")
          .createSignedUrl(d.file_path, 60 * 60);
        return { ...d, url: signed?.signedUrl ?? null };
      }),
    );
    return withUrls;
  });

