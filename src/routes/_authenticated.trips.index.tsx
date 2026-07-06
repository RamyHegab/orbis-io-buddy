import { createFileRoute, Link } from "@tanstack/react-router";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Plane, Trash2, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { COUNTRIES } from "@/lib/countries";

export const Route = createFileRoute("/_authenticated/trips/")({
  head: () => ({ meta: [{ title: "Trips — Orbis CRM" }] }),
  component: TripsPage,
});

type Leg = { country: string; start_date: string; end_date: string };

function buildTitle(legs: Leg[]): string {
  const valid = legs.filter((l) => l.country && l.start_date && l.end_date);
  if (valid.length === 0) return "";
  const countries = valid.map((l) => l.country).join(" • ");
  const starts = valid.map((l) => parseISO(l.start_date).getTime());
  const ends = valid.map((l) => parseISO(l.end_date).getTime());
  const min = new Date(Math.min(...starts));
  const max = new Date(Math.max(...ends));
  return `${countries} — ${format(min, "d MMM")} → ${format(max, "d MMM yyyy")}`;
}

function bucketOf(t: { start_date: string; end_date: string; status: string }): "past" | "in_progress" | "approved" | "draft" {
  const today = format(new Date(), "yyyy-MM-dd");
  if (t.end_date < today) return "past";
  if (t.start_date <= today && today <= t.end_date) return "in_progress";
  if (t.status === "approved" || t.status === "confirmed") return "approved";
  return "draft";
}

type ChecklistKey =
  | "save_as_draft"
  | "confirm_itinerary"
  | "itinerary_approved"
  | "freight_required"
  | "parcel_sent"
  | "book_appointment"
  | "book_flights_hotels"
  | "risk_assessment";

const CHECKLIST_ITEMS: { key: ChecklistKey; label: string; hint?: string }[] = [
  { key: "save_as_draft", label: "Save as draft", hint: "Keep working on other steps before submitting for approval" },
  { key: "confirm_itinerary", label: "Confirm itinerary" },
  { key: "itinerary_approved", label: "Itinerary approved", hint: "Line manager approves from their account" },
  { key: "freight_required", label: "Freight required?", hint: "System will remind in notifications if Yes" },
  { key: "parcel_sent", label: "Parcel sent" },
  { key: "book_appointment", label: "Book appointment", hint: "Will prompt to email itinerary contacts" },
  { key: "book_flights_hotels", label: "Book flights and hotels" },
  { key: "risk_assessment", label: "Risk assessment review" },
];

