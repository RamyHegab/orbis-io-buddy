import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Archive } from "lucide-react";
import { toast } from "sonner";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoDate(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toISOString().slice(0, 10);
}
function endOfMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function ArchiveCycleDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Seed defaults from app_settings (admin-managed recruitment cycle)
  const { data: cycle } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("cycle_start_month, cycle_start_year, cycle_end_month, cycle_end_year")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
  });

  const today = new Date();
  const [startMonth, setStartMonth] = useState<number>(9);
  const [startYear, setStartYear] = useState<number>(today.getFullYear() - 1);
  const [endMonth, setEndMonth] = useState<number>(8);
  const [endYear, setEndYear] = useState<number>(today.getFullYear());

  // Once settings load, seed the inputs
  const seededRef = useState({ v: false })[0];
  if (cycle && !seededRef.v) {
    seededRef.v = true;
    setStartMonth(cycle.cycle_start_month);
    setStartYear(cycle.cycle_start_year);
    setEndMonth(cycle.cycle_end_month);
    setEndYear(cycle.cycle_end_year);
  }

  const cycleLabel = `${startYear}-${endYear}`;
  const startDate = isoDate(startYear, startMonth, 1);
  const endDate = isoDate(endYear, endMonth, endOfMonth(endYear, endMonth));

  const archive = useMutation({
    mutationFn: async () => {
      const stamp = {
        archived: true,
        archived_cycle: cycleLabel,
        archived_at: new Date().toISOString(),
      };
      const filter = (q: any) =>
        q.gte("start_date", startDate).lte("start_date", endDate).eq("archived", false);

      const t = await filter(supabase.from("trips").update(stamp));
      if (t.error) throw t.error;
      const p = await filter(supabase.from("planned_activities").update(stamp));
      if (p.error) throw p.error;
      const e = await filter(supabase.from("events_catalog").update(stamp));
      if (e.error) throw e.error;
    },
    onSuccess: () => {
      toast.success(`Cycle ${cycleLabel} archived`);
      qc.invalidateQueries();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to archive"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Archive className="h-4 w-4 mr-1" /> Close cycle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close a completed cycle</DialogTitle>
          <DialogDescription>
            Move trips, planned activities and events with a start date in this window into Previous Cycles.
            They stay browsable there and are read-only afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cycle start</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <select
                className="border rounded-md h-9 px-2 bg-background text-sm"
                value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <Input type="number" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Cycle end</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <select
                className="border rounded-md h-9 px-2 bg-background text-sm"
                value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <Input type="number" value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} />
            </div>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-muted-foreground text-xs">Cycle label</div>
            <div className="font-medium">{cycleLabel}</div>
            <div className="text-xs text-muted-foreground mt-1">{startDate} → {endDate}</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => archive.mutate()} disabled={archive.isPending || endDate < startDate}>
            {archive.isPending ? "Archiving…" : "Archive cycle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
