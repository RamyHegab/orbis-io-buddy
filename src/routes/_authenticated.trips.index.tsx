import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Plane, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate } from "@/lib/format";
import { format, parseISO } from "date-fns";

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

function bucketOf(t: { start_date: string; end_date: string; status: string }): "past" | "in_progress" | "upcoming" {
  const today = format(new Date(), "yyyy-MM-dd");
  if (t.end_date < today) return "past";
  if (t.status === "confirmed") return "upcoming";
  return "in_progress";
}

function TripsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [legs, setLegs] = useState<Leg[]>([{ country: "", start_date: "", end_date: "" }]);

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
      const title = buildTitle(valid);
      const start = valid.reduce((a, l) => (a < l.start_date ? a : l.start_date), valid[0].start_date);
      const end = valid.reduce((a, l) => (a > l.end_date ? a : l.end_date), valid[0].end_date);
      const { data: trip, error } = await supabase.from("trips").insert({
        title, destinations: valid.map((l) => l.country),
        start_date: start, end_date: end, user_id: user.id,
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
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Trip deleted"); qc.invalidateQueries({ queryKey: ["trips"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateLeg = (i: number, patch: Partial<Leg>) =>
    setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const previewTitle = buildTitle(legs);

  const grouped = useMemo(() => {
    const g = { past: [] as any[], in_progress: [] as any[], upcoming: [] as any[] };
    for (const t of trips ?? []) g[bucketOf(t)].push(t);
    return g;
  }, [trips]);

  const renderGrid = (list: any[]) =>
    list.length === 0 ? (
      <Card className="p-10 text-center text-muted-foreground">No trips in this group.</Card>
    ) : (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((t) => (
          <Card key={t.id} className="p-5 hover:shadow-md transition-shadow h-full relative group">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon" variant="ghost"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete trip?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes "{t.title}" and all its activities.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => del.mutate(t.id)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Link to="/trips/$tripId" params={{ tripId: t.id }} className="block">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Plane className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{fmtDate(t.start_date)} → {fmtDate(t.end_date)}</div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {t.status === "confirmed" && <Badge className="bg-emerald-600 hover:bg-emerald-600">Confirmed</Badge>}
                    {t.destinations?.slice(0, 3).map((d: string) => <Badge key={d} variant="secondary">{d}</Badge>)}
                  </div>
                </div>
              </div>
            </Link>
          </Card>
        ))}
      </div>
    );

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
                        <Input placeholder="Country" value={leg.country} onChange={(e) => updateLeg(i, { country: e.target.value })} />
                        <Input type="date" value={leg.start_date} onChange={(e) => updateLeg(i, { start_date: e.target.value })} />
                        <Input type="date" value={leg.end_date} onChange={(e) => updateLeg(i, { end_date: e.target.value })} />
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
                <Button onClick={() => create.mutate()} disabled={!previewTitle || create.isPending} className="w-full">
                  Create trip
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="in_progress">
        <TabsList>
          <TabsTrigger value="in_progress">In progress ({grouped.in_progress.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming confirmed ({grouped.upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({grouped.past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="in_progress" className="mt-4">{renderGrid(grouped.in_progress)}</TabsContent>
        <TabsContent value="upcoming" className="mt-4">{renderGrid(grouped.upcoming)}</TabsContent>
        <TabsContent value="past" className="mt-4">{renderGrid(grouped.past)}</TabsContent>
      </Tabs>
    </PageContainer>
  );
}
