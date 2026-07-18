import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NOTION_API = "https://api.notion.com/v1";

export const importNotionPlanning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    notionToken: string;
    tripsDatabaseId: string;
    eventsDatabaseId: string;
  }) => z.object({
    notionToken: z.string().min(1),
    tripsDatabaseId: z.string().min(1),
    eventsDatabaseId: z.string().min(1),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const events = await queryNotionDatabase(data.notionToken, data.eventsDatabaseId);
    const trips = await queryNotionDatabase(data.notionToken, data.tripsDatabaseId);

    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");

    const eventInserts = events.map((page) => mapEventCatalog(page, userId, profiles ?? [])).filter(Boolean);
    const { data: insertedEvents, error: eventsError } = await supabase
      .from("events_catalog")
      .insert(eventInserts as any)
      .select("id, title");
    if (eventsError) throw new Error(`Events import failed: ${eventsError.message}`);

    const eventTitleToId = new Map((insertedEvents ?? []).map((e: any) => [e.title, e.id]));

    const tripInserts = trips.map((page) => mapPlannedActivity(page, userId, profiles ?? [], eventTitleToId)).filter(Boolean);
    const { error: tripsError } = await supabase.from("planned_activities").insert(tripInserts as any);
    if (tripsError) throw new Error(`Trips import failed: ${tripsError.message}`);

    return {
      eventsImported: eventInserts.length,
      tripsImported: tripInserts.length,
    };
  });

