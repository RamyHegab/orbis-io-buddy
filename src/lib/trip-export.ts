import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import { ACTIVITY_TYPE_LABELS } from "@/lib/format";
import { mapsSearchUrl } from "@/lib/google-maps";

type Trip = { title: string; start_date: string; end_date: string; objectives?: string | null };
type Activity = {
  id?: string;
  day_date: string; type: string; title: string;
  start_time: string | null; end_time: string | null;
  location: string | null;
  cost?: number | string | null;
  cost_currency?: string | null;
  agent_id?: string | null;
  school_id?: string | null;
  objectives?: string | null;
  visit_notes?: string | null;
  place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  formatted_address?: string | null;
  agents?: { trading_name?: string } | null;
  schools?: { name?: string; address?: string | null; place_id?: string | null; lat?: number | null; lng?: number | null; formatted_address?: string | null } | null;
  agent_branches?: { branch_name?: string; address?: string | null; place_id?: string | null; lat?: number | null; lng?: number | null; formatted_address?: string | null } | null;
};
type Hotel = {
  check_in_date: string;
  check_out_date: string;
  cost?: number | string | null;
  cost_currency?: string | null;
};

function origin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
function agentUrl(id: string) { return `${origin()}/agents/${id}`; }
function schoolUrl() { return `${origin()}/schools`; }

function activityMapUrl(a: Activity): string | null {
  return mapsSearchUrl({
    query: a.formatted_address || a.location || a.agent_branches?.address || a.schools?.address || null,
    placeId: a.place_id ?? a.agent_branches?.place_id ?? a.schools?.place_id ?? null,
    lat: a.lat ?? a.agent_branches?.lat ?? a.schools?.lat ?? null,
    lng: a.lng ?? a.agent_branches?.lng ?? a.schools?.lng ?? null,
  });
}

function buildDays(trip: Trip, activities: Activity[]) {
  const start = parseISO(trip.start_date);
  const n = differenceInDays(parseISO(trip.end_date), start) + 1;
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(start, i);
    const key = format(d, "yyyy-MM-dd");
    return { date: d, key, acts: activities.filter((a) => a.day_date === key) };
  });
}

function activityRow(a: Activity) {
  const time = [a.start_time?.slice(0, 5), a.end_time?.slice(0, 5)].filter(Boolean).join(" - ") || "—";
  const detail = [
    ACTIVITY_TYPE_LABELS[a.type as keyof typeof ACTIVITY_TYPE_LABELS] ?? a.type,
    a.agents?.trading_name, a.schools?.name, a.agent_branches?.branch_name, a.location,
  ].filter(Boolean).join(" • ");
  return [time, a.title, detail];
}

function computeCostTotals(activities: Activity[], hotels: Hotel[]) {
  const fmt = (m: Record<string, number>) =>
    Object.entries(m).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ") || "—";
  const travel: Record<string, number> = {};
  const events: Record<string, number> = {};
  const hotelTot: Record<string, number> = {};
  const total: Record<string, number> = {};
  const bump = (m: Record<string, number>, cur: string, amt: number) => { m[cur] = (m[cur] ?? 0) + amt; };
  for (const a of activities) {
    if (a.cost == null || a.cost === "") continue;
    const cur = a.cost_currency || "GBP";
    const amt = Number(a.cost);
    bump(total, cur, amt);
    if (a.type === "travel") bump(travel, cur, amt);
    else if (a.type === "recruitment_event") bump(events, cur, amt);
  }
  for (const h of hotels) {
    if (h.cost == null || h.cost === "") continue;
    const cur = h.cost_currency || "GBP";
    const amt = Number(h.cost);
    bump(total, cur, amt);
    bump(hotelTot, cur, amt);
  }
  return { travel: fmt(travel), events: fmt(events), hotel: fmt(hotelTot), total: fmt(total) };
}

