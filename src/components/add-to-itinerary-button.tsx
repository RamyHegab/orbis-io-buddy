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

  const trip = trips?.find((t) => t.id === tripId);

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
        start_time: null,
        end_time: null,
        location: props.address ?? null,
        formatted_address: props.formatted_address ?? null,
        place_id: props.place_id ?? null,
        lat: props.lat ?? null,
        lng: props.lng ?? null,
      };
      if (props.source === "agent") payload.agent_id = props.id;
      if (props.source === "agent_branch") {
        payload.agent_id = props.agentId ?? null;
        payload.branch_id = props.id;
      }
      if (props.source === "school") payload.school_id = props.id;
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
      setTripId("");
      setDay(undefined);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const stop = (e: React.MouseEvent) => { e.stopPropagation(); };
  const stopContent = (e: React.MouseEvent) => { e.stopPropagation(); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent onClick={stop} className="max-w-md">
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
              <p className="text-xs text-muted-foreground mt-1">
                Trip runs {format(parseISO(trip.start_date), "d MMM")} – {format(parseISO(trip.end_date), "d MMM yyyy")}. Time can be set later in the trip view.
              </p>
            </div>
          )}
          <Button className="w-full" disabled={!trip || !day || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Adding…" : "Add to itinerary"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
