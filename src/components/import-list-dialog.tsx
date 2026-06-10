import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { SCHEMAS, autoMatch, mapRow, parseWorkbook, type ImportType } from "@/lib/import-mapping";


type Props = {
  type: ImportType;
  agentId?: string;
  triggerLabel?: string;
  onDone?: () => void;
};

type Step = "upload" | "map" | "conflicts" | "done";

type RowAction = "skip" | "merge" | "create";
type Conflict = {
  index: number;
  incoming: Record<string, any>;
  existing: Record<string, any>;
  action: RowAction;
  // For each field that differs: "existing" keeps DB value, "incoming" replaces with sheet value
  fieldChoice: Record<string, "existing" | "incoming">;
};

const SKIP = "__skip__";

export function ImportListDialog({ type, agentId, triggerLabel = "Import list", onDone }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fields = SCHEMAS[type];
  const tableName = type === "school" ? "schools" : type === "agent" ? "agents" : "agent_branches";

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [newRows, setNewRows] = useState<Record<string, any>[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep("upload"); setHeaders([]); setRows([]); setMapping({});
    setConflicts([]); setNewRows([]); setBusy(false);
  };

  const handleFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
    if (!json.length) { toast.error("Sheet is empty"); return; }
    const hdrs = Object.keys(json[0]);
    setHeaders(hdrs);
    setRows(json);
    setMapping(autoMatch(hdrs, fields));
    setStep("map");
  };

  const preview = useMemo(() => rows.slice(0, 3).map((r) => mapRow(r, mapping)), [rows, mapping]);

  const proceed = async () => {
    if (!user) { toast.error("Not signed in"); return; }
    const missing = fields.filter((f) => f.required && !mapping[f.key]);
    if (missing.length) { toast.error(`Map required: ${missing.map((m) => m.label).join(", ")}`); return; }
    setBusy(true);
    try {
      const mapped = rows.map((r) => mapRow(r, mapping)).filter((r) => Object.keys(r).length > 0);
      // Detect conflicts
      const found: Conflict[] = [];
      const fresh: Record<string, any>[] = [];
      for (let i = 0; i < mapped.length; i++) {
        const m = mapped[i];
        let q = supabase.from(tableName as any).select("*").eq("user_id", user.id);
        if (type === "school") {
          if (!m.name || !m.country) { fresh.push(m); continue; }
          q = q.eq("name", m.name).eq("country", m.country);
        } else if (type === "agent") {
          if (!m.trading_name) { fresh.push(m); continue; }
          q = q.eq("trading_name", m.trading_name);
        } else {
          if (!m.branch_name || !agentId) { fresh.push(m); continue; }
          q = q.eq("agent_id", agentId).eq("branch_name", m.branch_name);
        }
        const { data: existing } = await q.maybeSingle();
        if (existing) {
          const fieldChoice: Record<string, "existing" | "incoming"> = {};
          for (const k of Object.keys(m)) {
            if (String((existing as any)[k] ?? "") !== String(m[k] ?? "")) fieldChoice[k] = "existing";
          }
          found.push({ index: i, incoming: m, existing: existing as any, action: "merge", fieldChoice });
        } else fresh.push(m);
      }
      setConflicts(found);
      setNewRows(fresh);
      if (found.length === 0) {
        await doImport(fresh, []);
      } else {
        setStep("conflicts");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (fresh: Record<string, any>[], cs: Conflict[]) => {
    if (!user) return;
    setBusy(true);
    try {
      let inserted = 0, updated = 0, skipped = 0;
      const toInsert = [...fresh];
      for (const c of cs) {
        if (c.action === "skip") { skipped++; continue; }
        if (c.action === "create") { toInsert.push(c.incoming); continue; }
        // merge: only update fields user picked "incoming"
        const patch: Record<string, any> = {};
        for (const [k, choice] of Object.entries(c.fieldChoice)) {
          if (choice === "incoming") patch[k] = c.incoming[k];
        }
        if (Object.keys(patch).length === 0) { skipped++; continue; }
        const { error } = await supabase.from(tableName as any).update(patch).eq("id", c.existing.id);
        if (error) throw error;
        updated++;
      }
      if (toInsert.length) {
        const rowsWithUser = toInsert.map((r) => ({
          ...r,
          user_id: user.id,
          ...(type === "agent_branch" && agentId ? { agent_id: agentId } : {}),
        }));
        const { error } = await supabase.from(tableName as any).insert(rowsWithUser);
        if (error) throw error;
        inserted = toInsert.length;
      }
      toast.success(`Imported ${inserted}, updated ${updated}, skipped ${skipped}`);
      qc.invalidateQueries();
      setStep("done");
      onDone?.();
      setTimeout(() => { setOpen(false); reset(); }, 800);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="h-4 w-4 mr-1" /> {triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import {type === "agent_branch" ? "branches" : type + "s"} from spreadsheet</DialogTitle></DialogHeader>

        {step === "upload" && (
          <label className="flex flex-col items-center gap-3 px-6 py-12 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
            <div className="text-sm font-medium">Click to upload .xlsx or .csv</div>
            <div className="text-xs text-muted-foreground">First row must contain column headers</div>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Review the mapping. Required fields marked *.</p>
            <div className="space-y-2">
              {fields.map((f) => (
                <div key={f.key} className="grid grid-cols-[1fr_1fr] gap-3 items-center">
                  <Label className="text-sm">{f.label}{f.required && " *"}</Label>
                  <Select value={mapping[f.key] ?? SKIP} onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === SKIP ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="— skip —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP}>— skip —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {preview.length > 0 && (
              <div className="border rounded-md p-3 bg-muted/40">
                <div className="text-xs font-medium mb-2 text-muted-foreground">Preview (first 3 rows)</div>
                <pre className="text-xs overflow-x-auto">{JSON.stringify(preview, null, 2)}</pre>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={proceed} disabled={busy}>{busy ? "Checking…" : "Continue"}</Button>
            </div>
          </div>
        )}

        {step === "conflicts" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{conflicts.length} existing record(s) matched. Pick which value wins for each changed field.</p>
            <div className="space-y-3 max-h-[55vh] overflow-y-auto">
              {conflicts.map((c, i) => {
                const title = String(c.existing.name ?? c.existing.trading_name ?? c.existing.branch_name ?? "Record");
                const diffKeys = Object.keys(c.fieldChoice);
                const setAction = (action: RowAction) => {
                  const next = [...conflicts]; next[i] = { ...c, action }; setConflicts(next);
                };
                const setField = (k: string, choice: "existing" | "incoming") => {
                  const next = [...conflicts];
                  next[i] = { ...c, fieldChoice: { ...c.fieldChoice, [k]: choice } };
                  setConflicts(next);
                };
                const setAll = (choice: "existing" | "incoming") => {
                  const fc: Record<string, "existing" | "incoming"> = {};
                  for (const k of diffKeys) fc[k] = choice;
                  const next = [...conflicts]; next[i] = { ...c, fieldChoice: fc }; setConflicts(next);
                };
                return (
                  <div key={i} className="border rounded-md p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">{title}</div>
                      <Select value={c.action} onValueChange={(v: any) => setAction(v)}>
                        <SelectTrigger className="h-7 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="merge">Merge fields</SelectItem>
                          <SelectItem value="skip">Skip row</SelectItem>
                          <SelectItem value="create">Create as new</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {c.action === "merge" && (
                      diffKeys.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No differences — nothing to update.</div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2 text-xs">
                            <button type="button" className="text-primary hover:underline" onClick={() => setAll("existing")}>Keep all existing</button>
                            <span className="text-muted-foreground">·</span>
                            <button type="button" className="text-primary hover:underline" onClick={() => setAll("incoming")}>Use all incoming</button>
                          </div>
                          <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
                            <div>Field</div><div>Existing</div><div>Incoming (from sheet)</div>
                          </div>
                          {diffKeys.map((k) => {
                            const fLabel = fields.find((f) => f.key === k)?.label ?? k;
                            const ev = c.existing[k];
                            const iv = c.incoming[k];
                            const choice = c.fieldChoice[k];
                            return (
                              <div key={k} className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs items-start">
                                <div className="font-medium pt-1">{fLabel}</div>
                                <label className={`flex gap-2 p-2 rounded cursor-pointer border ${choice === "existing" ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"}`}>
                                  <input type="radio" className="mt-0.5" checked={choice === "existing"} onChange={() => setField(k, "existing")} />
                                  <span className="break-words min-w-0">{ev == null || ev === "" ? <em className="text-muted-foreground">empty</em> : String(ev)}</span>
                                </label>
                                <label className={`flex gap-2 p-2 rounded cursor-pointer border ${choice === "incoming" ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"}`}>
                                  <input type="radio" className="mt-0.5" checked={choice === "incoming"} onChange={() => setField(k, "incoming")} />
                                  <span className="break-words min-w-0">{iv == null || iv === "" ? <em className="text-muted-foreground">empty</em> : String(iv)}</span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={() => doImport(newRows, conflicts)} disabled={busy}>{busy ? "Importing…" : "Import"}</Button>
            </div>
          </div>
        )}

        {step === "done" && <div className="py-8 text-center text-sm text-muted-foreground">Done.</div>}
      </DialogContent>
    </Dialog>
  );
}
