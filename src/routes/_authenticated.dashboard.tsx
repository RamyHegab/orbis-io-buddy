import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, Users, GraduationCap, CalendarDays, FileBarChart } from "lucide-react";
import { fmtDate, ACTIVITY_TYPE_LABELS, ACTIVITY_DOT_COLORS } from "@/lib/format";
import { DiscoveryBanner } from "@/components/discovery-banner";
import { WorldMap, normalizeCountry, type CountryStats } from "@/components/world-map";
import { UpcomingChecklist } from "@/components/upcoming-checklist";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Orbis CRM" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data: stats } = useQuery({
    enabled: !!uid,
    queryKey: ["stats", uid],
    queryFn: async () => {
      const [agents, schools, trips, activities] = await Promise.all([
        supabase.from("agents").select("id", { count: "exact", head: true }),
        supabase.from("schools").select("id", { count: "exact", head: true }),
        supabase.from("trips").select("id", { count: "exact", head: true }),
        supabase.from("activities").select("id", { count: "exact", head: true }),
      ]);
      return {
        agents: agents.count ?? 0,
        schools: schools.count ?? 0,
        trips: trips.count ?? 0,
        activities: activities.count ?? 0,
      };
    },
  });

  const { data: upcomingTrip } = useQuery({
    enabled: !!uid,
    queryKey: ["upcoming-trip", uid],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("trips")
        .select("id, title, start_date, end_date, destinations, checklist, status")
        .gte("end_date", today)
        .eq("status", "confirmed")
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: todayActivities } = useQuery({
    enabled: !!uid,
    queryKey: ["today-activities", uid],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("activities")
        .select("*, agents(trading_name), schools(name)")
        .eq("day_date", today)
        .order("start_time");
      return data ?? [];
    },
  });

  const { data: countryStats } = useQuery({
    enabled: !!uid,
    queryKey: ["country-stats", uid],
    queryFn: async () => {
      const [agentsRes, branchesRes, schoolsRes, tripsRes] = await Promise.all([
        supabase.from("agents").select("id, hq_country"),
        supabase.from("agent_branches").select("agent_id, country"),
        supabase.from("schools").select("country"),
        supabase.from("trips").select("destinations, end_date"),
      ]);

      const agentCountries: Record<string, Set<string>> = {};
      for (const a of agentsRes.data ?? []) {
        if (!a.hq_country) continue;
        const k = normalizeCountry(a.hq_country);
        (agentCountries[k] ??= new Set()).add(a.id);
      }
      for (const b of branchesRes.data ?? []) {
        if (!b.country || !b.agent_id) continue;
        const k = normalizeCountry(b.country);
        (agentCountries[k] ??= new Set()).add(b.agent_id);
      }

      const stats: Record<string, CountryStats> = {};
      for (const [k, ids] of Object.entries(agentCountries)) {
        (stats[k] ??= { agents: 0, schools: 0, trips: 0 }).agents = ids.size;
      }
      for (const s of schoolsRes.data ?? []) {
        if (!s.country) continue;
        const k = normalizeCountry(s.country);
        (stats[k] ??= { agents: 0, schools: 0, trips: 0 }).schools += 1;
      }
      const today = new Date().toISOString().slice(0, 10);
      for (const t of tripsRes.data ?? []) {
        if (!t.end_date || t.end_date > today) continue;
        for (const d of t.destinations ?? []) {
          if (!d) continue;
          const k = normalizeCountry(d);
          (stats[k] ??= { agents: 0, schools: 0, trips: 0 }).trips += 1;
        }
      }
      return stats;
    },
  });

  const cards = [
    { label: "Agents", value: stats?.agents ?? 0, icon: Users, to: "/agents" },
    { label: "Schools", value: stats?.schools ?? 0, icon: GraduationCap, to: "/schools" },
    { label: "Trips", value: stats?.trips ?? 0, icon: Plane, to: "/trips" },
    { label: "Activities", value: stats?.activities ?? 0, icon: CalendarDays, to: "/trips" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome${user?.email ? `, ${user.email.split("@")[0]}` : ""}`}
        description="Your recruitment pipeline at a glance."
        actions={
          <Link to="/reports">
            <Button className="bg-gold text-gold-foreground hover:bg-gold/90">
              <FileBarChart className="h-4 w-4 mr-2" /> Create Report
            </Button>
          </Link>
        }
      />

      <DiscoveryBanner />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Link key={c.label} to={c.to as any} className="block">
            <Card className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-semibold tracking-tight">{c.value}</div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="p-4 mb-6 border-2 border-primary/80">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="font-semibold">Global footprint</h2>
          <span className="text-xs text-muted-foreground">
            Hover a country for agents, schools & completed trips
          </span>
        </div>
        <WorldMap data={countryStats ?? {}} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">

        <Card className="p-6">
          <h2 className="font-semibold mb-1">Next trip</h2>
          {upcomingTrip ? (
            <Link to="/trips/$tripId" params={{ tripId: upcomingTrip.id }} className="block group">
              <div className="text-lg font-medium group-hover:text-primary transition-colors mt-2">
                {upcomingTrip.title}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {fmtDate(upcomingTrip.start_date)} – {fmtDate(upcomingTrip.end_date)}
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {upcomingTrip.destinations?.map((d: string) => (
                  <Badge key={d} variant="secondary">{d}</Badge>
                ))}
              </div>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              No upcoming trips. <Link to="/trips" className="text-primary hover:underline">Create one</Link>.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-3">Today's activities</h2>
          {todayActivities && todayActivities.length > 0 ? (
            <ul className="space-y-3">
              {todayActivities.map((a: any) => (
                <li key={a.id} className="flex items-start gap-3">
                  <div className={`mt-1.5 h-2 w-2 rounded-full ${ACTIVITY_DOT_COLORS[a.type]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {ACTIVITY_TYPE_LABELS[a.type]}
                      {a.start_time && ` • ${a.start_time.slice(0, 5)}`}
                      {a.location && ` • ${a.location}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing scheduled today.</p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
