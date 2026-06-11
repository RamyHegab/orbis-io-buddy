import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate } from "@/lib/format";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateTripReport } from "@/lib/trip-report.functions";

export const Route = createFileRoute("/_authenticated/trips/$tripId/report")({
  component: TripReportPage,
});

function TripReportPage() {
  const { tripId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const generate = useServerFn(generateTripReport);
  const [generating, setGenerating] = useState(false);

  const { data: trip } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => (await supabase.from("trips").select("*").eq("id", tripId).maybeSingle()).data,
  });

  const { data: latest } = useQuery({
    queryKey: ["report", tripId],
    queryFn: async () => (await supabase.from("trip_reports").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data,
  });

  const runGenerate = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      setGenerating(true);
      const result = await generate({ data: { tripId } });
      setGenerating(false);
      return result;
    },
    onSuccess: () => {
      toast.success("Report generated");
      qc.invalidateQueries({ queryKey: ["report", tripId] });
    },
    onError: (e: any) => {
      setGenerating(false);
      toast.error(e.message ?? "Failed to generate report");
    },
  });

  if (!trip) return <PageContainer><p className="text-muted-foreground">Loading…</p></PageContainer>;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/trips/$tripId", params: { tripId } })} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to trip
      </Button>
      <PageHeader
        title="Trip Report"
        description={`${trip.title} • ${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date)}`}
        actions={
          <Button onClick={() => runGenerate.mutate()} disabled={generating}>
            {generating ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {latest ? "Regenerate" : "Generate report"}
          </Button>
        }
      />

      {latest ? (
        <Card className="p-8">
          <div className="text-xs text-muted-foreground mb-4">
            Generated {new Date(latest.created_at).toLocaleString()} {latest.model && `• ${latest.model}`}
          </div>
          <div className="prose prose-sm max-w-none prose-headings:tracking-tight prose-p:text-foreground">
            <ReactMarkdown>{latest.content_md}</ReactMarkdown>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No report yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate an AI summary of all activities, comments, and form submissions on this trip.
          </p>
        </Card>
      )}
    </PageContainer>
  );
}
