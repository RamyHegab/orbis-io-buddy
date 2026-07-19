import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useCan, useRole } from "@/hooks/use-auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilePlus2, ExternalLink, Trash2, Plus, Search, X, ArrowUpDown, Pencil, Lock } from "lucide-react";
import { toast } from "sonner";
import { ACTIVITY_TYPE_LABELS } from "@/lib/format";
import { dialCodeForLocation } from "@/lib/country-codes";
import { ShareFormButton } from "@/components/share-form-button";
import { FormTemplateEditor } from "@/components/form-template-editor";

export const Route = createFileRoute("/_authenticated/forms")({
  head: () => ({ meta: [{ title: "Forms — Orbis CRM" }] }),
  component: FormsPage,
});

type FieldType = "text" | "textarea" | "number" | "phone" | "select" | "checkbox" | "rating";
interface Field {
  id: string;
  type: FieldType;
  label: string;
  options?: string[];
  required?: boolean;
}

function FormsPage() {
  const { user } = useAuth();
  const canManageTemplates = useCan("can_manage_templates");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name_asc" | "name_desc">("newest");
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");

  const [pickerTemplate, setPickerTemplate] = useState<{ id: string; name: string; activity_type: string } | null>(null);
  const [activityId, setActivityId] = useState<string>("");

  // Template creation state
  const [tplOpen, setTplOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<Field[]>([]);

  const { data: templates } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await supabase.from("form_templates").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: instances } = useQuery({
    queryKey: ["form-instances"],
    queryFn: async () =>
      (await supabase
        .from("form_instances")
        .select("id, name, event_date, country_code, template_id, activity_id, created_at")
        .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const { data: activities } = useQuery({
    enabled: !!pickerTemplate,
    queryKey: ["activities-for-form"],
    queryFn: async () => {
      return (await supabase
        .from("activities")
        .select("id, title, day_date, location, to_country, from_country, type")
        .order("day_date", { ascending: false })
        .limit(500)
      ).data ?? [];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("form_templates").insert({
        created_by: user.id,
        name, description, activity_type: "other" as any,
        fields: fields as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template created");
      setTplOpen(false);
      setName(""); setDescription(""); setFields([]);
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("form_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addField = (type: FieldType) => {
    setFields([...fields, { id: crypto.randomUUID(), type, label: "", required: false, options: type === "select" ? [] : undefined }]);
  };
  const updateField = (id: string, patch: Partial<Field>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const generate = useMutation({
    mutationFn: async () => {
      if (!user || !pickerTemplate || !activityId) throw new Error("Pick an activity");
      const activity = activities?.find((a) => a.id === activityId);
      if (!activity) throw new Error("Activity not found");
      const dial = dialCodeForLocation(activity.to_country, activity.from_country, activity.location);
      const { data, error } = await supabase
        .from("form_instances")
        .insert({
          template_id: pickerTemplate.id,
          activity_id: activity.id,
          created_by: user.id,
          name: activity.title,
          event_date: activity.day_date,
          country_code: dial,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Form generated");
      setPickerTemplate(null);
      setActivityId("");
      qc.invalidateQueries({ queryKey: ["form-instances"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeInstance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("form_instances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["form-instances"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const activityTypes = useMemo(() => {
    const s = new Set<string>();
    for (const t of templates ?? []) if (t.activity_type) s.add(t.activity_type);
    return Array.from(s).sort();
  }, [templates]);

  const q = search.trim().toLowerCase();
  const matchesSearch = (text: string) => q === "" || text.toLowerCase().includes(q);

  const filteredTemplates = useMemo(() => {
    let list = (templates ?? []).filter((t: any) => {
      if (!matchesSearch(`${t.name ?? ""} ${t.description ?? ""}`)) return false;
      if (activityTypeFilter !== "all" && t.activity_type !== activityTypeFilter) return false;
      return true;
    });
    list = [...list];
    if (sort === "newest") list.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    if (sort === "oldest") list.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    if (sort === "name_asc") list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    if (sort === "name_desc") list.sort((a, b) => (b.name ?? "").localeCompare(a.name ?? ""));
    return list;
  }, [templates, search, sort, activityTypeFilter]);

  const filteredInstances = useMemo(() => {
    let list = (instances ?? []).filter((inst: any) => {
      const template = templates?.find((t: any) => t.id === inst.template_id);
      const hay = `${inst.name ?? ""} ${template?.name ?? ""} ${template?.activity_type ?? ""} ${inst.country_code ?? ""}`;
      return matchesSearch(hay);
    });
    list = [...list];
    if (sort === "newest") list.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    if (sort === "oldest") list.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    if (sort === "name_asc") list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    if (sort === "name_desc") list.sort((a, b) => (b.name ?? "").localeCompare(a.name ?? ""));
    return list;
  }, [instances, templates, search, sort]);

  const filtersActive = search !== "" || sort !== "newest" || activityTypeFilter !== "all";

  return (
    <PageContainer>
      <PageHeader
        title="Forms"
        description="Generate recruitment forms from templates, share them via QR/link, and collect submissions — even offline."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search forms…"
                className="pl-8 h-9 w-48"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as any)}>
              <SelectTrigger className="h-9 w-36">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name_asc">Name A–Z</SelectItem>
                <SelectItem value="name_desc">Name Z–A</SelectItem>
              </SelectContent>
            </Select>
            <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Activity type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {activityTypes.map((t) => (
                  <SelectItem key={t} value={t}>{ACTIVITY_TYPE_LABELS[t] ?? t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setSort("newest"); setActivityTypeFilter("all"); }}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
            {canManageTemplates ? (
              <Dialog open={tplOpen} onOpenChange={setTplOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-1.5" /> New template</Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>New form template</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event check-in form" /></div>
                  <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>

                  <div className="border-t pt-3">
                    <Label className="mb-2 block">Fields</Label>
                    <div className="space-y-2 mb-3">
                      {fields.map((f) => (
                        <Card key={f.id} className="p-3">
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-2" />
                            <div className="flex-1 space-y-2">
                              <div className="flex gap-2">
                                <Input placeholder="Question label" value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} />
                                <span className="text-xs text-muted-foreground self-center capitalize">{f.type}</span>
                              </div>
                              {f.type === "select" && (
                                <Input
                                  placeholder="Options, comma separated"
                                  value={f.options?.join(", ") ?? ""}
                                  onChange={(e) => updateField(f.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                                />
                              )}
                            </div>
                            <button onClick={() => setFields(fields.filter((x) => x.id !== f.id))} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </Card>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["text", "textarea", "number", "phone", "select", "checkbox", "rating"] as FieldType[]).map((t) => (
                        <Button key={t} variant="outline" size="sm" type="button" onClick={() => addField(t)}>
                          + {t}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button onClick={() => createTemplate.mutate()} disabled={!name || fields.length === 0} className="w-full">
                    Create template
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
          </div>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Templates</h2>
        {templates && templates.length > 0 ? (
          filteredTemplates.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTemplates.map((t) => (
                <Card key={t.id} className="p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {t.activity_type ? (ACTIVITY_TYPE_LABELS[t.activity_type] ?? t.activity_type) : (t.form_type ?? "form")} • {Array.isArray(t.fields) ? t.fields.length : 0} fields
                      </div>
                    </div>
                    {canManageTemplates && (
                      <button
                        onClick={() => { if (confirm("Delete template?")) removeTemplate.mutate(t.id); }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete template"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{t.description}</p>}
                  <div className="mt-auto pt-3">
                    <Button
                      size="sm"
                      onClick={() => {
                        setPickerTemplate({ id: t.id, name: t.name, activity_type: t.activity_type ?? "other" });
                        setActivityId("");
                      }}
                    >
                      <FilePlus2 className="h-4 w-4 mr-1.5" /> Use form
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No templates match your search or filters.
            </Card>
          )
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No templates yet.{" "}
            {canManageTemplates ? "Click \"New template\" to create one." : "Ask an admin to create one, or to grant you the \"Manage master forms\" permission."}
          </Card>
        )}
      </section>

      <section className="space-y-3 mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Generated forms</h2>
        {instances && instances.length > 0 ? (
          filteredInstances.length > 0 ? (
            <div className="space-y-2">
              {filteredInstances.map((inst) => {
                const url = `${origin}/f/${inst.id}`;
                return (
                  <Card key={inst.id} className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{inst.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {inst.event_date ? new Date(inst.event_date).toLocaleDateString(undefined, { dateStyle: "medium" }) : "No date"}
                        {inst.country_code ? ` • default ${inst.country_code}` : ""}
                      </div>
                    </div>
                    <ShareFormButton url={url} title={inst.name} />
                    <Button size="sm" variant="outline" asChild>
                      <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1.5" /> Open</a>
                    </Button>
                    <button
                      onClick={() => { if (confirm("Delete this form?")) removeInstance.mutate(inst.id); }}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete form"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No generated forms match your search or sort.
            </Card>
          )
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No forms generated yet. Pick a template above to generate one for an activity.
          </Card>
        )}
      </section>

      <Dialog open={!!pickerTemplate} onOpenChange={(o) => { if (!o) { setPickerTemplate(null); setActivityId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate form from "{pickerTemplate?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Activity</Label>
              <Select value={activityId} onValueChange={setActivityId}>
                <SelectTrigger><SelectValue placeholder="Pick an activity from your itinerary" /></SelectTrigger>
                <SelectContent>
                  {(activities ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title} — {a.day_date}{a.location ? ` • ${a.location}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                The form name and date will match the activity. Phone fields will default to the country's dial code.
              </p>
            </div>
            <Button onClick={() => generate.mutate()} disabled={!activityId || generate.isPending} className="w-full">
              {generate.isPending ? "Generating…" : "Generate form"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
