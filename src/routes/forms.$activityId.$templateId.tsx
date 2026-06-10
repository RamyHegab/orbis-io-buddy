import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Globe2, Star } from "lucide-react";

export const Route = createFileRoute("/forms/$activityId/$templateId")({
  head: () => ({ meta: [{ title: "Submit Form — Orbis CRM" }] }),
  component: FormFill,
});

interface Field {
  id: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox" | "rating";
  label: string;
  options?: string[];
  required?: boolean;
}

function FormFill() {
  const { activityId, templateId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const { data: template } = useQuery({
    enabled: !!user,
    queryKey: ["template", templateId],
    queryFn: async () => (await supabase.from("form_templates").select("*").eq("id", templateId).maybeSingle()).data,
  });

  const { data: activity } = useQuery({
    enabled: !!user,
    queryKey: ["activity-meta", activityId],
    queryFn: async () => (await supabase.from("activities").select("title, day_date").eq("id", activityId).maybeSingle()).data,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      const { error } = await supabase.from("form_submissions").insert({
        activity_id: activityId,
        template_id: templateId,
        user_id: user.id,
        data: values,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submitted!");
      setValues({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading || !user) return <div className="p-8 text-center">Loading…</div>;
  if (!template) return <div className="p-8 text-center text-muted-foreground">Template not found.</div>;

  const fields = (Array.isArray(template.fields) ? template.fields : []) as unknown as Field[];

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-accent/30 px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Globe2 className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">Orbis CRM</span>
        </div>

        <Card className="p-6">
          <h1 className="text-xl font-semibold mb-1">{template.name}</h1>
          {activity && <p className="text-xs text-muted-foreground mb-4">{activity.title} • {activity.day_date}</p>}
          {template.description && <p className="text-sm text-muted-foreground mb-5">{template.description}</p>}

          <div className="space-y-4">
            {fields.map((f) => (
              <div key={f.id}>
                <Label className="mb-1.5 block">{f.label || "(no label)"}</Label>
                {f.type === "text" && <Input value={values[f.id] ?? ""} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />}
                {f.type === "textarea" && <Textarea value={values[f.id] ?? ""} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />}
                {f.type === "number" && <Input type="number" value={values[f.id] ?? ""} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />}
                {f.type === "select" && (
                  <Select value={values[f.id] ?? ""} onValueChange={(v) => setValues({ ...values, [f.id]: v })}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{f.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {f.type === "checkbox" && (
                  <div className="flex items-center gap-2">
                    <Checkbox checked={!!values[f.id]} onCheckedChange={(v) => setValues({ ...values, [f.id]: v })} />
                    <span className="text-sm text-muted-foreground">Yes</span>
                  </div>
                )}
                {f.type === "rating" && (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setValues({ ...values, [f.id]: n })}
                        className="p-1"
                      >
                        <Star className={`h-6 w-6 ${(values[f.id] ?? 0) >= n ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button onClick={() => submit.mutate()} className="w-full mt-6" disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
