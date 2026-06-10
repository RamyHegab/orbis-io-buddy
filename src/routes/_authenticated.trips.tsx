import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Plane } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/trips")({
  head: () => ({ meta: [{ title: "Trips — Orbis CRM" }] }),
  component: TripsPage,
});

function TripsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", destinations: "", start_date: "", end_date: "", notes: "" });

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
      const destArr = form.destinations.split(",").map((s) => s.trim()).filter(Boolean);
      const { error } = await supabase.from("trips").insert({
        title: form.title,
        destinations: destArr,
        start_date: form.start_date,
        end_date: form.end_date,
        notes: form.notes,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Trip created");
      setOpen(false);
      setForm({ title: "", destinations: "", start_date: "", end_date: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Trips"
        description="Plan and run international recruitment journeys."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New trip</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New trip</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fall 2026 — Southeast Asia" /></div>
                <div><Label>Destinations (comma separated)</Label><Input value={form.destinations} onChange={(e) => setForm({ ...form, destinations: e.target.value })} placeholder="Vietnam, Thailand, Indonesia" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Start *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div><Label>End *</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={() => create.mutate()} disabled={!form.title || !form.start_date || !form.end_date} className="w-full">Create trip</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {trips && trips.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.map((t) => (
            <Link key={t.id} to="/trips/$tripId" params={{ tripId: t.id }}>
              <Card className="p-5 hover:shadow-md transition-shadow h-full">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Plane className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{fmtDate(t.start_date)} → {fmtDate(t.end_date)}</div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {t.destinations?.slice(0, 3).map((d) => <Badge key={d} variant="secondary">{d}</Badge>)}
                    </div>
                    <Badge className="mt-3 capitalize" variant="outline">{t.status}</Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center text-muted-foreground">No trips yet. Plan your first recruitment trip.</Card>
      )}
    </PageContainer>
  );
}
