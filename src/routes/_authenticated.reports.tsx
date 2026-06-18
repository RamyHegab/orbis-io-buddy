import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Download, Sparkles, Globe, X, Search, Check } from "lucide-react";
import { generateAggregateReport, type AggregateReport } from "@/lib/aggregate-report.functions";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { renderMarkdownToPdf } from "@/lib/markdown-pdf";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Global Reporting — Orbis CRM" }] }),
  component: ReportsPage,
});

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function ReportsPage() {
  const init = defaultRange();
  const [startDate, setStartDate] = useState(init.start);
  const [endDate, setEndDate] = useState(init.end);
  const [countries, setCountries] = useState<string[]>([]);
  const [report, setReport] = useState<AggregateReport | null>(null);

  // Pull the union of countries from trips / agents / schools for the picker
  const { data: countryOptions = [] } = useQuery({
    queryKey: ["report-country-options"],
    queryFn: async () => {
      const [trips, agents, schools] = await Promise.all([
        supabase.from("trips").select("destinations"),
        supabase.from("agents").select("hq_country"),
        supabase.from("schools").select("country"),
      ]);
      const set = new Set<string>();
      for (const t of trips.data ?? []) for (const d of (t.destinations ?? []) as string[]) if (d) set.add(d);
      for (const a of agents.data ?? []) if (a.hq_country) set.add(a.hq_country);
      for (const s of schools.data ?? []) if (s.country) set.add(s.country);
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
  });

  const fn = useServerFn(generateAggregateReport);
  const mutation = useMutation({
    mutationFn: (vars: { startDate: string; endDate: string; countries?: string[] }) => fn({ data: vars }),
    onSuccess: (r) => { setReport(r); toast.success("Report generated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to generate report"),
  });

  const onGenerate = () => {
    if (startDate > endDate) { toast.error("Start date must be before end date"); return; }
    mutation.mutate({ startDate, endDate, countries: countries.length ? countries : undefined });
  };


  const onExportPdf = () => {
    if (!report) return;
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Title block — mirrors the on-screen Trip Report header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Recruitment Report", 14, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(`${report.startDate} – ${report.endDate}`, 14, 29);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, 34);
    doc.setTextColor(0);
    doc.setDrawColor(220);
    doc.line(14, 38, pageW - 14, 38);

    // AI summary rendered as formatted markdown — the same body the
    // itinerary planner's Trip Report shows on screen.
    let y = 44;
    if (report.aiSummary) {
      y = renderMarkdownToPdf(doc, report.aiSummary, { x: 14, y, width: pageW - 28, bottom: 280 });
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(140);
      doc.text("No AI summary available for this range.", 14, y);
      doc.setTextColor(0);
      y += 8;
    }

    // Supporting data tables on a fresh page
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Supporting data", 14, 20);

    autoTable(doc, {
      startY: 26,
      head: [["Metric", "Total"]],
      body: [
        ["Trips", String(report.totals.trips)],
        ["Recruitment events", String(report.totals.events)],
        ["Agent visits", String(report.totals.agentVisits)],
        ["School visits", String(report.totals.schoolVisits)],
      ],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 75] },
    });

    if (report.byCountry.length) {
      autoTable(doc, {
        head: [["Country", "Trips", "Events", "Agent visits", "School visits"]],
        body: report.byCountry.map((r) => [r.country, r.trips, r.events, r.agentVisits, r.schoolVisits]),
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 75] },
      });
    }

    if (report.tripsList.length) {
      autoTable(doc, {
        head: [["Trip", "Dates", "Destinations"]],
        body: report.tripsList.map((t) => [t.title, `${t.start_date} → ${t.end_date}`, t.destinations.join(", ")]),
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 75] },
      });
    }

    doc.save(`report_${report.startDate}_to_${report.endDate}.pdf`);
  };

  return (
    <PageContainer>
      <PageHeader title="Global Reporting" description="Aggregate trip activity and AI-summarised outcomes for any date range." />

      <Card className="mb-6 border-2 border-primary/80">
        <CardHeader>
          <CardTitle className="text-base">Create report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor="start" className="text-xs">Start date</Label>
              <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label htmlFor="end" className="text-xs">End date</Label>
              <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-44" />
            </div>
            <Button onClick={onGenerate} disabled={mutation.isPending} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate report
            </Button>
            {report && (
              <Button variant="outline" onClick={onExportPdf}>
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {report && <ReportView report={report} />}
    </PageContainer>
  );
}

function ReportView({ report }: { report: AggregateReport }) {
  const t = report.totals;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Trips", value: t.trips },
          { label: "Recruitment events", value: t.events },
          { label: "Agent visits", value: t.agentVisits },
          { label: "School visits", value: t.schoolVisits },
        ].map((s) => (
          <Card key={s.label} className="p-5 border-2 border-primary/80">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</div>
            <div className="text-3xl font-semibold text-primary mt-1">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="border-2 border-primary/80">
        <CardHeader><CardTitle className="text-base">By country</CardTitle></CardHeader>
        <CardContent>
          {report.byCountry.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="text-left px-3 py-2">Country</th>
                    <th className="text-right px-3 py-2">Trips</th>
                    <th className="text-right px-3 py-2">Events</th>
                    <th className="text-right px-3 py-2">Agent visits</th>
                    <th className="text-right px-3 py-2">School visits</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byCountry.map((r) => (
                    <tr key={r.country} className="border-b border-border">
                      <td className="px-3 py-2 font-medium">{r.country}</td>
                      <td className="px-3 py-2 text-right">{r.trips}</td>
                      <td className="px-3 py-2 text-right">{r.events}</td>
                      <td className="px-3 py-2 text-right">{r.agentVisits}</td>
                      <td className="px-3 py-2 text-right">{r.schoolVisits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/80">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Key take-aways (AI summary)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report.aiSummary ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{report.aiSummary}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">No AI summary available.</p>
          )}
        </CardContent>
      </Card>

      {report.tripsList.length > 0 && (
        <Card className="border-2 border-primary/80">
          <CardHeader><CardTitle className="text-base">Trips in range</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {report.tripsList.map((t) => (
                <li key={t.id} className="flex justify-between gap-4 border-b border-border pb-2">
                  <span className="font-medium">{t.title}</span>
                  <span className="text-muted-foreground">{t.start_date} → {t.end_date}</span>
                  <span className="text-muted-foreground truncate">{t.destinations.join(", ")}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
