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
    { key: "general_email", label: "General email", aliases: ["email", "general email", "school email"] },
    { key: "general_phone", label: "General phone", aliases: ["phone", "general phone", "telephone"] },
    { key: "primary_contact_name", label: "Contact name", aliases: ["contact", "contact name", "primary contact"] },
    { key: "primary_contact_position", label: "Contact position", aliases: ["position", "title", "role"] },
    { key: "primary_contact_email", label: "Contact email", aliases: ["contact email"] },
    { key: "primary_contact_phone", label: "Contact phone", aliases: ["contact phone"] },
    { key: "notes", label: "Notes", aliases: ["notes", "comments", "remarks"] },
  ],
  agent: [
    { key: "trading_name", label: "Trading name", required: true, aliases: ["trading name", "name", "agent", "agent name", "company"] },
    { key: "legal_name", label: "Legal name", aliases: ["legal name", "registered name"] },
    { key: "agent_code", label: "Agent code", aliases: ["code", "agent code", "id"] },
    { key: "status", label: "Status", aliases: ["status", "stage"] },
    { key: "website", label: "Website", aliases: ["website", "url", "site"] },
    { key: "hq_country", label: "HQ country", aliases: ["country", "hq country", "headquarters country"] },
    { key: "hq_address", label: "HQ address", aliases: ["address", "hq address", "headquarters"] },
    { key: "account_manager", label: "Account manager", aliases: ["account manager", "am", "owner"] },
    { key: "main_contact_name", label: "Main contact name", aliases: ["contact", "main contact", "contact name"] },
    { key: "main_contact_email", label: "Main contact email", aliases: ["email", "contact email"] },
    { key: "main_contact_phone", label: "Main contact phone", aliases: ["phone", "contact phone", "telephone"] },
  ],
  agent_branch: [
    { key: "branch_name", label: "Branch name", required: true, aliases: ["branch", "branch name", "office", "name"] },
    { key: "city", label: "City", aliases: ["city", "town"] },
    { key: "country", label: "Country", aliases: ["country"] },
    { key: "address", label: "Address", aliases: ["address", "street"] },
    { key: "agency_name", label: "Agency name", aliases: ["agency", "agency name"] },
    { key: "in_country_trading_name", label: "In-country trading name", aliases: ["in country", "trading name local"] },
    { key: "contact_first_name", label: "Contact first name", aliases: ["first name", "contact first"] },
    { key: "contact_last_name", label: "Contact last name", aliases: ["last name", "surname", "contact last"] },
    { key: "contact_position", label: "Contact position", aliases: ["position", "title", "role"] },
    { key: "contact_email", label: "Contact email", aliases: ["email", "contact email"] },
    { key: "contact_phone", label: "Contact phone", aliases: ["phone", "telephone", "contact phone"] },
  ],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function autoMatch(headers: string[], fields: FieldDef[]): Record<string, string> {
  const map: Record<string, string> = {};
  const normHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  for (const f of fields) {
    const candidates = [f.key, f.label, ...(f.aliases ?? [])].map(norm);
    let hit = normHeaders.find((h) => candidates.includes(h.n));
    if (!hit) hit = normHeaders.find((h) => candidates.some((c) => h.n.includes(c) || c.includes(h.n)));
    if (hit) map[f.key] = hit.raw;
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
