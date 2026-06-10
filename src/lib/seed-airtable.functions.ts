import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readFileSync } from "fs";
import { join } from "path";

// Tiny CSV parser (handles quoted fields w/ commas + embedded quotes).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.some((v) => v.length)) rows.push(cur);
        cur = [];
      } else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

function parseDmy(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export const seedAirtableData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Admin only
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admin only");

    // Skip if there are already agents for this user
    const { count } = await supabase.from("agents").select("*", { count: "exact", head: true }).eq("user_id", userId);
    if ((count ?? 0) > 0) return { agents: 0, branches: 0, skipped: true };

    const agentsCsv = readFileSync(join(process.cwd(), "src/data/seed/agents.csv"), "utf-8");
    const branchesCsv = readFileSync(join(process.cwd(), "src/data/seed/branches.csv"), "utf-8");

    const agentRows = rowsToObjects(parseCsv(agentsCsv));
    const branchRows = rowsToObjects(parseCsv(branchesCsv));

    // Dedupe agents by trading_name + legal_name (case-insensitive), keep latest agreement_end_date
    const agentMap = new Map<string, any>();
    for (const r of agentRows) {
      const trading = r["Agent trading name"];
      if (!trading) continue;
      const legal = r["Legal name"] || "";
      const key = `${trading.toLowerCase()}__${legal.toLowerCase()}`;
      const row = {
        user_id: userId,
        trading_name: trading,
        legal_name: legal || null,
        account_manager: r["Account Manager"] || null,
        status: (r["Status"]?.toLowerCase() || "active") as any,
        website: r["Website"] || null,
        hq_country: r["HQ Country"] || null,
        hq_address: r["HQ Address"] || null,
        agent_code: r["Agent Code"]?.trim() || null,
        agreement_start_date: parseDmy(r["Agreement Start Date"]),
        agreement_end_date: parseDmy(r["Agreement End Date"]),
        countries_of_operation: (r["Countries of operation"] || "")
          .split(",").map((s) => s.trim()).filter(Boolean),
        main_contact_name: r["Main contact Person"]?.trim() || null,
        main_contact_email: r["Email"]?.trim() || null,
        main_contact_phone: r["Contact Number"]?.trim() || null,
      };
      const existing = agentMap.get(key);
      if (!existing || (row.agreement_end_date && (!existing.agreement_end_date || row.agreement_end_date > existing.agreement_end_date))) {
        agentMap.set(key, row);
      }
    }

    const agentInserts = Array.from(agentMap.values());
    const { data: insertedAgents, error: agentErr } = await supabase
      .from("agents")
      .insert(agentInserts)
      .select("id, trading_name");
    if (agentErr) throw agentErr;

    // Map trading_name -> agent_id (lowercase)
    const tradingToId = new Map<string, string>();
    for (const a of insertedAgents ?? []) tradingToId.set(a.trading_name.toLowerCase(), a.id);

    // Branches
    const branchInserts = branchRows
      .map((r) => {
        const trading = r["Agent trading name"]?.toLowerCase();
        const agent_id = trading ? tradingToId.get(trading) : undefined;
        if (!agent_id) return null;
        return {
          user_id: userId,
          agent_id,
          branch_name: r["BRANCH"] || null,
          country: r["Country"] || null,
          city: r["City"] || null,
          address: r["Address"] || null,
          contact_first_name: r["First Name"] || null,
          contact_last_name: r["Last Name"] || null,
          contact_email: r["Email"] || null,
          contact_position: r["Position"] || null,
          contact_phone: r["Contact Number"] || null,
          in_country_trading_name: r["In-country trading name"] || null,
          agency_name: r["Agency name"] || null,
        };
      })
      .filter(Boolean) as any[];

    let branchesCount = 0;
    if (branchInserts.length) {
      const { error: bErr, count: bCount } = await supabase
        .from("agent_branches")
        .insert(branchInserts, { count: "exact" });
      if (bErr) throw bErr;
      branchesCount = bCount ?? branchInserts.length;
    }

    return { agents: agentInserts.length, branches: branchesCount, skipped: false };
  });
