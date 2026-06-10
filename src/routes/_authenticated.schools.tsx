import { createFileRoute } from "@tanstack/react-router";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, GraduationCap, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { listNotionDatabases, syncSchoolsFromNotion } from "@/lib/notion-sync.functions";

export const Route = createFileRoute("/_authenticated/schools")({
  head: () => ({ meta: [{ title: "Schools — Orbis CRM" }] }),
  component: SchoolsPage,
});

const LEVELS = [
  { value: "high_school", label: "High School" },
  { value: "university", label: "University" },
  { value: "language_school", label: "Language School" },
  { value: "other", label: "Other" },
];

function SchoolsPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ name: "", country: "", city: "", level: "high_school", contact_name: "", email: "", phone: "", notes: "" });
  const listDbs = useServerFn(listNotionDatabases);
  const sync = useServerFn(syncSchoolsFromNotion);
  const { data: notionDbs, refetch: refetchDbs } = useQuery({
    queryKey: ["notion-dbs"],
    queryFn: () => listDbs(),
    enabled: false,
  });
  const runSync = useMutation({
    mutationFn: () => sync({ data: { databaseId: selectedDb } }),
    onSuccess: (r: any) => {
      toast.success(`Synced — imported ${r.imported}, updated ${r.updated}`);
      setSyncOpen(false);
      qc.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("*").order("country").order("city");
      return data ?? [];
    },
  });

  const grouped = useMemo(() => {
    const filtered = (schools ?? []).filter((s) => {
      const t = filter.toLowerCase();
      return !t || s.name.toLowerCase().includes(t) || s.country.toLowerCase().includes(t) || s.city.toLowerCase().includes(t);
    });
    const map: Record<string, typeof filtered> = {};
    for (const s of filtered) {
      const key = s.country;
      (map[key] = map[key] ?? []).push(s);
    }
    return map;
  }, [schools, filter]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("schools").insert({ ...form, level: form.level as any, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("School added");
      setOpen(false);
      setForm({ name: "", country: "", city: "", level: "high_school", contact_name: "", email: "", phone: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["schools"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schools"] }),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Schools"
        description="Partner and prospect schools by country and city."
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <Dialog open={syncOpen} onOpenChange={(o) => { setSyncOpen(o); if (o) refetchDbs(); }}>
                <DialogTrigger asChild>
                  <Button variant="outline"><RefreshCw className="h-4 w-4 mr-1" /> Sync from Notion</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Sync schools from Notion</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Make sure the Schools database is shared with the Notion integration. Then pick it below.
                    </p>
                    <div>
                      <Label>Database</Label>
                      <Select value={selectedDb} onValueChange={setSelectedDb}>
                        <SelectTrigger><SelectValue placeholder="Pick a database" /></SelectTrigger>
                        <SelectContent>
                          {(notionDbs ?? []).map((d: any) => (
                            <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" disabled={!selectedDb || runSync.isPending} onClick={() => runSync.mutate()}>
                      {runSync.isPending ? "Syncing…" : "Sync now"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New school</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New school</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Country *</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                  <div><Label>City *</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Level</Label>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Contact name</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={() => create.mutate()} disabled={!form.name || !form.country || !form.city} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Input placeholder="Search by name, country, or city…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm mb-6" />

      {Object.keys(grouped).length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No schools yet.</Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([country, items]) => (
            <div key={country}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {country} <span className="text-xs font-normal">({items.length})</span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((s) => (
                  <Card key={s.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground shrink-0">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.city} • {LEVELS.find((l) => l.value === s.level)?.label}</div>
                        {s.contact_name && <div className="text-xs text-muted-foreground mt-1">{s.contact_name}</div>}
                      </div>
                      <button onClick={() => confirm("Delete?") && remove.mutate(s.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
