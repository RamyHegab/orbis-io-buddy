import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/notion/v1";

async function notion(path: string, init: RequestInit = {}) {
  const lov = process.env.LOVABLE_API_KEY;
  const key = process.env.NOTION_API_KEY;
  if (!lov || !key) throw new Error("Notion connector not configured");
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lov}`,
      "X-Connection-Api-Key": key,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Notion ${path} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Flatten a Notion property value into plain text/values.
function flattenProperty(p: any): any {
  if (!p) return null;
  switch (p.type) {
    case "title":
    case "rich_text":
      return (p[p.type] ?? []).map((t: any) => t.plain_text).join("");
    case "select":
      return p.select?.name ?? null;
    case "multi_select":
      return (p.multi_select ?? []).map((s: any) => s.name);
    case "number": return p.number;
    case "checkbox": return p.checkbox;
    case "url": return p.url;
    case "email": return p.email;
    case "phone_number": return p.phone_number;
    case "date": return p.date?.start ?? null;
    case "status": return p.status?.name ?? null;
    case "people": return (p.people ?? []).map((x: any) => x.name ?? x.id);
    case "files": return (p.files ?? []).map((f: any) => f.name);
    default: return null;
  }
}

// Look for a property by case-insensitive name match against candidate keys.
function pick(props: Record<string, any>, candidates: string[]): any {
  const lowerMap = Object.fromEntries(Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]));
  for (const c of candidates) {
    const v = lowerMap[c.toLowerCase()];
    if (v != null && v !== "") return v;
  }
  return null;
}

export const listNotionDatabases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const res = await notion("/search", {
      method: "POST",
      body: JSON.stringify({ filter: { property: "object", value: "database" }, page_size: 50 }),
    });
    return (res.results ?? []).map((d: any) => ({
      id: d.id,
      title: (d.title ?? []).map((t: any) => t.plain_text).join("") || "(untitled)",
    }));
  });

export const syncSchoolsFromNotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ databaseId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let cursor: string | undefined;
    let imported = 0;
    let updated = 0;

    do {
      const body: any = { page_size: 100 };
      if (cursor) body.start_cursor = cursor;
      const res = await notion(`/databases/${data.databaseId}/query`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      for (const page of res.results ?? []) {
        const props = page.properties ?? {};
        const flat: Record<string, any> = {};
        for (const [k, v] of Object.entries(props)) flat[k] = flattenProperty(v);

        const name = pick(flat, ["Name", "School", "School Name", "Title"]) || "(untitled)";
        const country = pick(flat, ["Country"]) || "Unknown";
        const city = pick(flat, ["City", "Location"]) || "";
        const status = pick(flat, ["Status", "Stage"]);

        const row = {
          user_id: userId,
          notion_page_id: page.id,
          name: String(name),
          country: String(country),
          city: String(city),
          status: status ? String(status) : null,
          properties: flat,
          last_synced_at: new Date().toISOString(),
        };

        // Upsert by (user_id, notion_page_id)
        const { data: existing } = await supabase
          .from("schools")
          .select("id")
          .eq("user_id", userId)
          .eq("notion_page_id", page.id)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase.from("schools").update(row).eq("id", existing.id);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase.from("schools").insert(row);
          if (error) throw error;
          imported++;
        }
      }
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    return { imported, updated };
  });
