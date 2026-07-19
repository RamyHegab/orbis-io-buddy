import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Globe2, Star, CheckCircle2, Upload, X, Plus, Trash2 } from "lucide-react";
import { DIAL_CODE_OPTIONS } from "@/lib/country-codes";
import type { Field, Part, Subfield } from "@/lib/agent-signup-locked";

export const Route = createFileRoute("/f/t/$token")({
  head: () => ({ meta: [{ title: "Form — Orbis CRM" }] }),
  component: PublicTokenForm,
});

interface Instance {
  id: string;
  name: string;
  event_date: string | null;
  country_code: string | null;
  template_id: string | null;
  activity_id: string | null;
  form_type: string;
  template: {
    name: string;
    description: string | null;
    fields: unknown;
    parts: unknown;
    is_active: boolean;
  } | null;
}

interface UploadedFile {
  path: string;
  name: string;
  size: number;
  content_type: string | null;
}

function PublicTokenForm() {
  const { token } = Route.useParams();
  const storageKey = `form-draft:${token}`;

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: instance, isLoading } = useQuery({
    queryKey: ["form-by-token", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/form-by-token/${token}`);
      if (!res.ok) return null;
      return (await res.json()) as Instance;
    },
  });

  function updateValue(key: string, v: unknown) {
    setValues((prev) => {
      const next = { ...prev, [key]: v };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const { fields, parts } = useMemo(() => {
    const tpl = instance?.template;
    const rawFields = Array.isArray(tpl?.fields) ? (tpl!.fields as Field[]) : [];
    const rawParts = Array.isArray(tpl?.parts) ? (tpl!.parts as Part[]) : [];
    if (rawParts.length === 0 && rawFields.length > 0) {
      return {
        fields: rawFields,
        parts: [{ id: "all", title: "Details", field_ids: rawFields.map((f) => f.id) }] as Part[],
      };
    }
    return { fields: rawFields, parts: rawParts };
  }, [instance]);

  const fieldsById = useMemo(() => {
    const m = new Map<string, Field>();
    fields.forEach((f) => m.set(f.id, f));
    return m;
  }, [fields]);

  const currentPart = parts[stepIdx];
  const totalSteps = parts.length;
  const progress = totalSteps > 0 ? ((stepIdx + 1) / totalSteps) * 100 : 0;

  function validatePart(p: Part): string | null {
    for (const fid of p.field_ids) {
      const f = fieldsById.get(fid);
      if (!f || !f.required) continue;
      const v = values[f.id];
      if (f.type === "checkbox") {
        if (!v) return `"${f.label || f.id}" is required`;
      } else if (f.type === "file") {
        const arr = Array.isArray(v) ? (v as UploadedFile[]) : [];
        if (arr.length < (f.min ?? 1)) return `"${f.label}" needs at least ${f.min ?? 1} file(s)`;
      } else if (f.type === "repeatable_group") {
        const rows = Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
        if (rows.length < (f.min ?? 1)) return `"${f.label}" needs at least ${f.min ?? 1} entr${(f.min ?? 1) === 1 ? "y" : "ies"}`;
        for (let i = 0; i < rows.length; i++) {
          for (const sf of f.subfields ?? []) {
            if (sf.required && !rowFieldFilled(rows[i]?.[sf.id], sf.type)) {
              return `"${f.label}" row ${i + 1}: ${sf.label} is required`;
            }
          }
        }
      } else if (!String(v ?? "").trim()) {
        return `"${f.label || f.id}" is required`;
      }
    }
    return null;
  }

  async function next() {
    const err = currentPart ? validatePart(currentPart) : null;
    if (err) {
      toast.error(err);
      return;
    }
    if (stepIdx < totalSteps - 1) {
      setStepIdx(stepIdx + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    await submit();
  }

  async function submit() {
    if (!instance) return;
    setSubmitting(true);
    try {
      const phoneField = fields.find((f) => f.type === "phone");
      const submitterPhone = phoneField ? String(values[phoneField.id] ?? "") || null : null;

      const { error } = await supabase.rpc("submit_public_form", {
        p_token: token,
        p_data: values as never,
        p_submitter_name: null,
        p_submitter_phone: submitterPhone,
      });
      if (error) throw error;
      setDone(true);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      toast.success("Submitted!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submission failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <div className="p-8 text-center">Loading…</div>;
  if (!instance) return <ScreenMessage title="Form not found" body="This link is invalid or has been revoked." />;
  if (!instance.template) return <ScreenMessage title="Template unavailable" body="The template for this form is no longer available." />;
  if (!instance.template.is_active)
    return <ScreenMessage title="Form not ready" body="This form has not been activated yet. Please contact the sender." />;

  const defaultDial = instance.country_code || "+1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-accent/30 px-4 py-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Globe2 className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">Orbis CRM</span>
        </div>

        <Card className="p-6">
          <h1 className="text-xl font-semibold mb-1">{instance.name}</h1>
          {instance.event_date && (
            <p className="text-xs text-muted-foreground mb-2">
              {new Date(instance.event_date).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </p>
          )}
          {instance.template.description && (
            <p className="text-sm text-muted-foreground mb-4">{instance.template.description}</p>
          )}

          {done ? (
            <div className="py-10 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <div className="font-medium text-lg">Thank you!</div>
              <p className="text-sm text-muted-foreground">Your response has been submitted.</p>
            </div>
          ) : (
            <>
              {totalSteps > 1 && (
                <div className="mb-5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>
                      Step {stepIdx + 1} of {totalSteps}
                    </span>
                    <span className="truncate max-w-[60%] text-right">{currentPart?.title}</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              )}

              {currentPart && (
                <div className="space-y-4">
                  {totalSteps > 1 && <h2 className="text-base font-semibold">{currentPart.title}</h2>}
                  {currentPart.field_ids.map((fid) => {
                    const f = fieldsById.get(fid);
                    if (!f) return null;
                    return (
                      <FieldRenderer
                        key={f.id}
                        field={f}
                        value={values[f.id]}
                        onChange={(v) => updateValue(f.id, v)}
                        defaultDial={defaultDial}
                        token={token}
                      />
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 mt-6">
                {stepIdx > 0 && (
                  <Button variant="outline" onClick={() => setStepIdx(stepIdx - 1)} disabled={submitting}>
                    Back
                  </Button>
                )}
                <Button className="flex-1" onClick={next} disabled={submitting}>
                  {submitting ? "Submitting…" : stepIdx < totalSteps - 1 ? "Next" : "Submit"}
                </Button>
              </div>
            </>
          )}
        </Card>

        {!done && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            Your progress is saved on this device. You can close this page and come back later using the same link.
          </p>
        )}
      </div>
    </div>
  );
}

function rowFieldFilled(v: unknown, type: Subfield["type"]) {
  if (type === "checkbox") return !!v;
  if (type === "file") return Array.isArray(v) && (v as UploadedFile[]).length > 0;
  return String(v ?? "").trim().length > 0;
}

function ScreenMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8 text-center space-y-2">
        <div className="font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{body}</p>
      </Card>
    </div>
  );
}

// ---------- Field renderer ----------

interface FieldRendererProps {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  defaultDial: string;
  token: string;
}

function FieldRenderer({ field: f, value, onChange, defaultDial, token }: FieldRendererProps) {
  const label = (
    <Label className="mb-1.5 block">
      {f.label || "(no label)"} {f.required && <span className="text-destructive">*</span>}
    </Label>
  );

  const hint = f.hint ? <p className="text-xs text-muted-foreground mt-1">{f.hint}</p> : null;

  return (
    <div>
      {label}
      {f.type === "text" && (
        <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.type === "textarea" && (
        <Textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />
      )}
      {f.type === "number" && (
        <Input type="number" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.type === "email" && (
        <Input type="email" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.type === "date" && (
        <Input type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.type === "phone" && (
        <PhoneInput value={(value as string) ?? ""} defaultDial={defaultDial} onChange={(v) => onChange(v)} />
      )}
      {f.type === "select" && (
        <Select value={(value as string) ?? ""} onValueChange={(v) => onChange(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {f.options?.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {f.type === "checkbox" && (
        <div className="flex items-center gap-2">
          <Checkbox checked={!!value} onCheckedChange={(v) => onChange(v)} />
          <span className="text-sm text-muted-foreground">Yes</span>
        </div>
      )}
      {f.type === "rating" && (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="p-1"
              aria-label={`Rate ${n}`}
            >
              <Star
                className={`h-6 w-6 ${
                  ((value as number) ?? 0) >= n ? "fill-primary text-primary" : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
      )}
      {f.type === "file" && (
        <FileField
          value={Array.isArray(value) ? (value as UploadedFile[]) : []}
          onChange={(v) => onChange(v)}
          multiple={!!f.multiple}
          token={token}
          fieldId={f.id}
          accept={f.accept}
        />
      )}
      {f.type === "repeatable_group" && (
        <RepeatableGroup
          value={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
          onChange={(v) => onChange(v)}
          subfields={f.subfields ?? []}
          min={f.min ?? 0}
          token={token}
        />
      )}
      {hint}
    </div>
  );
}

// ---------- File field ----------

function FileField({
  value,
  onChange,
  multiple,
  token,
  fieldId,
  accept,
}: {
  value: UploadedFile[];
  onChange: (v: UploadedFile[]) => void;
  multiple: boolean;
  token: string;
  fieldId: string;
  accept?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("field_id", fieldId);
        const res = await fetch(`/api/public/form-upload/${token}`, { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Upload failed");
        }
        const j = (await res.json()) as UploadedFile;
        uploaded.push(j);
      }
      onChange(multiple ? [...value, ...uploaded] : uploaded);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
        <Upload className="h-4 w-4" />
        <span>{busy ? "Uploading…" : multiple ? "Add files" : "Choose file"}</span>
        <input
          type="file"
          className="hidden"
          multiple={multiple}
          accept={accept}
          disabled={busy}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((f, i) => (
            <li key={f.path} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1.5">
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-muted-foreground">{formatSize(f.size)}</span>
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ---------- Repeatable group ----------

function RepeatableGroup({
  value,
  onChange,
  subfields,
  min,
  token,
}: {
  value: Record<string, unknown>[];
  onChange: (v: Record<string, unknown>[]) => void;
  subfields: Subfield[];
  min: number;
  token: string;
}) {
  const rows = value.length > 0 ? value : Array.from({ length: Math.max(min, 0) }, () => ({}));

  function update(i: number, key: string, v: unknown) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r));
    onChange(next);
  }
  function add() {
    onChange([...rows, {}]);
  }
  function remove(i: number) {
    if (rows.length <= min) {
      toast.error(`At least ${min} entry required`);
      return;
    }
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <Card key={i} className="p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">Entry {i + 1}</div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remove entry"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {subfields.map((sf) => (
            <div key={sf.id}>
              <Label className="mb-1 block text-xs">
                {sf.label} {sf.required && <span className="text-destructive">*</span>}
              </Label>
              {sf.type === "text" && (
                <Input value={(row[sf.id] as string) ?? ""} onChange={(e) => update(i, sf.id, e.target.value)} />
              )}
              {sf.type === "email" && (
                <Input
                  type="email"
                  value={(row[sf.id] as string) ?? ""}
                  onChange={(e) => update(i, sf.id, e.target.value)}
                />
              )}
              {sf.type === "textarea" && (
                <Textarea
                  value={(row[sf.id] as string) ?? ""}
                  onChange={(e) => update(i, sf.id, e.target.value)}
                  rows={2}
                />
              )}
              {sf.type === "number" && (
                <Input
                  type="number"
                  value={(row[sf.id] as string) ?? ""}
                  onChange={(e) => update(i, sf.id, e.target.value)}
                />
              )}
              {sf.type === "date" && (
                <Input
                  type="date"
                  value={(row[sf.id] as string) ?? ""}
                  onChange={(e) => update(i, sf.id, e.target.value)}
                />
              )}
              {sf.type === "phone" && (
                <Input value={(row[sf.id] as string) ?? ""} onChange={(e) => update(i, sf.id, e.target.value)} />
              )}
              {sf.type === "checkbox" && (
                <Checkbox
                  checked={!!row[sf.id]}
                  onCheckedChange={(v) => update(i, sf.id, v)}
                />
              )}
              {sf.type === "file" && (
                <FileField
                  value={Array.isArray(row[sf.id]) ? (row[sf.id] as UploadedFile[]) : []}
                  onChange={(v) => update(i, sf.id, v)}
                  multiple={false}
                  token={token}
                  fieldId={`${sf.id}_${i}`}
                />
              )}
              {sf.type === "select" && (
                <Input value={(row[sf.id] as string) ?? ""} onChange={(e) => update(i, sf.id, e.target.value)} />
              )}
              {sf.type === "rating" && (
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={(row[sf.id] as string) ?? ""}
                  onChange={(e) => update(i, sf.id, e.target.value)}
                />
              )}
            </div>
          ))}
        </Card>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1.5" /> Add entry
      </Button>
    </div>
  );
}

// ---------- Phone ----------

function PhoneInput({
  value,
  defaultDial,
  onChange,
}: {
  value: string;
  defaultDial: string;
  onChange: (v: string) => void;
}) {
  const initial = parseValue(value, defaultDial);
  const [dial, setDial] = useState(initial.dial);
  const [number, setNumber] = useState(initial.number);

  function commit(nextDial: string, nextNumber: string) {
    setDial(nextDial);
    setNumber(nextNumber);
    onChange(`${nextDial} ${nextNumber}`.trim());
  }

  const opts = ensureDial(DIAL_CODE_OPTIONS, defaultDial);

  return (
    <div className="flex gap-1.5">
      <Select value={dial} onValueChange={(v) => commit(v, number)}>
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {opts.map((o) => (
            <SelectItem key={o.code} value={o.code}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        value={number}
        onChange={(e) => commit(dial, e.target.value.replace(/[^\d\s-]/g, ""))}
        placeholder="Phone number"
      />
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
