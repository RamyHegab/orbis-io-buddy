import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SCHEMAS, type ImportType } from "@/lib/import-mapping";
import { CheckCircle2 } from "lucide-react";

const TYPES: ImportType[] = ["school", "agent", "agent_branch"];

const searchSchema = z.object({ agent: z.string().optional() });

export const Route = createFileRoute("/public/intake/$type")({
  validateSearch: searchSchema,
  head: ({ params }) => ({ meta: [{ title: `Submit ${params.type === "agent_branch" ? "branch" : params.type} — Orbis CRM` }] }),
  component: IntakePage,
});

function IntakePage() {
  const { type } = Route.useParams();
  const { agent } = useSearch({ from: "/public/intake/$type" });
  if (!TYPES.includes(type as ImportType)) {
    return <div className="min-h-screen flex items-center justify-center p-6 text-muted-foreground">Unknown form type.</div>;
  }
  const t = type as ImportType;
  const fields = SCHEMAS[t];
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitter, setSubmitter] = useState({ name: "", email: "", honey: "" });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);

  useEffect(() => {
    if (t === "agent_branch" && agent) {
      supabase.from("agents").select("trading_name").eq("id", agent).maybeSingle()
        .then(({ data }) => setAgentName(data?.trading_name ?? null));
    }
  }, [t, agent]);


  const submit = async () => {
    if (submitter.honey) return; // bot
    const missing = fields.filter((f) => f.required && !values[f.key]?.trim());
    if (missing.length) { toast.error(`Missing: ${missing.map((m) => m.label).join(", ")}`); return; }
    setBusy(true);
    const { error } = await supabase.from("pending_submissions").insert({
      type: t,
      payload: values,
      submitter_name: submitter.name || null,
      submitter_email: submitter.email || null,
      agent_id: t === "agent_branch" ? agent ?? null : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
  };

  const label = t === "agent_branch" ? "agent branch" : t;

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-xl font-semibold">Thank you</h1>
          <p className="text-sm text-muted-foreground">Your submission has been received and will be reviewed shortly.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <Card className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold capitalize">New {label}</h1>
          <p className="text-sm text-muted-foreground mt-1">Fill out this form to be added to our records.</p>
        </div>

        <div className="space-y-3 pb-4 border-b">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Your name</Label><Input value={submitter.name} onChange={(e) => setSubmitter({ ...submitter, name: e.target.value })} /></div>
            <div><Label>Your email</Label><Input type="email" value={submitter.email} onChange={(e) => setSubmitter({ ...submitter, email: e.target.value })} /></div>
          </div>
          <input type="text" tabIndex={-1} autoComplete="off" className="hidden" value={submitter.honey} onChange={(e) => setSubmitter({ ...submitter, honey: e.target.value })} />
        </div>

        {t === "agent_branch" && (
          <div>
            <Label>Agent</Label>
            <Input value={agentName ?? (agent ? "Loading…" : "(not specified)")} disabled readOnly />
            <p className="text-xs text-muted-foreground mt-1">This branch will be added to the agent above.</p>
          </div>
        )}


        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <Label>{f.label}{f.required && " *"}</Label>
              {f.key === "notes" ? (
                <Textarea value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              ) : (
                <Input value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              )}
            </div>
          ))}
        </div>

        <Button className="w-full" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit"}</Button>
      </Card>
    </div>
  );
}
