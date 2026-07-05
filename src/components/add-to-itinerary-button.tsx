import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type Source = "agent" | "agent_branch" | "school";

type Props = {
  source: Source;
  name: string;
  /** id of the source row (agent.id / branch.id / school.id) */
  id: string;
  /** For branches: parent agent id (required to populate activities.agent_id) */
  agentId?: string;
  address?: string | null;
  formatted_address?: string | null;
  place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  size?: "sm" | "icon";
  variant?: "outline" | "ghost" | "default";
  className?: string;
};

export function AddToItineraryButton(props: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tripId, setTripId] = useState<string>("");
  const [day, setDay] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [linkedAgentId, setLinkedAgentId] = useState("");
  const [linkedBranchId, setLinkedBranchId] = useState("");
  const [objectives, setObjectives] = useState("");

  const today = format(new Date(), "yyyy-MM-dd");
  const { data: trips } = useQuery({
    queryKey: ["trips", "upcoming"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trips")
        .select("id,title,start_date,end_date")
        .gte("end_date", today)
        .order("start_date");
      return data ?? [];
    },
    enabled: open,
  });

  // Extra options depending on source
  const { data: agents } = useQuery({
    queryKey: ["agents-lite"],
    queryFn: async () => (await supabase.from("agents").select("id,trading_name").order("trading_name")).data ?? [],
    enabled: open && props.source === "school",
  });
  const { data: branches } = useQuery({
    queryKey: ["branches-lite", props.source === "agent" ? props.id : null],
    queryFn: async () => (
      await supabase.from("agent_branches").select("id,branch_name,city").eq("agent_id", props.id).order("branch_name")
    ).data ?? [],
    enabled: open && props.source === "agent",
  });

  const trip = trips?.find((t) => t.id === tripId);

  const reset = () => {
    setTripId(""); setDay(undefined);
    setStartTime(""); setEndTime("");
    setLinkedAgentId(""); setLinkedBranchId("");
    setObjectives("");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!trip || !day) throw new Error("Pick a trip and a day");
      const type = props.source === "school" ? "school_visit" : "agent_visit";
      const payload: any = {
        trip_id: trip.id,
        user_id: user.id,
        day_date: format(day, "yyyy-MM-dd"),
        type,
        title: props.name,
        start_time: startTime || null,
        end_time: endTime || null,
        location: props.address ?? null,
        formatted_address: props.formatted_address ?? null,
        place_id: props.place_id ?? null,
        lat: props.lat ?? null,
        lng: props.lng ?? null,
        objectives: objectives.trim() || null,
      };
      if (props.source === "agent") {
        payload.agent_id = props.id;
        payload.branch_id = linkedBranchId || null;
      }
      if (props.source === "agent_branch") {
        payload.agent_id = props.agentId ?? null;
        payload.branch_id = props.id;
      }
      if (props.source === "school") {
        payload.school_id = props.id;
        payload.agent_id = linkedAgentId || null;
      }
      const { error } = await supabase.from("activities").insert(payload);
      if (error) throw error;
      return trip;
    },
    onSuccess: (t) => {
      toast.success(`Added to ${t!.title}`, {
        action: { label: "View trip", onClick: () => { window.location.href = `/trips/${t!.id}`; } },
      });
      qc.invalidateQueries({ queryKey: ["activities", t!.id] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = () => {
    if (!objectives.trim()) {
      const ok = window.confirm("No objectives added for this activity. Save without objectives?");
      if (!ok) return;
    }
    save.mutate();
  };

  const stop = (e: React.MouseEvent) => { e.stopPropagation(); };
  const stopContent = (e: React.MouseEvent) => { e.stopPropagation(); };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button
          variant={props.variant ?? "outline"}
          size={props.size ?? "sm"}
          onClick={stop}
          className={cn(props.className)}
          title="Add to itinerary"
        >
          <CalendarPlus className="h-4 w-4" />
          {props.size !== "icon" && <span className="ml-1">Add to itinerary</span>}
        </Button>
      </DialogTrigger>
      <DialogContent onClick={stopContent} className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add "{props.name}" to itinerary</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Trip</Label>
            <Select value={tripId} onValueChange={(v) => { setTripId(v); setDay(undefined); }}>
              <SelectTrigger><SelectValue placeholder={trips?.length === 0 ? "No upcoming trips" : "Pick a trip"} /></SelectTrigger>
              <SelectContent>
                {(trips ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title} · {format(parseISO(t.start_date), "d MMM")} – {format(parseISO(t.end_date), "d MMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {trip && (
            <>
              <div>
                <Label>Day</Label>
                <div className="border rounded-md mt-1 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={day}
                    onSelect={setDay}
                    defaultMonth={parseISO(trip.start_date)}
                    disabled={{ before: parseISO(trip.start_date), after: parseISO(trip.end_date) }}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </div>
              </div>
              {day && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Time from</Label>
                      <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                    </div>
                    <div>
                      <Label>Time to</Label>
                      <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                    </div>
                  </div>
                  {props.source === "school" && (
                    <div>
                      <Label>Linked agent (optional)</Label>
                      <Select value={linkedAgentId} onValueChange={setLinkedAgentId}>
                        <SelectTrigger><SelectValue placeholder="Pick an agent" /></SelectTrigger>
                        <SelectContent>
                          {(agents ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.trading_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {props.source === "agent" && (branches?.length ?? 0) > 0 && (
                    <div>
                      <Label>Branch (optional)</Label>
                      <Select value={linkedBranchId} onValueChange={setLinkedBranchId}>
                        <SelectTrigger><SelectValue placeholder="Pick a branch" /></SelectTrigger>
                        <SelectContent>
                          {(branches ?? []).map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.branch_name}{b.city ? ` — ${b.city}` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>Objectives</Label>
                    <Textarea
                      value={objectives}
                      onChange={(e) => setObjectives(e.target.value)}
                      rows={3}
                      placeholder="What you plan to achieve during this visit"
                    />
                  </div>
                </>
              )}
            </>
          )}
          <Button className="w-full" disabled={!trip || !day || save.isPending} onClick={onSubmit}>
            {save.isPending ? "Adding…" : "Add to itinerary"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

