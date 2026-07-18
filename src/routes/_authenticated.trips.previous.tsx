import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plane } from "lucide-react";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/trips/previous")({
  head: () => ({ meta: [{ title: "Previous Cycles Activities — Orbis CRM" }] }),
  component: PreviousTripsPage,
});

function PreviousTripsPage() {
  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips", "archived"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("archived", true)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Group by archived cycle label if available, else by year of start_date
  const groups = (() => {
    const map = new Map<string, any[]>();
    for (const t of trips ?? []) {
      const key = t.archived_cycle_label || (t.start_date ? new Date(t.start_date).getFullYear().toString() : "Unknown");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  })();

  return (
    <PageContainer>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/trips"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Trips</Link>
        </Button>
      </div>
      <PageHeader
        title="Previous Cycles Activities"
        description="Itineraries from past recruitment cycles (read-only)."
      />

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (trips ?? []).length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No archived trips yet. Trips get archived automatically when a recruitment cycle ends.
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map(([label, items]) => (
            <section key={label}>
              <h2 className="text-lg font-semibold text-primary mb-3">{label}</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {items.map((t) => (
                  <Link
                    key={t.id}
                    to="/trips/$tripId"
                    params={{ tripId: t.id }}
                    className="block"
                  >
                    <Card className="p-4 hover:border-primary transition-colors h-full">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Plane className="h-4 w-4 text-primary shrink-0" />
                          <div className="font-medium truncate">{t.title || "Untitled trip"}</div>
                        </div>
                        {t.status && <Badge variant="secondary" className="shrink-0">{t.status}</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {fmtDate(t.start_date)} → {fmtDate(t.end_date)}
                      </div>
                      {t.country && (
                        <div className="text-xs text-muted-foreground mt-1">{t.country}</div>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
