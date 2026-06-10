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

export function exportTripPdf(trip: Trip, activities: Activity[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(trip.title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${format(parseISO(trip.start_date), "d MMM yyyy")} → ${format(parseISO(trip.end_date), "d MMM yyyy")}`, 14, 25);
  doc.setTextColor(0);

  let y = 32;
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
    y = (doc as any).lastAutoTable.finalY + 6;
  }
  doc.save(`${trip.title.replace(/[^\w\s-]/g, "")}.pdf`);
}

export function exportTripWord(trip: Trip, activities: Activity[]) {
  const days = buildDays(trip, activities);
  const rows = days.map((day) => {
    const acts = day.acts.length === 0
      ? `<p style="color:#888;font-style:italic;margin:4px 0 12px 0">No activities</p>`
      : `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;margin-bottom:12px">
          <tr style="background:#f0f0f0"><th align="left">Time</th><th align="left">Activity</th><th align="left">Details</th></tr>
          ${day.acts.map((a) => {
            const [t, title, det] = activityRow(a);
            return `<tr><td>${esc(t)}</td><td>${esc(title)}</td><td>${esc(det)}</td></tr>`;
          }).join("")}
        </table>`;
    return `<h3>${format(day.date, "EEEE, d MMMM yyyy")}</h3>${acts}`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(trip.title)}</title></head>
    <body style="font-family:Calibri,Arial,sans-serif">
      <h1>${esc(trip.title)}</h1>
      <p style="color:#666">${format(parseISO(trip.start_date), "d MMM yyyy")} → ${format(parseISO(trip.end_date), "d MMM yyyy")}</p>
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
