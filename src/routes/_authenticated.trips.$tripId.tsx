import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, ArrowLeft, Sparkles, Pencil, FileText, FileDown, Trash2, Save, CheckCircle2, Copy, Hotel as HotelIcon, MapPin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { exportTripPdf, exportTripWord } from "@/lib/trip-export";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from "@/lib/format";
import { addDays, differenceInDays, parseISO, format } from "date-fns";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { mapsSearchUrl } from "@/lib/google-maps";
import { safeHttpUrl } from "@/lib/safe-url";
import { useServerFn } from "@tanstack/react-start";
import { lookupFlight } from "@/lib/flights.functions";
import { searchHotels, type HotelSearchResult } from "@/lib/hotels.functions";
import { Search, Star } from "lucide-react";
import { submitTripForApproval, withdrawTripSubmission, decideTripApproval } from "@/lib/trip-approvals.functions";
import { Loader2, AlertTriangle, Clock, Send, Undo2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  component: TripPlanner,
});

const ACTIVITY_TYPES = [
  { value: "travel", label: "Travel" },
  { value: "agent_visit", label: "Agent Visit" },
  { value: "school_visit", label: "School Visit" },
  { value: "recruitment_event", label: "Recruitment Event" },
  { value: "resting_day", label: "Resting Day" },
  { value: "other", label: "Other" },
];


const TRANSPORT_MODES = ["Air travel", "Train", "Taxi", "Bus", "Private car", "Ferry", "Other"];
const RESTING_TYPES = [
  { value: "toil", label: "TOIL" },
  { value: "weekend", label: "Weekend" },
  { value: "bank_holiday", label: "Bank Holiday" },
];

type FormState = {
  type: string;
  title: string;
  start_time: string;
  end_time: string;
  end_date: string;
  location: string;
  map_url: string;
  agent_id: string;
  branch_id: string;
  school_id: string;
  transport_mode: string;
  from_city: string;
  to_city: string;
  from_country: string;
  to_country: string;
  airline: string;
  flight_number: string;
  cost: string;
  cost_currency: string;
  resting_type: string;
  description: string;
  notes: string;
  objectives: string;
  visit_notes: string;
  place_id: string;
  lat: number | null;
  lng: number | null;
  formatted_address: string;
};

const emptyForm: FormState = {
  type: "", title: "", start_time: "", end_time: "", end_date: "",
  location: "", map_url: "", agent_id: "", branch_id: "", school_id: "",
  transport_mode: "", from_city: "", to_city: "", from_country: "", to_country: "",
  airline: "", flight_number: "", cost: "", cost_currency: "GBP",
  resting_type: "", description: "", notes: "", objectives: "", visit_notes: "",
  place_id: "", lat: null, lng: null, formatted_address: "",
};

type HotelForm = {
  id?: string;
  name: string;
  map_url: string;
  address: string;
  check_in_date: string;
  check_out_date: string;
  check_in_time: string;
  check_out_time: string;
  cost: string;
  cost_currency: string;
  notes: string;
  place_id: string;
  lat: number | null;
  lng: number | null;
  formatted_address: string;
};

const emptyHotel: HotelForm = {
  name: "", map_url: "", address: "",
  check_in_date: "", check_out_date: "",
  check_in_time: "", check_out_time: "",
  cost: "", cost_currency: "GBP", notes: "",
  place_id: "", lat: null, lng: null, formatted_address: "",
};



