import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { discoverBranchesForAllAgents } from "@/lib/branch-discovery.functions";

export function DiscoveryBanner() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const fn = useServerFn(discoverBranchesForAllAgents);
  const [running, setRunning] = useState(false);

  const { data } = useQuery({
    enabled: !!user && isAdmin,
    queryKey: ["discovery-banner", user?.id],
    queryFn: async () => {
      const [{ count }, { data: prof }] = await Promise.all([
        supabase.from("agents").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("discovery_banner_dismissed_at").eq("id", user!.id).maybeSingle(),
      ]);
      return { agents: count ?? 0, dismissed: !!prof?.discovery_banner_dismissed_at };
    },
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      await supabase.from("profiles").update({ discovery_banner_dismissed_at: new Date().toISOString() }).eq("id", user!.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discovery-banner"] }),
  });

  if (!user || !isAdmin || !data || data.agents === 0 || data.dismissed) return null;

  const run = async () => {
    setRunning(true);
    toast.info(`Searching the web for branches across ${data.agents} agent${data.agents === 1 ? "" : "s"}…`);
    try {
      const res = (await fn()) as { found: number; processed: number };
      toast.success(`Found ${res.found} candidates across ${res.processed} agents — review in Inbox.`);
      qc.invalidateQueries({ queryKey: ["pending_submissions"] });
      dismiss.mutate();
    } catch (e: any) {
      toast.error(e.message ?? "Bulk discovery failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="p-4 mb-6 border-primary/40 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2 shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium">Auto-discover branches for your agents</div>
          <p className="text-sm text-muted-foreground mt-0.5">
            We'll search each agent's website and the web for branch offices, then drop the candidates in your Inbox for review. Nothing is added until you approve.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={run} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Discover for {data.agents} agent{data.agents === 1 ? "" : "s"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dismiss.mutate()}>Not now</Button>
          </div>
        </div>
        <button onClick={() => dismiss.mutate()} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
