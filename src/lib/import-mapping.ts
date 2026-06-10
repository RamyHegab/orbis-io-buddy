import * as XLSX from "xlsx";

export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[];
};

export type ImportType = "school" | "agent" | "agent_branch";

export const SCHEMAS: Record<ImportType, FieldDef[]> = {
  school: [
    { key: "name", label: "Name", required: true, aliases: ["school", "school name", "institution", "title"] },
    { key: "country", label: "Country", required: true, aliases: ["country", "nation"] },
    { key: "city", label: "City", aliases: ["city", "town", "location"] },
    { key: "address", label: "Address", aliases: ["address", "street"] },
    { key: "level", label: "Level", aliases: ["level", "type", "category"] },
    { key: "website", label: "Website", aliases: ["website", "url", "site", "web"] },
    { key: "general_email", label: "General email", aliases: ["general email", "school email", "main email"] },
    { key: "general_phone", label: "General phone", aliases: ["general phone", "school phone", "main phone", "telephone"] },
    { key: "primary_contact_name", label: "Primary contact name", aliases: ["primary contact name", "primary contact", "contact name", "contact"] },
    { key: "primary_contact_position", label: "Primary contact position", aliases: ["primary position", "primary contact position", "position", "title", "role"] },
    { key: "primary_contact_email", label: "Primary contact email", aliases: ["primary email address", "primary email", "primary contact email", "contact email"] },
    { key: "primary_contact_phone", label: "Primary contact phone", aliases: ["primary contact number", "primary phone", "primary contact phone", "contact phone", "contact number"] },
    { key: "secondary_contact_name", label: "Secondary contact name", aliases: ["secondary contact name", "secondary contact"] },
    { key: "secondary_contact_email", label: "Secondary contact email", aliases: ["secondary email address", "secondary email", "secondary contact email"] },
    { key: "secondary_contact_phone", label: "Secondary contact phone", aliases: ["secondary contact number", "secondary phone", "secondary contact phone"] },
    { key: "notes", label: "Notes", aliases: ["notes", "comments", "remarks"] },
  ],
  agent: [
    { key: "trading_name", label: "Trading name", required: true, aliases: ["trading name", "name", "agent", "agent name", "company"] },
    { key: "legal_name", label: "Legal name", aliases: ["legal name", "registered name"] },
    { key: "agent_code", label: "Agent code", aliases: ["agent code", "code", "id"] },
    { key: "status", label: "Status", aliases: ["status", "stage"] },
    { key: "website", label: "Website", aliases: ["website", "url", "site"] },
    { key: "hq_country", label: "HQ country", aliases: ["hq country", "headquarters country", "country"] },
    { key: "hq_address", label: "HQ address", aliases: ["hq address", "headquarters", "address"] },
    { key: "account_manager", label: "Account manager", aliases: ["account manager", "am", "owner"] },
    { key: "main_contact_name", label: "Main contact name", aliases: ["main contact name", "main contact", "primary contact", "contact name", "contact"] },
    { key: "main_contact_email", label: "Main contact email", aliases: ["main contact email", "primary email address", "contact email", "email"] },
    { key: "main_contact_phone", label: "Main contact phone", aliases: ["main contact phone", "primary contact number", "contact phone", "telephone", "phone"] },
  ],
  agent_branch: [
    { key: "branch_name", label: "Branch name", required: true, aliases: ["branch name", "branch", "office", "name"] },
    { key: "city", label: "City", aliases: ["city", "town"] },
    { key: "country", label: "Country", aliases: ["country"] },
    { key: "address", label: "Address", aliases: ["address", "street"] },
    { key: "agency_name", label: "Agency name", aliases: ["agency name", "agency"] },
    { key: "in_country_trading_name", label: "In-country trading name", aliases: ["in country trading name", "in country", "trading name local"] },
    { key: "contact_first_name", label: "Contact first name", aliases: ["contact first name", "first name", "given name"] },
    { key: "contact_last_name", label: "Contact last name", aliases: ["contact last name", "last name", "surname", "family name"] },
    { key: "contact_position", label: "Contact position", aliases: ["contact position", "position", "title", "role"] },
    { key: "contact_email", label: "Contact email", aliases: ["contact email", "email"] },
    { key: "contact_phone", label: "Contact phone", aliases: ["contact phone", "phone", "telephone", "contact number"] },
  ],
};

const norm = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Detect best header row in a sheet (handles title/blank rows before headers). */
function findHeaderRow(rows: any[][]): number {
  let best = 0, bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i] ?? [];
    const filled = r.filter((c) => c != null && String(c).trim() !== "");
    const stringy = filled.filter((c) => typeof c === "string" && !/^\d+(\.\d+)?$/.test(String(c).trim())).length;
    // Heuristic: many filled string cells, no values that look like data
    const score = stringy >= 3 ? stringy + (filled.length === stringy ? 5 : 0) : -1;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

