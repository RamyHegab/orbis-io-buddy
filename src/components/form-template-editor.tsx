import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus, ChevronUp, ChevronDown, Lock, FileUp } from "lucide-react";
import {
  type Field,
  type FieldType,
  type Part,
  isLockedId,
  lockedFor,
} from "@/lib/agent-signup-locked";
import { parseDocxToCandidateFields } from "@/lib/docx-parse";

type FormType = "agent_signup" | "reference_request" | "agent_branch" | "event_checkin" | "school_visit" | "agent_visit" | "recruitment_event" | "other";

const SPECIAL_TYPES: FormType[] = ["agent_signup", "reference_request", "agent_branch"];
const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "number",
  "email",
  "phone",
  "date",
  "select",
  "checkbox",
  "rating",
  "file",
  "repeatable_group",
];

interface Template {
  id: string;
  name: string;
  description: string | null;
  form_type: string;
  fields: Field[] | any;
  parts: Part[] | any;
  is_active: boolean;
  is_system: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: Template | null; // null = new
  currentUserId?: string;
  isAdmin: boolean;
}

function newPart(title = "Section"): Part {
  return { id: crypto.randomUUID(), title, field_ids: [] };
}

function newField(type: FieldType): Field {
  return {
    id: crypto.randomUUID(),
    type,
    label: "",
    required: false,
    options: type === "select" ? [] : undefined,
    subfields: type === "repeatable_group" ? [{ id: crypto.randomUUID(), label: "", type: "text" }] : undefined,
    min: type === "repeatable_group" ? 0 : undefined,
    multiple: type === "file" ? false : undefined,
  };
}

