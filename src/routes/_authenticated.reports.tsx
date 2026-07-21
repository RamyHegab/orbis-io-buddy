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
import { openPrintPreview, esc as escHtml } from "@/lib/print-preview";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { renderToStaticMarkup } from "react-dom/server";

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


  const onExportPdf = async () => {
    if (!report) return;
    // Render the AI markdown to HTML server-safe using ReactMarkdown, then
    // wrap in supporting-data tables and open the branded print-preview.
    const aiHtml = report.aiSummary
      ? renderToStaticMarkup(
          <div className="ai-summary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.aiSummary}</ReactMarkdown>
          </div>,
        )
      : `<p class="muted"><em>No AI summary available for this range.</em></p>`;

    const totalsTable = `
      <h2>Supporting data</h2>
      <table>
        <thead><tr><th>Metric</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>
          <tr><td>Trips</td><td style="text-align:right">${report.totals.trips}</td></tr>
          <tr><td>Recruitment events</td><td style="text-align:right">${report.totals.events}</td></tr>
          <tr><td>Agent visits</td><td style="text-align:right">${report.totals.agentVisits}</td></tr>
          <tr><td>School visits</td><td style="text-align:right">${report.totals.schoolVisits}</td></tr>
        </tbody>
      </table>`;

    const byCountryTable = report.byCountry.length
      ? `<h3>By country</h3><table><thead><tr>
          <th>Country</th><th>Trips</th><th>Events</th><th>Agent visits</th><th>School visits</th>
        </tr></thead><tbody>
        ${report.byCountry.map((r) => `<tr>
          <td>${escHtml(r.country)}</td><td>${r.trips}</td><td>${r.events}</td>
          <td>${r.agentVisits}</td><td>${r.schoolVisits}</td></tr>`).join("")}
        </tbody></table>`
      : "";

    const tripsTable = report.tripsList.length
      ? `<h3>Trips in range</h3><table><thead><tr><th>Trip</th><th>Dates</th><th>Destinations</th></tr></thead><tbody>
        ${report.tripsList.map((t) => `<tr>
          <td>${escHtml(t.title)}</td>
          <td>${escHtml(t.start_date)} → ${escHtml(t.end_date)}</td>
          <td>${escHtml(t.destinations.join(", "))}</td></tr>`).join("")}
        </tbody></table>`
      : "";

    await openPrintPreview({
      title: "Recruitment Report",
      subtitle: `${report.startDate} – ${report.endDate}`,
      bodyHtml: `<div class="ai-summary">${aiHtml}</div>${totalsTable}${byCountryTable}${tripsTable}`,
      extraCss: `.ai-summary h1 { font-size: 18px; } .ai-summary h2 { font-size: 15px; border: 0; } .ai-summary h3 { font-size: 12px; } .ai-summary p, .ai-summary li { font-size: 11.5px; }`,
    });
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
            <div>
              <Label className="text-xs">Countries</Label>
              <CountryMultiSelect
                options={countryOptions}
                value={countries}
                onChange={setCountries}
              />
            </div>
            <Button onClick={onGenerate} disabled={mutation.isPending} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate report
            </Button>
            {report && (
              <Button variant="outline" onClick={onExportPdf}>
                <Download className="h-4 w-4 mr-2" /> Print / Download
              </Button>
            )}
          </div>
          {countries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {countries.map((c) => (
                <Badge key={c} variant="secondary" className="gap-1">
                  {c}
                  <button
                    type="button"
                    onClick={() => setCountries(countries.filter((x) => x !== c))}
                    className="hover:text-destructive"
                    aria-label={`Remove ${c}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setCountries([])}>
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {report && <ReportView report={report} />}
    </PageContainer>
  );
}

function CountryMultiSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [query, options]);
  const toggle = (c: string) =>
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);

  const label =
    value.length === 0 ? "All countries" : value.length === 1 ? value[0] : `${value.length} countries`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-56 justify-between font-normal">
          <span className="flex items-center gap-2 truncate">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search country..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {filtered.length === 0 && (
            <div className="px-2 py-2 text-sm text-muted-foreground">No countries</div>
          )}
          {filtered.map((c) => {
            const selected = value.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded text-sm transition-colors ${
                  selected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
              >
                <span className="truncate">{c}</span>
                {selected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
        {value.length > 0 && (
          <div className="pt-2 mt-2 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => onChange([])}>
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
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
