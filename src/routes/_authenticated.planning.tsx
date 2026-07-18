import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useCapabilities } from "@/hooks/use-auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Calendar as CalendarIcon, LayoutList, ListChecks, Edit2, ArrowRight, Check, X } from "lucide-react";
import { toast } from "sonner";
import { COUNTRIES } from "@/lib/countries";
import { countryFlag } from "@/lib/country-flags";
import { fmtDate } from "@/lib/format";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWithinInterval } from "date-fns";
import { Link, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/planning")({
  head: () => ({ meta: [{ title: "Planning — Orbis CRM" }] }),
  component: PlanningPage,
});

// ---------- Types ----------
type PlannedActivity = {
  id: string; user_id: string; title: string;
  start_date: string; end_date: string;
  countries: string[]; event_ids: string[]; event_types: string[];
  traveller_id: string | null; academic_support: "required" | "preferred" | "not_required";
  events_cost: number | null; travel_cost: number | null; hotel_cost: number | null; subsistence_cost: number | null;
  actual_events_cost: number | null; actual_travel_cost: number | null; actual_hotel_cost: number | null; actual_subsistence_cost: number | null;
  status: "proposed" | "planning" | "confirmed" | "done";
  objectives: string | null; notes: string | null; trip_id: string | null;
};
type EventCatalog = {
  id: string; title: string; start_date: string; end_date: string;
  countries: string[]; cities: string[]; cost: number | null; currency: string;
  status: "proposed" | "planning" | "confirmed" | "done";
  traveller_id: string | null; notes: string | null;
};

const EVENT_TYPES = [
  { value: "agents_visits", label: "Agents visits" },
  { value: "school_visits", label: "School visits" },
  { value: "recruitment_events", label: "Recruitment events" },
  { value: "other", label: "Other" },
];
const STATUSES = ["proposed", "planning", "confirmed", "done"] as const;
const STATUS_COLORS: Record<string, string> = {
  proposed: "bg-slate-500", planning: "bg-blue-500", confirmed: "bg-gold", done: "bg-green-600",
};
const ACADEMIC_SUPPORT_LABEL: Record<PlannedActivity["academic_support"], string> = {
  required: "Required", preferred: "Preferred", not_required: "Not Required",
};

const sum = (...xs: (number | null | undefined)[]) => xs.reduce<number>((a, x) => a + (Number(x) || 0), 0);

