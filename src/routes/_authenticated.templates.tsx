import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { ACTIVITY_TYPE_LABELS } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({ meta: [{ title: "Form Templates — Orbis CRM" }] }),
  component: TemplatesPage,
});

type FieldType = "text" | "textarea" | "number" | "phone" | "select" | "checkbox" | "rating";
interface Field {
  id: string;
  type: FieldType;
  label: string;
  options?: string[];
  required?: boolean;
}

const ACTIVITY_TYPES = ["agent_visit", "school_visit", "recruitment_event", "travel", "resting_day", "other"];

function TemplatesPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<Field[]>([]);


  const { data: templates } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await supabase.from("form_templates").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
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
      setOpen(false);
      setName(""); setDescription(""); setFields([]);
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: any) => toast.error(e.message),
  });


  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("form_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  const addField = (type: FieldType) => {
    setFields([...fields, { id: crypto.randomUUID(), type, label: "", required: false, options: type === "select" ? [] : undefined }]);
  };

  const updateField = (id: string, patch: Partial<Field>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  if (!isAdmin) {
    return (
      <PageContainer>
        <PageHeader title="Form Templates" />
        <Card className="p-8 text-center text-muted-foreground">
          Only administrators can manage form templates.
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Form Templates"
        description="Create reusable forms for recruitment events and visits."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New template</Button></DialogTrigger>
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

                <Button onClick={() => create.mutate()} disabled={!name || fields.length === 0} className="w-full">Create template</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {templates && templates.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {ACTIVITY_TYPE_LABELS[t.activity_type]} • {Array.isArray(t.fields) ? t.fields.length : 0} fields
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-2">{t.description}</p>}
                </div>
                <button onClick={() => confirm("Delete template?") && remove.mutate(t.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center text-muted-foreground">No templates yet.</Card>
      )}
    </PageContainer>
  );
}