function TripCard({ trip, selected, onSelect }: { trip: any; selected?: boolean; onSelect?: () => void }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trips").delete().eq("id", trip.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Trip deleted"); qc.invalidateQueries({ queryKey: ["trips"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card
      onClick={onSelect}
      className={`p-0 hover:shadow-md transition-all relative group shrink-0 w-56 cursor-pointer overflow-hidden rounded-md border-2 ${selected ? "border-gold shadow-md" : "border-primary/80"}`}
    >
      <div className={`h-1.5 w-full ${
        trip.status === "approved" || trip.status === "confirmed" ? "bg-gold"
          : trip.status === "submitted" ? "bg-amber-500"
          : "bg-primary"
      }`} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="icon" variant="ghost"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-7 w-7"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trip?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{trip.title}" and all its activities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="block p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-gold shrink-0 mb-3">
          <Plane className="h-5 w-5" />
        </div>
        <div className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">{trip.title}</div>
        <div className="text-xs text-muted-foreground mt-2">{fmtDate(trip.start_date)} → {fmtDate(trip.end_date)}</div>
        <div className="flex flex-wrap gap-1 mt-3">
          {(trip.status === "approved" || trip.status === "confirmed") && <Badge className="bg-gold text-gold-foreground hover:bg-gold/90">Approved</Badge>}
          {trip.status === "submitted" && <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">Pending approval</Badge>}
          {(!trip.status || trip.status === "draft") && <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">Draft</Badge>}
          {trip.destinations?.slice(0, 3).map((d: string) => (
            <Badge key={d} variant="outline" className="border-primary/40 text-primary">{d}</Badge>
          ))}
        </div>
      </Link>
    </Card>
  );
}

function HorizontalRow({ title, trips, selectedId, onSelect, empty }: { title: string; trips: any[]; selectedId?: string | null; onSelect?: (id: string) => void; empty: string }) {
  return (
    <section className="rounded-md border-2 border-primary/80 bg-card overflow-hidden">
      <div className="flex items-center justify-between bg-primary text-primary-foreground px-4 py-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gold">{title}</h2>
        <span className="text-[11px] font-semibold text-gold/80">{trips.length}</span>
      </div>
      {trips.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto p-4">
          {trips.map((t) => (
            <TripCard
              key={t.id}
              trip={t}
              selected={selectedId === t.id}
              onSelect={onSelect ? () => onSelect(t.id) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ChecklistPanel({ trip }: { trip: any | null }) {
  const qc = useQueryClient();
  // The trip existing IS proof the draft was saved, so seed that step as done
  // unless the user explicitly unchecked it.
  const checklist = { save_as_draft: true, ...((trip?.checklist ?? {}) as Record<string, any>) };

  const update = useMutation({
    mutationFn: async (next: Record<string, any>) => {
      const { error } = await supabase.from("trips").update({ checklist: next }).eq("id", trip.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const setVal = (key: ChecklistKey, value: any) => {
    update.mutate({ ...checklist, [key]: value });
  };

  if (!trip) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Select a draft, in-progress, or approved trip to see its checklist.
      </Card>
    );
  }

  const allDone = CHECKLIST_ITEMS.every((i) =>
    i.key === "freight_required" ? checklist[i.key] === "no" || checklist[i.key] === "yes" : !!checklist[i.key]
  );

  return (
    <Card className="p-0 sticky top-4 border-2 border-primary/80 overflow-hidden rounded-md">
      <div className="bg-primary text-primary-foreground px-5 py-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gold">Pre-trip checklist</div>
        <div className="font-semibold truncate mt-0.5">{trip.title}</div>
        <div className="text-xs text-primary-foreground/70 mt-0.5">{fmtDate(trip.start_date)} → {fmtDate(trip.end_date)}</div>
      </div>
      <div className="p-5 space-y-4">
        {CHECKLIST_ITEMS.map((item) => {
          if (item.key === "freight_required") {
            const v = checklist[item.key];
            return (
              <div key={item.key} className="space-y-1 rounded-md border border-primary/30 bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="flex gap-1">
                    <Button size="sm" variant={v === "yes" ? "default" : "outline"} className={`h-7 px-2 ${v === "yes" ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""}`} onClick={() => setVal(item.key, "yes")}>Yes</Button>
                    <Button size="sm" variant={v === "no" ? "default" : "outline"} className={`h-7 px-2 ${v === "no" ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""}`} onClick={() => setVal(item.key, "no")}>No</Button>
                  </div>
                </div>
                {item.hint && <div className="text-xs text-muted-foreground">{item.hint}</div>}
              </div>
            );
          }
          const done = !!checklist[item.key];
          return (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={done}
                onCheckedChange={(c) => setVal(item.key, !!c)}
                className="mt-0.5 data-[state=checked]:bg-gold data-[state=checked]:text-gold-foreground data-[state=checked]:border-gold"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {item.label}
                  {done ? (
                    <span className="inline-flex items-center gap-1 text-xs text-gold-foreground bg-gold rounded-sm px-1.5 py-0.5"><CheckCircle2 className="h-3 w-3" /> Done</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Circle className="h-3 w-3" /> Open</span>
                  )}
                </div>
                {item.hint && <div className="text-xs text-muted-foreground">{item.hint}</div>}
              </div>
            </label>
          );
        })}
        {allDone && (
          <div className="rounded-md border-2 border-gold bg-gold/15 p-3 text-sm font-semibold text-primary text-center">
            Good luck and enjoy your trip! ✈️
          </div>
        )}
      </div>
    </Card>
  );
}

function TripsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [legs, setLegs] = useState<Leg[]>([{ country: "", start_date: "", end_date: "" }]);
  const [objectives, setObjectives] = useState("");
  const [selectedUpcomingId, setSelectedUpcomingId] = useState<string | null>(null);

  const { data: trips } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data } = await supabase.from("trips").select("*").order("start_date", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const valid = legs.filter((l) => l.country && l.start_date && l.end_date);
      if (valid.length === 0) throw new Error("Add at least one country with dates");
      const badYear = valid.find((l) => Number(l.start_date.slice(0, 4)) < 2000 || Number(l.end_date.slice(0, 4)) < 2000);
      if (badYear) throw new Error(`Dates need a 4-digit year (e.g. 2026), got ${badYear.start_date} → ${badYear.end_date}`);
      const title = buildTitle(valid);
      const start = valid.reduce((a, l) => (a < l.start_date ? a : l.start_date), valid[0].start_date);
      const end = valid.reduce((a, l) => (a > l.end_date ? a : l.end_date), valid[0].end_date);
      const { data: trip, error } = await supabase.from("trips").insert({
        title, destinations: valid.map((l) => l.country),
        start_date: start, end_date: end, user_id: user.id,
        objectives: objectives || null,
      }).select("id").single();
      if (error) throw error;
      const rows = valid.map((l, i) => ({
        trip_id: trip.id, user_id: user.id, country: l.country,
        start_date: l.start_date, end_date: l.end_date, sort_order: i,
      }));
      const { error: e2 } = await supabase.from("trip_countries").insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Trip created");
      setOpen(false);
      setLegs([{ country: "", start_date: "", end_date: "" }]);
      setObjectives("");
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateLeg = (i: number, patch: Partial<Leg>) =>
    setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const previewTitle = buildTitle(legs);

  const grouped = useMemo(() => {
    const g = { past: [] as any[], in_progress: [] as any[], approved: [] as any[], draft: [] as any[] };
    for (const t of trips ?? []) g[bucketOf(t)].push(t);
    g.in_progress.sort((a, b) => a.start_date.localeCompare(b.start_date));
    g.approved.sort((a, b) => a.start_date.localeCompare(b.start_date));
    g.draft.sort((a, b) => a.start_date.localeCompare(b.start_date));
    return g;
  }, [trips]);

  const pastLimited = grouped.past.slice(0, 3);

  const checklistCandidates = useMemo(
    () => [...grouped.in_progress, ...grouped.approved, ...grouped.draft],
    [grouped.in_progress, grouped.approved, grouped.draft],
  );

  useEffect(() => {
    if (checklistCandidates.length === 0) {
      if (selectedUpcomingId !== null) setSelectedUpcomingId(null);
      return;
    }
    if (!selectedUpcomingId || !checklistCandidates.find((t) => t.id === selectedUpcomingId)) {
      setSelectedUpcomingId(checklistCandidates[0].id);
    }
  }, [checklistCandidates, selectedUpcomingId]);

  const selectedTrip = checklistCandidates.find((t) => t.id === selectedUpcomingId) ?? null;

  return (
    <PageContainer>
      <PageHeader
        title="Trips"
        description="Plan and run international recruitment journeys."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New trip</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>New trip</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Countries & dates</Label>
                  <p className="text-xs text-muted-foreground mb-2">Add each country you're visiting with the dates you'll be there.</p>
                  <div className="space-y-2">
                    {legs.map((leg, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                        <Select value={leg.country} onValueChange={(v) => updateLeg(i, { country: v })}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Select country" /></SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        <Input type="date" min="2000-01-01" max="2099-12-31" value={leg.start_date} onChange={(e) => updateLeg(i, { start_date: e.target.value })} />
                        <Input type="date" min="2000-01-01" max="2099-12-31" value={leg.end_date} onChange={(e) => updateLeg(i, { end_date: e.target.value })} />
                        <Button type="button" size="icon" variant="ghost" disabled={legs.length === 1} onClick={() => setLegs(legs.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" size="sm" variant="outline" className="mt-2"
                    onClick={() => setLegs([...legs, { country: "", start_date: "", end_date: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Add country
                  </Button>
                </div>
                {previewTitle && (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">Itinerary title</div>
                    <div className="font-medium text-sm">{previewTitle}</div>
                  </div>
                )}
                <div>
                  <Label>Trip objectives</Label>
                  <p className="text-xs text-muted-foreground mb-2">A few lines on the purpose of this trip.</p>
                  <Textarea
                    value={objectives}
                    onChange={(e) => setObjectives(e.target.value)}
                    rows={3}
                    placeholder="e.g. Attending IDP fairs in Vietnam and visiting agents in HCMC to train on September intake"
                  />
                </div>
                <Button
                  onClick={() => {
                    if (!objectives.trim()) {
                      const ok = window.confirm("No trip objectives added. Create trip without objectives?");
                      if (!ok) return;
                    }
                    create.mutate();
                  }}
                  disabled={!previewTitle || create.isPending}
                  className="w-full"
                >
                  Create trip
                </Button>

              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="space-y-6 min-w-0">
          <HorizontalRow
            title="In progress"
            trips={grouped.in_progress}
            selectedId={selectedUpcomingId}
            onSelect={setSelectedUpcomingId}
            empty="No trips currently underway. Trips move here automatically on their start date."
          />
          <HorizontalRow
            title="Draft"
            trips={grouped.draft}
            selectedId={selectedUpcomingId}
            onSelect={setSelectedUpcomingId}
            empty="No drafts. Click 'New trip' to start planning one."
          />
          <HorizontalRow
            title="Approved"
            trips={grouped.approved}
            selectedId={selectedUpcomingId}
            onSelect={setSelectedUpcomingId}
            empty="No approved trips yet. Submit an itinerary for your line manager to approve."
          />
          <HorizontalRow
            title="Past (last 3)"
            trips={pastLimited}
            empty="No past trips yet."
          />


        </div>
        <aside>
          <ChecklistPanel trip={selectedTrip} />
        </aside>
      </div>
    </PageContainer>
  );
}
