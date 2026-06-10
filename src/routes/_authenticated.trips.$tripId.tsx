import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, ArrowLeft, Sparkles, Pencil, FileText, FileDown, Trash2, Save, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { exportTripPdf, exportTripWord } from "@/lib/trip-export";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from "@/lib/format";
import { addDays, differenceInDays, parseISO, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  component: TripPlanner,
});

const ACTIVITY_TYPES = [
  { value: "travel", label: "Travel" },
  { value: "agent_visit", label: "Agent Visit" },
  { value: "school_visit", label: "School Visit" },
  { value: "recruitment_event", label: "Recruitment Event" },
  { value: "resting_day", label: "Resting Day" },
  { value: "other", label: "Other" },
];

const TRANSPORT_MODES = ["Air travel", "Train", "Taxi", "Bus", "Private car", "Ferry", "Other"];
const RESTING_TYPES = [
  { value: "toil", label: "TOIL" },
  { value: "weekend", label: "Weekend" },
  { value: "bank_holiday", label: "Bank Holiday" },
];

type FormState = {
  type: string;
  title: string;
  start_time: string;
  end_time: string;
  end_date: string;
  location: string;
  agent_id: string;
  branch_id: string;
  school_id: string;
  transport_mode: string;
  from_city: string;
  to_city: string;
  from_country: string;
  to_country: string;
  airline: string;
  flight_number: string;
  cost: string;
  cost_currency: string;
  resting_type: string;
  description: string;
  notes: string;
};

const emptyForm: FormState = {
  type: "school_visit", title: "", start_time: "", end_time: "", end_date: "",
  location: "", agent_id: "", branch_id: "", school_id: "",
  transport_mode: "", from_city: "", to_city: "", from_country: "", to_country: "",
  airline: "", flight_number: "", cost: "", cost_currency: "GBP",
  resting_type: "", description: "", notes: "",
};

