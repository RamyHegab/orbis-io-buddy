import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-auth";
import { CURRENCY_OPTIONS, currencySymbol } from "@/lib/currency";
import { toast } from "sonner";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Orbis CRM" }] }),
  component: SettingsPage,
});

function fixDateYear(d: string): string {
  const m = d?.match(/^(\d{1,4})-(\d{2})-(\d{2})$/);
  if (!m) return d;
  const y = Number(m[1]);
  if (y >= 2000 && y <= 2099) return d;
  const corrected = y < 100 ? y + 2000 : 2000 + (y % 100);
  return `${String(corrected).padStart(4, "0")}-${m[2]}-${m[3]}`;
}

function hasBadYear(d: string): boolean {
  if (!d) return false;
  const y = Number(d.slice(0, 4));
  return !Number.isFinite(y) || y < 2000 || y > 2099;
}

function SettingsPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();

  const { data: scan, refetch, isFetching } = useQuery({
    enabled: isAdmin,
    queryKey: ["trip-date-scan"],
    queryFn: async () => {
      const { data: trips } = await supabase.from("trips").select("id, title, start_date, end_date");
      const { data: legs } = await supabase.from("trip_countries").select("id, trip_id, country, start_date, end_date");
      const badTrips = (trips ?? []).filter((t: any) => hasBadYear(t.start_date) || hasBadYear(t.end_date));
      const badLegs = (legs ?? []).filter((l: any) => hasBadYear(l.start_date) || hasBadYear(l.end_date));
      const tripIds = new Set([...badTrips.map((t: any) => t.id), ...badLegs.map((l: any) => l.trip_id)]);
      const allTrips = trips ?? [];
      const items = Array.from(tripIds).map((id) => {
        const trip = allTrips.find((t: any) => t.id === id);
        const tripLegs = (legs ?? []).filter((l: any) => l.trip_id === id);
        return { trip, legs: tripLegs };
      });
      return items;
    },
  });

  const fixOne = useMutation({
    mutationFn: async (item: any) => {
      if (item.trip && (hasBadYear(item.trip.start_date) || hasBadYear(item.trip.end_date))) {
        const { error } = await supabase.from("trips").update({
          start_date: fixDateYear(item.trip.start_date),
          end_date: fixDateYear(item.trip.end_date),
        }).eq("id", item.trip.id);
        if (error) throw error;
      }
      for (const l of item.legs) {
        if (hasBadYear(l.start_date) || hasBadYear(l.end_date)) {
          const { error } = await supabase.from("trip_countries").update({
            start_date: fixDateYear(l.start_date),
            end_date: fixDateYear(l.end_date),
          }).eq("id", l.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Trip fixed");
      qc.invalidateQueries({ queryKey: ["trip-date-scan"] });
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fixAll = useMutation({
    mutationFn: async () => {
      for (const item of scan ?? []) {
        await fixOne.mutateAsync(item);
      }
    },
    onSuccess: () => toast.success("All trips fixed"),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Workspace, team, and integration preferences."
      />

      {isAdmin && <AccountSettingsCard />}
      {isAdmin && <BrandingCard />}




      {isAdmin && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Data maintenance — Trip dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Scan for trips whose start or end date has an invalid year (outside 2000–2099). The auto-fix converts 2-digit years to the 2000s.
              </p>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                  Re-scan
                </Button>
                {scan && scan.length > 0 && (
                  <Button size="sm" onClick={() => fixAll.mutate()} disabled={fixAll.isPending}>
                    Fix all ({scan.length})
                  </Button>
                )}
              </div>
            </div>
            {scan && scan.length === 0 ? (
              <p className="text-sm text-emerald-600">✓ No trips with invalid years.</p>
            ) : (
              <ul className="space-y-2">
                {(scan ?? []).map((item: any) => (
                  <li key={item.trip?.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.trip?.title ?? "(missing trip)"}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.trip?.start_date} → {item.trip?.end_date}
                        {item.legs.length > 0 && ` • ${item.legs.length} leg(s)`}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => fixOne.mutate(item)} disabled={fixOne.isPending}>
                      Fix year
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Manage team members, roles, and branding from this page.
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function AccountSettingsCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("cycle_start_month, cycle_start_year, cycle_end_month, cycle_end_year, currency")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
  });

  const [sm, setSm] = useState(9);
  const [sy, setSy] = useState(new Date().getFullYear());
  const [em, setEm] = useState(8);
  const [ey, setEy] = useState(new Date().getFullYear() + 1);
  const [currency, setCurrency] = useState("GBP");

  useEffect(() => {
    if (!data) return;
    setSm(data.cycle_start_month);
    setSy(data.cycle_start_year);
    setEm(data.cycle_end_month);
    setEy(data.cycle_end_year);
    setCurrency(data.currency || "GBP");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        id: 1,
        cycle_start_month: sm,
        cycle_start_year: sy,
        cycle_end_month: em,
        cycle_end_year: ey,
        currency,
      };
      const { error } = await supabase.from("app_settings").upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account settings saved");
      qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Account — Recruitment cycle & currency</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-1 block">Recruitment cycle</Label>
          <p className="text-xs text-muted-foreground mb-2">
            The cycle year used across Planning, Trips and Archive. A cycle spans from its start month/year to its end month/year (not the calendar year).
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Start month</Label>
              <Select value={String(sm)} onValueChange={(v) => setSm(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Start year</Label>
              <Input type="number" value={sy} onChange={(e) => setSy(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">End month</Label>
              <Select value={String(em)} onValueChange={(v) => setEm(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">End year</Label>
              <Input type="number" value={ey} onChange={(e) => setEy(Number(e.target.value))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Current cycle label: <span className="font-medium text-foreground">{sy}–{ey}</span>
          </p>
        </div>

        <div>
          <Label className="mb-1 block">Account currency</Label>
          <p className="text-xs text-muted-foreground mb-2">Used to display cost totals across the app.</p>
          <div className="flex items-center gap-3">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{currencySymbol(c)} {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">Preview: {currencySymbol(currency)}1,234.00</span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
