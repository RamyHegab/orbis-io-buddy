import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { formatMoney } from "@/lib/currency";

const InputSchema = z.object({ tripId: z.string().uuid() });

export const generateTripReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch trip + everything
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("*")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripErr) throw tripErr;
    if (!trip) throw new Error("Trip not found");

    const { data: activities } = await supabase
      .from("activities")
      .select("*, agents(trading_name, hq_country), schools(name, country, city)")
      .eq("trip_id", data.tripId)
      .order("day_date")
      .order("start_time");

    const { data: hotels } = await supabase
      .from("trip_hotels")
      .select("*")
      .eq("trip_id", data.tripId)
      .order("check_in_date");

    const activityIds = (activities ?? []).map((a) => a.id);
    const { data: comments } = activityIds.length
      ? await supabase.from("activity_comments").select("*").in("activity_id", activityIds)
      : { data: [] };
    const { data: submissions } = activityIds.length
      ? await supabase.from("form_submissions").select("*, form_templates(name)").in("activity_id", activityIds)
      : { data: [] };

    const commentsByAct: Record<string, any[]> = {};
    for (const c of comments ?? []) (commentsByAct[c.activity_id] = commentsByAct[c.activity_id] ?? []).push(c);
    const subsByAct: Record<string, any[]> = {};
    for (const s of submissions ?? []) (subsByAct[s.activity_id] = subsByAct[s.activity_id] ?? []).push(s);

    // Build context text
    let ctx = `# Trip: ${trip.title}\n`;
    ctx += `Dates: ${trip.start_date} to ${trip.end_date}\n`;
    ctx += `Destinations: ${(trip.destinations ?? []).join(", ") || "—"}\n`;
    if (trip.objectives) ctx += `\n## Trip Objectives\n${trip.objectives}\n`;
    if (trip.notes) ctx += `Notes: ${trip.notes}\n`;
    const totals: Record<string, Record<string, number>> = { travel: {}, hotel: {}, recruitment_event: {}, total: {} };
    for (const a of activities ?? []) {
      if (a.cost == null) continue;
      const cur = a.cost_currency || "GBP";
      const amt = Number(a.cost);
      totals.total[cur] = (totals.total[cur] ?? 0) + amt;
      if (totals[a.type]) totals[a.type][cur] = (totals[a.type][cur] ?? 0) + amt;
    }
    for (const h of hotels ?? []) {
      if (h.cost == null) continue;
      const cur = h.cost_currency || "GBP";
      const amt = Number(h.cost);
      totals.total[cur] = (totals.total[cur] ?? 0) + amt;
      totals.hotel[cur] = (totals.hotel[cur] ?? 0) + amt;
    }
    const fmtTotals = (m: Record<string, number>) =>
      Object.entries(m).map(([c, v]) => formatMoney(v, c)).join(", ") || "—";
    ctx += `\n## Cost Totals\n`;
    ctx += `- Travel: ${fmtTotals(totals.travel)}\n`;
    ctx += `- Hotels: ${fmtTotals(totals.hotel)}\n`;
    ctx += `- Events: ${fmtTotals(totals.recruitment_event)}\n`;
    ctx += `- Total: ${fmtTotals(totals.total)}\n`;

    ctx += `\n## Activities (${activities?.length ?? 0})\n`;
    for (const a of activities ?? []) {
      ctx += `\n### ${a.day_date}${a.start_time ? ` ${a.start_time.slice(0, 5)}` : ""} — ${a.title} [${a.type}]\n`;
      if (a.type === "travel") {
        const isAir = a.transport_mode === "Air travel";
        const from = isAir ? [a.from_country, a.from_city].filter(Boolean).join(" — ") : a.from_city;
        const to = isAir ? [a.to_country, a.to_city].filter(Boolean).join(" — ") : a.to_city;
        if (from) ctx += `From: ${from}\n`;
        if (to) ctx += `To: ${to}\n`;
        if (a.transport_mode) ctx += `Mode: ${a.transport_mode}\n`;
        if (a.airline) ctx += `Airline: ${a.airline}${a.flight_number ? ` ${a.flight_number}` : ""}\n`;
      }
      if (a.location) ctx += `Location: ${a.location}\n`;
      if (a.type === "agent_visit" && a.agents && a.agent_id) {
        ctx += `Agent card: [${a.agents.trading_name}](/agents/${a.agent_id}) _(requires login)_\n`;
      } else if (a.agents && a.agent_id) {
        ctx += `Agent: [${a.agents.trading_name}](/agents/${a.agent_id})\n`;
      }
      if (a.schools && a.school_id) ctx += `School: [${a.schools.name}](/schools) (${a.schools.city}, ${a.schools.country})\n`;
      if (a.notes) ctx += `Notes: ${a.notes}\n`;
      if (a.objectives) ctx += `Objectives: ${a.objectives}\n`;
      if (a.visit_notes) ctx += `Notes during visit: ${a.visit_notes}\n`;
      if (a.cost != null) ctx += `Cost: ${a.cost_currency || "GBP"} ${Number(a.cost).toFixed(2)}\n`;
      const cs = commentsByAct[a.id] ?? [];
      if (cs.length) {
        ctx += `Comments:\n`;
        for (const c of cs) ctx += `- ${c.body}\n`;
      }
      const ss = subsByAct[a.id] ?? [];
      if (ss.length) {
        ctx += `Form submissions:\n`;
        for (const s of ss) ctx += `- ${s.form_templates?.name}: ${JSON.stringify(s.data)}\n`;
      }
    }

    const model = "google/gemini-3-flash-preview";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are an executive assistant for a university international recruitment team. Write a polished, well-structured trip report in GitHub-flavoured Markdown. Use this exact section order:\n\n1. **Executive Summary** — reflect the Trip Objectives and assess how well they were met.\n2. **Trip Overview** — a markdown table with columns | Field | Detail | covering dates, destinations, total activities, and headline outcomes.\n3. **Cost Summary** — a markdown table with columns | Category | Amount | for Travel, Hotels, Events, Total ONLY. Never list individual hotels, nights or accommodation breakdowns.\n4. **Itinerary at a Glance** — a markdown table with columns | Date | Type | Title | Location |. For Travel rows, format Title as `From → To` using the country and city already provided. For Agent Visit rows, the Title MUST be `Agent Name — Branch` and MUST be wrapped in the markdown link to the agent card (e.g. `[Agent Name — Branch](/agents/<id>)`); add `(requires login)` in italics on the same cell.\n5. **Highlights by Country / City**.\n6. **Key Agent & School Engagements** — for every agent visit, render the agent name as a markdown link to `/agents/<id>` followed by `_(requires login)_` on a new line, then a short paragraph weaving in Objectives and 'Notes during visit'.\n7. **Recruitment Event Outcomes**.\n8. **Action Items / Follow-ups** — a markdown table with columns | # | Action | Owner | Due |.\n9. **Conclusion**.\n\nRules:\n- Always prefer markdown tables over long bullet lists where data is tabular — they render as clean two-tone striped tables.\n- Preserve every markdown link provided in the source data verbatim so the reader can click through.\n- Do NOT include any agent or school contact details (names of staff, emails, phones, postal addresses).\n- Be concise, concrete, and executive-friendly.",
          },
          { role: "user", content: ctx },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit exceeded. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("Empty response from AI");

    const { error: insErr } = await supabase.from("trip_reports").insert({
      trip_id: data.tripId,
      user_id: userId,
      content_md: content,
      model,
    });
    if (insErr) throw insErr;

    return { ok: true };
  });
