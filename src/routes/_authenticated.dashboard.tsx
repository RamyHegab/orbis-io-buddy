import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plane, Users, GraduationCap, CalendarDays, FileBarChart, Filter, X, Search } from "lucide-react";
import { fmtDate, ACTIVITY_TYPE_LABELS, ACTIVITY_DOT_COLORS } from "@/lib/format";
import { DiscoveryBanner } from "@/components/discovery-banner";
import { WorldMap, normalizeCountry, type CountryStats } from "@/components/world-map";
import { UpcomingChecklist } from "@/components/upcoming-checklist";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Orbis CRM" }] }),
  component: Dashboard,
});

function CountryFilter({
  options,
  value,
  onChange,
  displayMap,
}: {
  options: string[];
  value?: string;
  onChange: (v: string) => void;
  displayMap?: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const label = (k: string) => displayMap?.[k] ?? k;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => label(o).toLowerCase().includes(q) || o.toLowerCase().includes(q));
  }, [query, options, displayMap]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search country..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>
      <div className="max-h-52 overflow-y-auto space-y-0.5">
        <button
          onClick={() => {
            onChange("all");
            setQuery("");
          }}
          className={`w-full text-left px-2 py-1.5 rounded text-sm capitalize transition-colors ${
            value === "all"
              ? "bg-primary/10 text-primary font-medium"
              : "hover:bg-muted"
          }`}
        >
          All countries
        </button>
        {filtered.map((o) => (
          <button
            key={o}
            onClick={() => {
              onChange(o);
              setQuery("");
            }}
            className={`w-full text-left px-2 py-1.5 rounded text-sm capitalize transition-colors ${
              value === o
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted"
            }`}
          >
            {label(o)}
          </button>
        ))}
        {filtered.length === 0 && query.trim() && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No countries found
          </div>
        )}
      </div>
      {value !== "all" && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            onChange("all");
            setQuery("");
          }}
        >
          <X className="h-3.5 w-3.5 mr-1" /> Clear filter
        </Button>
      )}
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data: profile } = useQuery({
    enabled: !!uid,
    queryKey: ["profile", uid],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", uid!).maybeSingle();
      return data;
    },
  });

  const firstName = (profile?.full_name?.split(" ")[0]) || user?.email?.split("@")[0] || "";
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const greeting = firstName ? `${timeGreeting}, ${firstName} 👋` : `${timeGreeting} 👋`;
  const subtitle = `Welcome back${firstName ? `, ${firstName}` : ""} — here's your recruitment pipeline at a glance.`;

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
        supabase.from("agents").select("id, hq_country, countries_of_operation"),
        supabase.from("agent_branches").select("agent_id, country"),
        supabase.from("schools").select("country"),
        supabase.from("trips").select("destinations, end_date"),
      ]);

      // Preserve original casing per normalized key (first seen wins).
      const display: Record<string, string> = {};
      const remember = (raw: string) => {
        const k = normalizeCountry(raw);
        if (!k) return k;
        if (!display[k]) display[k] = raw.trim();
        return k;
      };

      const agentCountries: Record<string, Set<string>> = {};
      for (const a of agentsRes.data ?? []) {
        if (a.hq_country) {
          const k = remember(a.hq_country);
          (agentCountries[k] ??= new Set()).add(a.id);
        }
        for (const c of (a.countries_of_operation as string[] | null) ?? []) {
          if (!c) continue;
          const k = remember(c);
          (agentCountries[k] ??= new Set()).add(a.id);
        }
      }
      for (const b of branchesRes.data ?? []) {
        if (!b.country || !b.agent_id) continue;
        const k = remember(b.country);
        (agentCountries[k] ??= new Set()).add(b.agent_id);
      }

      const stats: Record<string, CountryStats> = {};
      for (const [k, ids] of Object.entries(agentCountries)) {
        (stats[k] ??= { agents: 0, schools: 0, trips: 0 }).agents = ids.size;
      }
      for (const s of schoolsRes.data ?? []) {
        if (!s.country) continue;
        const k = remember(s.country);
        (stats[k] ??= { agents: 0, schools: 0, trips: 0 }).schools += 1;
      }
      const today = new Date().toISOString().slice(0, 10);
      for (const t of tripsRes.data ?? []) {
        if (!t.end_date || t.end_date > today) continue;
        for (const d of t.destinations ?? []) {
          if (!d) continue;
          const k = remember(d);
          (stats[k] ??= { agents: 0, schools: 0, trips: 0 }).trips += 1;
        }
      }
      return { stats, display };
    },
  });

  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");

  const statsMap = countryStats?.stats ?? {};
  const displayMap = countryStats?.display ?? {};

  const agentCountryOptions = useMemo(
    () =>
      Object.entries(statsMap)
        .filter(([, v]) => v.agents > 0)
        .map(([k]) => k)
        .sort((a, b) => (displayMap[a] ?? a).localeCompare(displayMap[b] ?? b)),
    [statsMap, displayMap],
  );
  const schoolCountryOptions = useMemo(
    () =>
      Object.entries(statsMap)
        .filter(([, v]) => v.schools > 0)
        .map(([k]) => k)
        .sort((a, b) => (displayMap[a] ?? a).localeCompare(displayMap[b] ?? b)),
    [statsMap, displayMap],
  );

  const agentValue =
    agentFilter === "all"
      ? stats?.agents ?? 0
      : statsMap[agentFilter]?.agents ?? 0;
  const schoolValue =
    schoolFilter === "all"
      ? stats?.schools ?? 0
      : statsMap[schoolFilter]?.schools ?? 0;

  const cards = [
    {
      label: "Agents",
      value: agentValue,
      icon: Users,
      to: "/agents",
      filter: agentFilter,
      setFilter: setAgentFilter,
      options: agentCountryOptions,
    },
    {
      label: "Schools",
      value: schoolValue,
      icon: GraduationCap,
      to: "/schools",
      filter: schoolFilter,
      setFilter: setSchoolFilter,
      options: schoolCountryOptions,
    },
    { label: "Trips", value: stats?.trips ?? 0, icon: Plane, to: "/trips" as const },
    { label: "Activities", value: stats?.activities ?? 0, icon: CalendarDays, to: "/trips" as const },
  ] as Array<{
    label: string;
    value: number;
    icon: typeof Users;
    to: string;
    filter?: string;
    setFilter?: (v: string) => void;
    options?: string[];
  }>;

  return (
    <PageContainer>
      <PageHeader title={greeting} description={subtitle} />

      <DiscoveryBanner />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label} className="p-5 hover:shadow-md transition-shadow relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <div className="flex items-center gap-1">
                {c.setFilter && c.options && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Filter ${c.label} by country`}
                      >
                        <Filter
                          className={`h-3.5 w-3.5 ${
                            c.filter !== "all" ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-3 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Filter {c.label.toLowerCase()} by country
                      </div>
                      <CountryFilter
                        options={c.options}
                        value={c.filter}
                        onChange={c.setFilter}
                        displayMap={displayMap}
                      />
                    </PopoverContent>
                  </Popover>
                )}
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <Link to={c.to as any} className="block">
              <div className="text-3xl font-semibold tracking-tight">{c.value}</div>
              {c.filter && c.filter !== "all" && (
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  in {displayMap[c.filter] ?? c.filter}
                </div>
              )}
            </Link>
          </Card>
        ))}
      </div>


      <div className="grid lg:grid-cols-[2fr_1fr] gap-6 mb-6 lg:h-[420px]">
        <Card className="p-4 border-2 border-primary/80 h-full overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-2 px-1 shrink-0">
            <h2 className="font-semibold">Global footprint</h2>
            <Link to="/reports">
              <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90">
                <FileBarChart className="h-3.5 w-3.5 mr-1.5" /> Create Report
              </Button>
            </Link>
          </div>
          <div className="flex-1 overflow-hidden">
            <WorldMap data={statsMap} />
          </div>
        </Card>
        <UpcomingChecklist trip={upcomingTrip as any} />
      </div>

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
