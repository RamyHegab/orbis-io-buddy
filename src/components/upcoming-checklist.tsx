import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Plane } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type ChecklistKey =
  | "itinerary_approved"
  | "freight_required"
  | "parcel_sent"
  | "book_appointment"
  | "book_flights_hotels"
  | "risk_assessment";

const ITEMS: { key: ChecklistKey; label: string }[] = [
  { key: "itinerary_approved", label: "Itinerary approved" },
  { key: "freight_required", label: "Freight required?" },
  { key: "parcel_sent", label: "Parcel sent" },
  { key: "book_appointment", label: "Appointments booked" },
  { key: "book_flights_hotels", label: "Hotels and flights booked" },
  { key: "risk_assessment", label: "Review risk assessment" },
];

export type UpcomingTrip = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status?: string | null;
  checklist: Record<string, any> | null;
} | null;

export function UpcomingChecklist({ trip }: { trip: UpcomingTrip }) {
  const qc = useQueryClient();
  const approvedByStatus = trip?.status === "approved" || trip?.status === "confirmed";
  const checklist: Record<string, any> = {
    ...((trip?.checklist ?? {}) as Record<string, any>),
    ...(approvedByStatus ? { itinerary_approved: true } : {}),
  };

  const update = useMutation({
    mutationFn: async (next: Record<string, any>) => {
      if (!trip) return;
      const { error } = await supabase.from("trips").update({ checklist: next }).eq("id", trip.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["upcoming-trip"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setVal = (key: ChecklistKey, value: any) => {
    if (!trip) return;
    if (key === "itinerary_approved" && approvedByStatus) return;
    update.mutate({ ...checklist, [key]: value });
  };

  if (!trip) {
    return (
      <Card className="p-5 border-2 border-primary/80 h-full flex flex-col justify-center items-center text-center">
        <Plane className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No upcoming trips.</p>
        <Link to="/trips" className="text-xs text-primary hover:underline mt-2">Plan a trip</Link>
      </Card>
    );
  }

  const doneCount = ITEMS.filter((i) => {
    if (i.key === "freight_required") return checklist[i.key] === "no" || checklist[i.key] === "yes";
    return !!checklist[i.key];
  }).length;
  const pct = Math.round((doneCount / ITEMS.length) * 100);
  const allDone = doneCount === ITEMS.length;

  return (
    <Card className="p-0 border-2 border-primary/80 overflow-hidden h-full flex flex-col">
      <div className="bg-primary text-primary-foreground px-5 py-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-gold">Upcoming trip checklist</div>
        <div className="flex items-center justify-between mt-1">
          <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="font-semibold text-sm hover:underline truncate pr-3">
            {trip.title}
          </Link>
          <span className="text-xs text-primary-foreground/70 whitespace-nowrap">{pct}%</span>
        </div>
        <div className="text-xs text-primary-foreground/70 mt-0.5">{fmtDate(trip.start_date)} → {fmtDate(trip.end_date)}</div>
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">
        {ITEMS.map((item) => {
          if (item.key === "freight_required") {
            const v = checklist[item.key];
            const answered = v === "yes" || v === "no";
            return (
              <div key={item.key} className="flex items-center justify-between gap-2">
                <span className={`text-sm ${answered ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant={v === "yes" ? "default" : "outline"} className={`h-6 text-xs px-2 ${v === "yes" ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""}`} onClick={() => setVal(item.key, "yes")}>Yes</Button>
                  <Button size="sm" variant={v === "no" ? "default" : "outline"} className={`h-6 text-xs px-2 ${v === "no" ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""}`} onClick={() => setVal(item.key, "no")}>No</Button>
                </div>
              </div>
            );
          }
          const done = !!checklist[item.key];
          const locked = item.key === "itinerary_approved" && approvedByStatus;
          return (
            <label key={item.key} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={done}
                disabled={locked}
                onCheckedChange={(c) => setVal(item.key, !!c)}
                className="data-[state=checked]:bg-gold data-[state=checked]:text-gold-foreground data-[state=checked]:border-gold"
              />
              <span className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
              {done ? <CheckCircle2 className="h-3.5 w-3.5 text-gold ml-auto" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
            </label>
          );
        })}
        {allDone && (
          <div className="rounded-md border-2 border-gold bg-gold/15 p-2 text-xs font-semibold text-primary text-center">
            All checks done — Have a safe journey. Good luck! ✈️
          </div>
        )}
      </div>
    </Card>
  );
}