export function buildTripPdf(trip: Trip, activities: Activity[], hotels: Hotel[] = [], opts?: { origin?: string }) {
  const linkOrigin = opts?.origin ?? origin();
  const agentLink = (id: string) => `${linkOrigin}/agents/${id}`;
  const schoolLink = () => `${linkOrigin}/schools`;

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(trip.title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${format(parseISO(trip.start_date), "d MMM yyyy")} → ${format(parseISO(trip.end_date), "d MMM yyyy")}`, 14, 25);
  doc.setTextColor(0);

  let y = 32;

  if (trip.objectives) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Trip objectives", 14, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(trip.objectives, 180);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 4;
  }

  const totals = computeCostTotals(activities, hotels);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Cost summary", 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [["Travel", "Hotels", "Events", "Total"]],
    body: [[totals.travel, totals.hotel, totals.events, totals.total]],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: 30 },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  for (const day of buildDays(trip, activities)) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(format(day.date, "EEEE, d MMMM yyyy"), 14, y);
    y += 4;
    if (day.acts.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text("No activities", 14, y + 4);
      doc.setTextColor(0);
      y += 10;
      continue;
    }
    autoTable(doc, {
      startY: y + 2,
      head: [["Time", "Activity", "Details"]],
      body: day.acts.map(activityRow),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: 30 },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 60 } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    for (const a of day.acts) {
      const links: Array<{ label: string; url: string }> = [];
      if (a.agent_id) {
        const name = a.agent_branches?.branch_name ?? a.agents?.trading_name ?? "Agent";
        links.push({ label: `Agent: ${name}`, url: agentLink(a.agent_id) });
      }
      if (a.school_id && a.schools?.name) {
        links.push({ label: `School: ${a.schools.name}`, url: schoolLink() });
      }
      const mapUrl = activityMapUrl(a);
      if (mapUrl) {
        const addr = a.formatted_address || a.location || a.agent_branches?.address || a.schools?.address || "View on Google Maps";
        links.push({ label: `📍 ${addr}`, url: mapUrl });
      }
      const hasExtra = links.length || a.objectives || a.visit_notes;
      if (!hasExtra) continue;
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(a.title, 14, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      for (const l of links) {
        doc.setTextColor(20, 80, 200);
        doc.textWithLink(l.label, 14, y, { url: l.url });
        y += 4;
      }
      doc.setTextColor(0);
      const writeBlock = (label: string, text: string) => {
        const lines = doc.splitTextToSize(`${label}: ${text}`, 180);
        if (y + lines.length * 4 > 280) { doc.addPage(); y = 20; }
        doc.text(lines, 14, y);
        y += lines.length * 4;
      };
      if (a.objectives) writeBlock("Objectives", a.objectives);
      if (a.visit_notes) writeBlock("Notes during visit", a.visit_notes);
      y += 2;
    }
    y += 2;
  }
  return doc;
}

export function tripPdfFilename(trip: Trip): string {
  return `${trip.title.replace(/[^\w\s-]/g, "")}.pdf`;
}

export function buildTripPdfBytes(trip: Trip, activities: Activity[], hotels: Hotel[] = [], opts?: { origin?: string }): Uint8Array {
  const doc = buildTripPdf(trip, activities, hotels, opts);
  return new Uint8Array(doc.output("arraybuffer"));
}

export function exportTripPdf(trip: Trip, activities: Activity[], hotels: Hotel[] = []) {
  const doc = buildTripPdf(trip, activities, hotels);
  doc.save(tripPdfFilename(trip));
}

export function exportTripWord(trip: Trip, activities: Activity[], hotels: Hotel[] = []) {
  const days = buildDays(trip, activities);
  const totals = computeCostTotals(activities, hotels);

  const costTable = `
    <h2>Cost summary</h2>
    <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;margin-bottom:16px">
      <tr style="background:#f0f0f0">
        <th align="left">Travel</th><th align="left">Hotels</th><th align="left">Events</th><th align="left">Total</th>
      </tr>
      <tr>
        <td>${esc(totals.travel)}</td>
        <td>${esc(totals.hotel)}</td>
        <td>${esc(totals.events)}</td>
        <td><strong>${esc(totals.total)}</strong></td>
      </tr>
    </table>`;

  const rows = days.map((day) => {
    const acts = day.acts.length === 0
      ? `<p style="color:#888;font-style:italic;margin:4px 0 12px 0">No activities</p>`
      : `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;margin-bottom:8px">
          <tr style="background:#f0f0f0"><th align="left">Time</th><th align="left">Activity</th><th align="left">Details</th></tr>
          ${day.acts.map((a) => {
            const [t, title, det] = activityRow(a);
            return `<tr><td>${esc(t)}</td><td>${esc(title)}</td><td>${esc(det)}</td></tr>`;
          }).join("")}
        </table>`;
    const refs = day.acts.map((a) => {
      const items: string[] = [];
      if (a.agent_id) {
        const name = a.agent_branches?.branch_name ?? a.agents?.trading_name ?? "Agent";
        items.push(`<a href="${esc(agentUrl(a.agent_id))}">Agent: ${esc(name)}</a>`);
      }
      if (a.school_id && a.schools?.name) {
        items.push(`<a href="${esc(schoolUrl())}">School: ${esc(a.schools.name)}</a>`);
      }
      const mapUrl = activityMapUrl(a);
      if (mapUrl) {
        const addr = a.formatted_address || a.location || a.agent_branches?.address || a.schools?.address || "View on Google Maps";
        items.push(`<a href="${esc(mapUrl)}">📍 ${esc(addr)}</a>`);
      }
      const linkLine = items.length
        ? `<div style="margin:2px 0 4px 0;font-size:12px">${items.join(" &nbsp; · &nbsp; ")}</div>`
        : "";
      const obj = a.objectives
        ? `<div style="margin:2px 0;font-size:12px"><strong>Objectives:</strong> ${esc(a.objectives)}</div>` : "";
      const vis = a.visit_notes
        ? `<div style="margin:2px 0 8px 0;font-size:12px"><strong>Notes during visit:</strong> ${esc(a.visit_notes)}</div>` : "";
      if (!linkLine && !obj && !vis) return "";
      return `<div style="margin-bottom:6px"><div style="font-weight:600;font-size:12px">${esc(a.title)}</div>${linkLine}${obj}${vis}</div>`;
    }).join("");
    return `<h3>${format(day.date, "EEEE, d MMMM yyyy")}</h3>${acts}${refs}`;
  }).join("");

  const objectivesBlock = trip.objectives
    ? `<h2>Trip objectives</h2><p style="white-space:pre-wrap">${esc(trip.objectives)}</p>` : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(trip.title)}</title></head>
    <body style="font-family:Calibri,Arial,sans-serif">
      <h1>${esc(trip.title)}</h1>
      <p style="color:#666">${format(parseISO(trip.start_date), "d MMM yyyy")} → ${format(parseISO(trip.end_date), "d MMM yyyy")}</p>
      ${objectivesBlock}
      ${costTable}
      ${rows}
    </body></html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${trip.title.replace(/[^\w\s-]/g, "")}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
