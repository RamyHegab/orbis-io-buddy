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
import { Plus, Trash2, GraduationCap, RefreshCw, Upload, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { listNotionDatabases, syncSchoolsFromNotion } from "@/lib/notion-sync.functions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { MapPreview } from "@/components/map-preview";
import { mapsSearchUrl } from "@/lib/google-maps";

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

type FormState = {
  name: string;
  country: string;
  city: string;
  address: string;
  level: string;
  general_email: string;
  general_phone: string;
  primary_contact_name: string;
  primary_contact_position: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  secondary_contact_name: string;
  secondary_contact_email: string;
  secondary_contact_phone: string;
  notes: string;
  place_id: string;
  lat: number | null;
  lng: number | null;
  formatted_address: string;
};

const EMPTY_FORM: FormState = {
  name: "", country: "", city: "", address: "", level: "high_school",
  general_email: "", general_phone: "",
  primary_contact_name: "", primary_contact_position: "", primary_contact_email: "", primary_contact_phone: "",
  secondary_contact_name: "", secondary_contact_email: "", secondary_contact_phone: "",
  notes: "",
  place_id: "", lat: null, lng: null, formatted_address: "",
};

function SchoolsPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [campusFile, setCampusFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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
      return !t || s.name.toLowerCase().includes(t) || (s.country ?? "").toLowerCase().includes(t) || s.city.toLowerCase().includes(t);
    });
    const map: Record<string, typeof filtered> = {};
    for (const s of filtered) {
      const key = s.country ?? "—";
      (map[key] = map[key] ?? []).push(s);
    }
    return map;
  }, [schools, filter]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      let campus_image_url: string | null = null;
      if (campusFile) {
        setUploading(true);
        const path = `${user.id}/${Date.now()}-${campusFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("school-campuses").upload(path, campusFile);
        setUploading(false);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("school-campuses").createSignedUrl(path, 60 * 60 * 24 * 365);
        campus_image_url = signed?.signedUrl ?? null;
      }
      const { error } = await supabase.from("schools").insert({
        ...form,
        level: form.level as any,
        user_id: user.id,
        campus_image_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("School added");
      setOpen(false);
      setForm(EMPTY_FORM);
      setCampusFile(null);
      qc.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schools"] }),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

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
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>School contact form</DialogTitle></DialogHeader>
                <div className="space-y-6">
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">School</h3>
                    <div><Label>School name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>City *</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="City of school/branch" /></div>
                      <div><Label>Country</Label><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></div>
                    </div>
                    <AddressAutocomplete
                      label="Address"
                      placeholder="School address"
                      value={{
                        address: form.address,
                        place_id: form.place_id || null,
                        lat: form.lat,
                        lng: form.lng,
                        formatted_address: form.formatted_address || null,
                      }}
                      onChange={(v) => setForm({
                        ...form,
                        address: v.address,
                        place_id: v.place_id ?? "",
                        lat: v.lat,
                        lng: v.lng,
                        formatted_address: v.formatted_address ?? "",
                      })}
                    />
                    <div>
                      <Label>Level</Label>
                      <Select value={form.level} onValueChange={(v) => set("level", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">General contact</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>General email</Label><Input type="email" value={form.general_email} onChange={(e) => set("general_email", e.target.value)} placeholder="School/department" /></div>
                      <div><Label>General phone</Label><Input value={form.general_phone} onChange={(e) => set("general_phone", e.target.value)} /></div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Primary contact</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Name</Label><Input value={form.primary_contact_name} onChange={(e) => set("primary_contact_name", e.target.value)} /></div>
                      <div><Label>Position</Label><Input value={form.primary_contact_position} onChange={(e) => set("primary_contact_position", e.target.value)} placeholder="Title/role" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Email</Label><Input type="email" value={form.primary_contact_email} onChange={(e) => set("primary_contact_email", e.target.value)} /></div>
                      <div><Label>Phone</Label><Input value={form.primary_contact_phone} onChange={(e) => set("primary_contact_phone", e.target.value)} /></div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Secondary contact</h3>
                    <div><Label>Name</Label><Input value={form.secondary_contact_name} onChange={(e) => set("secondary_contact_name", e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Email</Label><Input type="email" value={form.secondary_contact_email} onChange={(e) => set("secondary_contact_email", e.target.value)} /></div>
                      <div><Label>Phone</Label><Input value={form.secondary_contact_phone} onChange={(e) => set("secondary_contact_phone", e.target.value)} /></div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Campus image</h3>
                    <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer hover:bg-accent">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">{campusFile ? campusFile.name : "Upload an iconic picture of your campus (max 5 MB)"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          if (f && f.size > 5 * 1024 * 1024) { toast.error("Max 5 MB"); return; }
                          setCampusFile(f);
                        }}
                      />
                    </label>
                  </section>

                  <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>

                  <Button onClick={() => create.mutate()} disabled={!form.name || !form.city || create.isPending || uploading} className="w-full">
                    {uploading ? "Uploading…" : create.isPending ? "Saving…" : "Submit"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
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
                      {s.campus_image_url ? (
                        <img src={s.campus_image_url} alt={s.name} className="h-9 w-9 rounded-md object-cover shrink-0" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground shrink-0">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.city} • {LEVELS.find((l) => l.value === s.level)?.label}</div>
                        {s.primary_contact_name && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {s.primary_contact_name}{s.primary_contact_position ? ` · ${s.primary_contact_position}` : ""}
                          </div>
                        )}
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
