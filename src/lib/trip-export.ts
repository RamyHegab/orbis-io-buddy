import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import { ACTIVITY_TYPE_LABELS } from "@/lib/format";

type Trip = { title: string; start_date: string; end_date: string };
type Activity = {
  day_date: string; type: string; title: string;
  start_time: string | null; end_time: string | null;
  location: string | null;
  agents?: { trading_name?: string } | null;
  schools?: { name?: string } | null;
  agent_branches?: { branch_name?: string } | null;
};
type Hotel = {
  name: string;
  map_url?: string | null;
  address?: string | null;
  check_in_date: string;
  check_out_date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  cost?: number | string | null;
  cost_currency?: string | null;
  notes?: string | null;
};

function buildDays(trip: Trip, activities: Activity[], hotels: Hotel[]) {
  const start = parseISO(trip.start_date);
  const n = differenceInDays(parseISO(trip.end_date), start) + 1;
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(start, i);
    const key = format(d, "yyyy-MM-dd");
    const stay = hotels.find((h) => key >= h.check_in_date && key <= h.check_out_date) ?? null;
    return { date: d, key, acts: activities.filter((a) => a.day_date === key), stay };
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

function hotelDayLabel(stay: Hotel, dayKey: string): string {
  if (dayKey === stay.check_in_date) {
    return `Check-in${stay.check_in_time ? ` ${stay.check_in_time.slice(0, 5)}` : ""}`;
  }
  if (dayKey === stay.check_out_date) {
    return `Check-out${stay.check_out_time ? ` ${stay.check_out_time.slice(0, 5)}` : ""}`;
  }
  return "Staying overnight";
}

function hotelCost(h: Hotel): string {
  if (h.cost == null || h.cost === "") return "";
  return `${h.cost_currency || "GBP"} ${Number(h.cost).toFixed(2)}`;
}

function hotelTotals(hotels: Hotel[]) {
  if (hotels.length === 0) return null;
  let totalNights = 0;
  const byCurrency: Record<string, number> = {};
  let earliest = hotels[0].check_in_date;
  let latest = hotels[0].check_out_date;
  for (const h of hotels) {
    const nights = Math.max(1, Math.round((parseISO(h.check_out_date).getTime() - parseISO(h.check_in_date).getTime()) / 86400000));
    totalNights += nights;
    if (h.cost != null && h.cost !== "") {
      const cur = h.cost_currency || "GBP";
      byCurrency[cur] = (byCurrency[cur] ?? 0) + Number(h.cost);
    }
    if (h.check_in_date < earliest) earliest = h.check_in_date;
    if (h.check_out_date > latest) latest = h.check_out_date;
  }
  const costStr = Object.entries(byCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ") || "—";
  const range = `${format(parseISO(earliest), "d MMM yyyy")} → ${format(parseISO(latest), "d MMM yyyy")}`;
  return { totalNights, costStr, range, count: hotels.length };
}


export function exportTripPdf(trip: Trip, activities: Activity[], hotels: Hotel[] = []) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(trip.title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${format(parseISO(trip.start_date), "d MMM yyyy")} → ${format(parseISO(trip.end_date), "d MMM yyyy")}`, 14, 25);
  doc.setTextColor(0);

  let y = 32;

  if (hotels.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Accommodation", 14, y);
    autoTable(doc, {
      startY: y + 2,
      head: [["Hotel", "Check-in", "Check-out", "Nights", "Cost", "Map / Address"]],
      body: hotels.map((h) => {
        const nights = Math.max(1, Math.round((parseISO(h.check_out_date).getTime() - parseISO(h.check_in_date).getTime()) / 86400000));
        return [
          h.name,
          `${h.check_in_date}${h.check_in_time ? ` ${h.check_in_time.slice(0, 5)}` : ""}`,
          `${h.check_out_date}${h.check_out_time ? ` ${h.check_out_time.slice(0, 5)}` : ""}`,
          String(nights),
          hotelCost(h) || "—",
          h.map_url || h.address || "—",
        ];
      }),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: 30 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  for (const day of buildDays(trip, activities, hotels)) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(format(day.date, "EEEE, d MMMM yyyy"), 14, y);
    y += 4;
    if (day.stay) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(`Hotel: ${day.stay.name} — ${hotelDayLabel(day.stay, day.key)}`, 14, y + 4);
      doc.setTextColor(0);
      y += 8;
    }
    if (day.acts.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text(day.stay ? "No other activities" : "No activities", 14, y + 4);
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
    y = (doc as any).lastAutoTable.finalY + 6;
  }
  doc.save(`${trip.title.replace(/[^\w\s-]/g, "")}.pdf`);
}

export function exportTripWord(trip: Trip, activities: Activity[], hotels: Hotel[] = []) {
  const days = buildDays(trip, activities, hotels);

  const hotelsTable = hotels.length === 0 ? "" : `
    <h2>Accommodation</h2>
    <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;margin-bottom:16px">
      <tr style="background:#f0f0f0">
        <th align="left">Hotel</th><th align="left">Check-in</th><th align="left">Check-out</th>
        <th align="left">Nights</th><th align="left">Cost</th><th align="left">Map / Address</th>
      </tr>
      ${hotels.map((h) => {
        const nights = Math.max(1, Math.round((parseISO(h.check_out_date).getTime() - parseISO(h.check_in_date).getTime()) / 86400000));
        const mapCell = h.map_url
          ? `<a href="${esc(h.map_url)}">${esc(h.map_url)}</a>`
          : esc(h.address ?? "—");
        const nameCell = h.map_url
          ? `<a href="${esc(h.map_url)}">${esc(h.name)}</a>`
          : esc(h.name);
        return `<tr>
          <td>${nameCell}</td>
          <td>${esc(h.check_in_date)}${h.check_in_time ? ` ${esc(h.check_in_time.slice(0, 5))}` : ""}</td>
          <td>${esc(h.check_out_date)}${h.check_out_time ? ` ${esc(h.check_out_time.slice(0, 5))}` : ""}</td>
          <td>${nights}</td>
          <td>${esc(hotelCost(h) || "—")}</td>
          <td>${mapCell}</td>
        </tr>`;
      }).join("")}
    </table>`;

  const rows = days.map((day) => {
    const stayLine = day.stay
      ? `<p style="color:#555;margin:4px 0 8px 0"><strong>Hotel:</strong> ${day.stay.map_url
          ? `<a href="${esc(day.stay.map_url)}">${esc(day.stay.name)}</a>`
          : esc(day.stay.name)} — ${esc(hotelDayLabel(day.stay, day.key))}</p>`
      : "";
    const acts = day.acts.length === 0
      ? `<p style="color:#888;font-style:italic;margin:4px 0 12px 0">${day.stay ? "No other activities" : "No activities"}</p>`
      : `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;margin-bottom:12px">
          <tr style="background:#f0f0f0"><th align="left">Time</th><th align="left">Activity</th><th align="left">Details</th></tr>
          ${day.acts.map((a) => {
            const [t, title, det] = activityRow(a);
            return `<tr><td>${esc(t)}</td><td>${esc(title)}</td><td>${esc(det)}</td></tr>`;
          }).join("")}
        </table>`;
    return `<h3>${format(day.date, "EEEE, d MMMM yyyy")}</h3>${stayLine}${acts}`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(trip.title)}</title></head>
    <body style="font-family:Calibri,Arial,sans-serif">
      <h1>${esc(trip.title)}</h1>
      <p style="color:#666">${format(parseISO(trip.start_date), "d MMM yyyy")} → ${format(parseISO(trip.end_date), "d MMM yyyy")}</p>
      ${hotelsTable}
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