function TripPlanner() {
  const { tripId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editLegs, setEditLegs] = useState<{ id?: string; country: string; start_date: string; end_date: string }[]>([]);
  const [editObjectives, setEditObjectives] = useState("");
  const [hotelDialogOpen, setHotelDialogOpen] = useState(false);
  const [hotelForm, setHotelForm] = useState<HotelForm>(emptyHotel);
  const [hotelSearchQuery, setHotelSearchQuery] = useState("");
  const [hotelSearchResults, setHotelSearchResults] = useState<HotelSearchResult[] | null>(null);
  const [hotelSearching, setHotelSearching] = useState(false);
  const searchHotelsFn = useServerFn(searchHotels);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [isLgUp, setIsLgUp] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (selectedDay && isLgUp && editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedDay, isLgUp]);



  const { data: trip } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => (await supabase.from("trips").select("*").eq("id", tripId).maybeSingle()).data,
  });

  const { data: countries } = useQuery({
    queryKey: ["trip-countries", tripId],
    queryFn: async () => (await supabase.from("trip_countries").select("*").eq("trip_id", tripId).order("sort_order")).data ?? [],
  });

  const { data: activities } = useQuery({
    queryKey: ["activities", tripId],
    queryFn: async () => (await supabase.from("activities").select("*, agents(trading_name), schools(name, address, lat, lng, place_id, formatted_address, primary_contact_name, primary_contact_position, primary_contact_email, primary_contact_phone, general_email, general_phone), agent_branches(branch_name, city, address, lat, lng, place_id, formatted_address, contact_first_name, contact_last_name, contact_position, contact_email, contact_phone)").eq("trip_id", tripId).order("day_date").order("start_time")).data ?? [],
  });

  const { data: hotels } = useQuery({
    queryKey: ["trip-hotels", tripId],
    queryFn: async () => (await supabase.from("trip_hotels").select("*").eq("trip_id", tripId).order("check_in_date")).data ?? [],
  });


  const { data: agents } = useQuery({
    queryKey: ["agents-list"],
    queryFn: async () => (await supabase.from("agents").select("id, trading_name").order("trading_name")).data ?? [],
  });

  const { data: branches } = useQuery({
    queryKey: ["agent-branches-list"],
    queryFn: async () => (await supabase.from("agent_branches").select("id, branch_name, city, agent_id, agents(trading_name)").order("branch_name")).data ?? [],
  });

  const { data: schools } = useQuery({
    queryKey: ["schools-list"],
    queryFn: async () => (await supabase.from("schools").select("id, name, city").order("name")).data ?? [],
  });

  const MAX_DAYS = 120;
  const dayCount = useMemo(() => {
    if (!trip) return 0;
    const n = differenceInDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [trip]);
  const daysTruncated = dayCount > MAX_DAYS;
  const days = useMemo(() => {
    if (!trip || dayCount < 1) return [];
    const start = parseISO(trip.start_date);
    const capped = Math.min(dayCount, MAX_DAYS);
    return Array.from({ length: capped }, (_, i) => addDays(start, i));
  }, [trip, dayCount]);

  const datesInvalid = !!trip && (() => {
    const s = parseISO(trip.start_date);
    const e = parseISO(trip.end_date);
    const n = differenceInDays(e, s) + 1;
    return !Number.isFinite(n) || n < 1 || n > MAX_DAYS ||
      s.getFullYear() < 2000 || e.getFullYear() < 2000;
  })();

  const countryForDay = (d: Date): string | null => {
    if (!countries) return null;
    const key = format(d, "yyyy-MM-dd");
    const c = countries.find((c) => key >= c.start_date && key <= c.end_date);
    return c?.country ?? null;
  };

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const a of activities ?? []) (map[a.day_date] = map[a.day_date] ?? []).push(a);
    return map;
  }, [activities]);

  const hotelForDay = (dayKey: string) => {
    return (hotels ?? []).find((h: any) => dayKey >= h.check_in_date && dayKey <= h.check_out_date);
  };


  const filteredBranches = useMemo(() => {
    if (!branches) return [];
    if (!form.agent_id) return branches;
    return branches.filter((b: any) => b.agent_id === form.agent_id);
  }, [branches, form.agent_id]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !selectedDay) throw new Error("Missing fields");
      if (trip && (selectedDay < trip.start_date || selectedDay > trip.end_date)) {
        throw new Error(`Date must be within trip range (${trip.start_date} → ${trip.end_date})`);
      }
      if (form.end_date && trip && (form.end_date < trip.start_date || form.end_date > trip.end_date)) {
        throw new Error(`End date must be within trip range (${trip.start_date} → ${trip.end_date})`);
      }
      const payload: any = {
        trip_id: tripId,
        user_id: user.id,
        type: form.type,
        day_date: selectedDay,
        title: form.title || defaultTitle(form, branches, schools, agents),
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        end_date: form.end_date || null,
        location: form.location || null,
        map_url: form.map_url || null,
        agent_id: form.agent_id || null,
        branch_id: form.branch_id || null,
        school_id: form.school_id || null,
        transport_mode: form.transport_mode || null,
        from_city: form.from_city || null,
        from_country: form.from_country || null,
        to_city: form.to_city || null,
        to_country: form.to_country || null,
        airline: form.airline || null,
        flight_number: form.flight_number || null,
        cost: form.cost ? Number(form.cost) : null,
        cost_currency: form.cost ? form.cost_currency : null,
        resting_type: form.resting_type || null,
        description: form.description || null,
        notes: form.notes || null,
        objectives: form.objectives || null,
        visit_notes: form.visit_notes || null,
        place_id: form.place_id || null,
        lat: form.lat,
        lng: form.lng,
        formatted_address: form.formatted_address || null,
      };
      if (editingActivityId) {
        const { error } = await supabase.from("activities").update(payload).eq("id", editingActivityId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("activities").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingActivityId ? "Activity updated" : "Activity added");
      setForm(emptyForm);
      setSelectedDay(null);
      setEditingActivityId(null);
      qc.invalidateQueries({ queryKey: ["activities", tripId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteActivity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activity deleted");
      if (editingActivityId) { setEditingActivityId(null); setSelectedDay(null); setForm(emptyForm); }
      qc.invalidateQueries({ queryKey: ["activities", tripId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const repeatPrevious = useMutation({
    mutationFn: async ({ targetDay, includeCost }: { targetDay: string; includeCost: boolean }) => {
      if (!user) throw new Error("Not signed in");
      const prev = format(addDays(parseISO(targetDay), -1), "yyyy-MM-dd");
      const src = (activities ?? []).filter((a: any) => a.day_date === prev && a.type === "recruitment_event");
      if (src.length === 0) throw new Error("No recruitment events on the previous day");
      const rows = src.map((a: any) => ({
        trip_id: tripId, user_id: user.id, type: a.type, day_date: targetDay,
        title: a.title, start_time: a.start_time, end_time: a.end_time,
        location: a.location, agent_id: a.agent_id, branch_id: a.branch_id,
        school_id: a.school_id,
        cost: includeCost ? a.cost : null,
        cost_currency: includeCost ? a.cost_currency : null,
        description: a.description, notes: a.notes,
        objectives: a.objectives, visit_notes: a.visit_notes,
      }));
      const { error } = await supabase.from("activities").insert(rows);
      if (error) throw error;
      return src.length;
    },
    onSuccess: (n) => {
      toast.success(`Repeated ${n} event${n > 1 ? "s" : ""} from previous day`);
      qc.invalidateQueries({ queryKey: ["activities", tripId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const costTotals = useMemo(() => {
    const groups: Record<string, Record<string, number>> = { travel: {}, hotel: {}, recruitment_event: {}, total: {} };
    for (const a of activities ?? []) {
      if (!a.cost) continue;
      const cur = a.cost_currency || "GBP";
      const amount = Number(a.cost);
      groups.total[cur] = (groups.total[cur] ?? 0) + amount;
      if (groups[a.type]) groups[a.type][cur] = (groups[a.type][cur] ?? 0) + amount;
    }
    for (const h of hotels ?? []) {
      if (h.cost == null) continue;
      const cur = h.cost_currency || "GBP";
      const amount = Number(h.cost);
      groups.total[cur] = (groups.total[cur] ?? 0) + amount;
      groups.hotel[cur] = (groups.hotel[cur] ?? 0) + amount;
    }
    const fmt = (m: Record<string, number>) =>
      Object.entries(m).map(([cur, v]) => `${cur} ${v.toFixed(2)}`).join(" · ") || "—";
    return {
      travel: fmt(groups.travel),
      hotel: fmt(groups.hotel),
      events: fmt(groups.recruitment_event),
      total: fmt(groups.total),

    };
  }, [activities, hotels]);

  const saveHotel = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const h = hotelForm;
      if (!h.name.trim()) throw new Error("Hotel name is required");
      if (!h.check_in_date || !h.check_out_date) throw new Error("Check-in and check-out dates are required");
      if (h.check_out_date < h.check_in_date) throw new Error("Check-out date must be on or after check-in");
      if (trip && (h.check_in_date < trip.start_date || h.check_in_date > trip.end_date || h.check_out_date < trip.start_date || h.check_out_date > trip.end_date)) {
        throw new Error(`Hotel dates must be within trip range (${trip.start_date} → ${trip.end_date})`);
      }
      const overlap = (hotels ?? []).find((other: any) => {
        if (h.id && other.id === h.id) return false;
        return !(h.check_out_date < other.check_in_date || h.check_in_date > other.check_out_date);
      });
      if (overlap) throw new Error(`Overlaps "${overlap.name}" (${overlap.check_in_date} → ${overlap.check_out_date})`);
      const payload: any = {
        trip_id: tripId,
        user_id: user.id,
        name: h.name.trim(),
        map_url: h.map_url || null,
        address: h.address || null,
        place_id: h.place_id || null,
        lat: h.lat,
        lng: h.lng,
        formatted_address: h.formatted_address || null,
        check_in_date: h.check_in_date,
        check_out_date: h.check_out_date,
        check_in_time: h.check_in_time || null,
        check_out_time: h.check_out_time || null,
        cost: h.cost ? Number(h.cost) : null,
        cost_currency: h.cost ? h.cost_currency : null,
        notes: h.notes || null,
      };
      if (h.id) {
        const { error } = await supabase.from("trip_hotels").update(payload).eq("id", h.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trip_hotels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(hotelForm.id ? "Hotel updated" : "Hotel added");
      setHotelDialogOpen(false);
      setHotelForm(emptyHotel);
      qc.invalidateQueries({ queryKey: ["trip-hotels", tripId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteHotel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trip_hotels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hotel removed");
      setHotelDialogOpen(false);
      setHotelForm(emptyHotel);
      qc.invalidateQueries({ queryKey: ["trip-hotels", tripId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAddHotel = (dayKey: string) => {
    setHotelForm({
      ...emptyHotel,
      check_in_date: dayKey,
      check_out_date: format(addDays(parseISO(dayKey), 1), "yyyy-MM-dd"),
    });
    setHotelDialogOpen(true);
  };

  const openEditHotel = (h: any) => {
    setHotelForm({
      id: h.id,
      name: h.name ?? "",
      map_url: h.map_url ?? "",
      address: h.address ?? "",
      check_in_date: h.check_in_date ?? "",
      check_out_date: h.check_out_date ?? "",
      check_in_time: h.check_in_time ? h.check_in_time.slice(0, 5) : "",
      check_out_time: h.check_out_time ? h.check_out_time.slice(0, 5) : "",
      cost: h.cost != null ? String(h.cost) : "",
      cost_currency: h.cost_currency ?? "GBP",
      notes: h.notes ?? "",
      place_id: h.place_id ?? "",
      lat: h.lat ?? null,
      lng: h.lng ?? null,
      formatted_address: h.formatted_address ?? "",
    });
    setHotelDialogOpen(true);
  };




  const saveEdit = useMutation({
    mutationFn: async () => {
      const valid = editLegs.filter((l) => l.country && l.start_date && l.end_date);
      if (valid.length === 0) throw new Error("Add at least one country");
      const badYear = valid.find((l) => Number(l.start_date.slice(0, 4)) < 2000 || Number(l.end_date.slice(0, 4)) < 2000);
      if (badYear) throw new Error(`Dates need a 4-digit year (e.g. 2026), got ${badYear.start_date} → ${badYear.end_date}`);
      const start = valid.reduce((a, l) => (a < l.start_date ? a : l.start_date), valid[0].start_date);
      const end = valid.reduce((a, l) => (a > l.end_date ? a : l.end_date), valid[0].end_date);
      const countries = valid.map((l) => l.country);
      const title = `${countries.join(" • ")} — ${format(parseISO(start), "d MMM")} → ${format(parseISO(end), "d MMM yyyy")}`;
      const { error } = await supabase.from("trips").update({
        title, destinations: countries, start_date: start, end_date: end,
        objectives: editObjectives || null,
      }).eq("id", tripId);
      if (error) throw error;
      await supabase.from("trip_countries").delete().eq("trip_id", tripId);
      const rows = valid.map((l, i) => ({
        trip_id: tripId, user_id: user!.id, country: l.country,
        start_date: l.start_date, end_date: l.end_date, sort_order: i,
      }));
      const { error: e2 } = await supabase.from("trip_countries").insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Trip updated");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["trip-countries", tripId] });
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTrip = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Trip deleted"); navigate({ to: "/trips" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (status: "active") => {
      const { error } = await supabase.from("trips").update({ status }).eq("id", tripId);
      if (error) throw error;
      return status;
    },
    onSuccess: () => {
      toast.success("Itinerary saved");
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitForApprovalFn = useServerFn(submitTripForApproval);
  const withdrawSubmissionFn = useServerFn(withdrawTripSubmission);
  const decideApprovalFn = useServerFn(decideTripApproval);

  const submitForApproval = useMutation({
    mutationFn: () => submitForApprovalFn({ data: { tripId } }),
    onSuccess: () => {
      toast.success("Submitted to your line manager for approval");
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["trip-approvals", tripId] });
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to submit"),
  });

  const withdrawSubmission = useMutation({
    mutationFn: () => withdrawSubmissionFn({ data: { tripId } }),
    onSuccess: () => {
      toast.success("Submission withdrawn");
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["trip-approvals", tripId] });
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to withdraw"),
  });

  const decideApproval = useMutation({
    mutationFn: (vars: { approvalId: string; decision: "approved" | "changes_requested"; note?: string }) =>
      decideApprovalFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.decision === "approved" ? "Trip approved" : "Changes requested");
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["trip-approvals", tripId] });
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const { data: latestApproval } = useQuery({
    queryKey: ["trip-approvals", tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from("trip_approvals")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });


  const fixDateYear = (d: string): string => {
    const m = d.match(/^(\d{1,4})-(\d{2})-(\d{2})$/);
    if (!m) return d;
    const y = Number(m[1]);
    if (y >= 2000 && y <= 2099) return d;
    const corrected = y < 100 ? y + 2000 : 2000 + (y % 100);
    return `${String(corrected).padStart(4, "0")}-${m[2]}-${m[3]}`;
  };

  const fixYear = useMutation({
    mutationFn: async () => {
      if (!trip) throw new Error("No trip");
      const newStart = fixDateYear(trip.start_date);
      const newEnd = fixDateYear(trip.end_date);
      const { error } = await supabase.from("trips")
        .update({ start_date: newStart, end_date: newEnd })
        .eq("id", tripId);
      if (error) throw error;
      for (const c of countries ?? []) {
        const cs = fixDateYear(c.start_date);
        const ce = fixDateYear(c.end_date);
        if (cs !== c.start_date || ce !== c.end_date) {
          const { error: e2 } = await supabase.from("trip_countries")
            .update({ start_date: cs, end_date: ce })
            .eq("id", c.id);
          if (e2) throw e2;
        }
      }
    },
    onSuccess: () => {
      toast.success("Trip dates corrected");
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["trip-countries", tripId] });
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (e: any) => toast.error(e.message),
  });


  const openForDay = (d: Date) => {
    setEditingActivityId(null);
    setSelectedDay(format(d, "yyyy-MM-dd"));
    setForm({ ...emptyForm, end_date: format(d, "yyyy-MM-dd") });
  };

  const openEditActivity = (a: any) => {
    setEditingActivityId(a.id);
    setSelectedDay(a.day_date);
    setForm({
      type: a.type ?? "school_visit",
      title: a.title ?? "",
      start_time: a.start_time ? a.start_time.slice(0, 5) : "",
      end_time: a.end_time ? a.end_time.slice(0, 5) : "",
      end_date: a.end_date ?? a.day_date ?? "",
      location: a.location ?? "",
      map_url: a.map_url ?? "",
      agent_id: a.agent_id ?? "",
      branch_id: a.branch_id ?? "",
      school_id: a.school_id ?? "",
      transport_mode: a.transport_mode ?? "",
      from_city: a.from_city ?? "",
      to_city: a.to_city ?? "",
      from_country: a.from_country ?? "",
      to_country: a.to_country ?? "",
      airline: a.airline ?? "",
      flight_number: a.flight_number ?? "",
      cost: a.cost != null ? String(a.cost) : "",
      cost_currency: a.cost_currency ?? "GBP",
      resting_type: a.resting_type ?? "",
      description: a.description ?? "",
      notes: a.notes ?? "",
      objectives: a.objectives ?? "",
      visit_notes: a.visit_notes ?? "",
      place_id: a.place_id ?? "",
      lat: a.lat != null ? Number(a.lat) : null,
      lng: a.lng != null ? Number(a.lng) : null,
      formatted_address: a.formatted_address ?? "",
    });
  };


  const openEdit = () => {
    setEditLegs((countries ?? []).map((c: any) => ({
      id: c.id, country: c.country, start_date: c.start_date, end_date: c.end_date,
    })));
    setEditObjectives(trip?.objectives ?? "");
    setEditOpen(true);
  };

  if (!trip) return <PageContainer><p className="text-muted-foreground">Loading…</p></PageContainer>;

  const canSubmit = isFormValid(form);
  const validationMessage = validateForm(form);
  const isOwner = !!user && trip.user_id === user.id;
  const pendingApproval = latestApproval?.decision === "pending" ? latestApproval : null;
  const isManagerForThisTrip = !!user && pendingApproval?.manager_id === user.id;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/trips" })} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> All trips
      </Button>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {trip.title}
            {(trip.status === "approved" || trip.status === "confirmed") && (
              <Badge className="bg-academic-preferred/20 text-academic-preferred border-academic-preferred/40 hover:bg-academic-preferred/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>
            )}
            {trip.status === "submitted" && (
              <Badge className="bg-academic-required/20 text-academic-required border-academic-required/40 hover:bg-academic-required/30"><Clock className="h-3 w-3 mr-1" /> Pending approval</Badge>
            )}
            {trip.status === "active" && latestApproval?.decision === "changes_requested" && (
              <Badge variant="destructive">Changes requested</Badge>
            )}
            {trip.status === "active" && latestApproval?.decision !== "changes_requested" && (
              <Badge className="bg-academic-required/20 text-academic-required border-academic-required/40 hover:bg-academic-required/30">In progress</Badge>
            )}
            {trip.status === "planning" && <Badge variant="outline" className="border-academic-not-required text-academic-not-required">Draft</Badge>}
            {trip.status === "canceled" && <Badge className="bg-status-canceled text-white hover:bg-status-canceled">Canceled</Badge>}
          </span>
        }
        description={`${fmtDate(trip.start_date)} → ${fmtDate(trip.end_date)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="h-4 w-4 mr-1" /> Edit trip</Button>

            {isOwner && (trip.status === "planning" || trip.status === "active") && (
              <>
                <Button variant="outline" size="sm" onClick={() => setStatus.mutate("active")} disabled={setStatus.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save (in progress)
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={submitForApproval.isPending}>
                      <Send className="h-4 w-4 mr-1" /> Submit for approval
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Submit itinerary for approval?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your line manager will be notified by email and in their inbox.
                        You can still withdraw the submission before they decide.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => submitForApproval.mutate()}>Submit</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {isOwner && trip.status === "submitted" && (
              <Button variant="outline" size="sm" onClick={() => withdrawSubmission.mutate()} disabled={withdrawSubmission.isPending}>
                <Undo2 className="h-4 w-4 mr-1" /> Withdraw submission
              </Button>
            )}

            {isOwner && trip.status !== "canceled" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={setStatus.isPending}>
                    Cancel trip
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this trip?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will mark the trip as canceled. You can still reopen it later if needed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setStatus.mutate("canceled")}>Confirm cancel</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {isManagerForThisTrip && trip.status === "submitted" && pendingApproval && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={decideApproval.isPending}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Approve itinerary?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The owner will be notified and the trip will move to the Approved panel.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => decideApproval.mutate({ approvalId: pendingApproval.id, decision: "approved" })}
                      >Approve</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)} disabled={decideApproval.isPending}>
                  <AlertTriangle className="h-4 w-4 mr-1 text-destructive" /> Request changes
                </Button>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><FileDown className="h-4 w-4 mr-1" /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportTripPdf(trip, (activities ?? []) as any, (hotels ?? []) as any)}>
                  <FileText className="h-4 w-4 mr-2" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportTripWord(trip, (activities ?? []) as any, (hotels ?? []) as any)}>
                  <FileText className="h-4 w-4 mr-2" /> Word (.doc)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/trips/$tripId/report" params={{ tripId }}>
              <Button variant="outline" size="sm"><Sparkles className="h-4 w-4 mr-1" /> AI Report</Button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm"><Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete trip?</AlertDialogTitle>
                  <AlertDialogDescription>This removes the trip and all its activities.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteTrip.mutate()}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      {trip.status === "active" && latestApproval?.decision === "changes_requested" && latestApproval.note && (
        <Card className="p-4 mb-4 border-destructive bg-destructive/10">
          <div className="font-semibold text-destructive mb-1 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Changes requested by your line manager
          </div>
          <p className="text-sm whitespace-pre-wrap">{latestApproval.note}</p>
          <p className="text-xs text-muted-foreground mt-2">Make the changes, then submit again for approval.</p>
        </Card>
      )}

      {isManagerForThisTrip && trip.status === "submitted" && (
        <Card className="p-4 mb-4 border-amber-500 bg-amber-50">
          <div className="font-semibold text-amber-900 mb-1 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Awaiting your approval
          </div>
          <p className="text-sm text-amber-900/80">
            This itinerary was submitted by the trip owner. Use the Approve or Request changes buttons above.
          </p>
        </Card>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request changes</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>What needs to change?</Label>
            <Textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={5}
              placeholder="e.g. Please add hotel costs and confirm the agent visit on Day 4."
            />
            <Button
              className="w-full"
              disabled={!rejectNote.trim() || decideApproval.isPending}
              onClick={() => {
                if (!pendingApproval) return;
                decideApproval.mutate({
                  approvalId: pendingApproval.id,
                  decision: "changes_requested",
                  note: rejectNote.trim(),
                }, { onSuccess: () => { setRejectOpen(false); setRejectNote(""); } });
              }}
            >
              Send back with comments
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Edit trip</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Countries & dates</Label>
            <p className="text-xs text-muted-foreground">The title is generated from countries and dates.</p>
            <div className="space-y-2">
              {editLegs.map((leg, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                  <Input placeholder="Country" value={leg.country}
                    onChange={(e) => setEditLegs((prev) => prev.map((l, idx) => idx === i ? { ...l, country: e.target.value } : l))} />
                  <Input type="date" min="2000-01-01" max="2099-12-31" value={leg.start_date}
                    onChange={(e) => setEditLegs((prev) => prev.map((l, idx) => idx === i ? { ...l, start_date: e.target.value } : l))} />
                  <Input type="date" min="2000-01-01" max="2099-12-31" value={leg.end_date}
                    onChange={(e) => setEditLegs((prev) => prev.map((l, idx) => idx === i ? { ...l, end_date: e.target.value } : l))} />
                  <Button type="button" size="icon" variant="ghost" disabled={editLegs.length === 1}
                    onClick={() => setEditLegs(editLegs.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" size="sm" variant="outline"
              onClick={() => setEditLegs([...editLegs, { country: "", start_date: "", end_date: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Add country
            </Button>
            <div>
              <Label>Trip objectives</Label>
              <Textarea
                value={editObjectives}
                onChange={(e) => setEditObjectives(e.target.value)}
                placeholder="e.g. Attend IDP fairs in Hanoi & HCMC, visit agents to train on September intake"
              />
            </div>
            <Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending} className="w-full">Save</Button>
            <p className="text-xs text-muted-foreground">
              Changing dates may leave existing activities outside the new range — they'll stop appearing in the calendar.
            </p>
          </div>
        </DialogContent>
      </Dialog>


      <Card className="p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div><div className="text-xs text-muted-foreground">Travel</div><div className="font-semibold">{costTotals.travel}</div></div>
        <div><div className="text-xs text-muted-foreground">Hotels</div><div className="font-semibold">{costTotals.hotel}</div></div>
        <div><div className="text-xs text-muted-foreground">Events</div><div className="font-semibold">{costTotals.events}</div></div>
        <div><div className="text-xs text-muted-foreground">Total</div><div className="font-semibold text-primary">{costTotals.total}</div></div>
      </Card>

      {datesInvalid && (
        <Card className="p-4 mb-4 border-destructive bg-destructive/10">
          <div className="font-semibold text-destructive mb-1">Trip dates look invalid</div>
          <p className="text-sm text-muted-foreground mb-3">
            The start or end date isn't a valid 4-digit year (got {trip.start_date} → {trip.end_date}).
            We can auto-fix 2-digit years to the 2000s, or you can edit manually.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => fixYear.mutate()} disabled={fixYear.isPending}>
              Fix year (→ {fixDateYear(trip.start_date)} → {fixDateYear(trip.end_date)})
            </Button>
            <Button size="sm" variant="outline" onClick={openEdit}>Edit manually</Button>
          </div>
        </Card>
      )}


      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {daysTruncated && (
            <Card className="p-3 border-amber-500 bg-amber-50 text-sm">
              Showing the first {MAX_DAYS} of {dayCount} days. Trim the trip date range to see the rest.
            </Card>
          )}
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const dayActs = byDay[key] ?? [];
            const country = countryForDay(d);
            const resting = dayActs.find((a) => a.type === "resting_day");
            const isSelected = selectedDay === key;
            const prevKey = format(addDays(d, -1), "yyyy-MM-dd");
            const prevHasEvents = (byDay[prevKey] ?? []).some((a) => a.type === "recruitment_event");
            const stay = hotelForDay(key);
            const isCheckIn = stay && stay.check_in_date === key;
            const isCheckOut = stay && stay.check_out_date === key;
            return (
              <Card key={key} className={`p-5 ${resting ? "bg-muted/40" : ""} ${isSelected ? "ring-2 ring-primary" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold">{format(d, "EEEE, MMMM d")}</div>
                    <div className="text-xs text-muted-foreground">
                      Day {differenceInDays(d, parseISO(trip.start_date)) + 1}
                      {country && ` • ${country}`}
                      {resting && ` • ${resting.title} (no activities)`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {prevHasEvents && !resting && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" disabled={repeatPrevious.isPending} title="Repeat previous day's event(s)">
                            <Copy className="h-4 w-4 mr-1" /> Repeat previous day
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Repeat previous day's events?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The previous day's recruitment event(s) had a cost recorded. Was that cost for a single day, or for the whole run of repeated days?
                              <br /><br />
                              Choose <strong>Include cost</strong> to copy the same cost onto this day (cost per day). Choose <strong>Skip cost</strong> if the previous day's cost already covers today (cost was for the whole event).
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => repeatPrevious.mutate({ targetDay: key, includeCost: false })}>
                              Skip cost
                            </AlertDialogAction>
                            <AlertDialogAction onClick={() => repeatPrevious.mutate({ targetDay: key, includeCost: true })}>
                              Include cost
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => !stay && openAddHotel(key)}
                              disabled={!!stay || !!resting}
                            >
                              <HotelIcon className="h-4 w-4 mr-1" /> Add hotel
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {stay && (
                          <TooltipContent>Covered by {stay.name} ({stay.check_in_date} → {stay.check_out_date})</TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    <Button size="sm" variant={isSelected ? "default" : "ghost"} onClick={() => openForDay(d)} disabled={!!resting}>
                      <Plus className="h-4 w-4 mr-1" /> Add activity
                    </Button>
                  </div>
                </div>
                {stay && (
                  <button
                    type="button"
                    onClick={() => openEditHotel(stay)}
                    className="w-full text-left mb-2 flex items-center gap-3 rounded-lg border border-dashed bg-muted/40 px-3 py-2 hover:bg-muted transition-colors"
                  >
                    <HotelIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 text-sm">
                      <div className="font-medium truncate">
                        {(() => {
                          const safeMapUrl = safeHttpUrl(stay.map_url);
                          return safeMapUrl ? (
                            <a
                              href={safeMapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="underline text-primary"
                            >
                              {stay.name}
                            </a>
                          ) : (
                            stay.name
                          );
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isCheckIn
                          ? `Check-in${stay.check_in_time ? ` ${stay.check_in_time.slice(0, 5)}` : ""}`
                          : isCheckOut
                            ? `Check-out${stay.check_out_time ? ` ${stay.check_out_time.slice(0, 5)}` : ""}`
                            : "Staying overnight"}
                      </div>
                    </div>
                  </button>
                )}
                {dayActs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{stay ? "No other activities scheduled." : "No activities. Click \"Add\" to schedule."}</p>
                ) : (
                  <div className="space-y-2">
                    {dayActs.map((a) => {
                      const isEditingThis = editingActivityId === a.id;
                      return (
                        <div
                          key={a.id}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${ACTIVITY_TYPE_COLORS[a.type]} ${isEditingThis ? "ring-2 ring-primary" : ""}`}
                        >
                          <div className="text-xs font-mono w-20 shrink-0">
                            {a.start_time ? a.start_time.slice(0, 5) : "—"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => openEditActivity(a)}
                              className="text-left hover:opacity-80 block w-full"
                              title="Edit activity"
                            >
                              <div className="font-medium text-sm text-foreground truncate">{a.title}</div>
                            </button>
                            <div className="text-xs text-muted-foreground">
                              {ACTIVITY_TYPE_LABELS[a.type]}
                              {a.transport_mode && ` • ${a.transport_mode}`}
                              {a.flight_number && ` • ${a.flight_number}`}
                              {a.agent_id && (a.agent_branches?.branch_name || a.agents?.trading_name) && (
                                <>
                                  {" • "}
                                  <Link
                                    to="/agents/$agentId"
                                    params={{ agentId: a.agent_id }}
                                    className="underline hover:text-primary"
                                  >
                                    {a.agent_branches?.branch_name ?? a.agents?.trading_name}
                                  </Link>
                                </>
                              )}
                              {a.school_id && a.schools?.name && (
                                <>
                                  {" • "}
                                  <Link
                                    to="/schools"
                                    className="underline hover:text-primary"
                                  >
                                    {a.schools.name}
                                  </Link>
                                </>
                              )}
                              {(() => {
                                const u = mapsSearchUrl({
                                  query: a.formatted_address || a.location || a.agent_branches?.address || a.schools?.address,
                                  placeId: a.place_id ?? a.agent_branches?.place_id ?? a.schools?.place_id,
                                  lat: a.lat ?? a.agent_branches?.lat ?? a.schools?.lat,
                                  lng: a.lng ?? a.agent_branches?.lng ?? a.schools?.lng,
                                });
                                if (!a.location && !u) return null;
                                const text = a.location ?? "View on Google Maps";
                                return (
                                  <>
                                    {" • "}
                                    {u ? (
                                      <a href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                        <MapPin className="h-3 w-3" />{text}
                                      </a>
                                    ) : (
                                      <span>{text}</span>
                                    )}
                                  </>
                                );
                              })()}

                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditActivity(a)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Link to="/trips/$tripId/activities/$activityId" params={{ tripId, activityId: a.id }} title="Open details">
                              <Button size="icon" variant="ghost" className="h-7 w-7">
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Delete">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete activity?</AlertDialogTitle>
                                  <AlertDialogDescription>This removes "{a.title}" from the itinerary.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteActivity.mutate(a.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

        </div>

        {(() => {
          const editorBody = !selectedDay ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <div className="font-semibold text-foreground">Activity editor</div>
              <p>Select a day on the left and click <span className="font-medium">Add</span> to schedule an activity here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{editingActivityId ? "Edit activity" : "New activity"}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(selectedDay)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedDay(null); setEditingActivityId(null); setForm(emptyForm); }}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (validationMessage) { toast.error(validationMessage); return; }
                      create.mutate();
                    }}
                    disabled={create.isPending}
                  >
                    {editingActivityId ? "Save changes" : "Save"}
                  </Button>
                </div>
              </div>

              {(() => {
                const outOfRange =
                  (selectedDay && (selectedDay < trip.start_date || selectedDay > trip.end_date)) ||
                  (form.end_date && (form.end_date < trip.start_date || form.end_date > trip.end_date));
                return outOfRange ? (
                  <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    Date is outside the trip range ({trip.start_date} → {trip.end_date}). Adjust the date or edit the trip dates.
                  </div>
                ) : null;
              })()}
              <div>
                <Label>Activity type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...emptyForm, type: v, end_date: selectedDay ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Select activity" /></SelectTrigger>
                  <SelectContent>{ACTIVITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {form.type === "travel" && (
                <>
                  <div>
                    <Label>Mode of transport</Label>
                    <Select value={form.transport_mode} onValueChange={(v) => setForm({ ...form, transport_mode: v })}>
                      <SelectTrigger><SelectValue placeholder="Select transport" /></SelectTrigger>
                      <SelectContent>{TRANSPORT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {form.transport_mode === "Air travel" ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>From (country)</Label><Input value={form.from_country} onChange={(e) => setForm({ ...form, from_country: e.target.value })} placeholder="United Kingdom" /></div>
                        <div><Label>From (city)</Label><Input value={form.from_city} onChange={(e) => setForm({ ...form, from_city: e.target.value })} placeholder="London" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>To (country)</Label><Input value={form.to_country} onChange={(e) => setForm({ ...form, to_country: e.target.value })} placeholder="Thailand" /></div>
                        <div><Label>To (city)</Label><Input value={form.to_city} onChange={(e) => setForm({ ...form, to_city: e.target.value })} placeholder="Bangkok" /></div>
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>From (city)</Label><Input value={form.from_city} onChange={(e) => setForm({ ...form, from_city: e.target.value })} placeholder="London" /></div>
                      <div><Label>To (city)</Label><Input value={form.to_city} onChange={(e) => setForm({ ...form, to_city: e.target.value })} placeholder="Bangkok" /></div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Departure time</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                    <div><Label>Arrival time</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                  </div>
                  <div><Label>Arrival date</Label><Input type="date" min={trip.start_date} max={trip.end_date} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                  {form.transport_mode === "Air travel" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Airline</Label><Input value={form.airline} onChange={(e) => setForm({ ...form, airline: e.target.value })} /></div>
                      <div>
                        <Label>Flight number</Label>
                        <div className="flex gap-2">
                          <Input value={form.flight_number} onChange={(e) => setForm({ ...form, flight_number: e.target.value })} placeholder="BA286" />
                          <FlightLookupButton form={form} setForm={setForm} selectedDay={selectedDay} />
                        </div>
                      </div>
                    </div>
                  )}
                  <CostInput form={form} setForm={setForm} />
                </>
              )}

              {form.type === "agent_visit" && (
                <>
                  <div>
                    <Label>Agent</Label>
                    <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v, branch_id: "" })}>
                      <SelectTrigger><SelectValue placeholder="Pick an agent" /></SelectTrigger>
                      <SelectContent>{agents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.trading_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Agent branch</Label>
                    {filteredBranches.length > 0 && (
                      <Select value={form.branch_id} onValueChange={(v) => {
                        const b: any = filteredBranches.find((x: any) => x.id === v);
                        const agentName = b?.agents?.trading_name ?? agents?.find((a: any) => a.id === (b?.agent_id ?? form.agent_id))?.trading_name;
                        setForm({ ...form, branch_id: v, agent_id: b?.agent_id ?? form.agent_id, title: b ? `${agentName ? `${agentName} — ` : ""}${b.branch_name}` : form.title });
                      }}>
                        <SelectTrigger><SelectValue placeholder="Pick a branch" /></SelectTrigger>
                        <SelectContent>
                          {filteredBranches.map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.branch_name}{b.city && ` — ${b.city}`}{!form.agent_id && b.agents?.trading_name && ` (${b.agents.trading_name})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <div className="mt-2">
                      <Label className="text-xs text-muted-foreground">
                        {filteredBranches.length === 0
                          ? "No branches yet — type a branch name to visit"
                          : "Or type a branch name manually"}
                      </Label>
                      <Input
                        value={form.branch_id ? "" : form.title}
                        onChange={(e) => setForm({ ...form, branch_id: "", title: e.target.value })}
                        placeholder="e.g. Downtown office"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        You can add this branch to the agent later from the Agents page.
                      </p>
                    </div>
                  </div>

                  <TimeRange form={form} setForm={setForm} />
                </>
              )}

              {form.type === "school_visit" && (
                <>
                  <div>
                    <Label>School</Label>
                    {(!schools || schools.length === 0) ? (
                      <div className="text-sm text-muted-foreground border rounded-md p-3">
                        No schools yet. <Link to="/schools" className="underline text-primary">Add a school</Link> first.
                      </div>
                    ) : (
                      <Select value={form.school_id} onValueChange={(v) => {
                        const s = schools.find((x) => x.id === v);
                        setForm({ ...form, school_id: v, title: s ? `Visit ${s.name}` : form.title });
                      }}>
                        <SelectTrigger><SelectValue placeholder="Pick a school" /></SelectTrigger>
                        <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {s.city}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </div>
                  <TimeRange form={form} setForm={setForm} />
                  <div>
                    <Label>Linked agent</Label>
                    <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Pick an agent" /></SelectTrigger>
                      <SelectContent>{agents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.trading_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <CostInput form={form} setForm={setForm} />
                </>
              )}

              {form.type === "recruitment_event" && (
                <>
                  <div><Label>Event title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Spring Education Fair 2026" /></div>
                  <AddressAutocomplete
                    label="Venue"
                    placeholder="Hilton Conference Centre, address…"
                    value={{
                      address: form.location,
                      place_id: form.place_id || null,
                      lat: form.lat,
                      lng: form.lng,
                      formatted_address: form.formatted_address || null,
                    }}
                    onChange={(v) => setForm({
                      ...form,
                      location: v.address,
                      place_id: v.place_id ?? "",
                      lat: v.lat,
                      lng: v.lng,
                      formatted_address: v.formatted_address ?? "",
                    })}
                  />
                  <TimeRange form={form} setForm={setForm} />
                  <div>
                    <Label>Linked agent</Label>
                    <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Pick an agent" /></SelectTrigger>
                      <SelectContent>{agents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.trading_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <CostInput form={form} setForm={setForm} />
                </>
              )}

              {form.type === "hotel" && (
                <>
                  <div><Label>Hotel name</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Hilton Bangkok" /></div>
                  <div>
                    <Label>Address</Label>
                    <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Hotel address" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Check-in time</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                    <div><Label>Check-out time</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                  </div>
                  <div><Label>Check-out date</Label><Input type="date" min={trip.start_date} max={trip.end_date} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                  <CostInput form={form} setForm={setForm} />
                </>
              )}

              {form.type === "resting_day" && (
                <>
                  <div>
                    <Label>Reason</Label>
                    <Select value={form.resting_type} onValueChange={(v) => setForm({ ...form, resting_type: v, title: RESTING_TYPES.find((r) => r.value === v)?.label ?? "" })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{RESTING_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">No other activities will be scheduled for this day.</p>
                </>
              )}

              {form.type === "other" && (
                <>
                  <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="British Council meeting" /></div>
                  <TimeRange form={form} setForm={setForm} />
                  <div>
                    <Label>Linked agent</Label>
                    <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Pick an agent" /></SelectTrigger>
                      <SelectContent>{agents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.trading_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Linked school</Label>
                    <Select value={form.school_id} onValueChange={(v) => setForm({ ...form, school_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Pick a school" /></SelectTrigger>
                      <SelectContent>{schools?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Location / venue</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                  <CostInput form={form} setForm={setForm} />
                </>
              )}


              <div>
                <Label>Objectives</Label>
                <Textarea
                  value={form.objectives}
                  onChange={(e) => setForm({ ...form, objectives: e.target.value })}
                  placeholder="What you plan to achieve (e.g. discuss September intake, sign new agreement)"
                />
              </div>
              <div>
                <Label>Notes during visit</Label>
                <Textarea
                  value={form.visit_notes}
                  onChange={(e) => setForm({ ...form, visit_notes: e.target.value })}
                  placeholder="Observations, outcomes, follow-ups — used by the AI trip report"
                />
              </div>

              {validationMessage && (
                <p className="text-xs text-muted-foreground">{validationMessage}</p>
              )}
              {(() => {
                const outOfRange =
                  (selectedDay && (selectedDay < trip.start_date || selectedDay > trip.end_date)) ||
                  (form.end_date && (form.end_date < trip.start_date || form.end_date > trip.end_date));
                return (
                  <Button
                    onClick={() => {
                      if (validationMessage) { toast.error(validationMessage); return; }
                      if (!form.objectives?.trim()) {
                        const ok = window.confirm("No objectives added for this activity. Save without objectives?");
                        if (!ok) return;
                      }
                      create.mutate();
                    }}

                    disabled={create.isPending || !!outOfRange}
                    className="w-full"
                  >
                    {editingActivityId ? "Save changes" : "Add activity"}
                  </Button>
                );
              })()}
            </div>
          );

          return (
            <>
              <div className="hidden lg:block lg:col-span-1" ref={editorRef}>
                <Card className="p-5 lg:sticky lg:top-4 scroll-mt-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
                  {editorBody}
                </Card>

              </div>
              {!isLgUp && (
                <Dialog
                  open={!!selectedDay}
                  onOpenChange={(o) => { if (!o) { setSelectedDay(null); setEditingActivityId(null); setForm(emptyForm); } }}
                >
                  <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingActivityId ? "Edit activity" : "New activity"} — {selectedDay ? fmtDate(selectedDay) : ""}</DialogTitle>
                    </DialogHeader>
                    {selectedDay && editorBody}
                  </DialogContent>
                </Dialog>
              )}
            </>
          );
        })()}
      </div>

      <Dialog open={hotelDialogOpen} onOpenChange={(o) => { setHotelDialogOpen(o); if (!o) setHotelForm(emptyHotel); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{hotelForm.id ? "Edit hotel" : "Add hotel"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" /> Search Booking.com
              </div>
              <div className="flex gap-2">
                <Input
                  value={hotelSearchQuery}
                  onChange={(e) => setHotelSearchQuery(e.target.value)}
                  placeholder="City or hotel name (e.g. Bangkok, Hilton Dubai)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (async () => {
                        if (!hotelForm.check_in_date || !hotelForm.check_out_date) {
                          toast.error("Set check-in and check-out dates first");
                          return;
                        }
                        setHotelSearching(true);
                        try {
                          const res = await searchHotelsFn({ data: { query: hotelSearchQuery, checkIn: hotelForm.check_in_date, checkOut: hotelForm.check_out_date, currency: hotelForm.cost_currency || "GBP" } });
                          setHotelSearchResults(res);
                          if (res.length === 0) toast.info("No hotels found");
                        } catch (err: any) {
                          toast.error(err?.message ?? "Search failed");
                        } finally {
                          setHotelSearching(false);
                        }
                      })();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={hotelSearching || !hotelSearchQuery.trim()}
                  onClick={async () => {
                    if (!hotelForm.check_in_date || !hotelForm.check_out_date) {
                      toast.error("Set check-in and check-out dates first");
                      return;
                    }
                    setHotelSearching(true);
                    try {
                      const res = await searchHotelsFn({ data: { query: hotelSearchQuery, checkIn: hotelForm.check_in_date, checkOut: hotelForm.check_out_date, currency: hotelForm.cost_currency || "GBP" } });
                      setHotelSearchResults(res);
                      if (res.length === 0) toast.info("No hotels found");
                    } catch (err: any) {
                      toast.error(err?.message ?? "Search failed");
                    } finally {
                      setHotelSearching(false);
                    }
                  }}
                >
                  {hotelSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
              </div>
              {hotelSearchResults && hotelSearchResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {hotelSearchResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="w-full text-left rounded-md border bg-background p-2 hover:bg-accent hover:border-primary transition-colors"
                      onClick={() => {
                        setHotelForm({
                          ...hotelForm,
                          name: r.name,
                          address: r.address || `${r.city}${r.country ? ", " + r.country : ""}`,
                          formatted_address: r.address || `${r.city}${r.country ? ", " + r.country : ""}`,
                          lat: r.lat,
                          lng: r.lng,
                          cost: r.price != null ? String(r.price) : hotelForm.cost,
                          cost_currency: r.currency || hotelForm.cost_currency,
                          map_url:
                            r.lat != null && r.lng != null
                              ? `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`
                              : hotelForm.map_url,
                        });
                        setHotelSearchResults(null);
                        setHotelSearchQuery("");
                        toast.success("Hotel details filled");
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{r.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.city}{r.country ? `, ${r.country}` : ""}</div>
                          {r.review_score != null && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Star className="h-3 w-3 fill-gold text-gold" /> {r.review_score.toFixed(1)}
                              {r.review_count ? ` (${r.review_count})` : ""}
                            </div>
                          )}
                        </div>
                        {r.price != null && (
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold">{r.currency} {r.price}</div>
                            <div className="text-[10px] text-muted-foreground">total stay</div>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Set check-in / check-out dates below, then search. Click a result to fill the form.</p>
            </div>
            <div>
              <Label>Hotel name</Label>
              <Input value={hotelForm.name} onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })} placeholder="Hilton Bangkok" />
            </div>
            <AddressAutocomplete
              label="Hotel address"
              placeholder="Search for the hotel…"
              value={{
                address: hotelForm.address,
                place_id: hotelForm.place_id || null,
                lat: hotelForm.lat,
                lng: hotelForm.lng,
                formatted_address: hotelForm.formatted_address || null,
              }}
              onChange={(v) => setHotelForm({
                ...hotelForm,
                address: v.address,
                place_id: v.place_id ?? "",
                lat: v.lat,
                lng: v.lng,
                formatted_address: v.formatted_address ?? "",
                map_url: v.place_id
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.formatted_address || v.address)}&query_place_id=${encodeURIComponent(v.place_id)}`
                  : v.lat != null && v.lng != null
                  ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`
                  : hotelForm.map_url,
              })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Check-in date</Label><Input type="date" min={trip.start_date} max={trip.end_date} value={hotelForm.check_in_date} onChange={(e) => setHotelForm({ ...hotelForm, check_in_date: e.target.value })} /></div>
              <div><Label>Check-in time</Label><Input type="time" value={hotelForm.check_in_time} onChange={(e) => setHotelForm({ ...hotelForm, check_in_time: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Check-out date</Label><Input type="date" min={trip.start_date} max={trip.end_date} value={hotelForm.check_out_date} onChange={(e) => setHotelForm({ ...hotelForm, check_out_date: e.target.value })} /></div>
              <div><Label>Check-out time</Label><Input type="time" value={hotelForm.check_out_time} onChange={(e) => setHotelForm({ ...hotelForm, check_out_time: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div><Label>Cost</Label><Input type="number" inputMode="decimal" value={hotelForm.cost} onChange={(e) => setHotelForm({ ...hotelForm, cost: e.target.value })} placeholder="0.00" /></div>
              <div><Label>Currency</Label><Input value={hotelForm.cost_currency} onChange={(e) => setHotelForm({ ...hotelForm, cost_currency: e.target.value.toUpperCase() })} maxLength={3} /></div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={hotelForm.notes} onChange={(e) => setHotelForm({ ...hotelForm, notes: e.target.value })} placeholder="Booking ref, room type…" />
            </div>
            {(() => {
              const hotelOutOfRange =
                (hotelForm.check_in_date && (hotelForm.check_in_date < trip.start_date || hotelForm.check_in_date > trip.end_date)) ||
                (hotelForm.check_out_date && (hotelForm.check_out_date < trip.start_date || hotelForm.check_out_date > trip.end_date));
              const checkoutBeforeIn = hotelForm.check_in_date && hotelForm.check_out_date && hotelForm.check_out_date < hotelForm.check_in_date;
              const blocked = !!(hotelOutOfRange || checkoutBeforeIn);
              return (
                <>
                  {hotelOutOfRange && (
                    <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      Hotel dates must be within the trip range ({trip.start_date} → {trip.end_date}).
                    </div>
                  )}
                  {checkoutBeforeIn && (
                    <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      Check-out must be on or after check-in.
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => saveHotel.mutate()} disabled={saveHotel.isPending || blocked} className="flex-1">
                      {hotelForm.id ? "Save changes" : "Add hotel"}
                    </Button>
                    {hotelForm.id && (
                      <Button variant="outline" onClick={() => deleteHotel.mutate(hotelForm.id!)} disabled={deleteHotel.isPending}>
                        <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete
                      </Button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

    </PageContainer>

  );
}

function TimeRange({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div><Label>Time from</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
      <div><Label>Time to</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
    </div>
  );
}

function CostInput({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="grid grid-cols-[1fr_120px] gap-3">
      <div><Label>Cost</Label><Input type="number" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0.00" /></div>
      <div><Label>Currency</Label><Input value={form.cost_currency} onChange={(e) => setForm({ ...form, cost_currency: e.target.value.toUpperCase() })} maxLength={3} /></div>
    </div>
  );
}

function defaultTitle(f: FormState, branches: any, schools: any, agents: any): string {
  switch (f.type) {
    case "travel": {
      const isAir = f.transport_mode === "Air travel";
      const from = isAir
        ? [f.from_country, f.from_city].filter(Boolean).join(" — ")
        : f.from_city;
      const to = isAir
        ? [f.to_country, f.to_city].filter(Boolean).join(" — ")
        : f.to_city;
      if (from && to) return `${from} → ${to}`;
      return f.transport_mode || "Travel";
    }
    case "agent_visit": {
      const b = branches?.find((x: any) => x.id === f.branch_id);
      if (!b) return "Agent visit";
      const agentName = b.agents?.trading_name ?? agents?.find((a: any) => a.id === (b.agent_id ?? f.agent_id))?.trading_name;
      return `${agentName ? `${agentName} — ` : ""}${b.branch_name}`;
    }
    case "school_visit": {
      const s = schools?.find((x: any) => x.id === f.school_id);
      return s ? `Visit ${s.name}` : "School visit";
    }
    case "recruitment_event": return "Recruitment event";
    case "hotel": return f.title || "Hotel stay";
    case "resting_day": return RESTING_TYPES.find((r) => r.value === f.resting_type)?.label ?? "Resting day";
    default: return "Activity";
  }
}

function isFormValid(f: FormState): boolean {
  return validateForm(f) === null;
}

function validateForm(f: FormState): string | null {
  switch (f.type) {
    case "travel":
      if (!f.transport_mode) return "Pick a transport mode.";
      if (!f.from_city) return "Enter the departure city.";
      if (!f.to_city) return "Enter the arrival city.";
      return null;
    case "agent_visit": return (f.branch_id || f.title) ? null : "Pick a branch or type a branch name.";
    case "school_visit": return f.school_id ? null : "Pick a school to visit.";
    case "recruitment_event": return f.title ? null : "Enter an event title.";
    case "hotel": return f.title ? null : "Enter the hotel name.";
    case "resting_day": return f.resting_type ? null : "Pick a reason for the resting day.";
    case "other": return f.title ? null : "Enter a title for the activity.";
    default: return "Pick an activity type.";
  }
}

function FlightLookupButton({ form, setForm, selectedDay }: { form: FormState; setForm: (f: FormState) => void; selectedDay: string | null }) {
  const lookup = useServerFn(lookupFlight);
  const [loading, setLoading] = useState(false);
  const canLookup = !!form.flight_number?.trim() && !!selectedDay;

  const onClick = async () => {
    if (!canLookup) {
      toast.error(!form.flight_number?.trim() ? "Enter a flight number first" : "Select a day for this activity first");
      return;
    }
    setLoading(true);
    try {
      const r = await lookup({ data: { flightNumber: form.flight_number, date: selectedDay! } });
      setForm({
        ...form,
        airline: r.airline || form.airline,
        flight_number: r.flight_number || form.flight_number,
        from_city: r.from_city || form.from_city,
        from_country: r.from_country || form.from_country,
        to_city: r.to_city || form.to_city,
        to_country: r.to_country || form.to_country,
        start_time: r.start_time || form.start_time,
        end_time: r.end_time || form.end_time,
        end_date: r.end_date || form.end_date,
      });
      toast.success("Flight details loaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Flight lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={loading || !canLookup}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
    </Button>
  );
}
