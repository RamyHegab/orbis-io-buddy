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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
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

function TripPlanner() {
  const { tripId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "school_visit", title: "", start_time: "", end_time: "", location: "",
    agent_id: "", school_id: "", notes: "",
  });

  const { data: trip } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
      return data;
    },
  });

  const { data: activities } = useQuery({
    queryKey: ["activities", tripId],
    queryFn: async () => {
      const { data } = await supabase.from("activities").select("*, agents(name), schools(name)").eq("trip_id", tripId).order("day_date").order("start_time");
      return data ?? [];
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents-list"],
    queryFn: async () => (await supabase.from("agents").select("id, name").order("name")).data ?? [],
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

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const a of activities ?? []) (map[a.day_date] = map[a.day_date] ?? []).push(a);
    return map;
  }, [activities]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !selectedDay) throw new Error("Missing fields");
      const payload: any = {
        trip_id: tripId,
        user_id: user.id,
        type: form.type,
        title: form.title,
        day_date: selectedDay,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location || null,
        agent_id: form.agent_id || null,
        school_id: form.school_id || null,
        notes: form.notes || null,
      };
      const { error } = await supabase.from("activities").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activity added");
      setOpen(false);
      setForm({ type: "school_visit", title: "", start_time: "", end_time: "", location: "", agent_id: "", school_id: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["activities", tripId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openForDay = (d: Date) => {
    setSelectedDay(format(d, "yyyy-MM-dd"));
    setOpen(true);
  };

  if (!trip) return <PageContainer><p className="text-muted-foreground">Loading…</p></PageContainer>;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/trips" })} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> All trips
      </Button>
      <PageHeader
        title={trip.title}
        description={`${fmtDate(trip.start_date)} → ${fmtDate(trip.end_date)} • ${trip.destinations?.join(", ") || "No destinations"}`}
        actions={
          <Link to="/trips/$tripId/report" params={{ tripId }}>
            <Button variant="outline"><Sparkles className="h-4 w-4 mr-1" /> AI Report</Button>
          </Link>
        }
      />

      <div className="space-y-4">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const dayActs = byDay[key] ?? [];
          return (
            <Card key={key} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">{format(d, "EEEE, MMMM d")}</div>
                  <div className="text-xs text-muted-foreground">Day {differenceInDays(d, parseISO(trip.start_date)) + 1}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => openForDay(d)}>
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
                            {a.agents?.name && ` • ${a.agents.name}`}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New activity {selectedDay && `— ${fmtDate(selectedDay)}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIVITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start time</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><Label>End time</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            {form.type === "agent_visit" && (
              <div>
                <Label>Agent</Label>
                <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick an agent" /></SelectTrigger>
                  <SelectContent>{agents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.type === "school_visit" && (
              <div>
                <Label>School</Label>
                <Select value={form.school_id} onValueChange={(v) => setForm({ ...form, school_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a school" /></SelectTrigger>
                  <SelectContent>{schools?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {s.city}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={() => create.mutate()} disabled={!form.title} className="w-full">Add activity</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
