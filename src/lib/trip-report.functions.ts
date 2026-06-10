import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
    if (trip.notes) ctx += `Notes: ${trip.notes}\n`;
    ctx += `\n## Activities (${activities?.length ?? 0})\n`;
    for (const a of activities ?? []) {
      ctx += `\n### ${a.day_date}${a.start_time ? ` ${a.start_time.slice(0, 5)}` : ""} — ${a.title} [${a.type}]\n`;
      if (a.location) ctx += `Location: ${a.location}\n`;
      if (a.agents) ctx += `Agent: ${a.agents.trading_name}\n`;
      if (a.schools) ctx += `School: ${a.schools.name} (${a.schools.city}, ${a.schools.country})\n`;
      if (a.notes) ctx += `Notes: ${a.notes}\n`;
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
              "You are an executive assistant for a university international recruitment team. Write a professional, well-structured trip report in Markdown based on the provided data. Include an Executive Summary, Highlights by Country/City, Key Agent & School Engagements, Recruitment Event Outcomes, Action Items / Follow-ups, and a brief Conclusion. Be concise and concrete. Use bullet points where helpful.",
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
