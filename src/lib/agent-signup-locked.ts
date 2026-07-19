// Locked sections auto-injected into every Agent Signup form template.
// Admin can reorder these into parts but cannot delete/edit them.

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "phone"
  | "email"
  | "date"
  | "select"
  | "checkbox"
  | "rating"
  | "file"
  | "repeatable_group";

export interface Subfield {
  id: string;
  label: string;
  type: Exclude<FieldType, "repeatable_group">;
  required?: boolean;
}

export interface Field {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[];
  accept?: string; // for file: comma-separated mime hints
  multiple?: boolean; // for file
  min?: number; // for repeatable_group / file
  max?: number;
  subfields?: Subfield[]; // for repeatable_group
  locked?: boolean;
  hint?: string;
}

export interface Part {
  id: string;
  title: string;
  field_ids: string[];
}

const LOCK_PREFIX = "__locked__";

export const AGENT_SIGNUP_LOCKED_FIELDS: Field[] = [
  { id: `${LOCK_PREFIX}agent_name`, type: "text", label: "Agent / company name", required: true, locked: true },
  { id: `${LOCK_PREFIX}website`, type: "text", label: "Website", locked: true },
  { id: `${LOCK_PREFIX}hq_country`, type: "text", label: "Headquarters country", required: true, locked: true },
  { id: `${LOCK_PREFIX}countries_of_operation`, type: "textarea", label: "Countries of operation (comma separated)", locked: true },
  { id: `${LOCK_PREFIX}contact_person`, type: "text", label: "Primary contact person", required: true, locked: true },
  { id: `${LOCK_PREFIX}contact_email`, type: "email", label: "Primary contact email", required: true, locked: true },
  { id: `${LOCK_PREFIX}contact_phone`, type: "phone", label: "Primary contact phone", locked: true },
  { id: `${LOCK_PREFIX}notes`, type: "textarea", label: "About the agent", locked: true },
  { id: `${LOCK_PREFIX}num_branches`, type: "number", label: "Number of branches", required: true, locked: true, hint: "How many branch offices does the agent operate?" },
  {
    id: `${LOCK_PREFIX}references`,
    type: "repeatable_group",
    label: "References",
    required: true,
    locked: true,
    min: 2,
    hint: "Add at least two referees who can vouch for this agent.",
    subfields: [
      { id: "ref_name", label: "Referee name", type: "text", required: true },
      { id: "ref_email", label: "Referee email", type: "email", required: true },
      { id: "ref_institution", label: "Institution", type: "text", required: true },
      { id: "ref_role", label: "Role / position", type: "text" },
    ],
  },
  { id: `${LOCK_PREFIX}british_council`, type: "file", label: "British Council certificate(s)", required: true, locked: true, multiple: true, min: 1 },
  { id: `${LOCK_PREFIX}company_registration`, type: "file", label: "Company registration & mandatory documents", required: true, locked: true, multiple: true, min: 1 },
  {
    id: `${LOCK_PREFIX}supporting_docs`,
    type: "repeatable_group",
    label: "Supporting documents",
    locked: true,
    min: 0,
    subfields: [
      { id: "doc_title", label: "Document title", type: "text", required: true },
      { id: "doc_file", label: "File", type: "file", required: true },
    ],
  },
];

export const AGENT_SIGNUP_LOCKED_PART: Part = {
  id: `${LOCK_PREFIX}part`,
  title: "Required agent details",
  field_ids: AGENT_SIGNUP_LOCKED_FIELDS.map((f) => f.id),
};

export const REFERENCE_REQUEST_DEFAULT_FIELDS: Field[] = [
  { id: `${LOCK_PREFIX}ref_agent_name`, type: "text", label: "Agent being referenced", locked: true, required: true },
  { id: `${LOCK_PREFIX}ref_comments`, type: "textarea", label: "Your comments about this agent", locked: true, required: true },
  { id: `${LOCK_PREFIX}ref_rating`, type: "rating", label: "Overall rating", locked: true, required: true },
  { id: `${LOCK_PREFIX}ref_recommend`, type: "checkbox", label: "I would recommend working with this agent", locked: true },
];

export const REFERENCE_REQUEST_DEFAULT_PART: Part = {
  id: `${LOCK_PREFIX}ref_part`,
  title: "Reference details",
  field_ids: REFERENCE_REQUEST_DEFAULT_FIELDS.map((f) => f.id),
};

export const AGENT_BRANCH_DEFAULT_FIELDS: Field[] = [
  { id: `${LOCK_PREFIX}branch_name`, type: "text", label: "Branch name", locked: true, required: true },
  { id: `${LOCK_PREFIX}branch_country`, type: "text", label: "Country", locked: true, required: true },
  { id: `${LOCK_PREFIX}branch_city`, type: "text", label: "City", locked: true, required: true },
  { id: `${LOCK_PREFIX}branch_address`, type: "textarea", label: "Address", locked: true },
  { id: `${LOCK_PREFIX}branch_contact`, type: "text", label: "Branch contact person", locked: true },
  { id: `${LOCK_PREFIX}branch_email`, type: "email", label: "Branch email", locked: true },
  { id: `${LOCK_PREFIX}branch_phone`, type: "phone", label: "Branch phone", locked: true },
];

export const AGENT_BRANCH_DEFAULT_PART: Part = {
  id: `${LOCK_PREFIX}branch_part`,
  title: "Branch details",
  field_ids: AGENT_BRANCH_DEFAULT_FIELDS.map((f) => f.id),
};

export function lockedFor(formType: string): { fields: Field[]; part: Part } | null {
  if (formType === "agent_signup") return { fields: AGENT_SIGNUP_LOCKED_FIELDS, part: AGENT_SIGNUP_LOCKED_PART };
  if (formType === "reference_request") return { fields: REFERENCE_REQUEST_DEFAULT_FIELDS, part: REFERENCE_REQUEST_DEFAULT_PART };
  if (formType === "agent_branch") return { fields: AGENT_BRANCH_DEFAULT_FIELDS, part: AGENT_BRANCH_DEFAULT_PART };
  return null;
}

export function isLockedId(id: string) {
  return id.startsWith(LOCK_PREFIX);
}