function TripPlanner() {
  const { tripId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editLegs, setEditLegs] = useState<{ id?: string; country: string; start_date: string; end_date: string }[]>([]);


  const { data: trip } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => (await supabase.from("trips").select("*").eq("id", tripId).maybeSingle()).data,
  });

  const { data: countries } = useQuery({
    queryKey: ["trip-countries", tripId],
    queryFn: async () => (await supabase.from("trip_countries").select("*").eq("trip_id", tripId).order("sort_order")).data ?? [],
  });

  const { data: activities } = useQuery({
    queryKey: ["activities", tripId],
    queryFn: async () => (await supabase.from("activities").select("*, agents(trading_name), schools(name), agent_branches(branch_name, city)").eq("trip_id", tripId).order("day_date").order("start_time")).data ?? [],
  });

  const { data: agents } = useQuery({
    queryKey: ["agents-list"],
    queryFn: async () => (await supabase.from("agents").select("id, trading_name").order("trading_name")).data ?? [],
  });

  const { data: branches } = useQuery({
    queryKey: ["agent-branches-list"],
    queryFn: async () => (await supabase.from("agent_branches").select("id, branch_name, city, agent_id, agents(trading_name)").order("branch_name")).data ?? [],
  });

  const { data: schools } = useQuery({
    queryKey: ["schools-list"],
    queryFn: async () => (await supabase.from("schools").select("id, name, city").order("name")).data ?? [],
  });

  const days = useMemo(() => {
    if (!trip) return [];
    const start = parseISO(trip.start_date);
    const end = parseISO(trip.end_date);
    const n = differenceInDays(end, start) + 1;
    return Array.from({ length: n }, (_, i) => addDays(start, i));
  }, [trip]);

  const countryForDay = (d: Date): string | null => {
    if (!countries) return null;
    const key = format(d, "yyyy-MM-dd");
    const c = countries.find((c) => key >= c.start_date && key <= c.end_date);
    return c?.country ?? null;
  };

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const a of activities ?? []) (map[a.day_date] = map[a.day_date] ?? []).push(a);
    return map;
  }, [activities]);

  const filteredBranches = useMemo(() => {
    if (!branches) return [];
    if (!form.agent_id) return branches;
    return branches.filter((b: any) => b.agent_id === form.agent_id);
  }, [branches, form.agent_id]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !selectedDay) throw new Error("Missing fields");
      const payload: any = {
        trip_id: tripId,
        user_id: user.id,
        type: form.type,
        day_date: selectedDay,
        title: form.title || defaultTitle(form, branches, schools, agents),
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        end_date: form.end_date || null,
        location: form.location || null,
        agent_id: form.agent_id || null,
        branch_id: form.branch_id || null,
        school_id: form.school_id || null,
        transport_mode: form.transport_mode || null,
        airline: form.airline || null,
        flight_number: form.flight_number || null,
        cost: form.cost ? Number(form.cost) : null,
        cost_currency: form.cost ? form.cost_currency : null,
        resting_type: form.resting_type || null,
        description: form.description || null,
        notes: form.notes || null,
      };
      const { error } = await supabase.from("activities").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activity added");
      setForm(emptyForm);
      setSelectedDay(null);
      qc.invalidateQueries({ queryKey: ["activities", tripId] });
    },
    onError: (e: any) => toast.error(e.message),
  });


  const saveEdit = useMutation({
    mutationFn: async () => {
      const valid = editLegs.filter((l) => l.country && l.start_date && l.end_date);
      if (valid.length === 0) throw new Error("Add at least one country");
      const start = valid.reduce((a, l) => (a < l.start_date ? a : l.start_date), valid[0].start_date);
      const end = valid.reduce((a, l) => (a > l.end_date ? a : l.end_date), valid[0].end_date);
      const countries = valid.map((l) => l.country);
      const title = `${countries.join(" • ")} — ${format(parseISO(start), "d MMM")} → ${format(parseISO(end), "d MMM yyyy")}`;
      const { error } = await supabase.from("trips").update({
        title, destinations: countries, start_date: start, end_date: end,
      }).eq("id", tripId);
      if (error) throw error;
      await supabase.from("trip_countries").delete().eq("trip_id", tripId);
      const rows = valid.map((l, i) => ({
        trip_id: tripId, user_id: user!.id, country: l.country,
        start_date: l.start_date, end_date: l.end_date, sort_order: i,
      }));
      const { error: e2 } = await supabase.from("trip_countries").insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Trip updated");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["trip-countries", tripId] });
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTrip = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Trip deleted"); navigate({ to: "/trips" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openForDay = (d: Date) => {
    setSelectedDay(format(d, "yyyy-MM-dd"));
    setForm({ ...emptyForm, end_date: format(d, "yyyy-MM-dd") });
  };


  const openEdit = () => {
    setEditLegs((countries ?? []).map((c: any) => ({
      id: c.id, country: c.country, start_date: c.start_date, end_date: c.end_date,
    })));
    setEditOpen(true);
  };

  if (!trip) return <PageContainer><p className="text-muted-foreground">Loading…</p></PageContainer>;

  const canSubmit = isFormValid(form);

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/trips" })} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> All trips
      </Button>
      <PageHeader
        title={trip.title}
        description={`${fmtDate(trip.start_date)} → ${fmtDate(trip.end_date)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="h-4 w-4 mr-1" /> Edit trip</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><FileDown className="h-4 w-4 mr-1" /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportTripPdf(trip, (activities ?? []) as any)}>
                  <FileText className="h-4 w-4 mr-2" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportTripWord(trip, (activities ?? []) as any)}>
                  <FileText className="h-4 w-4 mr-2" /> Word (.doc)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/trips/$tripId/report" params={{ tripId }}>
              <Button variant="outline" size="sm"><Sparkles className="h-4 w-4 mr-1" /> AI Report</Button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm"><Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete trip?</AlertDialogTitle>
                  <AlertDialogDescription>This removes the trip and all its activities.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteTrip.mutate()}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Edit trip</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Countries & dates</Label>
            <p className="text-xs text-muted-foreground">The title is generated from countries and dates.</p>
            <div className="space-y-2">
              {editLegs.map((leg, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                  <Input placeholder="Country" value={leg.country}
                    onChange={(e) => setEditLegs((prev) => prev.map((l, idx) => idx === i ? { ...l, country: e.target.value } : l))} />
                  <Input type="date" value={leg.start_date}
                    onChange={(e) => setEditLegs((prev) => prev.map((l, idx) => idx === i ? { ...l, start_date: e.target.value } : l))} />
                  <Input type="date" value={leg.end_date}
                    onChange={(e) => setEditLegs((prev) => prev.map((l, idx) => idx === i ? { ...l, end_date: e.target.value } : l))} />
                  <Button type="button" size="icon" variant="ghost" disabled={editLegs.length === 1}
                    onClick={() => setEditLegs(editLegs.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" size="sm" variant="outline"
              onClick={() => setEditLegs([...editLegs, { country: "", start_date: "", end_date: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Add country
            </Button>
            <Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending} className="w-full">Save</Button>
            <p className="text-xs text-muted-foreground">
              Changing dates may leave existing activities outside the new range — they'll stop appearing in the calendar.
            </p>
          </div>
        </DialogContent>
      </Dialog>


      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const dayActs = byDay[key] ?? [];
            const country = countryForDay(d);
            const resting = dayActs.find((a) => a.type === "resting_day");
            const isSelected = selectedDay === key;
            return (
              <Card key={key} className={`p-5 ${resting ? "bg-muted/40" : ""} ${isSelected ? "ring-2 ring-primary" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold">{format(d, "EEEE, MMMM d")}</div>
                    <div className="text-xs text-muted-foreground">
                      Day {differenceInDays(d, parseISO(trip.start_date)) + 1}
                      {country && ` • ${country}`}
                      {resting && ` • ${resting.title} (no activities)`}
                    </div>
                  </div>
                  <Button size="sm" variant={isSelected ? "default" : "ghost"} onClick={() => openForDay(d)} disabled={!!resting}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                {dayActs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activities. Click "Add" to schedule.</p>
                ) : (
                  <div className="space-y-2">
                    {dayActs.map((a) => (
                      <Link
                        key={a.id}
                        to="/trips/$tripId/activities/$activityId"
                        params={{ tripId, activityId: a.id }}
                        className="block"
                      >
                        <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-muted ${ACTIVITY_TYPE_COLORS[a.type]}`}>
                          <div className="text-xs font-mono w-20 shrink-0">
                            {a.start_time ? a.start_time.slice(0, 5) : "—"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-foreground truncate">{a.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {ACTIVITY_TYPE_LABELS[a.type]}
                              {a.transport_mode && ` • ${a.transport_mode}`}
                              {a.flight_number && ` • ${a.flight_number}`}
                              {a.agent_branches?.branch_name && ` • ${a.agent_branches.branch_name}`}
                              {a.agents?.trading_name && !a.agent_branches && ` • ${a.agents.trading_name}`}
                              {a.schools?.name && ` • ${a.schools.name}`}
                              {a.location && ` • ${a.location}`}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="lg:col-span-1">
          <Card className="p-5 lg:sticky lg:top-4">
            {!selectedDay ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <div className="font-semibold text-foreground">Activity editor</div>
                <p>Select a day on the left and click <span className="font-medium">Add</span> to schedule an activity here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">New activity</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(selectedDay)}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedDay(null); setForm(emptyForm); }}>Cancel</Button>
                </div>
                <div>
                  <Label>Activity type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...emptyForm, type: v, end_date: selectedDay ?? "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ACTIVITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {form.type === "travel" && (
                  <>
                    <div>
                      <Label>Mode of transport</Label>
                      <Select value={form.transport_mode} onValueChange={(v) => setForm({ ...form, transport_mode: v })}>
                        <SelectTrigger><SelectValue placeholder="Select transport" /></SelectTrigger>
                        <SelectContent>{TRANSPORT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>From (city)</Label><Input value={form.from_city} onChange={(e) => setForm({ ...form, from_city: e.target.value })} placeholder="London" /></div>
                      <div><Label>To (city)</Label><Input value={form.to_city} onChange={(e) => setForm({ ...form, to_city: e.target.value })} placeholder="Bangkok" /></div>
                    </div>
                    {form.transport_mode === "Air travel" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>From (country)</Label><Input value={form.from_country} onChange={(e) => setForm({ ...form, from_country: e.target.value })} placeholder="United Kingdom" /></div>
                        <div><Label>To (country)</Label><Input value={form.to_country} onChange={(e) => setForm({ ...form, to_country: e.target.value })} placeholder="Thailand" /></div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Departure time</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                      <div><Label>Arrival time</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                    </div>
                    <div><Label>Arrival date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                    {form.transport_mode === "Air travel" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Airline</Label><Input value={form.airline} onChange={(e) => setForm({ ...form, airline: e.target.value })} /></div>
                        <div><Label>Flight number</Label><Input value={form.flight_number} onChange={(e) => setForm({ ...form, flight_number: e.target.value })} /></div>
                      </div>
                    )}
                    <CostInput form={form} setForm={setForm} />
                  </>
                )}

                {form.type === "agent_visit" && (
                  <>
                    <div>
                      <Label>Agent</Label>
                      <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v, branch_id: "" })}>
                        <SelectTrigger><SelectValue placeholder="Pick an agent" /></SelectTrigger>
                        <SelectContent>{agents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.trading_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Agent branch</Label>
                      {filteredBranches.length === 0 ? (
                        <div className="text-sm text-muted-foreground border rounded-md p-3">
                          No branches yet. <Link to="/agents" className="underline text-primary">Add a branch</Link> first.
                        </div>
                      ) : (
                        <Select value={form.branch_id} onValueChange={(v) => {
                          const b: any = filteredBranches.find((x: any) => x.id === v);
                          setForm({ ...form, branch_id: v, agent_id: b?.agent_id ?? form.agent_id, title: b ? `Visit ${b.branch_name}` : form.title });
                        }}>
                          <SelectTrigger><SelectValue placeholder="Pick a branch" /></SelectTrigger>
                          <SelectContent>
                            {filteredBranches.map((b: any) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.branch_name}{b.city && ` — ${b.city}`}{!form.agent_id && b.agents?.trading_name && ` (${b.agents.trading_name})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <TimeRange form={form} setForm={setForm} />
                  </>
                )}

                {form.type === "school_visit" && (
                  <>
                    <div>
                      <Label>School</Label>
                      {(!schools || schools.length === 0) ? (
                        <div className="text-sm text-muted-foreground border rounded-md p-3">
                          No schools yet. <Link to="/schools" className="underline text-primary">Add a school</Link> first.
                        </div>
                      ) : (
                        <Select value={form.school_id} onValueChange={(v) => {
                          const s = schools.find((x) => x.id === v);
                          setForm({ ...form, school_id: v, title: s ? `Visit ${s.name}` : form.title });
                        }}>
                          <SelectTrigger><SelectValue placeholder="Pick a school" /></SelectTrigger>
                          <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {s.city}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </div>
                    <TimeRange form={form} setForm={setForm} />
                    <div>
                      <Label>Linked agent</Label>
                      <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Pick an agent" /></SelectTrigger>
                        <SelectContent>{agents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.trading_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <CostInput form={form} setForm={setForm} />
                  </>
                )}

                {form.type === "recruitment_event" && (
                  <>
                    <div><Label>Venue name</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Hilton Conference Centre" /></div>
                    <div>
                      <Label>Address</Label>
                      <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Venue address" />
                      {form.location && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.location)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary underline mt-1 inline-block"
                        >
                          Find on Google Maps
                        </a>
                      )}
                    </div>
                    <TimeRange form={form} setForm={setForm} />
                    <div>
                      <Label>Linked agent</Label>
                      <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Pick an agent" /></SelectTrigger>
                        <SelectContent>{agents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.trading_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <CostInput form={form} setForm={setForm} />
                  </>
                )}

                {form.type === "resting_day" && (
                  <>
                    <div>
                      <Label>Reason</Label>
                      <Select value={form.resting_type} onValueChange={(v) => setForm({ ...form, resting_type: v, title: RESTING_TYPES.find((r) => r.value === v)?.label ?? "" })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{RESTING_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">No other activities will be scheduled for this day.</p>
                  </>
                )}

                {form.type === "other" && (
                  <>
                    <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="British Council meeting" /></div>
                    <TimeRange form={form} setForm={setForm} />
                    <div>
                      <Label>Linked agent</Label>
                      <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Pick an agent" /></SelectTrigger>
                        <SelectContent>{agents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.trading_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Linked school</Label>
                      <Select value={form.school_id} onValueChange={(v) => setForm({ ...form, school_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Pick a school" /></SelectTrigger>
                        <SelectContent>{schools?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Location / venue</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                    <CostInput form={form} setForm={setForm} />
                    <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  </>
                )}

                <Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending} className="w-full">
                  Add activity
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

    </PageContainer>
  );
}

function TimeRange({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div><Label>Time from</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
      <div><Label>Time to</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
    </div>
  );
}

function CostInput({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="grid grid-cols-[1fr_120px] gap-3">
      <div><Label>Cost</Label><Input type="number" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0.00" /></div>
      <div><Label>Currency</Label><Input value={form.cost_currency} onChange={(e) => setForm({ ...form, cost_currency: e.target.value.toUpperCase() })} maxLength={3} /></div>
    </div>
  );
}

function defaultTitle(f: FormState, branches: any, schools: any, agents: any): string {
  switch (f.type) {
    case "travel": {
      const from = [f.from_city, f.transport_mode === "Air travel" ? f.from_country : ""].filter(Boolean).join(", ");
      const to = [f.to_city, f.transport_mode === "Air travel" ? f.to_country : ""].filter(Boolean).join(", ");
      if (from && to) return `${from} → ${to}`;
      return f.transport_mode || "Travel";
    }
    case "agent_visit": {
      const b = branches?.find((x: any) => x.id === f.branch_id);
      return b ? `Visit ${b.branch_name}` : "Agent visit";
    }
    case "school_visit": {
      const s = schools?.find((x: any) => x.id === f.school_id);
      return s ? `Visit ${s.name}` : "School visit";
    }
    case "recruitment_event": return "Recruitment event";
    case "resting_day": return RESTING_TYPES.find((r) => r.value === f.resting_type)?.label ?? "Resting day";
    default: return "Activity";
  }
}

function isFormValid(f: FormState): boolean {
  switch (f.type) {
    case "travel": return !!f.transport_mode && !!f.from_city && !!f.to_city;
    case "agent_visit": return !!f.branch_id;
    case "school_visit": return !!f.school_id;
    case "recruitment_event": return !!f.title;
    case "resting_day": return !!f.resting_type;
    case "other": return !!f.title;
    default: return false;
  }
}
