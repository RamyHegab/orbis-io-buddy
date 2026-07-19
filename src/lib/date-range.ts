// Enforce that trip dates stay within ±12 months from today.
export function tripDateBounds(now: Date = new Date()) {
  const min = new Date(now);
  min.setMonth(min.getMonth() - 12);
  const max = new Date(now);
  max.setMonth(max.getMonth() + 12);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { min: iso(min), max: iso(max) };
}

export function assertTripDateInRange(date: string, label = "Date"): void {
  if (!date) return;
  const { min, max } = tripDateBounds();
  if (date < min || date > max) {
    throw new Error(`${label} must be within 12 months before or after today (${min} → ${max}).`);
  }
}