/** Disambiguate duplicate headers using nearest section keyword (Primary/Secondary/Main). */
function disambiguateHeaders(rawHeaders: string[]): string[] {
  const cleaned = rawHeaders.map((h) => String(h ?? "").replace(/\s+/g, " ").trim());
  const counts = new Map<string, number>();
  for (const h of cleaned) counts.set(h.toLowerCase(), (counts.get(h.toLowerCase()) ?? 0) + 1);
  const out: string[] = [];
  let section = "";
  for (const h of cleaned) {
    const u = h.toUpperCase();
    if (/\b(PRIMARY|MAIN)\b/.test(u)) section = "Primary";
    else if (/\bSECONDARY\b/.test(u)) section = "Secondary";
    const isDup = (counts.get(h.toLowerCase()) ?? 0) > 1;
    let name = isDup && section && !u.includes(section.toUpperCase()) ? `${section} ${h}` : h;
    if (!name) name = `Column ${out.length + 1}`;
    let unique = name, n = 2;
    while (out.includes(unique)) unique = `${name} (${n++})`;
    out.push(unique);
  }
  return out;
}

/** Combine adjacent "* first name" + "* last name" columns into a single "* name" column. */
function combineFirstLastNames(headers: string[], rows: Record<string, any>[]): { headers: string[]; rows: Record<string, any>[] } {
  const newHeaders = [...headers];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!/\bfirst name\b/i.test(h)) continue;
    // find a "last name" header that shares the prefix before "first"
    const prefix = h.replace(/\bfirst name\b.*$/i, "").trim();
    const lastIdx = headers.findIndex((x, j) => j !== i && new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*last name\\b`, "i").test(x));
    if (lastIdx === -1) continue;
    const lastH = headers[lastIdx];
    const combinedName = (prefix ? `${prefix} Name` : "Name").replace(/\s+/g, " ").trim();
    let unique = combinedName, n = 2;
    while (newHeaders.includes(unique)) unique = `${combinedName} (${n++})`;
    newHeaders.push(unique);
    for (const r of rows) {
      const a = r[h] == null ? "" : String(r[h]).trim();
      const b = r[lastH] == null ? "" : String(r[lastH]).trim();
      const joined = [a, b].filter(Boolean).join(" ");
      if (joined) r[unique] = joined;
    }
  }
  return { headers: newHeaders, rows };
}

/** Parse a workbook's first sheet into clean headers + row objects. */
export function parseWorkbook(buf: ArrayBuffer): { headers: string[]; rows: Record<string, any>[] } {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", blankrows: false });
  if (!aoa.length) return { headers: [], rows: [] };
  const headerIdx = findHeaderRow(aoa);
  const rawHeaders = (aoa[headerIdx] ?? []).map((c) => String(c ?? "").trim());
  const headers = disambiguateHeaders(rawHeaders);
  const dataRows: Record<string, any>[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i] ?? [];
    const obj: Record<string, any> = {};
    let any = false;
    for (let j = 0; j < headers.length; j++) {
      const v = row[j];
      if (v != null && String(v).trim() !== "") { obj[headers[j]] = v; any = true; }
    }
    if (any) dataRows.push(obj);
  }
  return combineFirstLastNames(headers, dataRows);
}

export function autoMatch(headers: string[], fields: FieldDef[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  const normHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  // Pass 1: exact normalized match — sort aliases longest-first so specific wins
  for (const f of fields) {
    const cands = [f.key, f.label, ...(f.aliases ?? [])].map(norm).sort((a, b) => b.length - a.length);
    const hit = normHeaders.find((h) => !used.has(h.raw) && cands.includes(h.n));
    if (hit) { map[f.key] = hit.raw; used.add(hit.raw); }
  }
  // Pass 2: header contains a full alias as a whole word
  for (const f of fields) {
    if (map[f.key]) continue;
    const cands = [f.key, f.label, ...(f.aliases ?? [])].map(norm).sort((a, b) => b.length - a.length);
    const hit = normHeaders.find((h) => !used.has(h.raw) && cands.some((c) => new RegExp(`(^|\\s)${c.replace(/\s+/g, "\\s+")}(\\s|$)`).test(h.n)));
    if (hit) { map[f.key] = hit.raw; used.add(hit.raw); }
  }
  return map;
}

export function mapRow(row: Record<string, any>, mapping: Record<string, string>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [field, header] of Object.entries(mapping)) {
    if (!header) continue;
    const v = row[header];
    if (v == null || v === "") continue;
    out[field] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}
