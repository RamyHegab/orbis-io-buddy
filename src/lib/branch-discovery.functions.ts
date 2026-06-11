import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BranchSchema = z.object({
  branch_name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  contact_first_name: z.string().nullable().optional(),
  contact_last_name: z.string().nullable().optional(),
  contact_position: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
const BranchesSchema = z.object({ branches: z.array(BranchSchema) });

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: admin only");
}

async function geocode(query: string): Promise<{ place_id?: string; lat?: number; lng?: number; formatted_address?: string } | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !gmKey || !query?.trim()) return null;
  try {
    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmKey },
    });
    const data: any = await res.json();
    const hit = data?.results?.[0];
    if (!hit) return null;
    return {
      place_id: hit.place_id,
      lat: hit.geometry?.location?.lat,
      lng: hit.geometry?.location?.lng,
      formatted_address: hit.formatted_address,
    };
  } catch {
    return null;
  }
}

async function enrichBranch(b: any, agentName: string) {
  const locStr = [b.city, b.country].filter(Boolean).join(", ");
  const query = b.address
    ? `${b.address}${locStr ? ", " + locStr : ""}`
    : `${agentName} ${[b.branch_name, locStr].filter(Boolean).join(" ")}`.trim();
  const geo = await geocode(query);
  if (!geo) return b;
  return {
    ...b,
    place_id: b.place_id ?? geo.place_id,
    lat: b.lat ?? geo.lat,
    lng: b.lng ?? geo.lng,
    formatted_address: b.formatted_address ?? geo.formatted_address,
    address: b.address ?? geo.formatted_address,
  };
}

async function aiExtract(markdown: string, agentName: string, sourceUrl: string) {
  const { generateObject } = await import("ai");
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const gateway = createLovableAiGatewayProvider(apiKey);

  const truncated = markdown.length > 18000 ? markdown.slice(0, 18000) : markdown;
  const { object } = await generateObject({
    model: gateway("google/gemini-3-flash-preview"),
    schema: BranchesSchema,
    prompt: `You are extracting branch/office locations for the education agency "${agentName}" from the following page content (source: ${sourceUrl}).

Return { "branches": [...] }. Each branch must be a real, distinct office of THIS agency (not partners, not schools, not destinations they send students to). If unsure, omit it.

For each branch include any of: branch_name (e.g. "Lahore Office"), city, country, address (full street), contact_first_name, contact_last_name, contact_position, contact_email, contact_phone, and a confidence 0-1 reflecting certainty this is a real branch of "${agentName}".

If no clear branch info, return an empty array.

PAGE CONTENT:
${truncated}`,
  });
  return object.branches ?? [];
}

async function discoverForAgent(agent: { id: string; trading_name: string; website: string | null; hq_country: string | null }) {
  const { fcMap, fcScrape, fcSearch } = await import("@/lib/firecrawl.server");
  const results: Array<{ branch: any; sourceUrl: string }> = [];

  // 1. Site scrape via website
  if (agent.website) {
    try {
      const site = agent.website.startsWith("http") ? agent.website : `https://${agent.website}`;
      const map = await fcMap(site, { search: "office branch contact location", limit: 8 }).catch(() => null);
      const candidates: string[] = (map?.links ?? map?.data?.links ?? [])
        .filter((u: string) => /office|branch|contact|location|where/i.test(u))
        .slice(0, 3);
      if (candidates.length === 0) candidates.push(site);
      for (const url of candidates) {
        const scrape = await fcScrape(url).catch(() => null);
        const md = scrape?.data?.markdown ?? scrape?.markdown;
        if (!md) continue;
        const branches = await aiExtract(md, agent.trading_name, url).catch(() => []);
        for (const b of branches) results.push({ branch: b, sourceUrl: url });
        if (results.length > 0) break;
      }
    } catch {}
  }

  // 2. Web search fallback
  if (results.length === 0) {
    try {
      const q = `"${agent.trading_name}" ${agent.hq_country ?? ""} branch office contact`;
      const search = await fcSearch(q, { limit: 3, scrape: true });
      const items: any[] = search?.data?.web ?? search?.web ?? search?.data ?? [];
      for (const item of items) {
        const md = item?.markdown ?? item?.content;
        const url = item?.url ?? item?.link;
        if (!md || !url) continue;
        const branches = await aiExtract(md, agent.trading_name, url).catch(() => []);
        for (const b of branches) results.push({ branch: b, sourceUrl: url });
        if (results.length > 0) break;
      }
    } catch {}
  }

  // Enrich with Google Maps geocoding (address + location)
  for (const r of results) {
    r.branch = await enrichBranch(r.branch, agent.trading_name);
  }

  return results;
}

export const discoverBranchesForAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { agentId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const ctx = context as any;
    const { data: agent, error } = await ctx.supabase
      .from("agents")
      .select("id, trading_name, website, hq_country")
      .eq("id", data.agentId)
      .maybeSingle();
    if (error || !agent) throw new Error("Agent not found");

    const { data: job } = await ctx.supabase
      .from("discovery_jobs")
      .insert({ user_id: ctx.userId, agent_id: agent.id, status: "running", total_count: 1 })
      .select()
      .single();

    try {
      const found = await discoverForAgent(agent);
      if (found.length > 0) {
        const rows = found.map((f) => ({
          type: "agent_branch",
          agent_id: agent.id,
          payload: f.branch,
          status: "pending",
          source: "auto_discovery",
          source_url: f.sourceUrl,
          submitter_name: `Auto-discovery (${agent.trading_name})`,
        }));
        await ctx.supabase.from("pending_submissions").insert(rows);
      }
      await ctx.supabase
        .from("discovery_jobs")
        .update({ status: "done", found_count: found.length, processed_count: 1 })
        .eq("id", job.id);
      return { found: found.length, jobId: job.id };
    } catch (e: any) {
      await ctx.supabase
        .from("discovery_jobs")
        .update({ status: "failed", error: String(e?.message ?? e), processed_count: 1 })
        .eq("id", job.id);
      throw e;
    }
  });

export const discoverBranchesForAllAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const ctx = context as any;
    const { data: agents } = await ctx.supabase
      .from("agents")
      .select("id, trading_name, website, hq_country")
      .order("created_at", { ascending: true })
      .limit(50);

    const list = agents ?? [];
    const { data: job } = await ctx.supabase
      .from("discovery_jobs")
      .insert({ user_id: ctx.userId, status: "running", total_count: list.length, kind: "agent_branches_bulk" })
      .select()
      .single();

    let totalFound = 0;
    let processed = 0;
    for (const agent of list) {
      try {
        const found = await discoverForAgent(agent);
        if (found.length > 0) {
          const rows = found.map((f) => ({
            type: "agent_branch",
            agent_id: agent.id,
            payload: f.branch,
            status: "pending",
            source: "auto_discovery",
            source_url: f.sourceUrl,
            submitter_name: `Auto-discovery (${agent.trading_name})`,
          }));
          await ctx.supabase.from("pending_submissions").insert(rows);
          totalFound += found.length;
        }
      } catch (e) {
        console.error("discovery failed for", agent.trading_name, e);
      }
      processed++;
      await ctx.supabase
        .from("discovery_jobs")
        .update({ found_count: totalFound, processed_count: processed })
        .eq("id", job.id);
    }

    await ctx.supabase.from("discovery_jobs").update({ status: "done" }).eq("id", job.id);
    return { found: totalFound, processed, jobId: job.id };
  });