export function FormTemplateEditor({ open, onOpenChange, template, currentUserId, isAdmin }: Props) {
  const qc = useQueryClient();
  const isNew = !template;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formType, setFormType] = useState<FormType>("other");
  const [isActive, setIsActive] = useState(true);
  const [parts, setParts] = useState<Part[]>([]);
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name ?? "");
      setDescription(template.description ?? "");
      setFormType((template.form_type ?? "other") as FormType);
      setIsActive(!!template.is_active);
      const rawFields: Field[] = Array.isArray(template.fields) ? (template.fields as Field[]) : [];
      const rawParts: Part[] = Array.isArray(template.parts) ? (template.parts as Part[]) : [];
      // If system template and empty, seed with locked defaults for its type
      const locked = lockedFor(template.form_type);
      if (rawFields.length === 0 && locked) {
        setFields(locked.fields);
        setParts([locked.part]);
      } else {
        setFields(rawFields);
        setParts(rawParts.length ? rawParts : [{ id: crypto.randomUUID(), title: "Section", field_ids: rawFields.map((f) => f.id) }]);
      }
    } else {
      setName("");
      setDescription("");
      setFormType("other");
      setIsActive(true);
      setParts([newPart()]);
      setFields([]);
    }
  }, [open, template]);

  // Sync locked defaults when form_type changes on a new template.
  useEffect(() => {
    if (!isNew) return;
    const locked = lockedFor(formType);
    if (locked) {
      setFields(locked.fields);
      setParts([locked.part]);
    } else {
      // remove any lingering locked fields
      setFields((prev) => prev.filter((f) => !isLockedId(f.id)));
      setParts((prev) => prev.filter((p) => !isLockedId(p.id)));
    }
  }, [formType, isNew]);

  const fieldById = useMemo(() => {
    const m = new Map<string, Field>();
    for (const f of fields) m.set(f.id, f);
    return m;
  }, [fields]);

  const orphanFieldIds = useMemo(() => {
    const inParts = new Set<string>();
    for (const p of parts) for (const id of p.field_ids) inParts.add(id);
    return fields.filter((f) => !inParts.has(f.id)).map((f) => f.id);
  }, [parts, fields]);

  const addPart = () => setParts([...parts, newPart(`Section ${parts.length + 1}`)]);
  const removePart = (id: string) => {
    if (isLockedId(id)) return;
    const p = parts.find((x) => x.id === id);
    if (!p) return;
    // move its non-locked fields to first non-locked part (or delete them if none)
    const target = parts.find((x) => x.id !== id && !isLockedId(x.id));
    const keepIds = p.field_ids.filter((fid) => isLockedId(fid));
    const moveIds = p.field_ids.filter((fid) => !isLockedId(fid));
    let nextParts = parts.filter((x) => x.id !== id);
    if (target) {
      nextParts = nextParts.map((x) => (x.id === target.id ? { ...x, field_ids: [...x.field_ids, ...moveIds] } : x));
    } else {
      setFields(fields.filter((f) => !moveIds.includes(f.id)));
    }
    // put locked ones back into first locked part if any
    if (keepIds.length) {
      const lockedPart = nextParts.find((x) => isLockedId(x.id));
      if (lockedPart) {
        nextParts = nextParts.map((x) => (x.id === lockedPart.id ? { ...x, field_ids: [...x.field_ids, ...keepIds] } : x));
      }
    }
    setParts(nextParts);
  };
  const movePart = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= parts.length) return;
    const copy = [...parts];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    setParts(copy);
  };

  const addField = (partId: string, type: FieldType) => {
    const f = newField(type);
    setFields([...fields, f]);
    setParts(parts.map((p) => (p.id === partId ? { ...p, field_ids: [...p.field_ids, f.id] } : p)));
  };
  const updateField = (id: string, patch: Partial<Field>) => {
    if (isLockedId(id)) return;
    setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };
  const removeField = (partId: string, fieldId: string) => {
    if (isLockedId(fieldId)) return;
    setFields(fields.filter((f) => f.id !== fieldId));
    setParts(parts.map((p) => (p.id === partId ? { ...p, field_ids: p.field_ids.filter((x) => x !== fieldId) } : p)));
  };
  const moveField = (partId: string, idx: number, dir: -1 | 1) => {
    setParts(
      parts.map((p) => {
        if (p.id !== partId) return p;
        const j = idx + dir;
        if (j < 0 || j >= p.field_ids.length) return p;
        const copy = [...p.field_ids];
        [copy[idx], copy[j]] = [copy[j], copy[idx]];
        return { ...p, field_ids: copy };
      }),
    );
  };

  const importDocx = async (file: File) => {
    try {
      const candidates = await parseDocxToCandidateFields(file);
      if (candidates.length === 0) {
        toast.error("No fields detected in the document");
        return;
      }
      // Append to last non-locked part (or create a new one).
      let target = [...parts].reverse().find((p) => !isLockedId(p.id));
      let nextParts = parts;
      if (!target) {
        target = newPart("Imported from Word");
        nextParts = [...parts, target];
      }
      setFields([...fields, ...candidates]);
      setParts(
        nextParts.map((p) =>
          p.id === target!.id ? { ...p, field_ids: [...p.field_ids, ...candidates.map((c) => c.id)] } : p,
        ),
      );
      toast.success(`Imported ${candidates.length} candidate field${candidates.length === 1 ? "" : "s"}. Review each below.`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to parse the document");
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      // Ensure locked defaults are present for special types.
      const locked = lockedFor(formType);
      let finalFields = fields;
      let finalParts = parts;
      if (locked) {
        const lockedIds = new Set(locked.fields.map((f) => f.id));
        const nonLocked = finalFields.filter((f) => !lockedIds.has(f.id));
        finalFields = [...locked.fields, ...nonLocked];
        // ensure locked part is first and contains all locked field ids
        const withoutLockedPart = finalParts.filter((p) => p.id !== locked.part.id);
        finalParts = [locked.part, ...withoutLockedPart];
      }
      // Attach any orphan fields to the first part.
      if (finalParts.length > 0 && orphanFieldIds.length > 0) {
        const firstId = finalParts[0].id;
        finalParts = finalParts.map((p) => (p.id === firstId ? { ...p, field_ids: [...p.field_ids, ...orphanFieldIds] } : p));
      }

      if (isNew) {
        if (!currentUserId) throw new Error("Not signed in");
        const { error } = await supabase.from("form_templates").insert({
          created_by: currentUserId,
          name: name.trim(),
          description: description.trim() || null,
          form_type: formType as any,
          activity_type: "other" as any,
          fields: finalFields as any,
          parts: finalParts as any,
          is_active: isActive,
        });
        if (error) throw error;
      } else if (template) {
        const { error } = await supabase
          .from("form_templates")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            form_type: formType as any,
            fields: finalFields as any,
            parts: finalParts as any,
            is_active: isActive,
          })
          .eq("id", template.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isNew ? "Template created" : "Template saved");
      qc.invalidateQueries({ queryKey: ["templates"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const specialLocked = !!lockedFor(formType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "New form template" : `Edit template — ${template?.name}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Form type</Label>
              <Select
                value={formType}
                onValueChange={(v) => setFormType(v as FormType)}
                disabled={!isNew || (template?.is_system ?? false)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="other">General</SelectItem>
                  <SelectItem value="event_checkin">Event check-in</SelectItem>
                  <SelectItem value="school_visit">School visit</SelectItem>
                  <SelectItem value="agent_visit">Agent visit</SelectItem>
                  <SelectItem value="recruitment_event">Recruitment event</SelectItem>
                  {isAdmin && <SelectItem value="agent_signup">Agent signup (admin)</SelectItem>}
                  {isAdmin && <SelectItem value="reference_request">Reference request (admin)</SelectItem>}
                  {isAdmin && <SelectItem value="agent_branch">Agent branch (admin)</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Inactive templates appear in the list but can't be used until activated.</div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {specialLocked && (
            <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-xs p-3 flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                This form type includes locked fields required by the onboarding flow. You can reorder or add extra fields around them, but locked fields can't be removed.
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button size="sm" variant="outline" onClick={addPart} type="button"><Plus className="h-3.5 w-3.5 mr-1" />Add section</Button>
            <label className="inline-flex items-center gap-1 text-sm cursor-pointer">
              <Button size="sm" variant="outline" type="button" asChild>
                <span><FileUp className="h-3.5 w-3.5 mr-1" />Import from Word (.docx)</span>
              </Button>
              <input
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importDocx(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <div className="space-y-4">
            {parts.map((part, pIdx) => {
              const locked = isLockedId(part.id);
              return (
                <Card key={part.id} className="p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Input
                      value={part.title}
                      onChange={(e) => setParts(parts.map((p) => (p.id === part.id ? { ...p, title: e.target.value } : p)))}
                      className="font-medium"
                      disabled={locked}
                    />
                    {locked && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Locked</Badge>}
                    <Button size="icon" variant="ghost" onClick={() => movePart(pIdx, -1)} disabled={pIdx === 0}><ChevronUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => movePart(pIdx, 1)} disabled={pIdx === parts.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                    {!locked && (
                      <Button size="icon" variant="ghost" onClick={() => removePart(part.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {part.field_ids.map((fid, fIdx) => {
                      const f = fieldById.get(fid);
                      if (!f) return null;
                      const isLocked = isLockedId(f.id);
                      return (
                        <div key={f.id} className="rounded-md border p-2 bg-background/60">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-2">
                              <div className="flex gap-2 items-center">
                                <Input
                                  placeholder="Question label"
                                  value={f.label}
                                  onChange={(e) => updateField(f.id, { label: e.target.value })}
                                  disabled={isLocked}
                                />
                                <Select
                                  value={f.type}
                                  onValueChange={(v) => updateField(f.id, { type: v as FieldType })}
                                  disabled={isLocked}
                                >
                                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {FIELD_TYPES.map((t) => (
                                      <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    checked={!!f.required}
                                    onChange={(e) => updateField(f.id, { required: e.target.checked })}
                                    disabled={isLocked}
                                  />
                                  Required
                                </label>
                                {isLocked && <Lock className="h-3.5 w-3.5 text-amber-600" />}
                              </div>

                              {f.type === "select" && (
                                <Input
                                  placeholder="Options, comma separated"
                                  value={f.options?.join(", ") ?? ""}
                                  onChange={(e) => updateField(f.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                                  disabled={isLocked}
                                />
                              )}
                              {f.type === "file" && (
                                <div className="flex items-center gap-3 text-xs">
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={!!f.multiple}
                                      onChange={(e) => updateField(f.id, { multiple: e.target.checked })}
                                      disabled={isLocked}
                                    />
                                    Allow multiple files
                                  </label>
                                  <label className="flex items-center gap-1">
                                    Min files
                                    <Input
                                      type="number"
                                      className="h-7 w-16"
                                      value={f.min ?? 0}
                                      onChange={(e) => updateField(f.id, { min: Number(e.target.value) })}
                                      disabled={isLocked}
                                    />
                                  </label>
                                </div>
                              )}
                              {f.type === "repeatable_group" && (
                                <div className="rounded border p-2 bg-muted/30 space-y-2">
                                  <div className="flex items-center gap-3 text-xs">
                                    <label className="flex items-center gap-1">
                                      Min entries
                                      <Input
                                        type="number"
                                        className="h-7 w-16"
                                        value={f.min ?? 0}
                                        onChange={(e) => updateField(f.id, { min: Number(e.target.value) })}
                                        disabled={isLocked}
                                      />
                                    </label>
                                  </div>
                                  <div className="text-xs text-muted-foreground">Sub-fields</div>
                                  <div className="space-y-1">
                                    {(f.subfields ?? []).map((sf, sfIdx) => (
                                      <div key={sf.id} className="flex gap-2">
                                        <Input
                                          className="h-8"
                                          placeholder="Sub-field label"
                                          value={sf.label}
                                          onChange={(e) => {
                                            const list = [...(f.subfields ?? [])];
                                            list[sfIdx] = { ...sf, label: e.target.value };
                                            updateField(f.id, { subfields: list });
                                          }}
                                          disabled={isLocked}
                                        />
                                        <Select
                                          value={sf.type}
                                          onValueChange={(v) => {
                                            const list = [...(f.subfields ?? [])];
                                            list[sfIdx] = { ...sf, type: v as any };
                                            updateField(f.id, { subfields: list });
                                          }}
                                          disabled={isLocked}
                                        >
                                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {(["text", "textarea", "number", "email", "phone", "date", "select", "checkbox", "file"] as const).map((t) => (
                                              <SelectItem key={t} value={t}>{t}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {!isLocked && (
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => {
                                              const list = (f.subfields ?? []).filter((_, i) => i !== sfIdx);
                                              updateField(f.id, { subfields: list });
                                            }}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  {!isLocked && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      type="button"
                                      onClick={() => {
                                        const list = [...(f.subfields ?? []), { id: crypto.randomUUID(), label: "", type: "text" as const }];
                                        updateField(f.id, { subfields: list });
                                      }}
                                    >
                                      + Sub-field
                                    </Button>
                                  )}
                                </div>
                              )}
                              {f.hint && <div className="text-xs text-muted-foreground">{f.hint}</div>}
                            </div>

                            <div className="flex flex-col gap-1">
                              <Button size="icon" variant="ghost" onClick={() => moveField(part.id, fIdx, -1)} disabled={fIdx === 0}><ChevronUp className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => moveField(part.id, fIdx, 1)} disabled={fIdx === part.field_ids.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                              {!isLocked && (
                                <Button size="icon" variant="ghost" onClick={() => removeField(part.id, f.id)}><Trash2 className="h-4 w-4" /></Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex flex-wrap gap-1 pt-1">
                      {FIELD_TYPES.map((t) => (
                        <Button key={t} size="sm" variant="ghost" type="button" onClick={() => addField(part.id, t)}>
                          + {t}
                        </Button>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : (isNew ? "Create template" : "Save changes")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
