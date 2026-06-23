import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FilePlus2, ExternalLink, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ACTIVITY_TYPE_LABELS } from "@/lib/format";
import { dialCodeForLocation } from "@/lib/country-codes";
import { ShareFormButton } from "@/components/share-form-button";

export const Route = createFileRoute("/_authenticated/forms")({
  head: () => ({ meta: [{ title: "Forms — Orbis CRM" }] }),
  component: FormsPage,
});

function FormsPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [pickerTemplate, setPickerTemplate] = useState<{ id: string; name: string; activity_type: string } | null>(null);
  const [activityId, setActivityId] = useState<string>("");

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

  return (
    <PageContainer>
      <PageHeader
        title="Forms"
        description="Generate recruitment forms from templates, share them via QR/link, and collect submissions — even offline."
        actions={
          isAdmin ? (
            <Button asChild variant="outline">
              <Link to="/templates"><Plus className="h-4 w-4 mr-1.5" /> Manage templates</Link>
            </Button>
          ) : null
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Templates</h2>
        {templates && templates.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((t) => (
              <Card key={t.id} className="p-4 flex flex-col">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {ACTIVITY_TYPE_LABELS[t.activity_type]} • {Array.isArray(t.fields) ? t.fields.length : 0} fields
                </div>
                {t.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{t.description}</p>}
                <div className="mt-auto pt-3">
                  <Button
                    size="sm"
                    onClick={() => {
                      setPickerTemplate({ id: t.id, name: t.name, activity_type: t.activity_type });
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
            No templates yet.{" "}
            {isAdmin ? <Link to="/templates" className="underline">Create one</Link> : "Ask an admin to create one."}
          </Card>
        )}
      </section>

      <section className="space-y-3 mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Generated forms</h2>
        {instances && instances.length > 0 ? (
          <div className="space-y-2">
            {instances.map((inst) => {
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
