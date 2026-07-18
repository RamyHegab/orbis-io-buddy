import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Globe2, Star, WifiOff, CheckCircle2 } from "lucide-react";
import { DIAL_CODE_OPTIONS } from "@/lib/country-codes";
import { enqueueSubmission, flushQueue, getPendingCount } from "@/lib/offline-queue";

export const Route = createFileRoute("/f/$instanceId")({
  head: () => ({ meta: [{ title: "Form — Orbis CRM" }] }),
  component: PublicFormFill,
});

interface Field {
  id: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox" | "rating" | "phone";
  label: string;
  options?: string[];
  required?: boolean;
}

function PublicFormFill() {
  const { instanceId } = Route.useParams();
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitterName, setSubmitterName] = useState("");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(getPendingCount(instanceId));
    const onOnline = async () => {
      setOnline(true);
      const r = await flushQueue(instanceId);
      setPending(getPendingCount(instanceId));
      if (r.uploaded > 0) toast.success(`Synced ${r.uploaded} offline submission${r.uploaded > 1 ? "s" : ""}`);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (navigator.onLine) onOnline();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [instanceId]);

  const { data: instance, isLoading } = useQuery({
    queryKey: ["form-instance", instanceId],
    queryFn: async () => {
      const res = await fetch(`/api/public/form-instance/${instanceId}`);
      if (!res.ok) return null;
      return (await res.json()) as {
        id: string;
        name: string;
        event_date: string | null;
        country_code: string | null;
        template_id: string | null;
        activity_id: string | null;
        template: { name: string; description: string | null; fields: unknown } | null;
      };
    },
  });


  async function submit() {
    if (!instance) return;
    setSubmitting(true);
    // collect phone(s) for top-level convenience column
    const fields = (Array.isArray(instance.template?.fields) ? instance.template?.fields : []) as unknown as Field[];
    const phoneField = fields.find((f) => f.type === "phone");
    const submitterPhone = phoneField ? String(values[phoneField.id] ?? "") : null;

    const payload = {
      instance_id: instance.id,
      template_id: instance.template_id ?? "",
      activity_id: instance.activity_id ?? "",
      data: values,
      submitter_name: submitterName || null,
      submitter_phone: submitterPhone,
    };


    try {
      if (!navigator.onLine) throw new Error("offline");
      const { error } = await supabase.from("form_submissions").insert(payload as any);
      if (error) throw error;
      setDone(true);
      setValues({});
      setSubmitterName("");
      toast.success("Submitted!");
    } catch (e: any) {
      enqueueSubmission(payload);
      setPending(getPendingCount(instanceId));
      setDone(true);
      setValues({});
      setSubmitterName("");
      toast.success("Saved offline — will sync when online");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <div className="p-8 text-center">Loading…</div>;
  if (!instance) return <div className="p-8 text-center text-muted-foreground">Form not found.</div>;
  if (!instance.template) return <div className="p-8 text-center text-muted-foreground">Template unavailable.</div>;

  const fields = (Array.isArray(instance.template.fields) ? instance.template.fields : []) as unknown as Field[];
  const defaultDial = instance.country_code || "+1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-accent/30 px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Globe2 className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">Orbis CRM</span>
        </div>

        {(!online || pending > 0) && (
          <Card className="p-3 mb-3 flex items-center gap-2 text-xs">
            <WifiOff className="h-4 w-4 text-amber-500" />
            <span className="flex-1">
              {!online ? "You're offline — submissions are saved on this device. " : ""}
              {pending > 0 ? `${pending} pending upload${pending > 1 ? "s" : ""}.` : "Will sync when online."}
            </span>
          </Card>
        )}

        <Card className="p-6">
          <h1 className="text-xl font-semibold mb-1">{instance.name}</h1>
          {instance.event_date && (
            <p className="text-xs text-muted-foreground mb-4">
              {new Date(instance.event_date).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </p>
          )}
          {instance.template.description && (
            <p className="text-sm text-muted-foreground mb-5">{instance.template.description}</p>
          )}

          {done ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <div className="font-medium">Thank you!</div>
              <p className="text-sm text-muted-foreground">Your response has been recorded.</p>
              <Button variant="outline" onClick={() => setDone(false)}>Submit another</Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Your name</Label>
                  <Input value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} placeholder="Optional" />
                </div>
                {fields.map((f) => (
                  <div key={f.id}>
                    <Label className="mb-1.5 block">
                      {f.label || "(no label)"} {f.required && <span className="text-destructive">*</span>}
                    </Label>
                    {f.type === "text" && <Input value={values[f.id] ?? ""} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />}
                    {f.type === "textarea" && <Textarea value={values[f.id] ?? ""} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />}
                    {f.type === "number" && <Input type="number" value={values[f.id] ?? ""} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />}
                    {f.type === "phone" && <PhoneInput value={values[f.id] ?? ""} defaultDial={defaultDial} onChange={(v) => setValues({ ...values, [f.id]: v })} />}
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
                          <button key={n} type="button" onClick={() => setValues({ ...values, [f.id]: n })} className="p-1">
                            <Star className={`h-6 w-6 ${(values[f.id] ?? 0) >= n ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button onClick={submit} className="w-full mt-6" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function PhoneInput({ value, defaultDial, onChange }: { value: string; defaultDial: string; onChange: (v: string) => void }) {
  // value format: "+20 1234567"
  const initial = parseValue(value, defaultDial);
  const [dial, setDial] = useState(initial.dial);
  const [number, setNumber] = useState(initial.number);

  useEffect(() => {
    onChange(`${dial} ${number}`.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dial, number]);

  const opts = ensureDial(DIAL_CODE_OPTIONS, defaultDial);

  return (
    <div className="flex gap-1.5">
      <Select value={dial} onValueChange={setDial}>
        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          {opts.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input type="tel" value={number} onChange={(e) => setNumber(e.target.value.replace(/[^\d\s-]/g, ""))} placeholder="Phone number" />
    </div>
  );
}

function parseValue(v: string, fallback: string) {
  if (!v) return { dial: fallback, number: "" };
  const m = v.match(/^(\+\d+)\s*(.*)$/);
  if (m) return { dial: m[1], number: m[2] };
  return { dial: fallback, number: v };
}

function ensureDial(opts: { code: string; label: string }[], code: string) {
  if (opts.some((o) => o.code === code)) return opts;
  return [{ code, label: code }, ...opts];
}