async function queryNotionDatabase(token: string, databaseId: string) {
  const results: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion API error (${res.status}): ${text}`);
    }
    const data = await res.json();
    results.push(...(data.results ?? []));
    cursor = data.next_cursor ?? undefined;
  } while (cursor);
  return results;
}

function extractTitle(page: any): string {
  const titleProp = Object.values(page.properties).find((p: any) => p.type === "title");
  return (titleProp as any)?.title?.map((t: any) => t.plain_text).join("") ?? "Untitled";
}

function extractText(page: any, keys: string[]): string | null {
  for (const key of keys) {
    const prop = page.properties[key];
    if (!prop) continue;
    if (prop.type === "rich_text") return prop.rich_text.map((t: any) => t.plain_text).join("").trim() || null;
    if (prop.type === "title") return prop.title.map((t: any) => t.plain_text).join("").trim() || null;
    if (prop.type === "select") return prop.select?.name ?? null;
    if (prop.type === "status") return prop.status?.name ?? null;
  }
  return null;
}

function extractDate(page: any, keys: string[]): { start?: string; end?: string } | null {
  for (const key of keys) {
    const prop = page.properties[key];
    if (prop?.type === "date") {
      return { start: prop.date?.start, end: prop.date?.end ?? undefined };
    }
  }
  return null;
}

function extractMultiSelect(page: any, keys: string[]): string[] {
  for (const key of keys) {
    const prop = page.properties[key];
    if (prop?.type === "multi_select") {
      return prop.multi_select.map((s: any) => s.name).filter(Boolean);
    }
    if (prop?.type === "relation") {
      return prop.relation.map((r: any) => r.id).filter(Boolean);
    }
  }
  return [];
}

function extractSelect(page: any, keys: string[]): string | null {
  for (const key of keys) {
    const prop = page.properties[key];
    if (prop?.type === "select") return prop.select?.name ?? null;
    if (prop?.type === "status") return prop.status?.name ?? null;
  }
  return null;
}

function extractNumber(page: any, keys: string[]): number | null {
  for (const key of keys) {
    const prop = page.properties[key];
    if (prop?.type === "number") return prop.number ?? null;
    if (prop?.type === "formula" && typeof prop.formula?.number === "number") return prop.formula.number;
  }
  return null;
}

function normalizeStatus(value: string | null): "proposed" | "planning" | "confirmed" | "done" {
  const v = (value ?? "").toLowerCase().replace(/\s+/g, "_");
  if (["planning", "in_progress", "in progress"].includes(v)) return "planning";
  if (["confirmed", "approved"].includes(v)) return "confirmed";
  if (["done", "completed", "finished"].includes(v)) return "done";
  return "proposed";
}

function normalizeAcademicSupport(value: string | null): "required" | "preferred" | "not_required" {
  const v = (value ?? "").toLowerCase();
  if (v.includes("requir") || v === "yes") return "required";
  if (v.includes("prefer") || v.includes("preferred")) return "preferred";
  return "not_required";
}

function normalizeEventTypes(values: string[]): string[] {
  const out = new Set<string>();
  for (const v of values) {
    const lower = v.toLowerCase();
    if (lower.includes("agent")) out.add("agents_visits");
    else if (lower.includes("school")) out.add("school_visits");
    else if (lower.includes("recruitment") || lower.includes("fair") || lower.includes("event")) out.add("recruitment_events");
    else out.add("other");
  }
  return Array.from(out);
}

function findUserIdByNameOrEmail(nameOrEmail: string | null, profiles: { id: string; full_name: string | null; email: string | null }[]): string | null {
  if (!nameOrEmail) return null;
  const query = nameOrEmail.toLowerCase().trim();
  const match = profiles.find(
    (p) =>
      p.full_name?.toLowerCase() === query ||
      p.email?.toLowerCase() === query ||
      p.full_name?.toLowerCase().includes(query) ||
      p.email?.toLowerCase().includes(query),
  );
  return match?.id ?? null;
}

function mapEventCatalog(page: any, userId: string, profiles: any[]) {
  const title = extractTitle(page);
  const date = extractDate(page, ["Dates", "Date", "Start", "Start date", "Start Date", "When"]) ?? { start: null, end: null };
  if (!date.start) return null;

  const countries = extractMultiSelect(page, ["Countries", "Country", "Country/countries", "Countries visited"]);
  const cities = extractMultiSelect(page, ["Cities", "City", "City/cities"]);
  const status = normalizeStatus(extractSelect(page, ["Status", "State", "Stage"]));
  const cost = extractNumber(page, ["Cost", "Event cost", "Event Cost", "Price"]);
  const currency = extractText(page, ["Currency", "Curr"]) ?? "USD";
  const traveller = extractText(page, ["Traveller", "Traveler", "Owner", "Assigned", "User"]);
  const notes = extractText(page, ["Notes", "Note", "Description", "Comments"]) ?? null;

  return {
    title,
    start_date: date.start,
    end_date: date.end ?? date.start,
    countries: countries.length ? countries : ["Unknown"],
    cities: cities.length ? cities : [],
    cost,
    currency,
    status,
    traveller_id: findUserIdByNameOrEmail(traveller, profiles) ?? userId,
    notes,
  };
}

function mapPlannedActivity(page: any, userId: string, profiles: any[], eventTitleToId: Map<string, string>) {
  const title = extractTitle(page);
  const date = extractDate(page, ["Dates", "Date", "Start", "Start date", "Start Date", "When"]) ?? { start: null, end: null };
  if (!date.start) return null;

  const countries = extractMultiSelect(page, ["Countries", "Country", "Country/countries", "Countries visited"]);
  const rawTypes = extractMultiSelect(page, ["Events", "Event types", "Event Types", "Type", "Types", "Activities", "Activity types"]);
  const eventTypes = normalizeEventTypes(rawTypes.length ? rawTypes : extractMultiSelect(page, ["Events"]));

  const eventIds = extractMultiSelect(page, ["Events", "Event", "Event ids"])
    .map((name) => eventTitleToId.get(name))
    .filter(Boolean) as string[];

  const academicSupport = normalizeAcademicSupport(extractSelect(page, ["Academic support", "Academic Support", "Academic", "Support"]));
  const status = normalizeStatus(extractSelect(page, ["Status", "State", "Stage"]));
  const eventsCost = extractNumber(page, ["Events cost", "Events Cost", "Event cost", "Events"]) ?? 0;
  const travelCost = extractNumber(page, ["Travel cost", "Travel Cost", "Travel"]) ?? 0;
  const hotelCost = extractNumber(page, ["Hotel cost", "Hotel Cost", "Hotel"]) ?? 0;
  const subsistenceCost = extractNumber(page, ["Subsistence cost", "Subsistence Cost", "Subsistence", "Per diem", "Per Diem"]) ?? 0;
  const traveller = extractText(page, ["Traveller", "Traveler", "Owner", "Assigned", "User"]);
  const objectives = extractText(page, ["Objectives", "Objective", "Goals", "Goal"]) ?? null;
  const notes = extractText(page, ["Notes", "Note", "Description", "Comments"]) ?? null;

  return {
    user_id: userId,
    title,
    start_date: date.start,
    end_date: date.end ?? date.start,
    countries: countries.length ? countries : ["Unknown"],
    event_ids: eventIds,
    event_types: eventTypes,
    traveller_id: findUserIdByNameOrEmail(traveller, profiles) ?? userId,
    academic_support: academicSupport,
    events_cost: eventsCost,
    travel_cost: travelCost,
    hotel_cost: hotelCost,
    subsistence_cost: subsistenceCost,
    status,
    objectives,
    notes,
    trip_id: null,
  };
}