// ---------- Component ----------
function PlanningPage() {
  const { user } = useAuth();
  const { caps } = useCapabilities();
  const canManageEvents = caps.can_manage_templates;
  const [tab, setTab] = useState("timeline");

  return (
    <PageContainer>
      <PageHeader
        title="Yearly Activities Timeline"
        description="Plan your recruitment cycle: activities, events, costs and travellers."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="timeline"><LayoutList className="h-4 w-4 mr-1" /> Timeline</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarIcon className="h-4 w-4 mr-1" /> Calendar</TabsTrigger>
          <TabsTrigger value="events"><ListChecks className="h-4 w-4 mr-1" /> Events catalog</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="pt-4"><TimelineView userId={user?.id} /></TabsContent>
        <TabsContent value="calendar" className="pt-4"><CalendarView userId={user?.id} /></TabsContent>
        <TabsContent value="events" className="pt-4"><EventsCatalogView canManage={!!canManageEvents} /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

// ---------- Shared: multi-select popover ----------
function MultiSelect({ options, values, onChange, placeholder }: {
  options: { value: string; label: string }[]; values: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal">
          {values.length === 0 ? <span className="text-muted-foreground">{placeholder}</span> :
            <span className="truncate">{values.length} selected</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2 bg-popover">
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2 h-8" />
        <div className="max-h-64 overflow-y-auto space-y-1">
          {filtered.map((o) => (
            <button key={o.value} type="button" onClick={() => toggle(o.value)}
              className="w-full flex items-center gap-2 text-sm px-2 py-1.5 hover:bg-muted rounded">
              <div className={`h-4 w-4 border rounded flex items-center justify-center ${values.includes(o.value) ? "bg-primary border-primary" : ""}`}>
                {values.includes(o.value) && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <span className="text-left flex-1">{o.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------- Activity dialog ----------
function ActivityDialog({ activity, onClose, userId }: { activity: PlannedActivity | null; onClose: () => void; userId?: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<PlannedActivity>>(activity ?? {
    title: "", start_date: "", end_date: "", countries: [], event_ids: [], event_types: [],
    traveller_id: userId ?? null, academic_support: "not_required",
    events_cost: 0, travel_cost: 0, hotel_cost: 0, subsistence_cost: 0, status: "proposed",
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events_catalog_min"],
    queryFn: async () => {
      const { data } = await supabase.from("events_catalog").select("id,title,cost,start_date").order("start_date");
      return (data ?? []) as { id: string; title: string; cost: number | null; start_date: string }[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_pickable"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  // auto-sum events cost when event_ids change (unless user overrode)
  const autoEventsCost = useMemo(() => {
    return (form.event_ids ?? []).reduce((a, id) => {
      const e = events.find((x) => x.id === id);
      return a + (Number(e?.cost) || 0);
    }, 0);
  }, [form.event_ids, events]);

  const total = sum(form.events_cost, form.travel_cost, form.hotel_cost, form.subsistence_cost);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      if (!form.title || !form.start_date || !form.end_date) throw new Error("Title and dates are required");
      if (!form.objectives?.trim()) {
        if (!window.confirm("No objectives set. Save anyway?")) throw new Error("__cancelled__");
      }
      const payload: any = {
        title: form.title, start_date: form.start_date, end_date: form.end_date,
        countries: form.countries ?? [], event_ids: form.event_ids ?? [], event_types: form.event_types ?? [],
        traveller_id: form.traveller_id ?? userId, academic_support: form.academic_support ?? "not_required",
        events_cost: form.events_cost ?? 0, travel_cost: form.travel_cost ?? 0,
        hotel_cost: form.hotel_cost ?? 0, subsistence_cost: form.subsistence_cost ?? 0,
        status: form.status ?? "proposed", objectives: form.objectives ?? null, notes: form.notes ?? null,
      };
      if (activity) {
        const { error } = await supabase.from("planned_activities").update(payload).eq("id", activity.id);
        if (error) throw error;
      } else {
        payload.user_id = userId;
        const { error } = await supabase.from("planned_activities").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(activity ? "Activity updated" : "Activity added"); qc.invalidateQueries({ queryKey: ["planned_activities"] }); onClose(); },
    onError: (e: any) => { if (e.message !== "__cancelled__") toast.error(e.message); },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{activity ? "Edit activity" : "New activity"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title (countries)</Label>
            <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Vietnam agent tour" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start date</Label><Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>End date</Label><Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div>
            <Label>Countries</Label>
            <MultiSelect options={COUNTRIES.map((c) => ({ value: c, label: c }))} values={form.countries ?? []}
              onChange={(v) => setForm({ ...form, countries: v })} placeholder="Select countries" />
          </div>
          <div>
            <Label>Events</Label>
            <MultiSelect options={events.map((e) => ({ value: e.id, label: `${e.title} (${e.start_date?.slice(0, 7) ?? ""})` }))}
              values={form.event_ids ?? []}
              onChange={(v) => setForm({ ...form, event_ids: v, events_cost: v.reduce((a, id) => a + (Number(events.find((x) => x.id === id)?.cost) || 0), 0) })}
              placeholder="Select events" />
            {form.event_ids && form.event_ids.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Auto-summed events cost: {autoEventsCost.toLocaleString()} (editable below)</p>
            )}
          </div>
          <div>
            <Label>Event types</Label>
            <MultiSelect options={EVENT_TYPES} values={form.event_types ?? []}
              onChange={(v) => setForm({ ...form, event_types: v })} placeholder="Select event types" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Traveller</Label>
              <Select value={form.traveller_id ?? userId ?? ""} onValueChange={(v) => setForm({ ...form, traveller_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select traveller" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Academic support</Label>
              <Select value={form.academic_support ?? "not_required"} onValueChange={(v: any) => setForm({ ...form, academic_support: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="preferred">Preferred</SelectItem>
                  <SelectItem value="not_required">Not required</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["events_cost", "travel_cost", "hotel_cost", "subsistence_cost"] as const).map((k) => (
              <div key={k}>
                <Label className="capitalize">{k.replace("_", " ")}</Label>
                <Input type="number" step="0.01" value={form[k] ?? 0} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
          <div className="rounded-md bg-muted/40 p-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Total cost</span>
            <span className="font-semibold">{total.toLocaleString()}</span>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status ?? "proposed"} onValueChange={(v: any) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Objectives</Label><Textarea rows={2} value={form.objectives ?? ""} onChange={(e) => setForm({ ...form, objectives: e.target.value })} /></div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Timeline view ----------
function TimelineView({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [editing, setEditing] = useState<PlannedActivity | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: activities = [] } = useQuery<PlannedActivity[]>({
    queryKey: ["planned_activities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("planned_activities").select("*").order("start_date");
      if (error) throw error;
      return (data ?? []) as PlannedActivity[];
    },
  });

  const { data: eventsCatalog = [] } = useQuery({
    queryKey: ["events_catalog_stats"],
    queryFn: async () => {
      const { data } = await supabase.from("events_catalog").select("id, cost, countries");
      return (data ?? []) as { id: string; cost: number | null; countries: string[] }[];
    },
  });

  const filtered = activities.filter((a) => statusFilter === "all" || a.status === statusFilter);

  const stats = useMemo(() => {
    const eventById = new Map(eventsCatalog.map((e) => [e.id, e]));
    const perCountry = new Map<string, { visits: number; events: number; cost: number }>();
    const bump = (c: string) => {
      if (!perCountry.has(c)) perCountry.set(c, { visits: 0, events: 0, cost: 0 });
      return perCountry.get(c)!;
    };
    const uniqueEventIds = new Set<string>();
    let totalBudget = 0;
    for (const a of activities) {
      const countries = a.countries ?? [];
      const n = countries.length || 1;
      const other = sum(a.travel_cost, a.hotel_cost, a.subsistence_cost);
      const otherPer = other / n;
      // events cost attributed by event's own countries
      const perCountryEventCost = new Map<string, number>();
      const perCountryEventCount = new Map<string, number>();
      for (const eid of a.event_ids ?? []) {
        uniqueEventIds.add(eid);
        const ev = eventById.get(eid);
        const ecountries = ev?.countries?.length ? ev.countries : countries;
        const split = ecountries.length || 1;
        for (const c of ecountries) {
          perCountryEventCost.set(c, (perCountryEventCost.get(c) || 0) + (Number(ev?.cost) || 0) / split);
          perCountryEventCount.set(c, (perCountryEventCount.get(c) || 0) + 1);
        }
      }
      // If activity has its own events_cost but no linked events, split across countries
      const hasLinkedEvents = (a.event_ids ?? []).length > 0;
      const flatEventsCost = hasLinkedEvents ? 0 : (Number(a.events_cost) || 0);
      const flatEventsPer = flatEventsCost / n;

      for (const c of countries) {
        const row = bump(c);
        row.visits += 1;
        row.events += perCountryEventCount.get(c) || 0;
        row.cost += otherPer + (perCountryEventCost.get(c) || 0) + flatEventsPer;
      }
      totalBudget += other + (hasLinkedEvents
        ? Array.from(perCountryEventCost.values()).reduce((s, x) => s + x, 0)
        : flatEventsCost);
    }
    const byCountry = Array.from(perCountry.entries())
      .map(([country, v]) => ({ country, ...v }))
      .sort((a, b) => b.cost - a.cost);
    return {
      trips: activities.length,
      events: uniqueEventIds.size,
      countries: perCountry.size,
      budget: totalBudget,
      byCountry,
    };
  }, [activities, eventsCatalog]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planned_activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["planned_activities"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const promoteToTrip = useMutation({
    mutationFn: async (a: PlannedActivity) => {
      if (!userId) throw new Error("Not signed in");
      const { data: trip, error } = await supabase.from("trips").insert({
        title: a.title, destinations: a.countries, start_date: a.start_date, end_date: a.end_date,
        user_id: userId, objectives: a.objectives,
      }).select("id").single();
      if (error) throw error;
      const rows = (a.countries.length ? a.countries : ["Unspecified"]).map((c, i) => ({
        trip_id: trip.id, user_id: userId, country: c, start_date: a.start_date, end_date: a.end_date, sort_order: i,
      }));
      await supabase.from("trip_countries").insert(rows);
      await supabase.from("planned_activities").update({ trip_id: trip.id }).eq("id", a.id);
      return trip.id as string;
    },
    onSuccess: (tripId) => {
      toast.success("Trip created — opening itinerary planner");
      qc.invalidateQueries({ queryKey: ["planned_activities"] });
      qc.invalidateQueries({ queryKey: ["trips"] });
      nav({ to: "/trips/$tripId", params: { tripId } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Top KPI tiles — colorful */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total trips", value: stats.trips.toLocaleString(),
            cls: "bg-gradient-to-br from-sky-500/15 to-sky-500/5 border-sky-500/40", accent: "text-sky-600 dark:text-sky-400" },
          { label: "Total events", value: stats.events.toLocaleString(),
            cls: "bg-gradient-to-br from-fuchsia-500/15 to-fuchsia-500/5 border-fuchsia-500/40", accent: "text-fuchsia-600 dark:text-fuchsia-400" },
          { label: "Countries", value: stats.countries.toLocaleString(),
            cls: "bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/40", accent: "text-emerald-600 dark:text-emerald-400" },
          { label: "Total budget", value: stats.budget.toLocaleString(undefined, { maximumFractionDigits: 0 }),
            cls: "bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-amber-500/40", accent: "text-amber-600 dark:text-amber-500" },
        ].map((k) => (
          <Card key={k.label} className={`p-4 border-2 ${k.cls}`}>
            <div className={`text-xs uppercase tracking-wider font-medium ${k.accent}`}>{k.label}</div>
            <div className={`text-4xl font-bold mt-1 ${k.accent}`}>{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Per-country smaller tiles */}
      {stats.byCountry.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {stats.byCountry.map((c) => {
            const flag = countryFlagUrl(c.country, 40);
            return (
              <Card key={c.country} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  {flag ? (
                    <img src={flag} alt="" width={20} height={14} className="rounded-sm shadow-sm shrink-0" />
                  ) : (
                    <span className="text-xl leading-none">🏳️</span>
                  )}
                  <span className="font-medium text-sm truncate">{c.country}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[11px]">
                  <div><div className="text-muted-foreground">Visits</div><div className="font-semibold">{c.visits}</div></div>
                  <div><div className="text-muted-foreground">Events</div><div className="font-semibold">{c.events}</div></div>
                  <div><div className="text-muted-foreground">Cost</div><div className="font-semibold">{c.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New activity
        </Button>
      </div>
      {filtered.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground text-sm">No activities yet — click "New activity" to plan one.</Card>
      )}
      {filtered.map((a) => {
        const total = sum(a.events_cost, a.travel_cost, a.hotel_cost, a.subsistence_cost);
        return (
          <Card key={a.id} className="p-4">
            <div className="flex items-start gap-4">
              <div className="text-center min-w-[70px] rounded-md bg-primary text-primary-foreground py-2">
                <div className="text-[10px] uppercase tracking-wider text-gold">{format(parseISO(a.start_date), "MMM")}</div>
                <div className="text-lg font-bold text-gold">{format(parseISO(a.start_date), "yyyy")}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(a.start_date)} → {fmtDate(a.end_date)}</div>
                  </div>
                  <Badge className={`${STATUS_COLORS[a.status]} text-white capitalize`}>{a.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {a.countries.map((c) => (<Badge key={c} variant="outline" className="border-primary/40 text-primary">{c}</Badge>))}
                  {a.event_types.map((t) => (
                    <Badge key={t} variant="outline" className="border-gold/50 text-gold-foreground bg-gold/10">
                      {EVENT_TYPES.find((x) => x.value === t)?.label ?? t}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-xs">Academic support: {ACADEMIC_SUPPORT_LABEL[a.academic_support]}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-xs">
                  <div><span className="text-muted-foreground">Events:</span> {Number(a.events_cost || 0).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Travel:</span> {Number(a.travel_cost || 0).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Hotel:</span> {Number(a.hotel_cost || 0).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Subsistence:</span> {Number(a.subsistence_cost || 0).toLocaleString()}</div>
                  <div className="font-semibold"><span className="text-muted-foreground font-normal">Total:</span> {total.toLocaleString()}</div>
                </div>
                {a.objectives && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{a.objectives}</p>}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(a); setDialogOpen(true); }}>
                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  {a.trip_id ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/trips/$tripId" params={{ tripId: a.trip_id }}>Open trip <ArrowRight className="h-3 w-3 ml-1" /></Link>
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => promoteToTrip.mutate(a)} disabled={promoteToTrip.isPending}>
                      Create trip <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                  {(a.status === "confirmed" || a.status === "done") && <ActualCostsButton activity={a} />}
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete activity?")) del.mutate(a.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
      {dialogOpen && <ActivityDialog activity={editing} userId={userId} onClose={() => setDialogOpen(false)} />}
    </div>
  );
}

// ---------- Actual costs mini-dialog ----------
function ActualCostsButton({ activity }: { activity: PlannedActivity }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState({
    actual_events_cost: activity.actual_events_cost ?? activity.events_cost ?? 0,
    actual_travel_cost: activity.actual_travel_cost ?? activity.travel_cost ?? 0,
    actual_hotel_cost: activity.actual_hotel_cost ?? activity.hotel_cost ?? 0,
    actual_subsistence_cost: activity.actual_subsistence_cost ?? activity.subsistence_cost ?? 0,
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("planned_activities").update(vals).eq("id", activity.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Actual costs saved"); qc.invalidateQueries({ queryKey: ["planned_activities"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Submit actual costs</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Actual costs — {activity.title}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(vals) as (keyof typeof vals)[]).map((k) => (
            <div key={k}>
              <Label className="capitalize">{k.replace("actual_", "").replace("_", " ")}</Label>
              <Input type="number" step="0.01" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Calendar view ----------
function CalendarView({ userId }: { userId?: string }) {
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const { data: activities = [] } = useQuery<PlannedActivity[]>({
    queryKey: ["planned_activities"],
    queryFn: async () => {
      const { data } = await supabase.from("planned_activities").select("*").order("start_date");
      return (data ?? []) as PlannedActivity[];
    },
  });
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startWeekday = startOfMonth(month).getDay();
  const [editing, setEditing] = useState<PlannedActivity | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setMonth(subMonths(month, 1))}>← Prev</Button>
        <div className="font-semibold text-lg">{format(month, "MMMM yyyy")}</div>
        <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, 1))}>Next →</Button>
        <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (<div key={d} className="p-1 text-center">{d}</div>))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startWeekday }).map((_, i) => (<div key={`b${i}`} />))}
        {days.map((d) => {
          const dayActs = activities.filter((a) =>
            isWithinInterval(d, { start: parseISO(a.start_date), end: parseISO(a.end_date) })
          );
          return (
            <div key={d.toISOString()} className="min-h-[90px] border border-border rounded p-1 text-xs">
              <div className="text-muted-foreground mb-1">{format(d, "d")}</div>
              <div className="space-y-0.5">
                {dayActs.slice(0, 3).map((a) => (
                  <button key={a.id} onClick={() => setEditing(a)}
                    className={`block w-full text-left truncate rounded px-1 py-0.5 text-white ${STATUS_COLORS[a.status]}`}>
                    {a.title}
                  </button>
                ))}
                {dayActs.length > 3 && <div className="text-muted-foreground">+{dayActs.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
      {editing && <ActivityDialog activity={editing} userId={userId} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ---------- Events catalog ----------
function EventsCatalogView({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EventCatalog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: events = [] } = useQuery<EventCatalog[]>({
    queryKey: ["events_catalog"],
    queryFn: async () => {
      const { data } = await supabase.from("events_catalog").select("*").order("start_date");
      return (data ?? []) as EventCatalog[];
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Event deleted"); qc.invalidateQueries({ queryKey: ["events_catalog"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New event</Button>
        </div>
      )}
      {events.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground text-sm">No events in the catalog yet.</Card>
      )}
      <div className="space-y-2">
        {events.map((e) => (
          <Card key={e.id} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium">{e.title}</div>
                <Badge className={`${STATUS_COLORS[e.status]} text-white capitalize text-[10px]`}>{e.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{fmtDate(e.start_date)} → {fmtDate(e.end_date)}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {e.countries.map((c) => (<Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>))}
                {e.cities.map((c) => (<Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>))}
              </div>
              {e.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{e.notes}</p>}
            </div>
            <div className="text-sm font-semibold">{e.cost != null ? `${e.currency} ${Number(e.cost).toLocaleString()}` : "—"}</div>
            {canManage && (
              <>
                <Button size="sm" variant="outline" onClick={() => { setEditing(e); setDialogOpen(true); }}><Edit2 className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete event?")) del.mutate(e.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </>
            )}
          </Card>
        ))}
      </div>
      {dialogOpen && <EventDialog event={editing} onClose={() => setDialogOpen(false)} />}
    </div>
  );
}

// ---------- Event catalog dialog ----------
function EventDialog({ event, onClose }: { event: EventCatalog | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<EventCatalog>>(event ?? {
    title: "", start_date: "", end_date: "", countries: [], cities: [], cost: 0, currency: "GBP",
    status: "proposed", traveller_id: null, notes: "",
  });
  const [newCity, setNewCity] = useState("");

  const { data: cities = [] } = useQuery({
    queryKey: ["event_cities"],
    queryFn: async () => {
      const { data } = await supabase.from("event_cities").select("country, city").order("city");
      return (data ?? []) as { country: string; city: string }[];
    },
  });

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    (form.countries ?? []).forEach((co) => cities.filter((r) => r.country === co).forEach((r) => set.add(r.city)));
    (form.cities ?? []).forEach((c) => set.add(c));
    return Array.from(set).sort();
  }, [cities, form.countries, form.cities]);

  const addNewCity = async () => {
    const c = newCity.trim();
    if (!c || !(form.countries ?? []).length) { toast.error("Pick a country first and type a city"); return; }
    for (const co of form.countries!) {
      await supabase.from("event_cities").insert({ country: co, city: c }).select();
    }
    setForm({ ...form, cities: [...(form.cities ?? []), c] });
    setNewCity("");
    qc.invalidateQueries({ queryKey: ["event_cities"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.start_date || !form.end_date) throw new Error("Title and dates required");
      const payload: any = {
        title: form.title, start_date: form.start_date, end_date: form.end_date,
        countries: form.countries ?? [], cities: form.cities ?? [], cost: form.cost ?? 0,
        currency: form.currency ?? "GBP", status: form.status ?? "proposed",
        traveller_id: form.traveller_id ?? null, notes: form.notes ?? null,
      };
      if (event) {
        const { error } = await supabase.from("events_catalog").update(payload).eq("id", event.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("events_catalog").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(event ? "Event updated" : "Event added"); qc.invalidateQueries({ queryKey: ["events_catalog"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start date</Label><Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>End date</Label><Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div>
            <Label>Countries</Label>
            <MultiSelect options={COUNTRIES.map((c) => ({ value: c, label: c }))} values={form.countries ?? []}
              onChange={(v) => setForm({ ...form, countries: v })} placeholder="Select countries" />
          </div>
          <div>
            <Label>Cities</Label>
            <MultiSelect options={availableCities.map((c) => ({ value: c, label: c }))} values={form.cities ?? []}
              onChange={(v) => setForm({ ...form, cities: v })} placeholder="Select cities" />
            <div className="flex gap-2 mt-2">
              <Input placeholder="Add new city" value={newCity} onChange={(e) => setNewCity(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewCity(); } }} />
              <Button type="button" variant="outline" onClick={addNewCity}>Add</Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Cost</Label><Input type="number" step="0.01" value={form.cost ?? 0} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></div>
            <div><Label>Currency</Label><Input value={form.currency ?? "GBP"} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? "proposed"} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
