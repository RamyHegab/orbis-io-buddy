import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  countries: z.array(z.string()).optional(),
});

export type AggregateReport = {
  startDate: string;
  endDate: string;
  totals: {
    trips: number;
    events: number;
    agentVisits: number;
    schoolVisits: number;
  };
  byCountry: Array<{
    country: string;
    trips: number;
    events: number;
    agentVisits: number;
    schoolVisits: number;
  }>;
  tripsList: Array<{ id: string; title: string; start_date: string; end_date: string; destinations: string[] }>;
  aiSummary: string;
};

export const generateAggregateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<AggregateReport> => {
    const { supabase } = context;
    const apiKey = process.env.LOVABLE_API_KEY;

    // Trips whose date range intersects [start, end]
    const { data: trips, error: tripsErr } = await supabase
      .from("trips")
      .select("id, title, start_date, end_date, destinations")
      .lte("start_date", data.endDate)
      .gte("end_date", data.startDate)
      .order("start_date");
    if (tripsErr) throw tripsErr;

    const tripIds = (trips ?? []).map((t) => t.id);

    const { data: activities } = tripIds.length
      ? await supabase
          .from("activities")
          .select("id, type, trip_id, day_date, agent_id, school_id, to_country, from_country, location, title")
          .in("trip_id", tripIds)
      : { data: [] as any[] };

    const { data: reports } = tripIds.length
      ? await supabase
          .from("trip_reports")
          .select("trip_id, content_md, created_at")
          .in("trip_id", tripIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };

    // Latest report per trip
    const latestByTrip = new Map<string, string>();
    for (const r of reports ?? []) {
      if (!latestByTrip.has(r.trip_id)) latestByTrip.set(r.trip_id, r.content_md);
    }

    // Lookup countries for agents/schools referenced
    const agentIds = Array.from(new Set((activities ?? []).map((a) => a.agent_id).filter(Boolean))) as string[];
    const schoolIds = Array.from(new Set((activities ?? []).map((a) => a.school_id).filter(Boolean))) as string[];
    const { data: agentRows } = agentIds.length
      ? await supabase.from("agents").select("id, hq_country").in("id", agentIds)
      : { data: [] as any[] };
    const { data: schoolRows } = schoolIds.length
      ? await supabase.from("schools").select("id, country").in("id", schoolIds)
      : { data: [] as any[] };
    const agentCountry = new Map((agentRows ?? []).map((a) => [a.id, a.hq_country ?? ""]));
    const schoolCountry = new Map((schoolRows ?? []).map((s) => [s.id, s.country ?? ""]));

    type Row = { country: string; trips: number; events: number; agentVisits: number; schoolVisits: number };
    const byCountry = new Map<string, Row>();
    const row = (c: string) => {
      const k = c || "Unspecified";
      if (!byCountry.has(k)) byCountry.set(k, { country: k, trips: 0, events: 0, agentVisits: 0, schoolVisits: 0 });
      return byCountry.get(k)!;
    };

    // Trips per country (by destination)
    for (const t of trips ?? []) {
      for (const d of t.destinations ?? []) row(d).trips += 1;
    }

    let events = 0, agentVisits = 0, schoolVisits = 0;
    for (const a of activities ?? []) {
      const c =
        a.type === "agent_visit" ? (agentCountry.get(a.agent_id!) || a.to_country || "")
        : a.type === "school_visit" ? (schoolCountry.get(a.school_id!) || a.to_country || "")
        : (a.to_country || "");
      if (a.type === "recruitment_event") { events += 1; row(c).events += 1; }
      else if (a.type === "agent_visit") { agentVisits += 1; row(c).agentVisits += 1; }
      else if (a.type === "school_visit") { schoolVisits += 1; row(c).schoolVisits += 1; }
    }

    // Optional country filter — restrict aggregates to the picked set
    const countryFilter = (data.countries ?? []).map((c) => c.trim()).filter(Boolean);
    const filteredByCountry = countryFilter.length
      ? Array.from(byCountry.values()).filter((r) => countryFilter.includes(r.country))
      : Array.from(byCountry.values());
    const byCountrySorted = filteredByCountry.sort((a, b) =>
      (b.trips + b.events + b.agentVisits + b.schoolVisits) - (a.trips + a.events + a.agentVisits + a.schoolVisits),
    );

    // Recompute totals when filtered
    if (countryFilter.length) {
      events = 0; agentVisits = 0; schoolVisits = 0;
      for (const r of byCountrySorted) {
        events += r.events;
        agentVisits += r.agentVisits;
        schoolVisits += r.schoolVisits;
      }
    }

    // Filter trips list to those touching selected countries
    const filteredTrips = countryFilter.length
      ? (trips ?? []).filter((t) => (t.destinations ?? []).some((d: string) => countryFilter.includes(d)))
      : (trips ?? []);

    // AI summary of key takeaways + leads from existing trip reports.
    let aiSummary = "";
    const sourceTripIds = new Set(filteredTrips.map((t) => t.id));
    const sourceReports = Array.from(latestByTrip.entries()).filter(([id]) => sourceTripIds.has(id));
    const countryScope = countryFilter.length ? ` focused on ${countryFilter.join(", ")}` : "";
    if (sourceReports.length && apiKey) {
      let prompt = `You are summarising a portfolio of completed recruitment trip reports for an executive briefing covering ${data.startDate} to ${data.endDate}${countryScope}.\n\nProduce a concise markdown summary with these sections ONLY:\n\n## Key Takeaways\n(3–6 bullet points across all trips)\n\n## Leads Generated\n(brief summary of the volume and quality of leads, agents, and schools that progressed; pull concrete numbers if present)\n\n## Notable Outcomes by Country\n(short bullets grouped by country)\n\nKeep it to ~350 words. Do not include contact details. Source reports follow:\n\n`;
      for (const [tripId, md] of sourceReports) {
        const trip = trips!.find((t) => t.id === tripId);
        prompt += `\n---\n# ${trip?.title ?? tripId} (${trip?.start_date} → ${trip?.end_date})\n${md}\n`;
      }
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You write tight, executive-grade summaries in clean markdown." },
              { role: "user", content: prompt.slice(0, 60000) },
            ],
          }),
        });
        if (res.status === 429) aiSummary = "_AI rate limit hit — please try again shortly._";
        else if (res.status === 402) aiSummary = "_AI credits exhausted — please add credits to continue._";
        else if (!res.ok) aiSummary = `_AI summary unavailable (${res.status})._`;
        else {
          const j = await res.json();
          aiSummary = j.choices?.[0]?.message?.content ?? "";
        }
      } catch (e: any) {
        aiSummary = `_AI summary failed: ${e?.message ?? "unknown error"}._`;
      }
    } else if (!sourceReports.length) {
      aiSummary = "_No trip reports found in this date range. Generate per-trip reports first to enable AI key-takeaway summaries._";
    }

    return {
      startDate: data.startDate,
      endDate: data.endDate,
      totals: { trips: trips?.length ?? 0, events, agentVisits, schoolVisits },
      byCountry: byCountrySorted,
      tripsList: (trips ?? []).map((t) => ({
        id: t.id, title: t.title, start_date: t.start_date, end_date: t.end_date, destinations: t.destinations ?? [],
      })),
      aiSummary,
    };
  });
