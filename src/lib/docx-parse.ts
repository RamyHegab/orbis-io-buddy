import mammoth from "mammoth";
import type { Field, FieldType } from "./agent-signup-locked";

/** Extract candidate fields from a .docx file (client-side). */
export async function parseDocxToCandidateFields(file: File): Promise<Field[]> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = (result.value ?? "").replace(/\r/g, "");

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const candidates: Field[] = [];
  const seen = new Set<string>();

  const push = (label: string, type: FieldType = "text") => {
    const clean = label.replace(/\s+/g, " ").replace(/[:*]+$/g, "").trim();
    if (!clean || clean.length < 2 || clean.length > 120) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      id: crypto.randomUUID(),
      label: clean,
      type,
      required: false,
    });
  };

  for (const raw of lines) {
    // "Full name:" or "Full name: ____"
    const colon = raw.match(/^([A-Za-z][A-Za-z0-9 \-\/&()']{1,80})\s*[:：]\s*(.*)$/);
    if (colon) {
      const label = colon[1];
      const rest = colon[2] ?? "";
      let type: FieldType = "text";
      const l = label.toLowerCase();
      if (/e-?mail/.test(l)) type = "email";
      else if (/phone|mobile|tel/.test(l)) type = "phone";
      else if (/date|dob|birth/.test(l)) type = "date";
      else if (/notes?|comments?|about|description|address/.test(l)) type = "textarea";
      else if (/\bnumber\b|\bno\.\b|count|amount/.test(l)) type = "number";
      else if (rest.includes("☐") || rest.includes("□")) type = "checkbox";
      push(label, type);
      continue;
    }
    // "Full name ______"
    const underscored = raw.match(/^([A-Za-z][A-Za-z0-9 \-\/&()']{1,80})\s+_{2,}$/);
    if (underscored) {
      push(underscored[1]);
    }
  }

  return candidates;
}
