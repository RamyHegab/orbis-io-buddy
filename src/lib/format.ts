import { format, parseISO } from "date-fns";

export function fmtDate(d: string | Date | null | undefined, pattern = "MMM d, yyyy") {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, pattern);
}

export function fmtTime(t: string | null | undefined) {
  if (!t) return "";
  return t.slice(0, 5);
}

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  travel: "Travel",
  agent_visit: "Agent Visit",
  school_visit: "School Visit",
  recruitment_event: "Recruitment Event",
  hotel: "Hotel",
  resting_day: "Resting Day",
  other: "Other",
};

export const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  travel: "bg-[var(--activity-travel)]/15 text-[var(--activity-travel)] border-[var(--activity-travel)]/30",
  agent_visit: "bg-[var(--activity-agent)]/15 text-[var(--activity-agent)] border-[var(--activity-agent)]/30",
  school_visit: "bg-[var(--activity-school)]/15 text-[var(--activity-school)] border-[var(--activity-school)]/30",
  recruitment_event: "bg-[var(--activity-event)]/15 text-[var(--activity-event)] border-[var(--activity-event)]/30",
  hotel: "bg-[var(--activity-other)]/15 text-[var(--activity-other)] border-[var(--activity-other)]/30",
  resting_day: "bg-[var(--activity-rest)]/15 text-[var(--activity-rest)] border-[var(--activity-rest)]/30",
  other: "bg-[var(--activity-other)]/15 text-[var(--activity-other)] border-[var(--activity-other)]/30",
};

export const ACTIVITY_DOT_COLORS: Record<string, string> = {
  travel: "bg-[var(--activity-travel)]",
  agent_visit: "bg-[var(--activity-agent)]",
  school_visit: "bg-[var(--activity-school)]",
  recruitment_event: "bg-[var(--activity-event)]",
  hotel: "bg-[var(--activity-other)]",
  resting_day: "bg-[var(--activity-rest)]",
  other: "bg-[var(--activity-other)]",
};
